import React, { useState, useEffect } from "react";
import { DollarSign, CheckCircle2, Clock, AlertCircle, FileText, Lock, ArrowUpRight, Receipt, Calendar, ShieldCheck, Filter } from "lucide-react";
import api from "../utils/api";
import Card from "./common/ui/Card";
import Badge from "./common/ui/Badge";
import StatCard from "./common/ui/StatCard";
import DashboardHeader from "./common/ui/DashboardHeader";
import EmptyState from "./common/ui/EmptyState";
import Table from "./common/ui/Table";
import { formatDateDMY } from "../utils/dateUtils";

const FeePortal = () => {
  const [fees, setFees] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [planModules, setPlanModules] = useState(null);
  const [semesterFilter, setSemesterFilter] = useState("");
  const [totalSemesters, setTotalSemesters] = useState(0);

  useEffect(() => {
    checkPlanAccess();
    fetchMyFees();
  }, [semesterFilter]);

  const checkPlanAccess = async () => {
    try {
      const res = await api.get('/tenant/usage');
      if (res.data.success) {
        const modules = res.data.data?.plan?.modules || {};
        setPlanModules(modules);
      }
    } catch (err) { /* ignore */ }
  };

  const fetchMyFees = async () => {
    try {
      setLoading(true);
      let params = new URLSearchParams();
      if (semesterFilter) params.append("semester", semesterFilter);
      const res = await api.get(`/fees/my-fees?${params}`);
      setFees(res.data.data?.fees || []);
      setTransactions(res.data.data?.transactions || []);
      setTotalSemesters(res.data.data?.totalSemesters || 0);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load fee data");
    } finally { setLoading(false); }
  };

  const getStatusBadge = (status) => {
    const tones = {
      paid: "success", partial: "warning", pending: "info", waived: "neutral", overdue: "danger",
    };
    return <Badge tone={tones[status] || "neutral"} size="sm" className="capitalize font-semibold">{status}</Badge>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount || 0);
  };

  const totalDue = fees.reduce((sum, f) => sum + Math.max(0, (f.amount + (f.lateFee || 0) - f.paidAmount)), 0);
  const totalPaid = fees.reduce((sum, f) => sum + (f.paidAmount || 0), 0);
  const overdueCount = fees.filter(f => f.status === "overdue" || (f.status === "pending" && new Date(f.dueDate) < new Date())).length;

  const transactionColumns = [
    {
      header: "Receipt #",
      cell: (row) => (
        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md border border-primary/20">
          {row.receiptNumber}
        </span>
      )
    },
    {
      header: "For Fee / Item",
      cell: (row) => (
        <div>
          <p className="font-semibold text-ink text-sm">
            {row.feeId?.description || (row.feeId?.semester ? `Semester ${row.feeId.semester} Tuition Fee` : "Tuition Fee")}
          </p>
          {row.notes && <p className="text-xs text-ink-soft mt-0.5">{row.notes}</p>}
        </div>
      )
    },
    {
      header: "Amount Paid",
      cell: (row) => <span className="font-bold text-emerald-600 text-sm">{formatCurrency(row.amount)}</span>
    },
    {
      header: "Payment Mode",
      cell: (row) => <span className="capitalize text-xs font-medium px-2 py-0.5 rounded-md bg-background border border-line/60">{row.mode?.replace("_", " ")}</span>
    },
    {
      header: "Collected By",
      cell: (row) => <span className="text-xs text-ink-soft">{row.collectedBy?.name || "Institution Admin"}</span>
    },
    {
      header: "Date",
      cell: (row) => <span className="text-ink-soft text-xs">{new Date(row.transactionDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
    },
    {
      header: "Status",
      cell: (row) => <Badge tone={row.status === "completed" ? "success" : "neutral"} size="sm" className="capitalize font-medium">{row.status}</Badge>
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink-soft font-medium text-xs">Loading fee records...</p>
        </div>
      </div>
    );
  }

  if (planModules && !planModules.financeManagement) {
    return (
      <div className="flex items-center justify-center py-16">
        <Card padding="lg" bordered className="max-w-lg w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-ink mb-2">Institutional Fee Portal</h2>
          <p className="text-ink-soft text-xs mb-4">Fee management is not active on your current institution plan tier.</p>
        </Card>
      </div>
    );
  }

  const currentFee = fees.find(f => f.isCurrentSemester);
  const upcomingFees = fees.filter(f => f.isUpcomingSemester);
  const pastFees = fees.filter(f => f.isPastSemester);

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="My Fees & Payment Ledger"
        meta="Track semester fee schedules, payment milestones, and official transaction receipts"
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-ink-soft hidden sm:inline">Filter Semester:</label>
            <select
              value={semesterFilter}
              onChange={e => setSemesterFilter(e.target.value)}
              className="rounded-xl border border-line/60 bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:ring-2 focus:ring-primary/20 font-medium cursor-pointer"
            >
              <option value="">All Semesters</option>
              {Array.from({ length: totalSemesters || 8 }, (_, i) => i + 1).map(s => (
                <option key={s} value={s}>Semester {s}</option>
              ))}
            </select>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <StatCard label="Remaining Due" value={formatCurrency(totalDue)} icon={Clock} tone={totalDue > 0 ? "warning" : "success"} />
        <StatCard label="Total Paid & Settled" value={formatCurrency(totalPaid)} icon={CheckCircle2} tone="success" />
        <StatCard label="Overdue Records" value={`${overdueCount} records`} icon={AlertCircle} tone={overdueCount > 0 ? "danger" : "neutral"} />
      </div>

      {/* Structured Semester Breakdown */}
      {fees.length > 0 && (
        <div className="space-y-6">
          {/* 1. Current Semester Fee Highlight */}
          {currentFee && (() => {
            const remaining = Math.max(0, currentFee.amount + (currentFee.lateFee || 0) - currentFee.paidAmount);
            const progress = currentFee.amount > 0 ? Math.min(100, Math.round((currentFee.paidAmount / currentFee.amount) * 100)) : 0;
            const isOverdue = currentFee.status === "overdue" || (currentFee.status === "pending" && new Date(currentFee.dueDate) < new Date());
            const isFullyPaid = currentFee.status === "paid" || remaining === 0;

            return (
              <Card padding="lg" className={`border-2 transition-all ${isOverdue ? 'border-red-300 bg-red-50/20' : isFullyPaid ? 'border-emerald-300 bg-emerald-50/20' : 'border-primary/30 bg-primary/5'}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone="primary" className="font-bold text-xs">CURRENT SEMESTER (SEM {currentFee.semester})</Badge>
                      {getStatusBadge(currentFee.status)}
                      <span className="text-xs text-ink-soft bg-surface px-2.5 py-1 rounded-md border border-line font-medium">
                        Window: {currentFee.windowLabel || (currentFee.semester % 2 !== 0 ? "July – December" : "January – June")}
                      </span>
                    </div>
                    {isFullyPaid ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Semester Fee Settled</span>
                      </div>
                    ) : (
                      <span className="text-red-600 font-semibold text-xs flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Due: {currentFee.deadlineLabel || formatDateDMY(currentFee.dueDate)}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xl font-bold text-ink">{currentFee.description || `${currentFee.feeType} Fee — Semester ${currentFee.semester}`}</h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 bg-surface rounded-xl border border-line">
                      <p className="text-xs text-ink-soft">Total Fee</p>
                      <p className="text-base font-bold text-ink">{formatCurrency(currentFee.amount)}</p>
                    </div>
                    <div className="p-3 bg-surface rounded-xl border border-line">
                      <p className="text-xs text-emerald-700">Amount Paid</p>
                      <p className="text-base font-bold text-emerald-600">{formatCurrency(currentFee.paidAmount)}</p>
                    </div>
                    <div className="p-3 bg-surface rounded-xl border border-line">
                      <p className="text-xs text-amber-700">Balance Remaining</p>
                      <p className="text-base font-bold text-amber-600">{formatCurrency(remaining)}</p>
                    </div>
                    <div className="p-3 bg-surface rounded-xl border border-line">
                      <p className="text-xs text-ink-soft">Payment Status</p>
                      <p className="text-base font-bold text-ink">{progress}% Paid</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-line rounded-full h-3 overflow-hidden mt-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-primary' : 'bg-line'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* 2. Upcoming Semester Fees */}
          {upcomingFees.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Upcoming Semester Fees & Advance Payments
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingFees.map(uFee => {
                  const uRemaining = Math.max(0, uFee.amount + (uFee.lateFee || 0) - uFee.paidAmount);
                  const isPaid = uFee.status === "paid" || uRemaining === 0;

                  return (
                    <Card key={uFee._id} padding="md" className={`border-2 transition-all ${isPaid ? 'border-emerald-300 bg-emerald-50/15' : 'border-line bg-surface/60'}`}>
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge tone="info" className="font-semibold text-xs">SEMESTER {uFee.semester}</Badge>
                              <Badge tone="neutral" className="text-xs">Upcoming</Badge>
                              {getStatusBadge(uFee.status)}
                            </div>
                            <h4 className="font-semibold text-ink text-sm">{uFee.description || `Semester ${uFee.semester} Tuition Fee`}</h4>
                            <p className="text-xs text-ink-soft">
                              Payment Window: <span className="font-medium text-ink">{uFee.windowLabel || "January – June"}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-ink">{formatCurrency(uFee.amount)}</p>
                            <span className={`text-xs font-semibold ${isPaid ? 'text-emerald-600' : 'text-ink-faint'}`}>
                              {isPaid ? "Fully Paid" : "Scheduled Fee"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
                          <span className="text-ink-soft">
                            Paid: <strong className="text-emerald-600 font-bold">{formatCurrency(uFee.paidAmount)}</strong>
                          </span>
                          <span className="text-ink-soft">
                            Balance: <strong className={uRemaining > 0 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold"}>{formatCurrency(uRemaining)}</strong>
                          </span>
                          <span className="text-ink-soft">
                            Due: <strong className="text-ink font-medium">{uFee.deadlineLabel || formatDateDMY(uFee.dueDate)}</strong>
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* All Fee Records Detailed List */}
      <Card padding="none" className="overflow-hidden">
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h2 className="font-bold text-ink">All Fee Schedules & Records</h2>
          <span className="text-xs text-ink-soft">{fees.length} Total Records</span>
        </div>
        {fees.length === 0 ? (
          <EmptyState
            title="No Fee Records"
            description="No fee records found for this student"
            icon={FileText}
          />
        ) : (
          <div className="divide-y divide-line">
            {fees.map(fee => {
              const remaining = Math.max(0, fee.amount + (fee.lateFee || 0) - fee.paidAmount);
              const isOverdue = fee.status === "overdue";
              const isPaid = fee.status === "paid" || remaining === 0;

              return (
                <div key={fee._id} className={`p-5 hover:bg-background transition ${isOverdue ? 'bg-red-50/40 border-l-4 border-l-red-400' : isPaid ? 'bg-emerald-50/15' : ''}`}>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-ink capitalize text-sm">{fee.feeType} Fee</span>
                        {getStatusBadge(fee.status)}
                        {fee.semester && <Badge tone={fee.semester % 2 === 1 ? "primary" : "info"}>Sem {fee.semester}</Badge>}
                        {fee.courseId?.name && <Badge tone="neutral">{fee.courseId.name}</Badge>}
                        {fee.isCurrentSemester && <Badge tone="primary">Current</Badge>}
                        {fee.isUpcomingSemester && <Badge tone="neutral">Upcoming</Badge>}
                      </div>
                      <p className="text-sm font-medium text-ink">{fee.description || `${fee.feeType} Fee for Semester ${fee.semester}`}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft pt-1">
                        <span>Window: <strong className="text-ink">{fee.windowLabel || (fee.semester % 2 !== 0 ? "July – Dec" : "Jan – Jun")}</strong></span>
                        <span>Due Date: <strong className="text-ink">{formatDateDMY(fee.dueDate)}</strong></span>
                        <span>Total: <strong className="text-ink font-semibold">{formatCurrency(fee.amount)}</strong></span>
                        <span>Paid: <strong className="text-emerald-600 font-semibold">{formatCurrency(fee.paidAmount)}</strong></span>
                        {fee.lateFee > 0 && <span className="text-red-500 font-semibold">Late Fee: {formatCurrency(fee.lateFee)}</span>}
                      </div>
                    </div>
                    <div className="text-right sm:ml-4 flex-shrink-0">
                      <p className="text-lg font-bold text-ink">{formatCurrency(remaining)}</p>
                      <p className={`text-xs font-semibold ${isPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isPaid ? "Fully Settled" : "remaining due"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Payment & Transaction History */}
      {transactions.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-ink">Payment History & Official Receipts</h2>
            </div>
            <span className="text-xs text-ink-soft">{transactions.length} Verified Payment{transactions.length !== 1 ? 's' : ''}</span>
          </div>
          <Table
            columns={transactionColumns}
            data={transactions}
            emptyTitle="No Transactions"
            emptyMessage="No payment transactions recorded yet"
            rowKey="_id"
          />
        </Card>
      )}
    </div>
  );
};

export default FeePortal;
