// src/components/SuperAdmin/SupportDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LifeBuoy,
  RefreshCw,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Crown,
  Tag,
  Building2,
  Filter,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  CheckCheck,
  X,
  Zap,
  StickyNote,
  Send,
  AlertTriangle,
  TrendingUp,
  InboxIcon,
} from 'lucide-react';
import api from '../../utils/api';
import Button from '../common/ui/Button';
import Card from '../common/ui/Card';
import Badge from '../common/ui/Badge';
import StatCard from '../common/ui/StatCard';
import PageHeader from '../common/ui/PageHeader';
import { Select, Input } from '../common/ui/Input';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: '',             label: 'All Categories' },
  { value: 'trial_expired', label: 'Trial Expired' },
  { value: 'billing',       label: 'Billing' },
  { value: 'technical',     label: 'Technical' },
  { value: 'account',       label: 'Account' },
  { value: 'other',         label: 'Other' },
];

const STATUSES = [
  { value: '',            label: 'All Statuses' },
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
  { value: 'closed',      label: 'Closed' },
];

const PRIORITIES = [
  { value: '',        label: 'All Priorities' },
  { value: 'urgent',  label: 'Urgent' },
  { value: 'high',    label: 'High' },
  { value: 'medium',  label: 'Medium' },
  { value: 'low',     label: 'Low' },
];

const STATUS_TONES = {
  open:        'info',
  in_progress: 'warning',
  resolved:    'success',
  closed:      'neutral',
};

