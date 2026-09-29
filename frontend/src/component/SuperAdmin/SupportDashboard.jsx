// src/components/SuperAdmin/SupportDashboard.jsx
// Redesigned with Academic Precision System (redesign/DESIGN.md)
// Institutional Helpdesk, Statutory Compliance Appeals, and Tier-3 COE Ticket Escalations
import React, { useState, useEffect, useCallback } from "react";
import {
  LifeBuoy,
  RefreshCw,
  CheckCircle2,
  Clock,
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
  InboxIcon,
  HelpCircle,
} from "lucide-react";
import api from "../../utils/api";
import { formatDateDMY, formatDateTime } from "../../utils/dateUtils";
import { logError } from "../../utils/logger";
import EmptyState from "../common/ui/EmptyState";

// Constants
const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "trial_expired", label: "Trial Expired" },
  { value: "billing", label: "Billing & Ledger" },
  { value: "technical", label: "Technical & API" },
  { value: "account", label: "Account Governance" },
  { value: "other", label: "General Inquiry" },
];

const STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITIES = [
  { value: "", label: "All Priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const SupportDashboard = () => {
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState({ open: 0, inProgress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [filters, setFilters] = useState({ status: "open", priority: "", category: "" });

  // Per-ticket action state
  const [expanded, setExpanded] = useState({});
  const [noteInput, setNoteInput] = useState({});
  const [statusInput, setStatusInput] = useState({});
  const [resolutionInput, setResolutionInput] = useState({});
  const [actionLoading, setActionLoading] = useState({});

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.category) params.set("category", filters.category);
      params.set("limit", "50");

      const res = await api.get(`/support/admin/all?${params}`);
      if (res.data.success) {
        setTickets(res.data.data?.tickets || []);
        setSummary(res.data.data?.summary || {});
      }
    } catch (err) {
      logError("Fetch Tickets", err);
      setError(err.response?.data?.message || "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const setTicketLoading = (id, val) =>
    setActionLoading((prev) => ({ ...prev, [id]: val }));

  // Update status
  const handleUpdateStatus = async (ticket) => {
    const newStatus = statusInput[ticket._id] || ticket.status;
    const resolution = resolutionInput[ticket._id] || "";
    if (newStatus === ticket.status && !resolution) return;

    setTicketLoading(ticket._id, true);
    try {
      await api.put(`/support/admin/${ticket._id}/status`, {
        status: newStatus,
        resolution,
      });
      showSuccess(`Ticket status updated to "${newStatus}".`);
      fetchTickets();
    } catch (err) {
      logError("Update Ticket Status", err);
      setError(err.response?.data?.message || "Failed to update status.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setTicketLoading(ticket._id, false);
    }
  };

  // Add note
  const handleAddNote = async (ticketId) => {
    const content = (noteInput[ticketId] || "").trim();
    if (!content) return;
    setTicketLoading(ticketId, true);
    try {
      await api.post(`/support/admin/${ticketId}/notes`, { content });
      setNoteInput((prev) => ({ ...prev, [ticketId]: "" }));
      showSuccess("Internal note added.");
      fetchTickets();
    } catch (err) {
      logError("Add Ticket Note", err);
      setError(err.response?.data?.message || "Failed to save note.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setTicketLoading(ticketId, false);
    }
  };

  const toggleExpand = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-6 font-sans antialiased text-slate-900">
      {/* 1. Header Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Institutional Helpdesk & Ticket Escalations
            </h1>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Statutory compliance inquiries, COE ticket discrepancies, and Tier-3 technical support tickets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTickets}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="rounded-xl p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Open Inquiries
            </span>
            <span className="text-3xl font-black text-slate-900 tabular-nums mt-1 block">
              {summary.open ?? 0}
            </span>
            <span className="text-[11px] text-amber-600 font-semibold mt-1 block">Awaiting First Response</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              In Investigation
            </span>
            <span className="text-3xl font-black text-slate-900 tabular-nums mt-1 block">
              {summary.inProgress ?? 0}
            </span>
            <span className="text-[11px] text-primary font-semibold mt-1 block">Active Engineering Review</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center border border-primary-surface">
            <LifeBuoy className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Resolved Cases
            </span>
            <span className="text-3xl font-black text-slate-900 tabular-nums mt-1 block">
              {summary.resolved ?? 0}
            </span>
            <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Resolved & Archived</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider mr-2">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Filter Queue:</span>
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <select
            value={filters.priority}
            onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <select
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-400 font-mono ml-auto">
            {tickets.length} tickets matching filters
          </span>
        </div>
      </div>

      {/* 4. Ticket Cards List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200/80 p-5 animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          title="No support tickets found"
          description="All institutional inquiries matching this filter set have been attended to."
          icon={LifeBuoy}
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => {
            const isExpanded = !!expanded[t._id];
            const isLoading = !!actionLoading[t._id];

            return (
              <div
                key={t._id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm transition-all overflow-hidden"
              >
                {/* Collapsed Header Bar */}
                <div
                  onClick={() => toggleExpand(t._id)}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Priority pill */}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          t.priority === "urgent"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : t.priority === "high"
                            ? "bg-orange-50 text-orange-700 border border-orange-200"
                            : t.priority === "medium"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {t.priority || "normal"}
                      </span>

                      {/* Status pill with dot */}
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                          t.status === "open"
                            ? "text-amber-700 bg-amber-50 border-amber-200"
                            : t.status === "in_progress"
                            ? "text-primary-dark bg-primary-soft border-primary-surface"
                            : t.status === "resolved"
                            ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                            : "text-slate-600 bg-slate-100 border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            t.status === "open"
                              ? "bg-amber-500"
                              : t.status === "in_progress"
                              ? "bg-primary"
                              : t.status === "resolved"
                              ? "bg-emerald-500"
                              : "bg-slate-400"
                          }`}
                        />
                        <span className="capitalize">{t.status?.replace("_", " ")}</span>
                      </span>

                      {/* Category */}
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {t.category || "General"}
                      </span>

                      <h3 className="font-bold text-sm text-slate-900 truncate">
                        {t.subject}
                      </h3>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono flex-wrap">
                      <span className="font-semibold text-primary-dark flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {t.tenantId?.name || "Institution Campus"}
                      </span>
                      <span>•</span>
                      <span>By {t.createdBy?.name || "Official"} ({t.createdBy?.email || "—"})</span>
                      <span>•</span>
                      <span>{formatDateDMY(t.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end lg:self-center">
                    <span className="text-xs font-bold text-primary inline-flex items-center gap-1">
                      <span>{isExpanded ? "Collapse" : "Open Thread"}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </div>
                </div>

                {/* Expanded Thread Drawer */}
                {isExpanded && (
                  <div className="p-5 bg-slate-50 border-t border-slate-100 space-y-5 text-xs">
                    {/* Inquiry Description */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Inquiry Statement / Description
                      </span>
                      <p className="text-slate-800 leading-relaxed text-xs whitespace-pre-wrap">
                        {t.description}
                      </p>
                    </div>

                    {/* Previous Resolution */}
                    {t.resolution && (
                      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                          <CheckCheck className="w-3.5 h-3.5" />
                          <span>Official Resolution Record</span>
                        </span>
                        <p className="text-emerald-900 text-xs leading-relaxed">
                          {t.resolution}
                        </p>
                      </div>
                    )}

                    {/* Internal Notes History */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Internal Administrative Audit Notes ({t.notes?.length || 0})
                      </span>
                      {t.notes && t.notes.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {t.notes.map((note, idx) => (
                            <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                                <span className="font-semibold text-slate-700">{note.addedBy?.name || "Super Administrator"}</span>
                                <span>{formatDateTime(note.createdAt)}</span>
                              </div>
                              <p className="text-slate-700 text-xs">{note.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-xs italic">No internal notes appended yet.</p>
                      )}

                      {/* Add Note Input */}
                      <div className="flex gap-2 pt-2">
                        <input
                          type="text"
                          placeholder="Append internal investigation note..."
                          value={noteInput[t._id] || ""}
                          onChange={(e) => setNoteInput((prev) => ({ ...prev, [t._id]: e.target.value }))}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs"
                        />
                        <button
                          onClick={() => handleAddNote(t._id)}
                          disabled={isLoading || !(noteInput[t._id] || "").trim()}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition inline-flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Add Note</span>
                        </button>
                      </div>
                    </div>

                    {/* Status & Resolution Form */}
                    <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3 items-end">
                      <div className="w-full sm:w-48">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Update Status
                        </label>
                        <select
                          value={statusInput[t._id] || t.status}
                          onChange={(e) => setStatusInput((prev) => ({ ...prev, [t._id]: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none cursor-pointer"
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>

                      <div className="flex-1 w-full">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Resolution Summary Notes
                        </label>
                        <input
                          type="text"
                          placeholder="Summary of actions taken to resolve inquiry..."
                          value={resolutionInput[t._id] || ""}
                          onChange={(e) => setResolutionInput((prev) => ({ ...prev, [t._id]: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>

                      <button
                        onClick={() => handleUpdateStatus(t)}
                        disabled={isLoading}
                        className="px-5 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl text-xs shadow-xs transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {isLoading ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SupportDashboard;
