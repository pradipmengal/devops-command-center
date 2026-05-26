/**
 * LazyServiceDetail - Task 15.2
 * Lazy-loads detailed service metadata on demand using intersection observer.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Loader } from 'lucide-react';

const LazyServiceDetail = ({ providerId, serviceName, className = '' }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  // Intersection observer to trigger load when visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Load detail when visible
  useEffect(() => {
    if (!visible || detail || loading) return;
    setLoading(true);
    fetch(`/api/providers/${providerId}/services?search=${encodeURIComponent(serviceName)}&page_size=1`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success' && data.data.services.length > 0) {
          setDetail(data.data.services[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [visible, providerId, serviceName]);

  return (
    <div ref={ref} className={className}>
      {loading && (
        <div className="flex items-center gap-2 text-white/60 text-sm py-2">
          <Loader className="w-4 h-4 animate-spin" />
          Loading details...
        </div>
      )}
      {detail && (
        <div className="space-y-1 text-sm">
          {detail.vcpu && (
            <div className="flex justify-between">
              <span className="text-white/60">vCPU</span>
              <span className="text-white">{detail.vcpu}</span>
            </div>
          )}
          {detail.memory_gb && (
            <div className="flex justify-between">
              <span className="text-white/60">Memory</span>
              <span className="text-white">{detail.memory_gb} GB</span>
            </div>
          )}
          {detail.region && (
            <div className="flex justify-between">
              <span className="text-white/60">Region</span>
              <span className="text-white">{detail.region}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LazyServiceDetail;
