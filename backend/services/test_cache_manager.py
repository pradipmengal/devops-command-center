"""
Unit tests for CacheManager.

This module contains comprehensive unit tests for the CacheManager service,
including tests for in-memory caching, TTL expiration, pattern-based invalidation,
and cache statistics.
"""

import pytest
import time
from datetime import datetime, timezone, timedelta

import sys
from pathlib import Path

# Add backend directory to path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from services.cache_manager import CacheManager, CacheStats


class TestCacheManagerMemory:
    """Test suite for CacheManager with in-memory backend."""
    
    def test_initialization_memory_backend(self):
        """Test cache manager initialization with memory backend."""
        cache = CacheManager(backend='memory', ttl_hours=6)
        
        assert cache.backend == 'memory'
        assert cache.ttl_hours == 6
        assert len(cache._cache) == 0
    
    def test_set_and_get_simple_value(self):
        """Test setting and getting a simple value."""
        cache = CacheManager(backend='memory')
        
        # Set value
        result = cache.set('test_key', 'test_value')
        assert result is True
        
        # Get value
        value = cache.get('test_key')
        assert value == 'test_value'
    
    def test_set_and_get_complex_value(self):
        """Test setting and getting complex data structures."""
        cache = CacheManager(backend='memory')
        
        complex_data = {
            'services': [
                {'name': 'EC2', 'price': 0.0416},
                {'name': 'S3', 'price': 0.023}
            ],
            'metadata': {
                'provider': 'aws',
                'region': 'us-east-1'
            }
        }
        
        cache.set('aws:services', complex_data)
        retrieved = cache.get('aws:services')
        
        assert retrieved == complex_data
        assert retrieved['services'][0]['name'] == 'EC2'
    
    def test_get_nonexistent_key_returns_none(self):
        """Test that getting a nonexistent key returns None."""
        cache = CacheManager(backend='memory')
        
        value = cache.get('nonexistent_key')
        assert value is None
    
    def test_ttl_expiration(self):
        """Test that cached values expire after TTL."""
        # Use very short TTL for testing (0.001 hours = 3.6 seconds)
        cache = CacheManager(backend='memory', ttl_hours=0.001)
        
        cache.set('expiring_key', 'expiring_value')
        
        # Value should be available immediately
        value = cache.get('expiring_key')
        assert value == 'expiring_value'
        
        # Wait for expiration (4 seconds to be safe)
        time.sleep(4)
        
        # Value should be expired
        value = cache.get('expiring_key')
        assert value is None
    
    def test_custom_ttl_per_key(self):
        """Test setting custom TTL for individual keys."""
        cache = CacheManager(backend='memory', ttl_hours=1)
        
        # Set with custom TTL
        cache.set('short_ttl_key', 'value1', ttl_hours=0.001)
        cache.set('long_ttl_key', 'value2', ttl_hours=10)
        
        # Both should be available immediately
        assert cache.get('short_ttl_key') == 'value1'
        assert cache.get('long_ttl_key') == 'value2'
        
        # Wait for short TTL to expire
        time.sleep(4)
        
        # Short TTL should be expired, long TTL still valid
        assert cache.get('short_ttl_key') is None
        assert cache.get('long_ttl_key') == 'value2'
    
    def test_invalidate_exact_match(self):
        """Test invalidating a single key by exact match."""
        cache = CacheManager(backend='memory')
        
        cache.set('aws:services', 'data1')
        cache.set('azure:services', 'data2')
        
        # Invalidate exact key
        count = cache.invalidate('aws:services')
        
        assert count == 1
        assert cache.get('aws:services') is None
        assert cache.get('azure:services') == 'data2'
    
    def test_invalidate_prefix_pattern(self):
        """Test invalidating keys by prefix pattern."""
        cache = CacheManager(backend='memory')
        
        cache.set('aws:services:us-east-1', 'data1')
        cache.set('aws:services:eu-west-1', 'data2')
        cache.set('aws:pricing:us-east-1', 'data3')
        cache.set('azure:services:eastus', 'data4')
        
        # Invalidate all AWS keys
        count = cache.invalidate('aws:*')
        
        assert count == 3
        assert cache.get('aws:services:us-east-1') is None
        assert cache.get('aws:services:eu-west-1') is None
        assert cache.get('aws:pricing:us-east-1') is None
        assert cache.get('azure:services:eastus') == 'data4'
    
    def test_invalidate_suffix_pattern(self):
        """Test invalidating keys by suffix pattern."""
        cache = CacheManager(backend='memory')
        
        cache.set('aws:services:us-east-1', 'data1')
        cache.set('azure:services:us-east-1', 'data2')
        cache.set('gcp:services:us-central1', 'data3')
        
        # Invalidate all us-east-1 keys
        count = cache.invalidate('*:us-east-1')
        
        assert count == 2
        assert cache.get('aws:services:us-east-1') is None
        assert cache.get('azure:services:us-east-1') is None
        assert cache.get('gcp:services:us-central1') == 'data3'
    
    def test_invalidate_contains_pattern(self):
        """Test invalidating keys by contains pattern."""
        cache = CacheManager(backend='memory')
        
        cache.set('aws:services:compute', 'data1')
        cache.set('azure:services:storage', 'data2')
        cache.set('gcp:pricing:compute', 'data3')
        
        # Invalidate all keys containing 'services'
        count = cache.invalidate('*services*')
        
        assert count == 2
        assert cache.get('aws:services:compute') is None
        assert cache.get('azure:services:storage') is None
        assert cache.get('gcp:pricing:compute') == 'data3'
    
    def test_clear_all_entries(self):
        """Test clearing all cache entries."""
        cache = CacheManager(backend='memory')
        
        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        cache.set('key3', 'value3')
        
        assert len(cache._cache) == 3
        
        result = cache.clear()
        
        assert result is True
        assert len(cache._cache) == 0
        assert cache.get('key1') is None
        assert cache.get('key2') is None
    
    def test_cache_statistics_hits_and_misses(self):
        """Test cache statistics tracking."""
        cache = CacheManager(backend='memory')
        
        # Initial stats
        stats = cache.get_stats()
        assert stats['hits'] == 0
        assert stats['misses'] == 0
        assert stats['sets'] == 0
        assert stats['hit_rate'] == 0.0
        
        # Set a value
        cache.set('key1', 'value1')
        stats = cache.get_stats()
        assert stats['sets'] == 1
        
        # Cache hit
        cache.get('key1')
        stats = cache.get_stats()
        assert stats['hits'] == 1
        assert stats['misses'] == 0
        assert stats['hit_rate'] == 100.0
        
        # Cache miss
        cache.get('nonexistent')
        stats = cache.get_stats()
        assert stats['hits'] == 1
        assert stats['misses'] == 1
        assert stats['hit_rate'] == 50.0
        
        # Another hit
        cache.get('key1')
        stats = cache.get_stats()
        assert stats['hits'] == 2
        assert stats['misses'] == 1
        assert stats['hit_rate'] == pytest.approx(66.67, rel=0.1)
    
    def test_cache_statistics_invalidations(self):
        """Test invalidation statistics tracking."""
        cache = CacheManager(backend='memory')
        
        cache.set('aws:key1', 'value1')
        cache.set('aws:key2', 'value2')
        cache.set('azure:key1', 'value3')
        
        # Invalidate AWS keys
        cache.invalidate('aws:*')
        
        stats = cache.get_stats()
        assert stats['invalidations'] == 2
    
    def test_reset_statistics(self):
        """Test resetting cache statistics."""
        cache = CacheManager(backend='memory')
        
        cache.set('key1', 'value1')
        cache.get('key1')
        cache.get('nonexistent')
        
        stats = cache.get_stats()
        assert stats['hits'] > 0
        assert stats['misses'] > 0
        
        # Reset stats
        cache.reset_stats()
        
        stats = cache.get_stats()
        assert stats['hits'] == 0
        assert stats['misses'] == 0
        assert stats['sets'] == 0
    
    def test_cache_size_in_stats(self):
        """Test that cache size is included in statistics."""
        cache = CacheManager(backend='memory')
        
        cache.set('key1', 'value1')
        cache.set('key2', 'value2')
        cache.set('key3', 'value3')
        
        stats = cache.get_stats()
        assert stats['size'] == 3
        assert stats['backend'] == 'memory'
        assert stats['ttl_hours'] == 6
    
    def test_repr_string(self):
        """Test string representation of cache manager."""
        cache = CacheManager(backend='memory', ttl_hours=12)
        
        cache.set('key1', 'value1')
        cache.get('key1')
        
        repr_str = repr(cache)
        
        assert 'CacheManager' in repr_str
        assert 'backend=\'memory\'' in repr_str
        assert 'ttl_hours=12' in repr_str
        assert 'size=1' in repr_str
        assert 'hit_rate=' in repr_str
    
    def test_invalid_backend_raises_error(self):
        """Test that invalid backend raises ValueError."""
        with pytest.raises(ValueError) as exc_info:
            CacheManager(backend='invalid_backend')
        
        assert 'Invalid backend' in str(exc_info.value)
    
    def test_expired_entry_removed_from_cache(self):
        """Test that expired entries are removed from cache on access."""
        cache = CacheManager(backend='memory', ttl_hours=0.001)
        
        cache.set('expiring_key', 'value')
        
        # Cache should have 1 entry
        assert len(cache._cache) == 1
        
        # Wait for expiration
        time.sleep(4)
        
        # Access expired key
        value = cache.get('expiring_key')
        assert value is None
        
        # Expired entry should be removed
        assert len(cache._cache) == 0


class TestCacheStats:
    """Test suite for CacheStats dataclass."""
    
    def test_cache_stats_initialization(self):
        """Test CacheStats initialization with default values."""
        stats = CacheStats()
        
        assert stats.hits == 0
        assert stats.misses == 0
        assert stats.sets == 0
        assert stats.invalidations == 0
        assert stats.hit_rate == 0.0
    
    def test_hit_rate_calculation(self):
        """Test hit rate calculation."""
        stats = CacheStats(hits=8, misses=2)
        assert stats.hit_rate == 80.0
        
        stats = CacheStats(hits=1, misses=3)
        assert stats.hit_rate == 25.0
        
        stats = CacheStats(hits=0, misses=0)
        assert stats.hit_rate == 0.0
    
    def test_to_dict_conversion(self):
        """Test converting CacheStats to dictionary."""
        stats = CacheStats(hits=10, misses=5, sets=15, invalidations=2)
        
        stats_dict = stats.to_dict()
        
        assert stats_dict['hits'] == 10
        assert stats_dict['misses'] == 5
        assert stats_dict['sets'] == 15
        assert stats_dict['invalidations'] == 2
        assert stats_dict['hit_rate'] == pytest.approx(66.67, rel=0.1)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
