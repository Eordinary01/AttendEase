import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  School,
  Search,
  ExternalLink,
  Copy,
  Check,
  X,
  Building2,
  ArrowRight,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react';
import api from '../../utils/api';
import {
  getRecentTenants,
  setActiveTenant,
  removeRecentTenant,
  getTenantLoginUrl,
  getFullTenantUrl
} from '../../utils/activeTenant';

export default function CampusSwitcherModal({ isOpen, onClose, onSelectTenant }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSubdomain, setCopiedSubdomain] = useState(null);
  const [manualSubdomain, setManualSubdomain] = useState('');
  const [recentTenants, setRecentTenants] = useState([]);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // Load recents on open & fetch default featured list
  useEffect(() => {
    if (isOpen) {
      setRecentTenants(getRecentTenants());
      setQuery('');
      setManualSubdomain('');
      setError(null);
      fetchTenants('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle debounce search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchTenants(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const fetchTenants = async (searchTerm) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/landing/search-tenants', {
        params: { q: searchTerm || '', _t: Date.now() },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setResults(res.data.data);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.warn('Failed to search tenants:', err);
      // Fallback: don't break UI, just provide empty
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRecent = (e, subdomain) => {
    e.stopPropagation();
    removeRecentTenant(subdomain);
    setRecentTenants(getRecentTenants());
  };

  const handleSelect = (tenant) => {
    setActiveTenant(tenant);
    if (onSelectTenant) {
      onSelectTenant(tenant);
    }
    onClose();
  };

  const handleCopy = (e, subdomain) => {
    e.stopPropagation();
    const url = getFullTenantUrl(subdomain);
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSubdomain(subdomain);
      setTimeout(() => setCopiedSubdomain(null), 2000);
    });
  };

  const handleManualGo = (e) => {
    e.preventDefault();
    const clean = manualSubdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!clean) return;
    const tenant = {
      subdomain: clean,
      name: `${clean.toUpperCase()} Campus`,
    };
    handleSelect(tenant);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-ink/50 backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-surface rounded-2xl shadow-2xl border border-line overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Top Decorative Roofline Crest */}
          <div className="h-1.5 w-full bg-gradient-to-r from-primary via-indigo-600 to-amber-500" />

          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-line bg-surface-subtle flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <School className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg font-bold text-ink">Find Campus Portal</h3>
                <p className="text-xs text-ink-muted">
                  Search registered universities, colleges, or enter your dedicated subdomain
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-ink-muted hover:text-ink hover:bg-surface rounded-lg transition-colors border border-transparent hover:border-line"
              aria-label="Close campus finder"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-4 sm:p-5 border-b border-line bg-surface">
            <div className="relative">
              <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by institution name or campus subdomain (e.g. stanford, oxford)..."
                className="w-full pl-10 pr-10 py-2.5 bg-surface-subtle border border-line rounded-xl text-sm text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-sans"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Recent Visited Badges */}
            {recentTenants.length > 0 && !query && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-medium text-ink-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Recent:
                </span>
                {recentTenants.map((recent) => (
                  <div
                    key={recent.subdomain}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-surface-subtle hover:bg-primary/10 border border-line hover:border-primary/30 text-xs font-mono text-ink transition-colors group"
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(recent)}
                      className="inline-flex items-center gap-1.5 text-left focus:outline-none"
                    >
                      <span>{recent.name || recent.subdomain}</span>
                      <span className="text-[10px] text-ink-muted">({recent.subdomain})</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveRecent(e, recent.subdomain)}
                      className="p-0.5 text-ink-muted hover:text-rose-600 rounded hover:bg-surface transition ml-0.5"
                      title={`Remove ${recent.name || recent.subdomain} from recents`}
                      aria-label={`Remove ${recent.name || recent.subdomain} from recents`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Institution List */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1 min-h-[220px]">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-ink-muted gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs">Searching registered institutions...</span>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider px-1">
                  {query ? 'Matching Institutions' : 'Featured & Active Campuses'}
                </div>
                {results.map((tenant) => (
                  <div
                    key={tenant.id || tenant.subdomain}
                    onClick={() => handleSelect(tenant)}
                    className="group flex items-center justify-between p-3 rounded-xl border border-line bg-surface hover:bg-surface-subtle hover:border-primary/40 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {tenant.logo ? (
                        <img
                          src={tenant.logo}
                          alt={tenant.name}
                          className="w-10 h-10 rounded-lg object-contain border border-line bg-white p-1 flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm text-white flex-shrink-0 shadow-xs"
                          style={{
                            backgroundColor: tenant.primaryColor || '#1e3a8a',
                          }}
                        >
                          {(tenant.name || tenant.subdomain).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-ink group-hover:text-primary transition-colors truncate">
                            {tenant.name}
                          </h4>
                          <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-line font-mono text-[10px] text-ink-muted flex-shrink-0">
                            {tenant.subdomain}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-ink-muted truncate mt-0.5">
                          /login/{tenant.subdomain}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, tenant.subdomain)}
                        className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface border border-transparent hover:border-line transition"
                        title="Copy direct portal link"
                      >
                        {copiedSubdomain === tenant.subdomain ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white font-medium text-xs flex items-center gap-1 transition-colors">
                        <span>Portal</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center px-4">
                <Building2 className="w-8 h-8 text-ink-muted mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-ink">No institutions found matching "{query}"</p>
                <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
                  If your institution was recently provisioned, enter your assigned subdomain directly below.
                </p>
              </div>
            )}
          </div>

          {/* Footer: Direct Subdomain Input */}
          <div className="p-4 sm:p-5 border-t border-line bg-surface-subtle">
            <form onSubmit={handleManualGo} className="space-y-2">
              <label className="block text-xs font-medium text-ink">
                Direct Subdomain Walkthrough
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={manualSubdomain}
                    onChange={(e) => setManualSubdomain(e.target.value)}
                    placeholder="e.g. mit, oxford, dps"
                    className="w-full px-3 py-2 bg-surface border border-line rounded-xl text-sm font-mono text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-ink-muted pointer-events-none">
                    .attendease.com
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={!manualSubdomain.trim()}
                  className="px-4 py-2 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <span>Go to Login</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
