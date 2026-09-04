// src/components/Admin/SupportPanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LifeBuoy,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  X,
  Send,
  ChevronRight,
  Loader2,
  Crown,
  ArrowUpRight,
  FileText,
  MessageSquare,
  Tag,
  AlertTriangle,
} from 'lucide-react';
import api from "../../utils/api";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import EmptyState from "../common/ui/EmptyState";
import DashboardHeader from "../common/ui/DashboardHeader";
import Input, { Select, Textarea } from "../common/ui/Input";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'trial_expired', label: 'Trial Expired' },
  { value: 'billing',       label: 'Billing Issue' },
  { value: 'technical',     label: 'Technical Issue' },
  { value: 'account',       label: 'Account Access' },
  { value: 'other',         label: 'Other' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: '#6b7280' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high',   label: 'High',   color: '#ef4444' },
  { value: 'urgent', label: 'Urgent', color: '#7c3aed' },
];

const STATUS_CONFIG = {
  open:        { label: 'Open',        tone: 'info' },
  in_progress: { label: 'In Progress', tone: 'warning' },
  resolved:    { label: 'Resolved',    tone: 'success' },
  closed:      { label: 'Closed',      tone: 'neutral' },
};

const PRIORITY_TONES = { low: 'neutral', medium: 'warning', high: 'danger', urgent: 'secondary' };

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.open;
  return <Badge tone={cfg.tone} size="sm" dot>{cfg.label}</Badge>;
};

const PriorityBadge = ({ priority }) => {
  const cfg = PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
  return (
    <Badge tone={PRIORITY_TONES[cfg.value] || 'neutral'} size="sm">
      <AlertTriangle className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SupportPanel = () => {
  const [tickets,      setTickets]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState(null);
  const [successMsg,   setSuccessMsg]   = useState(null);
  const [showForm,     setShowForm]     = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Subscription status from localStorage (set by the dashboard)
  const subscriptionStatus = localStorage.getItem('subscriptionStatus') || null;
  const isExpired = subscriptionStatus === 'expired';

  const [form, setForm] = useState({
    subject:     '',
    description: '',
    category:    'trial_expired',
    priority:    'high',
  });
  const [formErrors, setFormErrors] = useState({});

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/support/my-tickets');
      if (res.data.success) setTickets(res.data.data.tickets || []);
    } catch (err) {
      if (err.response?.status !== 403) {
        setError(err.response?.data?.message || 'Failed to load tickets.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const validateForm = () => {
    const errs = {};
    if (!form.subject.trim() || form.subject.trim().length < 5)
      errs.subject = 'Subject must be at least 5 characters.';
    if (!form.description.trim() || form.description.trim().length < 20)
      errs.description = 'Description must be at least 20 characters.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateForm();
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return; }
    setFormErrors({});
    setSubmitting(true);
    try {
      const res = await api.post('/support', form);
      if (res.data.success) {
        setSuccessMsg(res.data.message);
        setShowForm(false);
        setForm({ subject: '', description: '', category: 'trial_expired', priority: 'high' });
        fetchTickets();
        setTimeout(() => setSuccessMsg(null), 6000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit ticket.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Institutional Helpdesk & Support"
        meta={`Direct assistance, trial reactivations, billing inquiries, and issue resolution (${openCount} active tickets)`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="subtle" size="sm" leftIcon={RefreshCw} onClick={fetchTickets}>
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={Plus}
              onClick={() => setShowForm(true)}
              disabled={showForm || openCount >= 5}
            >
              New Ticket
            </Button>
          </div>
        }
      />

      {/* Expired Trial Banner */}
      {isExpired && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-5 border border-amber-200 bg-amber-50 flex flex-col sm:flex-row sm:items-center gap-4"
        >
          <div className="flex items-start gap-3 flex-1">
            <Crown className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Your free trial has expired</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Raise a support ticket below to request reactivation. Once our team verifies your account,
                you'll be moved to the free plan and can upgrade at any time.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(true); setForm(f => ({ ...f, category: 'trial_expired', priority: 'high' })); }}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition flex items-center gap-2 flex-shrink-0"
          >
            <ArrowUpRight className="w-4 h-4" /> Contact Support
          </button>
        </motion.div>
      )}

      {/* Rate-limit warning */}
      {openCount >= 5 && (
        <div className="rounded-xl p-4 bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          You have 5 open tickets. Please wait for them to be resolved before raising a new one.
        </div>
      )}

      {/* Success / Error banners */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl p-4 bg-green-50 border border-green-200 text-green-700 flex items-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            {successMsg}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl p-4 bg-red-50 border border-red-200 text-red-700 flex items-center gap-2"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Ticket Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
          >
            <Card padding="lg">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  New Support Ticket
                </h2>
                <button onClick={() => { setShowForm(false); setFormErrors({}); }}
                  className="p-1.5 hover:bg-background rounded-lg transition">
                  <X className="w-4 h-4 text-ink-faint" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label={<span>Subject <span className="text-red-500">*</span></span>}
                  type="text"
                  value={form.subject}
                  maxLength={150}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="Brief summary of your issue"
                  error={formErrors.subject}
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <Select
                    label="Category"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                  <Select
                    label="Priority"
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  >
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </Select>
                </div>

                <Textarea
                  label={<span>Description <span className="text-red-500">*</span> <span className="text-ink-faint font-normal ml-2">({form.description.length}/2000)</span></span>}
                  rows={5}
                  value={form.description}
                  maxLength={2000}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe your issue in detail. Include any error messages, steps to reproduce, or context that would help our team."
                  error={formErrors.description}
                />

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); setFormErrors({}); }}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    leftIcon={Send}
                    disabled={submitting}
                    loading={submitting}
                  >
                    {submitting ? 'Submitting…' : 'Submit Ticket'}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tickets List */}
      <Card padding="none">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h2 className="font-semibold text-ink">My Tickets</h2>
          {tickets.length > 0 && (
            <span className="text-xs text-ink-faint">{tickets.length} total</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-ink-faint" />
          </div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No tickets yet"
            description={'Create a support ticket using the "New Ticket" button above.'}
          />
        ) : (
          <div className="divide-y divide-line">
            {tickets.map(ticket => (
              <motion.div
                key={ticket._id}
                layout
                className="px-6 py-4 hover:bg-background/60 transition cursor-pointer"
                onClick={() => setSelectedTicket(selectedTicket?._id === ticket._id ? null : ticket)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-ink truncate">{ticket.subject}</p>
                      <StatusBadge status={ticket.status} />
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-ink-faint flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {CATEGORIES.find(c => c.value === ticket.category)?.label || ticket.category}
                      </span>
                      <span className="text-xs text-ink-faint flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-ink-faint transition-transform flex-shrink-0 mt-1 ${selectedTicket?._id === ticket._id ? 'rotate-90' : ''}`} />
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {selectedTicket?._id === ticket._id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-3">
                        <div className="p-3 bg-background rounded-lg text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">
                          {ticket.description}
                        </div>
                        {ticket.resolution && (
                          <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                            <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Resolution
                            </p>
                            <p className="text-sm text-green-800">{ticket.resolution}</p>
                          </div>
                        )}
                        {ticket.tenantReactivated && (
                          <div className="p-3 bg-secondary-soft border border-secondary-surface rounded-lg text-sm text-secondary-dark flex items-center gap-2">
                            <Crown className="w-4 h-4 flex-shrink-0" />
                            Your account has been reactivated on the free plan. You can now upgrade at any time.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default SupportPanel;
