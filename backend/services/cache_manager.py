"""
Cache Manager - Manages caching of service catalogs and pricing data.

This module implements a flexible caching layer that supports both in-memory
and Redis backends with TTL expiration, cache statistics, and pattern-based
invalidation.

Requirements:
    - Requirement 5.2: Caching layer with TTL
    - Requirement 5.3: Cache statistics and monitoring
    - Requirement 5.4: Pattern-based cache invalidation
"""

import json
import logging
import time
from typing import Any, Optional, Dict
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, asdict


logger = logging.getLogger(__name__)


@dataclass
class CacheStats:
    """Cache statistics for monitoring."""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    invalidations: int = 0
    
    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate as percentage."""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert stats to dictionary."""
        return {
            **asdict(self),
            "hit_rate": self.hit_rate
        }


class CacheManager:
    """
    Manages caching of service catalogs and pricing data with TTL expiration.
    
    Supports two backends:
    - 'memory': In-memory dictionary (default, suitable for development)
    - 'redis': Redis server (recommended for production)
    
    Features:
        - TTL-based expiration
        - Cache statistics (hits, misses, hit rate)
        - Pattern-based invalidation
        - JSON serialization for complex objects
    
    Requirements:
        - Requirement 5.2: Caching layer with TTL
        - Requirement 5.3: Cache statistics
        - Requirement 5.4: Pattern-based invalidation
    
    Usage:
        >>> cache = CacheManager(backend='memory', ttl_hours=6)
        >>> cache.set('aws:services', services_data)
        >>> data = cache.get('aws:services')
        >>> stats = cache.get_stats()
    """
    
    def __init__(
        self,
        backend: str = 'memory',
        ttl_hours: int = 6,
        redis_url: Optional[str] = None
    ):
        """
        Initialize the cache manager.
        
        Args:
            backend: Cache backend ('memory' or 'redis')
            ttl_hours: Default TTL in hours (default: 6)
            redis_url: Redis connection URL (required if backend='redis')
        
        Raises:
            ValueError: If backend is 'redis' but redis_url not provided
            ImportError: If backend is 'redis' but redis package not installed
        """
        self.backend = backend
        self.ttl_hours = ttl_hours
        self._stats = CacheStats()
        
        if backend == 'memory':
            self._cache: Dict[str, Dict[str, Any]] = {}
            logger.info("CacheManager initialized with in-memory backend")
        
        elif backend == 'redis':
            if redis_url is None:
                raise ValueError("redis_url is required when backend='redis'")
            
            try:
                import redis
                self._redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=5
                )
                # Test connection
                self._redis_client.ping()
                logger.info(f"CacheManager initialized with Redis backend: {redis_url}")
            
            except ImportError:
                raise ImportError(
                    "redis package is required for Redis backend. "
                    "Install with: pip install redis"
                )
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                raise
        
        else:
            raise ValueError(f"Invalid backend: {backend}. Must be 'memory' or 'redis'")
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get cached value if not expired.
        
        Args:
            key: Cache key
        
        Returns:
            Cached value if found and not expired, None otherwise
        
        Example:
            >>> services = cache.get('aws:services:us-east-1')
            >>> if services is None:
            ...     services = fetch_from_api()
            ...     cache.set('aws:services:us-east-1', services)
        """
        if self.backend == 'memory':
            return self._get_memory(key)
        else:
            return self._get_redis(key)
    
    def _get_memory(self, key: str) -> Optional[Any]:
        """Get value from in-memory cache."""
        if key not in self._cache:
            self._stats.misses += 1
            logger.debug(f"Cache miss: {key}")
            return None
        
        entry = self._cache[key]
        
        # Check if expired
        if datetime.now(timezone.utc) > entry['expires_at']:
            logger.debug(f"Cache expired: {key}")
            del self._cache[key]
            self._stats.misses += 1
            return None
        
        self._stats.hits += 1
        logger.debug(f"Cache hit: {key}")
        return entry['value']
    
    def _get_redis(self, key: str) -> Optional[Any]:
        """Get value from Redis cache."""
        try:
            value_json = self._redis_client.get(key)
            
            if value_json is None:
                self._stats.misses += 1
                logger.debug(f"Cache miss: {key}")
                return None
            
            self._stats.hits += 1
            logger.debug(f"Cache hit: {key}")
            
            # Deserialize JSON
            return json.loads(value_json)
        
        except Exception as e:
            logger.error(f"Redis get error for key '{key}': {e}")
            self._stats.misses += 1
            return None
    
    def set(
        self,
        key: str,
        value: Any,
        ttl_hours: Optional[int] = None
    ) -> bool:
        """
        Set cached value with TTL.
        
        Args:
            key: Cache key
            value: Value to cache (must be JSON-serializable)
            ttl_hours: TTL in hours (default: use instance default)
        
        Returns:
            True if set successfully, False otherwise
        
        Example:
            >>> cache.set('aws:services', services_data, ttl_hours=12)
            True
        """
        ttl = ttl_hours if ttl_hours is not None else self.ttl_hours
        
        if self.backend == 'memory':
            return self._set_memory(key, value, ttl)
        else:
            return self._set_redis(key, value, ttl)
    
    def _set_memory(self, key: str, value: Any, ttl_hours: int) -> bool:
        """Set value in in-memory cache."""
        try:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
            
            self._cache[key] = {
                'value': value,
                'expires_at': expires_at,
                'created_at': datetime.now(timezone.utc)
            }
            
            self._stats.sets += 1
            logger.debug(f"Cache set: {key} (TTL: {ttl_hours}h)")
            return True
        
        except Exception as e:
            logger.error(f"Failed to set cache key '{key}': {e}")
            return False
    
    def _set_redis(self, key: str, value: Any, ttl_hours: int) -> bool:
        """Set value in Redis cache."""
        try:
            # Serialize to JSON
            value_json = json.dumps(value)
            
            # Set with TTL in seconds
            ttl_seconds = ttl_hours * 3600
            self._redis_client.setex(key, ttl_seconds, value_json)
            
            self._stats.sets += 1
            logger.debug(f"Cache set: {key} (TTL: {ttl_hours}h)")
            return True
        
        except (TypeError, ValueError) as e:
            logger.error(f"Failed to serialize value for key '{key}': {e}")
            return False
        except Exception as e:
            logger.error(f"Redis set error for key '{key}': {e}")
            return False
    
    def invalidate(self, pattern: str) -> int:
        """
        Invalidate cache entries matching pattern.
        
        Pattern matching:
        - Exact match: 'aws:services'
        - Prefix match: 'aws:*' (matches all keys starting with 'aws:')
        - Suffix match: '*:us-east-1' (matches all keys ending with ':us-east-1')
        - Contains match: '*services*' (matches all keys containing 'services')
        
        Args:
            pattern: Pattern to match (supports * wildcard)
        
        Returns:
            Number of keys invalidated
        
        Example:
            >>> cache.invalidate('aws:*')  # Invalidate all AWS cache entries
            5
            >>> cache.invalidate('*:us-east-1')  # Invalidate all us-east-1 entries
            3
        """
        if self.backend == 'memory':
            return self._invalidate_memory(pattern)
        else:
            return self._invalidate_redis(pattern)
    
    def _invalidate_memory(self, pattern: str) -> int:
        """Invalidate entries in in-memory cache."""
        import fnmatch
        
        keys_to_delete = [
            key for key in self._cache.keys()
            if fnmatch.fnmatch(key, pattern)
        ]
        
        for key in keys_to_delete:
            del self._cache[key]
        
        count = len(keys_to_delete)
        self._stats.invalidations += count
        
        logger.info(f"Invalidated {count} cache entries matching pattern: {pattern}")
        return count
    
    def _invalidate_redis(self, pattern: str) -> int:
        """Invalidate entries in Redis cache."""
        try:
            # Use SCAN to find matching keys (more efficient than KEYS)
            cursor = 0
            keys_to_delete = []
            
            while True:
                cursor, keys = self._redis_client.scan(
                    cursor=cursor,
                    match=pattern,
                    count=100
                )
                keys_to_delete.extend(keys)
                
                if cursor == 0:
                    break
            
            # Delete keys in pipeline for efficiency
            if keys_to_delete:
                pipeline = self._redis_client.pipeline()
                for key in keys_to_delete:
                    pipeline.delete(key)
                pipeline.execute()
            
            count = len(keys_to_delete)
            self._stats.invalidations += count
            
            logger.info(f"Invalidated {count} cache entries matching pattern: {pattern}")
            return count
        
        except Exception as e:
            logger.error(f"Redis invalidate error for pattern '{pattern}': {e}")
            return 0
    
    def clear(self) -> bool:
        """
        Clear all cache entries.
        
        Returns:
            True if cleared successfully, False otherwise
        
        Warning:
            This operation clears the entire cache. Use with caution.
        """
        if self.backend == 'memory':
            count = len(self._cache)
            self._cache.clear()
            logger.info(f"Cleared {count} cache entries")
            return True
        else:
            try:
                self._redis_client.flushdb()
                logger.info("Cleared Redis cache")
                return True
            except Exception as e:
                logger.error(f"Failed to clear Redis cache: {e}")
                return False
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache hit/miss statistics.
        
        Returns:
            Dictionary with cache statistics:
            - hits: Number of cache hits
            - misses: Number of cache misses
            - sets: Number of cache sets
            - invalidations: Number of invalidations
            - hit_rate: Cache hit rate as percentage
            - backend: Cache backend type
            - ttl_hours: Default TTL in hours
        
        Example:
            >>> stats = cache.get_stats()
            >>> print(f"Hit rate: {stats['hit_rate']:.1f}%")
            Hit rate: 85.3%
        """
        stats = self._stats.to_dict()
        stats['backend'] = self.backend
        stats['ttl_hours'] = self.ttl_hours
        
        if self.backend == 'memory':
            stats['size'] = len(self._cache)
        else:
            try:
                stats['size'] = self._redis_client.dbsize()
            except Exception:
                stats['size'] = None
        
        return stats
    
    def reset_stats(self) -> None:
        """Reset cache statistics."""
        self._stats = CacheStats()
        logger.info("Cache statistics reset")
    
    def __repr__(self) -> str:
        """String representation of cache manager."""
        stats = self.get_stats()
        return (
            f"CacheManager("
            f"backend='{self.backend}', "
            f"ttl_hours={self.ttl_hours}, "
            f"size={stats.get('size', 'unknown')}, "
            f"hit_rate={stats['hit_rate']:.1f}%)"
        )
