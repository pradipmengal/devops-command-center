/**
 * MultiCloudDashboard Page - Task 14.1
 * 
 * Enterprise-grade multi-cloud cost intelligence dashboard.
 * Three-column layout: filters | main content | optimization panel
 * 
 * Requirements:
 *   - Requirement 14.1: Enterprise dashboard layout
 *   - Requirement 14.2: Responsive design
 *   - Requirement 14.3: Glassmorphism styling
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Menu, X, Key, CheckCircle, XCircle, Loader, Save, Trash2 } from 'lucide-react';

import ProviderSelector from '../components/multi-cloud/ProviderSelector';
import RegionSelector from '../components/multi-cloud/RegionSelector';
import CategoryFilter from '../components/multi-cloud/CategoryFilter';
import ServiceCatalog from '../components/multi-cloud/ServiceCatalog';
import ComparisonPanel from '../components/multi-cloud/ComparisonPanel';
import CostEstimator from '../components/multi-cloud/CostEstimator';
import OptimizationPanel from '../components/multi-cloud/OptimizationPanel';
import DashboardHeader from '../components/multi-cloud/DashboardHeader';
import DashboardMetrics from '../components/multi-cloud/DashboardMetrics';
import RegionalPriceComparison from '../components/multi-cloud/RegionalPriceComparison';
import PriceStatusBadge from '../components/multi-cloud/PriceStatusBadge';
import { useComparison } from '../hooks/useComparison';

const MultiCloudDashboard = () => {
  // Filter state
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currency, setCurrency] = useState('USD');

  // UI state
  const [activeTab, setActiveTab] = useState('catalog'); // catalog | compare | estimate
  const [showFilters, setShowFilters] = useState(true);
  const [showOptimization, setShowOptimization] = useState(true);
  const [services, setServices] = useState<any[]>([]);
  const [optimizationSuggestions, setOptimizationSuggestions] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'live' | 'demo' | 'mixed'

  // Infracost API key state
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const testAbortRef = useRef<AbortController | null>(null);

  // AWS Credentials state
  const [showAwsConfig, setShowAwsConfig] = useState(false);
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [awsTestStatus, setAwsTestStatus] = useState<string | null>(null);
  const [awsTestMessage, setAwsTestMessage] = useState('');
  const [awsSaveStatus, setAwsSaveStatus] = useState<string | null>(null);
  const [awsSaveMessage, setAwsSaveMessage] = useState('');
  const [maskedAwsKey, setMaskedAwsKey] = useState<string | null>(null);
  const awsTestAbortRef = useRef<AbortController | null>(null);

  // GCP Credentials state
  const [showGcpConfig, setShowGcpConfig] = useState(false);
  const [gcpJsonContent, setGcpJsonContent] = useState('');
  const [gcpTestStatus, setGcpTestStatus] = useState<string | null>(null);
  const [gcpTestMessage, setGcpTestMessage] = useState('');
  const [gcpSaveStatus, setGcpSaveStatus] = useState<string | null>(null);
  const [gcpSaveMessage, setGcpSaveMessage] = useState('');
  const [maskedGcpEmail, setMaskedGcpEmail] = useState<string | null>(null);
  const gcpTestAbortRef = useRef<AbortController | null>(null);

  // Fetch config status on mount
  useEffect(() => {
    const fetchAwsStatus = async () => {
      try {
        const resp = await fetch('/api/settings/aws-credentials');
        const data = await resp.json();
        if (data.configured && data.masked_access_key_id) {
          setMaskedAwsKey(data.masked_access_key_id);
        }
      } catch (err) {
        console.error('Failed to fetch AWS credentials status:', err);
      }
    };
    const fetchGcpStatus = async () => {
      try {
        const resp = await fetch('/api/settings/gcp-credentials');
        const data = await resp.json();
        if (data.configured && data.masked_client_email) {
          setMaskedGcpEmail(data.masked_client_email);
        }
      } catch (err) {
        console.error('Failed to fetch GCP credentials status:', err);
      }
    };
    fetchAwsStatus();
    fetchGcpStatus();
  }, []);

  const handleTestApiKey = useCallback(async () => {
    if (!apiKey.trim()) return;
    if (testAbortRef.current) testAbortRef.current.abort();
    testAbortRef.current = new AbortController();
    const signal = testAbortRef.current.signal;

    setTestStatus('testing');
    setTestMessage('');
    try {
      const resp = await fetch('/api/cloud-pricing/infracost/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim() }),
        signal,
      });
      const data = await resp.json();
      if (data.status === 'success' && data.data.valid) {
        setTestStatus('success');
        setTestMessage('Connection successful!');
      } else {
        setTestStatus('error');
        setTestMessage(data.data?.message || 'Connection failed');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setTestStatus('error');
        setTestMessage(err.message);
      }
    }
  }, [apiKey]);

  const handleTestAwsCredentials = useCallback(async () => {
    if (!awsAccessKey.trim() || !awsSecretKey.trim()) return;
    if (awsTestAbortRef.current) awsTestAbortRef.current.abort();
    awsTestAbortRef.current = new AbortController();
    const signal = awsTestAbortRef.current.signal;

    setAwsTestStatus('testing');
    setAwsTestMessage('');
    setAwsSaveStatus(null);
    try {
      const resp = await fetch('/api/settings/aws-credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          access_key_id: awsAccessKey.trim(), 
          secret_access_key: awsSecretKey.trim() 
        }),
        signal,
      });
      const data = await resp.json();
      if (data.valid) {
        setAwsTestStatus('success');
        setAwsTestMessage(data.message || 'Connection successful!');
      } else {
        setAwsTestStatus('error');
        setAwsTestMessage(data.message || 'Connection failed');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setAwsTestStatus('error');
        setAwsTestMessage(err.message);
      }
    }
  }, [awsAccessKey, awsSecretKey]);

  const handleSaveAwsCredentials = useCallback(async () => {
    if (awsTestStatus !== 'success') return;
    
    setAwsSaveStatus('saving');
    setAwsSaveMessage('');
    try {
      const resp = await fetch('/api/settings/aws-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          access_key_id: awsAccessKey.trim(), 
          secret_access_key: awsSecretKey.trim() 
        }),
      });
      
      if (resp.ok) {
        const data = await resp.json();
        setAwsSaveStatus('success');
        setAwsSaveMessage(data.message || 'Credentials saved successfully!');
        const statusResp = await fetch('/api/settings/aws-credentials');
        const statusData = await statusResp.json();
        if (statusData.masked_access_key_id) {
          setMaskedAwsKey(statusData.masked_access_key_id);
        }
      } else {
        const data = await resp.json();
        setAwsSaveStatus('error');
        setAwsSaveMessage(data.detail || 'Failed to save credentials');
      }
    } catch (err: any) {
      setAwsSaveStatus('error');
      setAwsSaveMessage(err.message);
    }
  }, [awsAccessKey, awsSecretKey, awsTestStatus]);

  const handleTestGcpCredentials = useCallback(async () => {
    if (!gcpJsonContent.trim()) return;
    if (gcpTestAbortRef.current) gcpTestAbortRef.current.abort();
    gcpTestAbortRef.current = new AbortController();
    const signal = gcpTestAbortRef.current.signal;

    setGcpTestStatus('testing');
    setGcpTestMessage('');
    setGcpSaveStatus(null);
    try {
      const resp = await fetch('/api/settings/gcp-credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json_content: gcpJsonContent.trim() }),
        signal,
      });
      const data = await resp.json();
      if (data.valid) {
        setGcpTestStatus('success');
        setGcpTestMessage(data.message || 'Connection successful!');
      } else {
        setGcpTestStatus('error');
        setGcpTestMessage(data.message || 'Connection failed');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setGcpTestStatus('error');
        setGcpTestMessage(err.message);
      }
    }
  }, [gcpJsonContent]);

  const handleSaveGcpCredentials = useCallback(async () => {
    if (gcpTestStatus !== 'success') return;
    
    setGcpSaveStatus('saving');
    setGcpSaveMessage('');
    try {
      const resp = await fetch('/api/settings/gcp-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json_content: gcpJsonContent.trim() }),
      });
      
      if (resp.ok) {
        const data = await resp.json();
        setGcpSaveStatus('success');
        setGcpSaveMessage(data.message || 'Credentials saved successfully!');
        const statusResp = await fetch('/api/settings/gcp-credentials');
        const statusData = await statusResp.json();
        if (statusData.masked_client_email) {
          setMaskedGcpEmail(statusData.masked_client_email);
        }
      } else {
        const data = await resp.json();
        setGcpSaveStatus('error');
        setGcpSaveMessage(data.detail || 'Failed to save credentials');
      }
    } catch (err: any) {
      setGcpSaveStatus('error');
      setGcpSaveMessage(err.message);
    }
  }, [gcpJsonContent, gcpTestStatus]);

  const handleRemoveAwsCredentials = useCallback(async () => {
    setAwsSaveStatus('saving');
    setAwsSaveMessage('');
    try {
      const resp = await fetch('/api/settings/aws-credentials', { method: 'DELETE' });
      if (resp.ok) {
        setMaskedAwsKey(null);
        setAwsAccessKey('');
        setAwsSecretKey('');
        setAwsTestStatus(null);
        setAwsTestMessage('');
        setAwsSaveStatus('success');
        setAwsSaveMessage('AWS credentials removed successfully!');
        // Clear success message after 3 seconds
        setTimeout(() => {
          setAwsSaveStatus(null);
          setAwsSaveMessage('');
        }, 3000);
      } else {
        const data = await resp.json().catch(() => ({}));
        setAwsSaveStatus('error');
        setAwsSaveMessage(data.detail || `Failed to remove (HTTP ${resp.status}). Please restart the backend.`);
      }
    } catch (err: any) {
      setAwsSaveStatus('error');
      setAwsSaveMessage(`Network error: ${err.message}`);
    }
  }, []);

  const handleRemoveGcpCredentials = useCallback(async () => {
    setGcpSaveStatus('saving');
    setGcpSaveMessage('');
    try {
      const resp = await fetch('/api/settings/gcp-credentials', { method: 'DELETE' });
      if (resp.ok) {
        setMaskedGcpEmail(null);
        setGcpJsonContent('');
        setGcpTestStatus(null);
        setGcpTestMessage('');
        setGcpSaveStatus('success');
        setGcpSaveMessage('GCP credentials removed successfully!');
        // Clear success message after 3 seconds
        setTimeout(() => {
          setGcpSaveStatus(null);
          setGcpSaveMessage('');
        }, 3000);
      } else {
        const data = await resp.json().catch(() => ({}));
        setGcpSaveStatus('error');
        setGcpSaveMessage(data.detail || `Failed to remove (HTTP ${resp.status}). Please restart the backend.`);
      }
    } catch (err: any) {
      setGcpSaveStatus('error');
      setGcpSaveMessage(`Network error: ${err.message}`);
    }
  }, []);

  // Comparison state
  const { comparisonServices, addToComparison, removeFromComparison, clearComparison, isInComparison } = useComparison();

  const handleProviderToggle = useCallback((providerId: string) => {
    setSelectedProviders(prev =>
      prev.includes(providerId)
        ? prev.filter(id => id !== providerId)
        : [...prev, providerId]
    );
  }, []);

  const handleRegionToggle = useCallback((regionId: string) => {
    setSelectedRegions(prev =>
      prev.includes(regionId)
        ? prev.filter(id => id !== regionId)
        : [...prev, regionId]
    );
  }, []);

  const handleCategoryToggle = useCallback((categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  }, []);

  const handleExport = async () => {
    try {
      const response = await fetch('/api/services/search?' + new URLSearchParams({
        providers: selectedProviders.join(','),
        page_size: '500'
      }));
      const data = await response.json();
      if (data.status === 'success') {
        const services = data.data.services;
        const csv = [
          ['Provider', 'Service', 'Category', 'Price (USD)', 'Unit', 'Tier', 'Region'].join(','),
          ...services.map((s: any) => [
            s.provider, `"${s.service_name}"`, `"${s.category}"`,
            s.price_usd, s.unit, s.tier_label, s.region || ''
          ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `multi-cloud-services-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleRefresh = async () => {
    if (selectedProviders.length === 0) return;
    try {
      await fetch(`/api/services/refresh?providers=${selectedProviders.join(',')}`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  const handleServicesLoaded = useCallback((loadedServices: any[]) => {
    setServices(loadedServices);
    const anyFallback = loadedServices.some(s => s.is_fallback);
    const anyLive = loadedServices.some(s => !s.is_fallback);
    if (loadedServices.length > 0) {
      setSyncStatus(anyLive && !anyFallback ? 'live' : anyFallback && anyLive ? 'mixed' : 'demo');
    }
  }, []);

  const handleAddToCompare = useCallback((service: any) => {
    addToComparison(service);
  }, [addToComparison]);

  const isServiceInComparison = useCallback((service: any) => {
    return isInComparison(service);
  }, [isInComparison]);

  const tabs = [
    { id: 'catalog', label: 'Service Catalog' },
    { id: 'regional', label: 'Regional Prices' },
    { id: 'compare', label: `Compare (${comparisonServices.length})` },
    { id: 'estimate', label: 'Cost Estimator' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 p-4 md:p-6">
      {/* Dashboard Header */}
      <DashboardHeader
        selectedProviders={selectedProviders}
        onSearch={setSearchTerm}
        onAnalyze={() => {}}
        onExport={handleExport}
        onRefresh={handleRefresh}
        currency={currency}
        onCurrencyChange={setCurrency}
        className="mb-4"
      />

      {/* Sync Status Bar */}
      {syncStatus !== 'idle' && (
        <div className="mb-4 flex items-center gap-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-2 text-xs">
            <PriceStatusBadge
              status={syncStatus === 'live' ? 'live' : syncStatus === 'mixed' ? 'cached' : 'fallback'}
              size="sm"
            />
            <span className="text-gray-400">
              {syncStatus === 'live' && 'Live pricing from cloud APIs'}
              {syncStatus === 'mixed' && 'Mixed data — some providers using cached prices'}
              {syncStatus === 'demo' && 'Using estimated pricing data (API unavailable)'}
            </span>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-xs text-gray-400 hover:text-gray-200"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh data
          </button>
        </div>
      )}

      {/* Configuration Section */}
      <div className="mb-4 space-y-3">
        {/* Infracost API Key Configuration */}
        <div>
          <button
            onClick={() => setShowApiConfig(!showApiConfig)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs text-gray-400 hover:text-gray-200"
          >
            <Key className="w-3 h-3" />
            {showApiConfig ? 'Hide' : 'Configure'} Infracost API Key
          </button>
          {showApiConfig && (
            <div className="mt-2 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestStatus(null); setTestMessage(''); }}
                placeholder="Paste your Infracost API key..."
                className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-400/50"
              />
              <button
                onClick={handleTestApiKey}
                disabled={!apiKey.trim() || testStatus === 'testing'}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300"
              >
                {testStatus === 'testing' ? (
                  <Loader className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                Test Connection
              </button>
              {testStatus === 'success' && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  {testMessage}
                </span>
              )}
              {testStatus === 'error' && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <XCircle className="w-3 h-3" />
                  {testMessage}
                </span>
              )}
            </div>
          )}
        </div>

        {/* AWS Credentials Configuration */}
        <div>
          <button
            onClick={() => {
              setShowAwsConfig(!showAwsConfig);
              if (!showAwsConfig && maskedAwsKey) {
                setAwsAccessKey(maskedAwsKey);
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs text-gray-400 hover:text-gray-200"
          >
            <Key className="w-3 h-3" />
            {showAwsConfig ? 'Hide' : 'Configure'} AWS Credentials
            {maskedAwsKey && !showAwsConfig && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">
                Configured: {maskedAwsKey}
              </span>
            )}
          </button>
          {showAwsConfig && (
            <div className="mt-2 flex flex-col gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={awsAccessKey}
                  onChange={(e) => { setAwsAccessKey(e.target.value); setAwsTestStatus(null); setAwsTestMessage(''); setAwsSaveStatus(null); }}
                  placeholder="AWS Access Key ID (e.g., AKIA...)"
                  className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-400/50"
                />
                <input
                  type="password"
                  value={awsSecretKey}
                  onChange={(e) => { setAwsSecretKey(e.target.value); setAwsTestStatus(null); setAwsTestMessage(''); setAwsSaveStatus(null); }}
                  placeholder="AWS Secret Access Key"
                  className="flex-1 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-400/50"
                />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleTestAwsCredentials}
                  disabled={!awsAccessKey.trim() || !awsSecretKey.trim() || awsTestStatus === 'testing' || awsSaveStatus === 'saving'}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300"
                >
                  {awsTestStatus === 'testing' ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  Test Connection
                </button>
                <button
                  onClick={handleSaveAwsCredentials}
                  disabled={awsTestStatus !== 'success' || awsSaveStatus === 'saving'}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300"
                >
                  {awsSaveStatus === 'saving' ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Credentials
                </button>
                {maskedAwsKey && (
                  <button
                    onClick={handleRemoveAwsCredentials}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
                {awsTestStatus === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    {awsTestMessage}
                  </span>
                )}
                {awsTestStatus === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle className="w-3 h-3" />
                    {awsTestMessage}
                  </span>
                )}
                {awsSaveStatus === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    {awsSaveMessage}
                  </span>
                )}
                {awsSaveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle className="w-3 h-3" />
                    {awsSaveMessage}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* GCP Credentials Configuration */}
        <div>
          <button
            onClick={() => {
              setShowGcpConfig(!showGcpConfig);
              if (!showGcpConfig && maskedGcpEmail) {
                setGcpJsonContent(`{"type": "service_account", "client_email": "${maskedGcpEmail}", ...}`);
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-xs text-gray-400 hover:text-gray-200"
          >
            <Key className="w-3 h-3" />
            {showGcpConfig ? 'Hide' : 'Configure'} GCP Credentials
            {maskedGcpEmail && !showGcpConfig && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">
                Configured: {maskedGcpEmail}
              </span>
            )}
          </button>
          {showGcpConfig && (
            <div className="mt-2 flex flex-col gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <textarea
                value={gcpJsonContent}
                onChange={(e) => { setGcpJsonContent(e.target.value); setGcpTestStatus(null); setGcpTestMessage(''); setGcpSaveStatus(null); }}
                placeholder='Paste your entire GCP Service Account JSON here (e.g., {"type": "service_account", "project_id": "...", ...})'
                rows={6}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-xs font-mono placeholder-gray-500 focus:outline-none focus:border-blue-400/50 resize-y"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleTestGcpCredentials}
                  disabled={!gcpJsonContent.trim() || gcpTestStatus === 'testing' || gcpSaveStatus === 'saving'}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300"
                >
                  {gcpTestStatus === 'testing' ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  Test Connection
                </button>
                <button
                  onClick={handleSaveGcpCredentials}
                  disabled={gcpTestStatus !== 'success' || gcpSaveStatus === 'saving'}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300"
                >
                  {gcpSaveStatus === 'saving' ? (
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Credentials
                </button>
                {maskedGcpEmail && (
                  <button
                    onClick={handleRemoveGcpCredentials}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
                {gcpTestStatus === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    {gcpTestMessage}
                  </span>
                )}
                {gcpTestStatus === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle className="w-3 h-3" />
                    {gcpTestMessage}
                  </span>
                )}
                {gcpSaveStatus === 'success' && (
                  <span className="flex items-center gap-1 text-xs text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    {gcpSaveMessage}
                  </span>
                )}
                {gcpSaveStatus === 'error' && (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle className="w-3 h-3" />
                    {gcpSaveMessage}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <DashboardMetrics
        services={services}
        optimizationSuggestions={optimizationSuggestions}
        className="mb-4"
      />

      {/* Main Layout */}
      <div className="flex gap-4">
        {/* Left Sidebar - Filters */}
        <div className={`${showFilters ? 'w-72 flex-shrink-0' : 'w-0 overflow-hidden'} transition-all duration-300`}>
          <div className="space-y-4">
            <ProviderSelector
              selectedProviders={selectedProviders}
              onProviderToggle={handleProviderToggle}
            />
            <RegionSelector
              selectedProviders={selectedProviders}
              selectedRegions={selectedRegions}
              onRegionToggle={handleRegionToggle}
            />
            <CategoryFilter
              selectedCategories={selectedCategories}
              onCategoryToggle={handleCategoryToggle}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="mb-3 flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors"
          >
            {showFilters ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>

          <div className="flex gap-1 mb-4 bg-white/5 rounded-xl p-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'catalog' && (
            <ServiceCatalog
              selectedProviders={selectedProviders}
              selectedRegions={selectedRegions}
              selectedCategories={selectedCategories}
              searchTerm={searchTerm}
              onServicesLoaded={handleServicesLoaded}
              onAddToCompare={handleAddToCompare}
              isInComparison={isServiceInComparison}
            />
          )}

          {activeTab === 'regional' && (
            <RegionalPriceComparison
              selectedProviders={selectedProviders.length > 0 ? selectedProviders : ['aws', 'azure', 'gcp', 'tata_cloud', 'jio_cloud', 'yotta', 'nxtgen']}
            />
          )}

          {activeTab === 'compare' && (
            <ComparisonPanel
              comparisonServices={comparisonServices}
              onRemoveService={removeFromComparison}
              onClearAll={clearComparison}
            />
          )}

          {activeTab === 'estimate' && (
            <CostEstimator
              selectedProviders={selectedProviders}
              selectedCategories={selectedCategories}
            />
          )}
        </div>

        {/* Right Sidebar - Optimization */}
        <div className={`${showOptimization ? 'w-80 flex-shrink-0' : 'w-0 overflow-hidden'} transition-all duration-300 hidden xl:block`}>
          <OptimizationPanel
            selectedProviders={selectedProviders}
            selectedCategories={selectedCategories}
            autoAnalyze={false}
          />
        </div>
      </div>
    </div>
  );
};

export default MultiCloudDashboard;