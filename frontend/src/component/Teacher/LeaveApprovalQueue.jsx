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
  User,
  BookOpen,
  CalendarCheck,
  Send,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Users,
  ArrowUpRight,
} from "lucide-react";
import api from "../../utils/api";
import { formatDateDMY, formatDateTime } from "../../utils/dateUtils";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import { Select, Textarea } from "../common/ui/Input";
import UniversalSpinner from "../common/ui/UniversalSpinner";
import EmptyState from "../common/ui/EmptyState";
import Modal from "../common/ui/Modal";

export default function LeaveApprovalQueue() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("teacher-pending"); // 'teacher-pending' | 'mentor-pending' | 'all'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSection, setSelectedSection] = useState("all");

  // Action Modal State
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [currentLeave, setCurrentLeave] = useState(null);
  const [modalAction, setModalAction] = useState("approve"); // 'approve' | 'reject' | 'needs-more-info'
  const [actionRemarks, setActionRemarks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionResult, setActionResult] = useState(null);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      let res;
      if (activeTab === "teacher-pending") {
        res = await api.get("/leaves/teacher/pending");
      } else if (activeTab === "mentor-pending") {
        res = await api.get("/leaves/mentor/pending");
      } else {
        res = await api.get("/leaves/section/all", {
          params: {
            status: activeTab === "all" ? undefined : activeTab,
          },
        });
      }

      if (res.data?.success) {
        setLeaves(res.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching leave queue:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [activeTab]);

  const openActionModal = (leave, action) => {
    setCurrentLeave(leave);
    setModalAction(action);
    setActionRemarks("");
    setActionError("");
    setActionResult(null);
    setActionModalOpen(true);
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!currentLeave) return;

    if (modalAction === "reject" && (!actionRemarks || actionRemarks.trim().length < 5)) {
      setActionError("Please provide a reason for rejection (minimum 5 characters).");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");
      const res = await api.put(`/leaves/${currentLeave._id}/approve`, {
        action: modalAction,
        remarks: actionRemarks.trim(),
      });

      if (res.data?.success) {
        setActionResult({
          success: true,
          message: res.data.message,
          reconciliation: res.data.reconciliation,
        });
        fetchLeaves();
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to process leave action";
      setActionError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // Sections filter list
  const availableSections = Array.from(
    new Set(leaves.map((l) => l.section).filter(Boolean))
  ).sort();

  // Filter leaves by search and section
  const filteredLeaves = leaves.filter((l) => {
    const matchesSection = selectedSection === "all" || l.section === selectedSection;
    const sName = l.student?.name?.toLowerCase() || "";
    const sRoll = l.student?.rollNo?.toLowerCase() || "";
    const sReason = l.reason?.toLowerCase() || "";
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || sName.includes(q) || sRoll.includes(q) || sReason.includes(q);
    return matchesSection && matchesSearch;
  });

  const getLeaveTypeBadge = (type) => {
    switch (type) {
      case "medical":
        return <Badge tone="danger">Medical</Badge>;
      case "od":
      case "on-duty":
        return <Badge tone="purple">On Duty (OD)</Badge>;
      case "personal":
        return <Badge tone="primary">Personal</Badge>;
      case "bereavement":
        return <Badge tone="neutral">Bereavement</Badge>;
      default:
        return <Badge tone="neutral">{type?.toUpperCase() || "OTHER"}</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "approved":
      case "attendance-updated":
        return <Badge tone="success">Approved & Reconciled</Badge>;
      case "rejected":
        return <Badge tone="danger">Rejected</Badge>;
      case "needs-more-info":
        return <Badge tone="warning">Needs Info</Badge>;
      case "cancelled":
        return <Badge tone="neutral">Cancelled</Badge>;
      default:
        return <Badge tone="purple">Pending Review</Badge>;
    }
  };

  const currentUserId = localStorage.getItem("userId") || "";
  const currentUserName = localStorage.getItem("userName") || "";
  const currentUserRole = localStorage.getItem("role") || "";

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <DashboardHeader
        title="Leave Verification Queue"
        subtitle="Review, verify, and approve academic leave and on-duty requests submitted by students."
        breadcrumbs={[
          { label: "Dashboard", href: "/teacher/dashboard" },
          { label: "Leave Approvals" },
        ]}
      />

      {/* Filter and Queue Tabs Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-surface-alt p-1 rounded-xl border border-line text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab("teacher-pending")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${activeTab === "teacher-pending"
                ? "bg-surface text-primary shadow-2xs font-bold"
                : "text-ink-soft hover:text-ink"
                }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Subject Queue</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mentor-pending")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${activeTab === "mentor-pending"
                ? "bg-surface text-purple-600 dark:text-purple-400 shadow-2xs font-bold"
                : "text-ink-soft hover:text-ink"
                }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Mentor Queue</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${activeTab === "all"
                ? "bg-surface text-ink shadow-2xs font-bold"
                : "text-ink-soft hover:text-ink"
                }`}
            >
              <span>All Section Leaves</span>
            </button>
          </div>

          {/* Search & Section Filter */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="text"
                placeholder="Search student or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {availableSections.length > 0 && (
              <Select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="text-xs"
              >
                <option value="all">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    Section {sec}
                  </option>
                ))}
              </Select>
            )}

            <Button variant="outline" size="sm" onClick={fetchLeaves} leftIcon={RefreshCw}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Requests List */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <UniversalSpinner size="lg" />
        </div>
      ) : filteredLeaves.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No Leave Requests Found"
          description={
            activeTab.includes("pending")
              ? "All clear! There are no pending student leave requests awaiting your verification in this queue."
              : "No leave requests matched the selected filters."
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredLeaves.map((leave) => {
            const myStep = (leave.approvalChain || []).find((s) => {
              if (s.approverId && currentUserId && String(s.approverId) === String(currentUserId)) return true;
              if (s.approverName && currentUserName && s.approverName.trim().toLowerCase() === currentUserName.trim().toLowerCase()) return true;
              return false;
            });
            const approvedByMe = myStep && myStep.status === "approved";
            const rejectedByMe = myStep && myStep.status === "rejected";
            const currentApproverRole = leave.currentApproverRole || (leave.flowType === "single-subject" ? "teacher" : "mentor");

            return (
              <motion.div
                key={leave._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl border border-line bg-surface hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Header: Student & Leave Category */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-base">
                        {leave.student?.name ? leave.student.name[0].toUpperCase() : "S"}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-ink">{leave.student?.name}</h4>
                        <p className="text-xs text-ink-faint">
                          {leave.student?.rollNo ? `Roll: ${leave.student.rollNo} • ` : ""}
                          Section {leave.section} {leave.semester ? `• Sem ${leave.semester}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 ">
                      {approvedByMe ? (
                        <Badge tone="success">✓ Approved by you ({myStep.role?.toUpperCase() || "FACULTY"})</Badge>
                      ) : rejectedByMe ? (
                        <Badge tone="danger">✗ Rejected by you</Badge>
                      ) : (
                        getStatusBadge(leave.status)
                      )}
                      <div className="flex items-center gap-1">
                        {getLeaveTypeBadge(leave.leaveType)}
                        <Badge tone={leave.flowType === "single-subject" ? "neutral" : "purple"} size="sm">
                          {leave.flowType === "single-subject"
                            ? "Single Subject"
                            : leave.flowType === "multi-subject"
                              ? "Multi-Subject"
                              : "All Classes"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Exam Conflict Alert Badge if present */}
                  {leave.examPeriodConflict && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                      <ShieldAlert className="h-4 w-4 flex-shrink-0 text-amber-600" />
                      <span>Active exam schedule conflict during this period. Can be forwarded to HOD if required.</span>
                    </div>
                  )}

                  {/* Scope & Date Window */}
                  <div className="p-3 bg-surface-alt rounded-xl border border-line space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        Academic Leave Window:
                      </span>
                      <span className="font-bold text-primary">
                        {formatDateDMY(leave.fromDate)}
                        {leave.fromDate !== leave.toDate && ` to ${formatDateDMY(leave.toDate)}`}
                      </span>
                    </div>

                    {leave.subjectInfo?.subjectName ? (
                      <div className="flex items-center gap-1.5 text-ink-soft">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Subject: {leave.subjectInfo.subjectName}</span>
                      </div>
                    ) : leave.subjectIds?.length > 0 ? (
                      <div className="flex items-center gap-1.5 text-ink-soft">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Subjects: {leave.subjectIds.map((s) => s.subjectName || s.subjectCode).join(", ")}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-ink-soft">
                        <Users className="h-3.5 w-3.5" />
                        <span>Applies to all scheduled classes (Full Day)</span>
                      </div>
                    )}

                    {leave.sessionSlot?.startTime && (
                      <div className="flex items-center gap-1.5 text-ink-soft">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          Specific Slot: {leave.sessionSlot.startTime} - {leave.sessionSlot.endTime}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Reason & Explanation */}
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-ink">{leave.reason}</p>
                    <p className="text-xs text-ink-soft line-clamp-3 bg-surface p-2 rounded-lg border border-line/60">
                      {leave.reasonDescription}
                    </p>
                  </div>

                  {/* Institutional Approval Hierarchy Tracker */}
                  {leave.approvalChain && leave.approvalChain.length > 0 && (
                    <div className="p-2.5 bg-surface-alt/70 rounded-xl border border-line text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                          Institutional Approval Hierarchy
                        </span>
                        <span>{leave.approvalChain.length} Step{leave.approvalChain.length > 1 ? "s" : ""}</span>
                      </div>
                      <div className="space-y-1">
                        {leave.approvalChain.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] py-1 border-b border-line/40 last:border-0"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${step.status === "approved"
                                  ? "bg-emerald-500"
                                  : step.status === "rejected"
                                    ? "bg-red-500"
                                    : step.status === "needs-more-info"
                                      ? "bg-amber-500"
                                      : "bg-purple-500 animate-pulse"
                                  }`}
                              />
                              <span className="font-semibold capitalize text-ink">
                                {step.role === "teacher"
                                  ? "Teacher"
                                  : step.role === "mentor"
                                    ? "Mentor"
                                    : step.role === "hod"
                                      ? "HOD"
                                      : step.role === "dean"
                                        ? "Dean"
                                        : step.role}
                              </span>
                              {step.approverName && (
                                <span className="text-ink-faint">({step.approverName})</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-bold ${step.status === "approved"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : step.status === "rejected"
                                    ? "text-red-600 dark:text-red-400"
                                    : step.status === "needs-more-info"
                                      ? "text-amber-600 dark:text-amber-400"
                                      : "text-purple-600 dark:text-purple-400"
                                  }`}
                              >
                                {step.status === "approved"
                                  ? "Approved"
                                  : step.status === "rejected"
                                    ? "Rejected"
                                    : step.status === "needs-more-info"
                                      ? "Needs Info"
                                      : "Awaiting Review"}
                              </span>
                              {step.actedAt && (
                                <span className="text-[10px] text-ink-faint">
                                  {formatDateDMY(step.actedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {leave.attachments?.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-ink-faint">
                        Attached Proofs ({leave.attachments.length}):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {leave.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url || `/api/tickets/file/${att._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-alt hover:bg-line text-xs font-medium text-ink transition-colors border border-line"
                          >
                            <FileText className="h-3.5 w-3.5 text-primary" />
                            <span className="max-w-[130px] truncate">{att.originalName}</span>
                            <ExternalLink className="h-3 w-3 text-ink-faint" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons or Status Summary */}
                <div className="pt-3 border-t border-line">
                  {approvedByMe ? (
                    <div className="w-full p-3 rounded-xl bg-grey-900 border border-emerald-200 dark:border-emerald-900/60 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          Approved from your side ({myStep.role?.toUpperCase() || "FACULTY"})
                        </span>
                        {myStep.actedAt && (
                          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                            {formatDateTime(myStep.actedAt)}
                          </span>
                        )}
                      </div>
                      {myStep.remarks && (
                        <p className="text-emerald-700 dark:text-emerald-400 text-[11px] italic">
                          "{myStep.remarks}"
                        </p>
                      )}
                      {leave.status === "pending" ? (
                        <div className="pt-1.5 border-t border-emerald-200/60 dark:border-emerald-900/40 text-[11px] text-ink-soft flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          <span>
                            Currently awaiting <strong>{leave.currentApproverRole?.toUpperCase() || "NEXT TIER"}</strong> review
                          </span>
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ Fully approved & attendance reconciled
                        </div>
                      )}
                    </div>
                  ) : rejectedByMe ? (
                    <div className="w-full p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs">
                      <span className="font-semibold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                        <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        Rejected from your side
                      </span>
                      {myStep.remarks && (
                        <p className="mt-1 text-red-700 dark:text-red-400 text-[11px]">
                          Reason: {myStep.remarks}
                        </p>
                      )}
                    </div>
                  ) : leave.status === "pending" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openActionModal(leave, "needs-more-info")}
                        className="text-xs flex-1 min-w-[90px]"
                      >
                        Request Info
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => openActionModal(leave, "reject")}
                        className="text-xs flex-1 min-w-[70px]"
                      >
                        Reject
                      </Button>
                      {(currentApproverRole === "teacher" || currentApproverRole === "mentor") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openActionModal(leave, "forward-hod")}
                          className="text-xs flex-1 min-w-[110px] text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                          leftIcon={ArrowUpRight}
                        >
                          Forward HOD
                        </Button>
                      )}
                      {currentApproverRole === "hod" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openActionModal(leave, "forward-dean")}
                          className="text-xs flex-1 min-w-[110px] text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                          leftIcon={ArrowUpRight}
                        >
                          Forward Dean
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => openActionModal(leave, "approve")}
                        className="text-xs flex-1 min-w-[130px]"
                      >
                        Approve & Reconcile
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-ink-faint flex items-center justify-between w-full">
                      <span>Status: {leave.status}</span>
                      {leave.reconciliationMeta?.reconciledAt && (
                        <span>
                          Reconciled: {formatDateDMY(leave.reconciliationMeta.reconciledAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Action Confirmation Modal */}
      <Modal
        isOpen={actionModalOpen}
        onClose={() => setActionModalOpen(false)}
        title={
          modalAction === "approve"
            ? "Approve Leave & Reconcile Attendance"
            : modalAction === "reject"
              ? "Reject Leave Request"
              : modalAction === "forward-hod"
                ? "Forward Leave to Head of Department (HOD)"
                : modalAction === "forward-dean"
                  ? "Forward / Escalate Leave to Dean"
                  : "Request More Information"
        }
      >
        {actionResult ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <CheckCircle2 className="h-5 w-5" />
              <span>{actionResult.message}</span>
            </div>
            {actionResult.reconciliation && (
              <div className="p-3 bg-surface-alt rounded-lg border border-line text-xs space-y-1">
                <p className="font-semibold text-ink">Automated Attendance Reconciliation Summary:</p>
                <p className="text-ink-soft">
                  • {actionResult.reconciliation.updatedCount} absent attendance records converted to 'leave'.
                </p>
                <p className="text-ink-soft">
                  • {actionResult.reconciliation.createdCount} synthetic leave attendance records inserted.
                </p>
                <p className="text-ink-soft">
                  • Deficit trajectory and consecutive absence caches purged.
                </p>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button onClick={() => setActionModalOpen(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleActionSubmit} className="space-y-4 py-2">
            {actionError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {actionError}
              </div>
            )}

            <div className="p-3 bg-surface-alt rounded-lg border border-line text-xs space-y-1">
              <p className="font-semibold text-ink">Student: {currentLeave?.student?.name}</p>
              <p className="text-ink-soft">
                Leave Window: {currentLeave && formatDateDMY(currentLeave.fromDate)}
                {currentLeave?.fromDate !== currentLeave?.toDate &&
                  ` to ${formatDateDMY(currentLeave?.toDate)}`}
              </p>
              <p className="text-ink-soft">Category: {currentLeave?.leaveType?.toUpperCase()}</p>
            </div>

            {modalAction === "approve" && (
              <p className="text-xs text-ink-soft leading-relaxed">
                Approving this request will complete verification and immediately update the student's attendance records to <strong>'leave'</strong> for scheduled classes across this date window.
              </p>
            )}
            {modalAction === "forward-hod" && (
              <p className="text-xs text-ink-soft leading-relaxed">
                Forwarding this request will record your approval and escalate the leave directly to the <strong>Head of Department (HOD)</strong> for departmental review.
              </p>
            )}
            {modalAction === "forward-dean" && (
              <p className="text-xs text-ink-soft leading-relaxed">
                Escalating this request will record HOD endorsement and route the leave request directly to the <strong>Dean of Academics</strong> for institutional review.
              </p>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-soft mb-1.5">
                Remarks {modalAction === "reject" ? <span className="text-red-500">* (Mandatory)</span> : "(Optional)"}
              </label>
              <Textarea
                placeholder={
                  modalAction === "reject"
                    ? "Provide reason for rejection..."
                    : modalAction === "forward-hod"
                      ? "Add notes/reasons for forwarding to HOD..."
                      : modalAction === "forward-dean"
                        ? "Add notes/reasons for escalating to Dean..."
                        : "Add faculty verification remarks..."
                }
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                rows={3}
                required={modalAction === "reject"}
                minLength={modalAction === "reject" ? 5 : 0}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActionModalOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant={modalAction === "reject" ? "danger" : "primary"}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Processing..."
                  : modalAction === "approve"
                    ? "Confirm Approval"
                    : modalAction === "forward-hod"
                      ? "Forward to HOD"
                      : modalAction === "forward-dean"
                        ? "Forward to Dean"
                        : "Submit"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
