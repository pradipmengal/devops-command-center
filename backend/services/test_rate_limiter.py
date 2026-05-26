"""
Unit tests for RateLimiter.

This module contains comprehensive unit tests for the RateLimiter service,
including tests for rate limit enforcement, sliding window algorithm,
automatic waiting, and statistics tracking.
"""

import pytest
import asyncio
import time

import sys
from pathlib import Path

# Add backend directory to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.rate_limiter import RateLimiter, RateLimitConfig, RateLimitStats


class TestRateLimiter:
    """Test suite for RateLimiter."""
    
    def test_initialization(self):
        """Test rate limiter initialization with default values."""
        limiter = RateLimiter(default_max_requests=10, default_window_seconds=60)
        
        assert limiter._default_config.max_requests == 10
        assert limiter._default_config.window_seconds == 60
    
    def test_configure_provider(self):
        """Test configuring rate limit for a provider."""
        limiter = RateLimiter()
        
        limiter.configure_provider('aws', max_requests=20, window_seconds=60)
        
        assert 'aws' in limiter._configs
        assert limiter._configs['aws'].max_requests == 20
        assert limiter._configs['aws'].window_seconds == 60
    
    @pytest.mark.asyncio
    async def test_acquire_allows_requests_within_limit(self):
        """Test that acquire allows requests within rate limit."""
        limiter = RateLimiter()
        limiter.configure_provider('test', max_requests=5, window_seconds=60)
        
        # Should allow 5 requests
        for i in range(5):
            result = await limiter.acquire('test')
            assert result is True, f"Request {i+1} should be allowed"
    
    @pytest.mark.asyncio
    async def test_acquire_blocks_requests_exceeding_limit(self):
        """Test that acquire blocks requests exceeding rate limit."""
        limiter = RateLimiter()
        limiter.configure_provider('test', max_requests=3, window_seconds=60)
        
        # Allow 3 requests
        for i in range(3):
            result = await limiter.acquire('test')
            assert result is True
        
        # 4th request should be blocked
        result = await limiter.acquire('test')
        assert result is False
    
    @pytest.mark.asyncio
    async def test_sliding_window_allows_requests_after_expiry(self):
        """Test that sliding window allows requests after old ones expire."""
        limiter = RateLimiter()
        # Very short window for testing (2 seconds)
        limiter.configure_provider('test', max_requests=2, window_seconds=2)
        
        # Make 2 requests (fill the limit)
        assert await limiter.acquire('test') is True
        assert await limiter.acquire('test') is True
        
        # 3rd request should be blocked
        assert await limiter.acquire('test') is False
        
        # Wait for window to expire
        await asyncio.sleep(2.1)
        
        # Should allow requests again
        assert await limiter.acquire('test') is True
    
    @pytest.mark.asyncio
    async def test_wait_if_needed_waits_for_window_reset(self):
        """Test that wait_if_needed waits for rate limit window to reset."""
        limiter = RateLimiter()
        limiter.configure_provider('test', max_requests=2, window_seconds=2)
        
        # Fill the limit
        assert await limiter.acquire('test') is True
        assert await limiter.acquire('test') is True
        
        # This should wait ~2 seconds
        start_time = time.time()
        result = await limiter.wait_if_needed('test')
        elapsed = time.time() - start_time
        
        assert result is True
        assert elapsed >= 1.8  # Allow some timing variance
    
    @pytest.mark.asyncio
    async def test_wait_if_needed_returns_immediately_if_under_limit(self):
        """Test that wait_if_needed returns immediately if under limit."""
        limiter = RateLimiter()
        limiter.configure_provider('test', max_requests=5, window_seconds=60)
        
        start_time = time.time()
        result = await limiter.wait_if_needed('test')
        elapsed = time.time() - start_time
        
        assert result is True
        assert elapsed < 0.1  # Should be nearly instant
    
    @pytest.mark.asyncio
    async def test_wait_if_needed_with_timeout(self):
        """Test that wait_if_needed respects timeout."""
        limiter = RateLimiter()
        limiter.configure_provider('test', max_requests=1, window_seconds=10)
        
        # Fill the limit
        assert await limiter.acquire('test') is True
        
        # Try to wait with short timeout (should timeout)
        start_time = time.time()
        result = await limiter.wait_if_needed('test', timeout=1.0)
        elapsed = time.time() - start_time
        
        assert result is False
        assert elapsed < 1.5  # Should timeout around 1 second
    
    def test_get_current_usage(self):
        """Test getting current rate limit usage."""
        limiter = RateLimiter()
        limiter.configure_provider('test', max_requests=10, window_seconds=60)
        
        usage = limiter.get_current_usage('test')
        
        assert usage['provider_id'] == 'test'
        assert usage['current_requests'] == 0
        assert usage['max_requests'] == 10
        assert usage['window_seconds'] == 60
        assert usage['usage_percentage'] == 0.0
    
    @pytest.mark.asyncio
    async def test_get_current_usage_after_requests(self):
        """Test current usage after making requests."""
        limiter = RateLimiter()
        limiter.configure_provider('test', max_requests=10, window_seconds=60)
        
        # Make 3 requests
        await limiter.acquire('test')
        await limiter.acquire('test')
        await limiter.acquire('test')
        
        usage = limiter.get_current_usage('test')
        
        assert usage['current_requests'] == 3
        assert usage['usage_percentage'] == 30.0
    
    @pytest.mark.asyncio
    async def test_statistics_tracking(self):
        """Test that statistics are tracked correctly."""
        limiter = RateLimiter()
        limiter.configure_provider('test', max_requests=3, window_seconds=60)
        
        # Make 3 successful requests
        await limiter.acquire('test')
        await limiter.acquire('test')
        await limiter.acquire('test')
        
        # Try 1 blocked request
        await limiter.acquire('test')
        
        stats = limiter.get_stats('test')
        
        assert stats['requests_made'] == 3
        assert stats['requests_blocked'] == 1
    
    @pytest.mark.asyncio
    async def test_reset_stats(self):
        """Test resetting statistics."""
        limiter = RateLimiter()
        limiter.configure_provider('test', max_requests=5, window_seconds=60)
        
        # Make some requests
        await limiter.acquire('test')
        await limiter.acquire('test')
        
        stats = limiter.get_stats('test')
        assert stats['requests_made'] == 2
        
        # Reset stats
        limiter.reset_stats('test')
        
        stats = limiter.get_stats('test')
        assert stats['requests_made'] == 0
        assert stats['requests_blocked'] == 0
    
    @pytest.mark.asyncio
    async def test_multiple_providers_independent(self):
        """Test that rate limits for different providers are independent."""
        limiter = RateLimiter()
        limiter.configure_provider('aws', max_requests=2, window_seconds=60)
        limiter.configure_provider('azure', max_requests=2, window_seconds=60)
        
        # Fill AWS limit
        assert await limiter.acquire('aws') is True
        assert await limiter.acquire('aws') is True
        assert await limiter.acquire('aws') is False
        
        # Azure should still be available
        assert await limiter.acquire('azure') is True
        assert await limiter.acquire('azure') is True
        assert await limiter.acquire('azure') is False
    
    @pytest.mark.asyncio
    async def test_uses_default_config_for_unconfigured_provider(self):
        """Test that unconfigured providers use default configuration."""
        limiter = RateLimiter(default_max_requests=5, default_window_seconds=60)
        
        # Don't configure 'test' provider, should use defaults
        for i in range(5):
            result = await limiter.acquire('test')
            assert result is True
        
        # 6th request should be blocked (default limit is 5)
        result = await limiter.acquire('test')
        assert result is False
    
    def test_repr_string(self):
        """Test string representation of rate limiter."""
        limiter = RateLimiter(default_max_requests=10, default_window_seconds=60)
        limiter.configure_provider('aws', max_requests=20, window_seconds=60)
        limiter.configure_provider('azure', max_requests=15, window_seconds=60)
        
        repr_str = repr(limiter)
        
        assert 'RateLimiter' in repr_str
        assert 'providers=2' in repr_str
        assert 'default=10' in repr_str


