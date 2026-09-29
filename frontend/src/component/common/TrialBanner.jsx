import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, ArrowRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../../utils/api';

export const TrialBanner = ({ subscription, tenantId, onRefresh, role }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!subscription || role === 'super_admin') return null;

  const isTrial = subscription.status === 'trial' || (subscription.plan === 'free' && Boolean(subscription.trialEndsAt));
  const isInGrace = Boolean(subscription.isInGracePeriod);

  if (!isTrial && !isInGrace) return null;

  const now = Date.now();
  const trialEnd = subscription.trialEndsAt ? new Date(subscription.trialEndsAt).getTime() : 0;
  const diffDays = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
  const isExpiringSoon = diffDays <= 3;

  if (!isExpiringSoon && !isInGrace) return null;

  const handleContinueFree = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post('/billing/continue-free', {
        tenantId: tenantId || localStorage.getItem('tenantId'),
      });
      if (res.data?.success) {
        setSuccess('Switched to Free Tier successfully!');
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to switch to Free Tier');
    } finally {
      setLoading(false);
    }
  };

  const graceDaysRemaining = subscription.graceDaysLeft || Math.max(1, Math.ceil((trialEnd + 3 * 24 * 60 * 60 * 1000 - now) / (1000 * 60 * 60 * 24)));

  return (
    <div
      className={`w-full px-4 py-2.5 text-xs sm:text-sm border-b transition-colors ${
        isInGrace
          ? 'bg-rose-500/10 text-rose-950 dark:text-rose-200 border-rose-500/30'
          : 'bg-amber-500/10 text-amber-950 dark:text-amber-200 border-amber-500/30'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Message */}
        <div className="flex items-center gap-2">
          {isInGrace ? (
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span className="font-medium">
            {isInGrace ? (
              <>
                <strong className="font-semibold">Trial Grace Period Active:</strong> Your trial has concluded. You have{' '}
                <strong className="font-bold">{graceDaysRemaining} day(s)</strong> of grace remaining before lockout.
              </>
            ) : (
              <>
                <strong className="font-semibold">Trial Ending Soon:</strong> Your AttendEase trial ends in{' '}
                <strong className="font-bold">
                  {diffDays <= 0 ? 'less than a day' : `${diffDays} day(s)`}
                </strong>
                .
              </>
            )}
            {success ? (
              <span className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">
                {success}
              </span>
            ) : error ? (
              <span className="ml-2 text-rose-600 dark:text-rose-400">{error}</span>
            ) : null}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {role === 'admin' && (
            <>
              <button
                type="button"
                onClick={handleContinueFree}
                disabled={loading}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-line/60 bg-surface text-ink hover:bg-surface-hover hover:border-line transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Switching...' : 'Continue Free Tier'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/billing')}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-primary text-white hover:opacity-90 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <span>Upgrade Plan</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;
