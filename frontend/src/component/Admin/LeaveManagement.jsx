import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  ShieldCheck,
  RotateCw,
  Layers,
  ChevronRight,
  TrendingUp,
  Download,
  ShieldAlert,
} from "lucide-react";
import api from "../../utils/api";
import { formatDateDMY, formatDateTime, getLocalTodayStr } from "../../utils/dateUtils";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import { Select, Textarea } from "../common/ui/Input";
import UniversalSpinner from "../common/ui/UniversalSpinner";
import EmptyState from "../common/ui/EmptyState";
import Modal from "../common/ui/Modal";

export default function LeaveManagement() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedFlow, setSelectedFlow] = useState("all");

  // Override / Action Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [targetLeave, setTargetLeave] = useState(null);
  const [actionType, setActionType] = useState("approve"); // 'approve' | 'reject' | 'cancel'
  const [remarks, setRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionResult, setActionResult] = useState(null);

  // Reconcile trigger
  const [reconcilingId, setReconcilingId] = useState(null);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedStatus !== "all") params.status = selectedStatus;
      if (selectedType !== "all") params.leaveType = selectedType;
      if (selectedFlow !== "all") params.flowType = selectedFlow;

      const res = await api.get(`/leaves/section/${selectedSection}`, { params });
      if (res.data?.success) {
        setLeaves(res.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching admin leaves:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [selectedSection, selectedStatus, selectedType, selectedFlow]);



  // Export CSV Handler
  const handleExportCsv = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSection !== "all") params.append("section", selectedSection);
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      if (selectedType !== "all") params.append("leaveType", selectedType);
      if (selectedFlow !== "all") params.append("flowType", selectedFlow);

      const res = await api.get(`/leaves/export?${params.toString()}`, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Leave_Register_${getLocalTodayStr()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export leave register CSV.");
    }
  };

  const openActionModal = (leave, action) => {
    setTargetLeave(leave);
    setActionType(action);
    setRemarks("");
    setActionError("");
    setActionResult(null);
    setModalOpen(true);
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!targetLeave) return;

    if (actionType === "reject" && (!remarks || remarks.trim().length < 5)) {
      setActionError("Mandatory remarks (min 5 characters) required when rejecting.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");

      let res;
      if (actionType === "cancel") {
        res = await api.post(`/leaves/${targetLeave._id}/cancel`, {
          reason: remarks.trim() || "Cancelled by administrator",
        });
      } else {
        res = await api.put(`/leaves/${targetLeave._id}/approve`, {
          action: actionType,
          remarks: remarks.trim(),
        });
      }

      if (res.data?.success) {
        setActionResult(res.data);
        setTimeout(() => {
          setModalOpen(false);
          fetchLeaves();
        }, 1200);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to process override action";
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceReconcile = async (leaveId) => {
    try {
      setReconcilingId(leaveId);
      const res = await api.post(`/leaves/${leaveId}/reconcile`);
      if (res.data?.success) {
        fetchLeaves();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to re-reconcile leave attendance");
    } finally {
      setReconcilingId(null);
    }
  };

  const availableSections = Array.from(
    new Set(leaves.map((l) => l.section).filter(Boolean))
  );

  const filteredLeaves = leaves.filter((leave) => {
    const studentName = leave.student?.name?.toLowerCase() || "";
    const rollNo = leave.student?.rollNo?.toLowerCase() || "";
    const reason = leave.reason?.toLowerCase() || "";
    const q = searchQuery.toLowerCase();

    return studentName.includes(q) || rollNo.includes(q) || reason.includes(q);
  });

  // Calculate Metrics
  const totalCount = leaves.length;
  const pendingCount = leaves.filter((l) => l.status === "pending").length;
  const approvedCount = leaves.filter(
    (l) => l.status === "approved" || l.status === "attendance-updated"
  ).length;
  const rejectedCount = leaves.filter((l) => l.status === "rejected").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DashboardHeader
          title="Institutional Leave Management & Reconciliation"
          subtitle="Manage student absence requests across sections, execute administrative overrides, and audit automated attendance reconciliation."
        />
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md" className="border-line">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">Total Applications</p>
          <p className="text-2xl font-black text-ink mt-1">{totalCount}</p>
        </Card>
        <Card padding="md" className="border-line border-l-4 border-l-amber-500">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Pending Review</p>
          <p className="text-2xl font-black text-ink mt-1">{pendingCount}</p>
        </Card>
        <Card padding="md" className="border-line border-l-4 border-l-emerald-500">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Approved & Reconciled</p>
          <p className="text-2xl font-black text-ink mt-1">{approvedCount}</p>
        </Card>
        <Card padding="md" className="border-line border-l-4 border-l-red-500">
          <p className="text-xs font-bold uppercase tracking-wider text-red-600">Rejected</p>
          <p className="text-2xl font-black text-ink mt-1">{rejectedCount}</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card padding="md" className="border-line">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <div className="relative md:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              placeholder="Search by student name, roll number, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <Select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="text-xs"
          >
            <option value="all">All Academic Sections</option>
            {availableSections.map((sec) => (
              <option key={sec} value={sec}>
                Section {sec}
              </option>
            ))}
          </Select>

          <Select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="attendance-updated">Attendance Updated</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </Select>

          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs"
          >
            <option value="all">All Categories</option>
            <option value="medical">Medical</option>
            <option value="od">On Duty (OD)</option>
            <option value="personal">Personal</option>
            <option value="bereavement">Bereavement</option>
            <option value="other">Other</option>
          </Select>

          <Select
            value={selectedFlow}
            onChange={(e) => setSelectedFlow(e.target.value)}
            className="text-xs"
          >
            <option value="all">All Routing Flows</option>
            <option value="single-subject">Single Subject</option>
            <option value="multi-subject">Multi-Subject</option>
            <option value="all-classes">All Classes</option>
          </Select>
        </div>
      </Card>

      {/* Leave Applications Table */}
      <Card padding="none" className="border-line overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 flex justify-center">
            <UniversalSpinner size="lg" />
          </div>
        ) : filteredLeaves.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Calendar}
              title="No Leave Requests"
              description="No applications match the current search or section filter criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line bg-surface-alt/60 text-ink-soft font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Section & Flow</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Leave Window (DD/MM/YYYY)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned Reviewer</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredLeaves.map((leave) => (
                  <tr key={leave._id} className="hover:bg-surface-alt/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-ink">{leave.student?.name}</div>
                      <div className="text-[11px] text-ink-faint font-mono">
                        {leave.student?.rollNo || "No Roll No"}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-ink">Section {leave.section}</span>
                      <div className="mt-0.5">
                        <Badge tone={leave.flowType === "single-subject" ? "neutral" : "purple"} size="sm">
                          {leave.flowType === "single-subject"
                            ? "Single Subject"
                            : leave.flowType === "multi-subject"
                            ? "Multi-Subject"
                            : "All Classes"}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        tone={
                          leave.leaveType === "medical"
                            ? "danger"
                            : leave.leaveType === "od" || leave.leaveType === "on-duty"
                            ? "purple"
                            : "primary"
                        }
                      >
                        {leave.leaveType?.toUpperCase()}
                      </Badge>
                      {leave.examPeriodConflict && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-red-600 font-bold">
                          <ShieldAlert className="h-3 w-3" />
                          <span>Exam Conflict</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-ink">
                        {formatDateDMY(leave.fromDate)}
                        {leave.fromDate !== leave.toDate && ` — ${formatDateDMY(leave.toDate)}`}
                      </div>
                      <div className="text-[11px] text-ink-faint line-clamp-1">{leave.reason}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        tone={
                          leave.status === "approved" || leave.status === "attendance-updated"
                            ? "success"
                            : leave.status === "rejected"
                            ? "danger"
                            : leave.status === "cancelled"
                            ? "neutral"
                            : "warning"
                        }
                      >
                        {leave.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-ink-soft">
                      {leave.mentorId?.name
                        ? `Mentor: ${leave.mentorId.name}`
                        : leave.assignedTeacherId?.name
                        ? `Faculty: ${leave.assignedTeacherId.name}`
                        : "Unassigned"}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      {["approved", "attendance-updated"].includes(leave.status) && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleForceReconcile(leave._id)}
                          disabled={reconcilingId === leave._id}
                          className="text-[11px]"
                        >
                          {reconcilingId === leave._id ? "Reconciling..." : "Re-Reconcile"}
                        </Button>
                      )}

                      {leave.status === "pending" && (
                        <>
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => openActionModal(leave, "approve")}
                            className="text-[11px]"
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => openActionModal(leave, "reject")}
                            className="text-[11px]"
                          >
                            Reject
                          </Button>
                        </>
                      )}

                      {["pending", "approved", "attendance-updated"].includes(leave.status) && (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => openActionModal(leave, "cancel")}
                          className="text-[11px] text-red-600 hover:text-red-700"
                        >
                          Cancel & Revert
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Override / Approval / Cancel Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          actionType === "approve"
            ? "Administrative Leave Approval"
            : actionType === "cancel"
            ? "Cancel Leave & Revert Attendance"
            : "Reject Leave Request"
        }
      >
        {actionResult ? (
          <div className="space-y-4 py-3">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5" />
              <span>{actionResult.message}</span>
            </div>
            {actionResult.reconciliation && (
              <div className="p-3 bg-surface-alt rounded-lg border border-line text-xs space-y-1">
                <p className="font-semibold text-ink">Reconciliation Details:</p>
                <p className="text-ink-soft">
                  • {actionResult.reconciliation.updatedCount} absent records converted to 'leave'.
                </p>
                <p className="text-ink-soft">
                  • {actionResult.reconciliation.createdCount} synthetic leave records created.
                </p>
              </div>
            )}
            {actionResult.revertOutcome && (
              <div className="p-3 bg-surface-alt rounded-lg border border-line text-xs space-y-1">
                <p className="font-semibold text-ink">Revert Outcome:</p>
                <p className="text-ink-soft">
                  • {actionResult.revertOutcome.revertedCount} records reverted to 'absent'.
                </p>
                <p className="text-ink-soft">
                  • {actionResult.revertOutcome.deletedSyntheticCount} synthetic leave records removed.
                </p>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleActionSubmit} className="space-y-4 py-2">
            {actionError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {actionError}
              </div>
            )}

            <div className="p-3 bg-surface-alt rounded-lg border border-line text-xs space-y-1">
              <p className="font-semibold text-ink">Student: {targetLeave?.student?.name}</p>
              <p className="text-ink-soft">
                Window: {targetLeave && formatDateDMY(targetLeave.fromDate)}
                {targetLeave?.fromDate !== targetLeave?.toDate &&
                  ` to ${formatDateDMY(targetLeave?.toDate)}`}
              </p>
              <p className="text-ink-soft">Reason: {targetLeave?.reason}</p>
            </div>

            {actionType === "cancel" ? (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900">
                <strong>Warning:</strong> Cancelling an approved leave will delete any synthetic leave attendance records and revert converted attendance records back to 'absent'.
              </p>
            ) : actionType === "approve" ? (
              <p className="text-xs text-ink-soft">
                Admin approval overrides all pending tiers in the approval chain and initiates immediate attendance reconciliation.
              </p>
            ) : null}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                Remarks {actionType === "reject" ? <span className="text-red-500">* (Mandatory)</span> : "(Optional)"}
              </label>
              <Textarea
                placeholder={
                  actionType === "reject"
                    ? "Provide reason for rejection..."
                    : actionType === "cancel"
                    ? "Provide reason for cancellation..."
                    : "Add administrative override notes..."
                }
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                required={actionType === "reject"}
                minLength={actionType === "reject" ? 5 : 0}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={actionType === "approve" ? "primary" : "danger"}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Processing..."
                  : actionType === "approve"
                  ? "Confirm Approval"
                  : actionType === "cancel"
                  ? "Confirm Cancellation & Revert"
                  : "Reject Request"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