const PRIORITY_TONES = {
  urgent: 'primary',
  high:   'danger',
  medium: 'warning',
  low:    'neutral',
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SupportDashboard = () => {
  const [tickets,    setTickets]    = useState([]);
  const [summary,    setSummary]    = useState({ open: 0, inProgress: 0, resolved: 0 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [filters, setFilters] = useState({ status: 'open', priority: '', category: '' });

  // Per-ticket action state
  const [expanded,       setExpanded]       = useState({});       // { ticketId: bool }
  const [noteInput,      setNoteInput]      = useState({});       // { ticketId: string }
  const [statusInput,    setStatusInput]    = useState({});       // { ticketId: string }
  const [resolutionInput, setResolutionInput] = useState({});     // { ticketId: string }
  const [actionLoading,  setActionLoading]  = useState({});       // { ticketId: bool }

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.status)   params.set('status',   filters.status);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.category) params.set('category', filters.category);
      params.set('limit', '50');

      const res = await api.get(`/support/admin/all?${params}`);
      if (res.data.success) {
        setTickets(res.data.data?.tickets || []);
        setSummary(res.data.data?.summary || {});
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const setTicketLoading = (id, val) =>
    setActionLoading(prev => ({ ...prev, [id]: val }));

  // Update status
  const handleUpdateStatus = async (ticket) => {
    const newStatus = statusInput[ticket._id] || ticket.status;
    const resolution = resolutionInput[ticket._id] || '';
    if (newStatus === ticket.status && !resolution) return;

    setTicketLoading(ticket._id, true);
    try {
      await api.put(`/support/admin/${ticket._id}/status`,
        { status: newStatus, resolution });
      showSuccess(`Ticket status updated to "${newStatus}".`);
      fetchTickets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setTicketLoading(ticket._id, false);
    }
  };

  // Add note
  const handleAddNote = async (ticketId) => {
    const content = (noteInput[ticketId] || '').trim();
    if (!content) return;
    setTicketLoading(ticketId, true);
    try {
      await api.post(`/support/admin/${ticketId}/notes`, { content });
      setNoteInput(prev => ({ ...prev, [ticketId]: '' }));
      showSuccess('Note added.');
      fetchTickets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add note.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setTicketLoading(ticketId, false);
    }
  };

  // Resolve & Reactivate
  const handleResolveReactivate = async (ticket) => {
    const resolution = resolutionInput[ticket._id] ||
      `Account reactivated on free plan. You may now upgrade anytime. — ${new Date().toLocaleDateString()}`;
    if (!window.confirm(`Resolve ticket and reactivate tenant "${ticket.tenantName}" on the free plan?`)) return;

    setTicketLoading(ticket._id, true);
    try {
      await api.post(`/support/admin/${ticket._id}/resolve-reactivate`,
        { resolution });
      showSuccess(`✅ Ticket resolved and "${ticket.tenantName}" reactivated on free plan!`);
      fetchTickets();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve and reactivate.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setTicketLoading(ticket._id, false);
    }
  };

  const toggleExpand = (id) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title="Support Dashboard"
        subtitle="Review and resolve tenant support tickets."
        icon={LifeBuoy}
        actions={
          <Button onClick={fetchTickets} variant="outline" leftIcon={RefreshCw}>
            Refresh
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={InboxIcon}      label="Open"        value={summary.open        || 0} tone="primary" />
        <StatCard icon={TrendingUp}     label="In Progress" value={summary.inProgress  || 0} tone="warning" />
        <StatCard icon={CheckCheck}     label="Resolved"    value={summary.resolved    || 0} tone="success" />
        <StatCard icon={Crown}          label="Total"       value={(summary.open || 0) + (summary.inProgress || 0) + (summary.resolved || 0)} tone="secondary" />
      </div>

      {/* Banners */}
      <AnimatePresence>
        {successMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-xl p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />{successMsg}
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-xl p-4 bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />{error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-ink-faint" />
          {[
            { key: 'status',   options: STATUSES },
            { key: 'priority', options: PRIORITIES },
            { key: 'category', options: CATEGORIES },
          ].map(({ key, options }) => (
            <Select
              key={key}
              value={filters[key]}
              onChange={e => setFilters(prev => ({ ...prev, [key]: e.target.value }))}
              className="w-auto min-w-[160px] capitalize"
            >
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ))}
          {(filters.status || filters.priority || filters.category) && (
            <button onClick={() => setFilters({ status: '', priority: '', category: '' })}
              className="text-xs text-ink-faint hover:text-red-500 flex items-center gap-1 transition">
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </Card>

      {/* Tickets */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between bg-background/60">
          <h2 className="font-semibold text-ink">Tickets</h2>
          {!loading && <span className="text-xs text-ink-faint">{tickets.length} shown</span>}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-ink-faint" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="w-12 h-12 text-ink-faint mb-3" />
            <p className="font-medium text-ink-soft">No tickets match these filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {tickets.map(ticket => {
              const isOpen = expanded[ticket._id];
              const isLoading = actionLoading[ticket._id];
              const isTrialExpired = ticket.category === 'trial_expired';

              return (
                <div key={ticket._id} className="p-5 hover:bg-background/50 transition">
                  {/* Summary Row */}
                  <div
                    className="flex items-start justify-between gap-4 cursor-pointer"
                    onClick={() => toggleExpand(ticket._id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-ink">{ticket.subject}</p>
                        <Badge tone={STATUS_TONES[ticket.status] || 'neutral'} dot>{ticket.status?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</Badge>
                        <Badge tone={PRIORITY_TONES[ticket.priority] || 'neutral'}>
                          <AlertTriangle className="w-3 h-3" /> {ticket.priority}
                        </Badge>
                        {ticket.tenantReactivated && (
                          <Badge tone="success">
                            <CheckCheck className="w-3 h-3" /> Reactivated
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        <span className="text-xs text-ink-faint flex items-center gap-1">
                          <Building2 className="w-3 h-3" />{ticket.tenantName || 'Unknown Tenant'}
                        </span>
                        <span className="text-xs text-ink-faint">{ticket.submitterEmail}</span>
                        <span className="text-xs text-ink-faint flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {CATEGORIES.find(c => c.value === ticket.category)?.label || ticket.category}
                        </span>
                        <span className="text-xs text-ink-faint flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4 text-ink-faint" /> : <ChevronDown className="w-4 h-4 text-ink-faint" />}
                    </div>
                  </div>

                  {/* Expanded Detail & Actions */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-4">
                          {/* Description */}
                          <div>
                            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-1.5">Description</p>
                            <div className="p-3 bg-background rounded-lg text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">
                              {ticket.description}
                            </div>
                          </div>

                          {/* Subscription context */}
                          {ticket.subscriptionContext && (
                            <div className="flex items-center gap-4 text-xs text-ink-soft bg-background rounded-lg px-3 py-2">
                              <span>Plan at submission: <strong className="text-ink capitalize">{ticket.subscriptionContext.plan}</strong></span>
                              <span>Status: <strong className={`capitalize ${ticket.subscriptionContext.status === 'expired' ? 'text-red-600' : 'text-ink'}`}>{ticket.subscriptionContext.status}</strong></span>
                            </div>
                          )}

                          {/* Existing resolution */}
                          {ticket.resolution && (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg">
                              <p className="text-xs font-semibold text-emerald-700 mb-1">Resolution</p>
                              <p className="text-sm text-emerald-800">{ticket.resolution}</p>
                              {ticket.resolvedByName && (
                                <p className="text-xs text-emerald-600 mt-1">By {ticket.resolvedByName} · {new Date(ticket.resolvedAt).toLocaleDateString()}</p>
                              )}
                            </div>
                          )}

                          {/* Admin notes */}
                          {ticket.adminNotes?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-1.5">Internal Notes</p>
                              <div className="space-y-2">
                                {ticket.adminNotes.map(note => (
                                  <div key={note._id} className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg">
                                    <p className="text-sm text-ink-soft">{note.content}</p>
                                    <p className="text-xs text-ink-faint mt-1">{note.addedByName} · {new Date(note.addedAt).toLocaleDateString()}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* ── Action Panel ── */}
                          {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                            <div className="border border-line rounded-xl p-4 space-y-4 bg-surface">
                              <p className="text-sm font-semibold text-ink">Actions</p>

                              {/* Status update */}
                              <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                  <Select
                                    label="Change Status"
                                    value={statusInput[ticket._id] || ticket.status}
                                    onChange={e => setStatusInput(prev => ({ ...prev, [ticket._id]: e.target.value }))}
                                    className="w-auto min-w-[160px]"
                                  >
                                    {STATUSES.filter(s => s.value).map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                  </Select>
                                </div>
                                <div className="flex-1 min-w-[200px]">
                                  <Input
                                    label="Resolution Note (optional)"
                                    type="text"
                                    value={resolutionInput[ticket._id] || ''}
                                    onChange={e => setResolutionInput(prev => ({ ...prev, [ticket._id]: e.target.value }))}
                                    placeholder="Optional resolution text…"
                                  />
                                </div>
                                <Button
                                  onClick={() => handleUpdateStatus(ticket)}
                                  disabled={isLoading}
                                  loading={isLoading}
                                  leftIcon={CheckCircle2}
                                >
                                  Update
                                </Button>
                              </div>

                              {/* Resolve & Reactivate (only for expired trial tickets) */}
                              {isTrialExpired && !ticket.tenantReactivated && (
                                <div className="flex flex-wrap gap-3 items-center p-3 bg-primary-soft border border-primary-surface rounded-lg">
                                  <div className="flex-1 text-sm text-primary-dark">
                                    <strong>Resolve & Reactivate</strong> — This will mark the ticket resolved and
                                    reactivate <strong>{ticket.tenantName}</strong> on the free plan.
                                  </div>
                                  <Button
                                    onClick={() => handleResolveReactivate(ticket)}
                                    disabled={isLoading}
                                    loading={isLoading}
                                    leftIcon={Zap}
                                  >
                                    Resolve & Reactivate
                                  </Button>
                                </div>
                              )}

                              {/* Add Note */}
                              <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                  <Input
                                    label={<span className="flex items-center gap-1"><StickyNote className="w-3 h-3" /> Internal Note</span>}
                                    type="text"
                                    value={noteInput[ticket._id] || ''}
                                    onChange={e => setNoteInput(prev => ({ ...prev, [ticket._id]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddNote(ticket._id); }}
                                    placeholder="Add an internal note…"
                                  />
                                </div>
                                <Button
                                  onClick={() => handleAddNote(ticket._id)}
                                  disabled={isLoading || !noteInput[ticket._id]?.trim()}
                                  loading={isLoading}
                                  leftIcon={Send}
                                  className="!bg-amber-500 hover:!bg-amber-600"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
};

export default SupportDashboard;
