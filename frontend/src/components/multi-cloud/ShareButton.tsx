/**
 * ShareButton Component - Task 18.2
 * Generates and copies shareable links for current comparison state.
 */

import React, { useState } from 'react';
import { Share2, Copy, Check, Loader } from 'lucide-react';

const ShareButton = ({ state, title = 'Multi-Cloud Comparison', className = '' }) => {
  const [status, setStatus] = useState('idle'); // idle | loading | copied | error
  const [shareUrl, setShareUrl] = useState('');

  const handleShare = async () => {
    setStatus('loading');
    try {
      const response = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, title })
      });
      const data = await response.json();

      if (data.status === 'success') {
        const url = `${window.location.origin}${data.data.share_url}`;
        setShareUrl(url);
        await navigator.clipboard.writeText(url);
        setStatus('copied');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 2000);
      }
    } catch (err) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const icons = {
    idle: <Share2 className="w-4 h-4" />,
    loading: <Loader className="w-4 h-4 animate-spin" />,
    copied: <Check className="w-4 h-4" />,
    error: <Share2 className="w-4 h-4" />
  };

  const labels = {
    idle: 'Share',
    loading: 'Creating...',
    copied: 'Copied!',
    error: 'Failed'
  };

  const colors = {
    idle: 'bg-white/10 hover:bg-white/20 text-white',
    loading: 'bg-white/10 text-white/60',
    copied: 'bg-green-500/20 border-green-500/30 text-green-200',
    error: 'bg-red-500/20 border-red-500/30 text-red-200'
  };

  return (
    <button
      onClick={handleShare}
      disabled={status === 'loading'}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-white/20 transition-colors ${colors[status]} ${className}`}
    >
      {icons[status]}
      {labels[status]}
    </button>
  );
};

export default ShareButton;