class TestRateLimitConfig:
    """Test suite for RateLimitConfig dataclass."""
    
    def test_requests_per_minute_calculation(self):
        """Test requests per minute calculation."""
        config = RateLimitConfig(max_requests=10, window_seconds=60)
        assert config.requests_per_minute == 10.0
        
        config = RateLimitConfig(max_requests=20, window_seconds=120)
        assert config.requests_per_minute == 10.0
        
        config = RateLimitConfig(max_requests=5, window_seconds=30)
        assert config.requests_per_minute == 10.0


class TestRateLimitStats:
    """Test suite for RateLimitStats dataclass."""
    
    def test_stats_initialization(self):
        """Test RateLimitStats initialization."""
        stats = RateLimitStats(provider_id='aws')
        
        assert stats.provider_id == 'aws'
        assert stats.requests_made == 0
        assert stats.requests_blocked == 0
        assert stats.total_wait_time_seconds == 0.0
        assert stats.last_request_at is None
    
    def test_stats_to_dict(self):
        """Test converting stats to dictionary."""
        stats = RateLimitStats(
            provider_id='aws',
            requests_made=10,
            requests_blocked=2,
            total_wait_time_seconds=5.5
        )
        
        stats_dict = stats.to_dict()
        
        assert stats_dict['provider_id'] == 'aws'
        assert stats_dict['requests_made'] == 10
        assert stats_dict['requests_blocked'] == 2
        assert stats_dict['total_wait_time_seconds'] == 5.5


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
