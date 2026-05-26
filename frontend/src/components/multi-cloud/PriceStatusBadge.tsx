import React from 'react';

const STATUS_CONFIG = {
  live: {
    label: 'Live',
    bg: 'bg-green-500',
    pulse: 'animate-pulse',
    shadow: 'shadow-green-500/50',
  },
  cached: {
    label: 'Cached',
    bg: 'bg-yellow-400',
    pulse: '',
    shadow: 'shadow-yellow-400/30',
  },
  fallback: {
    label: 'Estimated',
    bg: 'bg-red-400',
    pulse: '',
    shadow: 'shadow-red-400/30',
  },
};

const PriceStatusBadge = ({ status = 'fallback', showLabel = true, size = 'sm' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.fallback;
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
        ${status === 'live' ? 'bg-green-500/15 text-green-300 border border-green-500/30' : ''}
        ${status === 'cached' ? 'bg-yellow-400/15 text-yellow-300 border border-yellow-400/30' : ''}
        ${status === 'fallback' ? 'bg-red-400/15 text-red-300 border border-red-400/30' : ''}
      `}
      title={
        status === 'live' ? 'Price fetched live from provider API' :
        status === 'cached' ? 'Price served from cache' :
        'Price estimated via region multiplier (API unavailable)'
      }
    >
      <span className={`relative flex ${dotSize}`}>
        <span
          className={`absolute inline-flex w-full h-full rounded-full opacity-75 ${config.bg} ${config.pulse}`}
        />
        <span className={`relative inline-flex rounded-full ${dotSize} ${config.bg}`} />
      </span>
      {showLabel && config.label}
    </span>
  );
};

export default React.memo(PriceStatusBadge);
