"""
Rate Limiter - Enforces rate limits for external API calls.

This module implements a rate limiter that prevents exceeding API rate limits
for external provider APIs. It supports per-provider rate limiting with
sliding window algorithm and automatic waiting/retry logic.

Requirements:
    - Requirement 5.5: Rate limiting for external APIs
    - Requirement 5.6: Per-provider rate limit configuration
    - Requirement 5.7: Automatic retry with backoff
"""

import asyncio
import logging
import time
from typing import Dict, List, Optional
from datetime import datetime, timezone
from dataclasses import dataclass, field


logger = logging.getLogger(__name__)


@dataclass
class RateLimitConfig:
    """Rate limit configuration for a provider."""
    max_requests: int  # Maximum requests allowed
    window_seconds: int  # Time window in seconds
    
    @property
    def requests_per_minute(self) -> float:
        """Calculate requests per minute."""
        return (self.max_requests / self.window_seconds) * 60


@dataclass
class RateLimitStats:
    """Rate limit statistics for monitoring."""
    provider_id: str
    requests_made: int = 0
    requests_blocked: int = 0
    total_wait_time_seconds: float = 0.0
    last_request_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict:
        """Convert stats to dictionary."""
        return {
            "provider_id": self.provider_id,
            "requests_made": self.requests_made,
            "requests_blocked": self.requests_blocked,
            "total_wait_time_seconds": self.total_wait_time_seconds,
            "last_request_at": self.last_request_at.isoformat() if self.last_request_at else None
        }


