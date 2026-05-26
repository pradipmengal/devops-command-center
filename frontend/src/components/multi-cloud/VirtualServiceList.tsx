/**
 * VirtualServiceList - Task 15.1
 * Virtual scrolling for large service catalogs using intersection observer.
 * Renders only visible items for performance with large datasets.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ServiceCard from './ServiceCard';

const ITEM_HEIGHT = 200; // estimated card height in px
const BUFFER = 5;        // extra items to render above/below viewport

const VirtualServiceList = ({ services = [], viewMode = 'grid', className = '' }) => {
  const containerRef = useRef(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });

  const COLS = viewMode === 'grid' ? 3 : 1;

  const updateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const rowHeight = ITEM_HEIGHT;
    const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER);
    const endRow = Math.ceil((scrollTop + clientHeight) / rowHeight) + BUFFER;
    setVisibleRange({
      start: startRow * COLS,
      end: Math.min(services.length, endRow * COLS)
    });
  }, [services.length, COLS]);

  useEffect(() => {
    updateVisibleRange();
  }, [services.length, updateVisibleRange]);

  const totalRows = Math.ceil(services.length / COLS);
  const totalHeight = totalRows * ITEM_HEIGHT;
  const startRow = Math.floor(visibleRange.start / COLS);
  const offsetTop = startRow * ITEM_HEIGHT;

  const visibleServices = services.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      ref={containerRef}
      onScroll={updateVisibleRange}
      className={`overflow-y-auto ${className}`}
      style={{ maxHeight: '70vh' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}
          className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-3'
          }
        >
          {visibleServices.map((service, i) => (
            <ServiceCard
              key={`${service.provider}-${service.service_name}-${visibleRange.start + i}`}
              service={service}
              viewMode={viewMode}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default VirtualServiceList;