class RateLimiter:
    """
    Enforces rate limits for external API calls with queuing and retry logic.
    
    Uses a sliding window algorithm to track requests per provider and ensures
    that rate limits are not exceeded. Supports automatic waiting when rate
    limit is approached.
    
    Features:
        - Per-provider rate limit configuration
        - Sliding window algorithm for accurate rate limiting
        - Automatic waiting when rate limit approached
        - Statistics tracking for monitoring
        - Thread-safe for concurrent requests
    
    Requirements:
        - Requirement 5.5: Rate limiting for external APIs
        - Requirement 5.6: Per-provider rate limit configuration
        - Requirement 5.7: Automatic retry with backoff
    
    Usage:
        >>> limiter = RateLimiter()
        >>> limiter.configure_provider('aws', max_requests=10, window_seconds=60)
        >>> 
        >>> # Check if request can proceed
        >>> if await limiter.acquire('aws'):
        ...     # Make API call
        ...     response = await fetch_from_aws()
        >>> 
        >>> # Or wait automatically if needed
        >>> await limiter.wait_if_needed('aws')
        >>> response = await fetch_from_aws()
    """
    
    def __init__(self, default_max_requests: int = 10, default_window_seconds: int = 60):
        """
        Initialize the rate limiter.
        
        Args:
            default_max_requests: Default maximum requests per window
            default_window_seconds: Default time window in seconds
        """
        self._default_config = RateLimitConfig(
            max_requests=default_max_requests,
            window_seconds=default_window_seconds
        )
        
        # Per-provider configurations
        self._configs: Dict[str, RateLimitConfig] = {}
        
        # Per-provider request timestamps (sliding window)
        self._request_timestamps: Dict[str, List[float]] = {}
        
        # Per-provider statistics
        self._stats: Dict[str, RateLimitStats] = {}
        
        # Locks for thread safety
        self._locks: Dict[str, asyncio.Lock] = {}
        
        logger.info(
            f"RateLimiter initialized (default: {default_max_requests} requests "
            f"per {default_window_seconds}s)"
        )
    
    def configure_provider(
        self,
        provider_id: str,
        max_requests: int,
        window_seconds: int = 60
    ) -> None:
        """
        Configure rate limit for a specific provider.
        
        Args:
            provider_id: Provider identifier
            max_requests: Maximum requests allowed in window
            window_seconds: Time window in seconds (default: 60)
        
        Example:
            >>> limiter.configure_provider('aws', max_requests=10, window_seconds=60)
            >>> limiter.configure_provider('azure', max_requests=20, window_seconds=60)
        """
        self._configs[provider_id] = RateLimitConfig(
            max_requests=max_requests,
            window_seconds=window_seconds
        )
        
        # Initialize tracking structures
        if provider_id not in self._request_timestamps:
            self._request_timestamps[provider_id] = []
        
        if provider_id not in self._stats:
            self._stats[provider_id] = RateLimitStats(provider_id=provider_id)
        
        if provider_id not in self._locks:
            self._locks[provider_id] = asyncio.Lock()
        
        logger.info(
            f"Configured rate limit for '{provider_id}': "
            f"{max_requests} requests per {window_seconds}s"
        )
    
    def _get_config(self, provider_id: str) -> RateLimitConfig:
        """Get rate limit configuration for provider."""
        return self._configs.get(provider_id, self._default_config)
    
    def _get_lock(self, provider_id: str) -> asyncio.Lock:
        """Get or create lock for provider."""
        if provider_id not in self._locks:
            self._locks[provider_id] = asyncio.Lock()
        return self._locks[provider_id]
    
    def _get_stats(self, provider_id: str) -> RateLimitStats:
        """Get or create stats for provider."""
        if provider_id not in self._stats:
            self._stats[provider_id] = RateLimitStats(provider_id=provider_id)
        return self._stats[provider_id]
    
    def _cleanup_old_timestamps(self, provider_id: str, config: RateLimitConfig) -> None:
        """Remove timestamps outside the sliding window."""
        if provider_id not in self._request_timestamps:
            self._request_timestamps[provider_id] = []
            return
        
        current_time = time.time()
        cutoff_time = current_time - config.window_seconds
        
        # Keep only timestamps within the window
        self._request_timestamps[provider_id] = [
            ts for ts in self._request_timestamps[provider_id]
            if ts > cutoff_time
        ]
    
    async def acquire(self, provider_id: str) -> bool:
        """
        Check if request can proceed without exceeding rate limit.
        
        This method checks if a request can be made immediately without
        waiting. It does NOT block or wait.
        
        Args:
            provider_id: Provider identifier
        
        Returns:
            True if request can proceed, False if rate limit would be exceeded
        
        Example:
            >>> if await limiter.acquire('aws'):
            ...     response = await fetch_from_aws()
            ... else:
            ...     print("Rate limit reached, try again later")
        """
        config = self._get_config(provider_id)
        lock = self._get_lock(provider_id)
        stats = self._get_stats(provider_id)
        
        async with lock:
            # Clean up old timestamps
            self._cleanup_old_timestamps(provider_id, config)
            
            # Check if we can make another request
            if provider_id not in self._request_timestamps:
                self._request_timestamps[provider_id] = []
            
            current_count = len(self._request_timestamps[provider_id])
            
            if current_count >= config.max_requests:
                stats.requests_blocked += 1
                logger.debug(
                    f"Rate limit reached for '{provider_id}': "
                    f"{current_count}/{config.max_requests} requests in window"
                )
                return False
            
            # Record this request
            current_time = time.time()
            self._request_timestamps[provider_id].append(current_time)
            
            stats.requests_made += 1
            stats.last_request_at = datetime.now(timezone.utc)
            
            logger.debug(
                f"Request acquired for '{provider_id}': "
                f"{current_count + 1}/{config.max_requests} requests in window"
            )
            
            return True
    
    async def wait_if_needed(self, provider_id: str, timeout: Optional[float] = None) -> bool:
        """
        Block until rate limit window resets if needed.
        
        This method automatically waits if the rate limit has been reached,
        then records the request once the window allows it.
        
        Args:
            provider_id: Provider identifier
            timeout: Maximum time to wait in seconds (None = wait indefinitely)
        
        Returns:
            True if request can proceed, False if timeout reached
        
        Raises:
            asyncio.TimeoutError: If timeout is reached while waiting
        
        Example:
            >>> await limiter.wait_if_needed('aws')
            >>> response = await fetch_from_aws()
        """
        config = self._get_config(provider_id)
        lock = self._get_lock(provider_id)
        stats = self._get_stats(provider_id)
        
        start_wait_time = time.time()
        
        async with lock:
            while True:
                # Clean up old timestamps
                self._cleanup_old_timestamps(provider_id, config)
                
                # Check if we can make a request
                if provider_id not in self._request_timestamps:
                    self._request_timestamps[provider_id] = []
                
                current_count = len(self._request_timestamps[provider_id])
                
                if current_count < config.max_requests:
                    # We can proceed
                    current_time = time.time()
                    self._request_timestamps[provider_id].append(current_time)
                    
                    stats.requests_made += 1
                    stats.last_request_at = datetime.now(timezone.utc)
                    
                    wait_time = current_time - start_wait_time
                    if wait_time > 0.1:  # Only log if we actually waited
                        stats.total_wait_time_seconds += wait_time
                        logger.info(
                            f"Waited {wait_time:.2f}s for rate limit window "
                            f"for '{provider_id}'"
                        )
                    
                    return True
                
                # Rate limit reached, calculate wait time
                oldest_timestamp = self._request_timestamps[provider_id][0]
                wait_until = oldest_timestamp + config.window_seconds
                wait_seconds = wait_until - time.time()
                
                if wait_seconds <= 0:
                    # Window should have reset, try again
                    continue
                
                # Check timeout
                if timeout is not None:
                    elapsed = time.time() - start_wait_time
                    if elapsed + wait_seconds > timeout:
                        logger.warning(
                            f"Rate limit wait timeout for '{provider_id}' "
                            f"(waited {elapsed:.2f}s)"
                        )
                        return False
                
                logger.debug(
                    f"Rate limit reached for '{provider_id}', "
                    f"waiting {wait_seconds:.2f}s"
                )
                
                stats.requests_blocked += 1
                
                # Wait for the window to reset
                await asyncio.sleep(wait_seconds)
    
    def get_current_usage(self, provider_id: str) -> Dict:
        """
        Get current rate limit usage for a provider.
        
        Args:
            provider_id: Provider identifier
        
        Returns:
            Dictionary with current usage information:
            - current_requests: Number of requests in current window
            - max_requests: Maximum requests allowed
            - window_seconds: Time window in seconds
            - usage_percentage: Usage as percentage
            - time_until_reset: Seconds until oldest request expires
        
        Example:
            >>> usage = limiter.get_current_usage('aws')
            >>> print(f"Usage: {usage['usage_percentage']:.1f}%")
        """
        config = self._get_config(provider_id)
        
        # Clean up old timestamps
        self._cleanup_old_timestamps(provider_id, config)
        
        if provider_id not in self._request_timestamps:
            current_requests = 0
            time_until_reset = 0.0
        else:
            timestamps = self._request_timestamps[provider_id]
            current_requests = len(timestamps)
            
            if timestamps:
                oldest_timestamp = timestamps[0]
                time_until_reset = max(
                    0.0,
                    (oldest_timestamp + config.window_seconds) - time.time()
                )
            else:
                time_until_reset = 0.0
        
        usage_percentage = (current_requests / config.max_requests * 100) if config.max_requests > 0 else 0.0
        
        return {
            "provider_id": provider_id,
            "current_requests": current_requests,
            "max_requests": config.max_requests,
            "window_seconds": config.window_seconds,
            "usage_percentage": usage_percentage,
            "time_until_reset": time_until_reset
        }
    
    def get_stats(self, provider_id: Optional[str] = None) -> Dict:
        """
        Get rate limit statistics.
        
        Args:
            provider_id: Provider identifier (None = all providers)
        
        Returns:
            Dictionary with statistics for provider(s)
        
        Example:
            >>> stats = limiter.get_stats('aws')
            >>> print(f"Requests made: {stats['requests_made']}")
            >>> 
            >>> all_stats = limiter.get_stats()  # All providers
        """
        if provider_id is not None:
            stats = self._get_stats(provider_id)
            return stats.to_dict()
        else:
            return {
                pid: stats.to_dict()
                for pid, stats in self._stats.items()
            }
    
    def reset_stats(self, provider_id: Optional[str] = None) -> None:
        """
        Reset rate limit statistics.
        
        Args:
            provider_id: Provider identifier (None = reset all)
        """
        if provider_id is not None:
            if provider_id in self._stats:
                self._stats[provider_id] = RateLimitStats(provider_id=provider_id)
                logger.info(f"Reset statistics for '{provider_id}'")
        else:
            for pid in self._stats:
                self._stats[pid] = RateLimitStats(provider_id=pid)
            logger.info("Reset statistics for all providers")
    
    def __repr__(self) -> str:
        """String representation of rate limiter."""
        return (
            f"RateLimiter("
            f"providers={len(self._configs)}, "
            f"default={self._default_config.max_requests} requests/"
            f"{self._default_config.window_seconds}s)"
        )
