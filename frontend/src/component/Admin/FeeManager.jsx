import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { DollarSign, Plus, Trash2, X, Check, AlertCircle, Save, Eye, Filter, Clock, CheckCircle, Crown, Lock, LayoutGrid, List, RefreshCw } from "lucide-react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import Modal from "../common/ui/Modal";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import StatCard from "../common/ui/StatCard";
import DashboardHeader from "../common/ui/DashboardHeader";
import EmptyState from "../common/ui/EmptyState";
import Table from "../common/ui/Table";
import Input, { Select, Textarea } from "../common/ui/Input";
import Skeleton from "../common/ui/Skeleton";
import PricingModal from "../common/PricingModal";
import { useUpgradeModal } from "../../utils/billing";
import { usePermissions } from "../../contexts/PermissionsContext";
import { formatDateDMY } from "../../utils/dateUtils";

const FEE_TYPES = ["tuition", "transport", "hostel", "other"];
const PAYMENT_MODES = ["cash", "online", "cheque", "bank_transfer"];

const FeeManager = () => {
  const [fees, setFees] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [sections, setSections] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState("fees");
  const [viewLayout, setViewLayout] = useState("cohorts"); // "cohorts" | "all"
  const [selectedCohort, setSelectedCohort] = useState(null);
  const [cohortSearch, setCohortSearch] = useState("");
  const [cohortStatusFilter, setCohortStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedFee, setSelectedFee] = useState(null);
  const [selectedSection, setSelectedSection] = useState("");
  const [filterCourse, setFilterCourse] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [feeDetail, setFeeDetail] = useState(null);

  // Infinite scroll progressive pagination state
  const [visibleFeeCount, setVisibleFeeCount] = useState(25);
  const [visibleTxnCount, setVisibleTxnCount] = useState(25);
  const [visibleCohortFeeCount, setVisibleCohortFeeCount] = useState(25);

  const [formData, setFormData] = useState({
    studentId: "", feeType: "tuition", amount: "", dueDate: "", description: "",
    lateFee: 0, academicYear: "", courseId: "", branch: "", semester: "",
  });
  const [generateData, setGenerateData] = useState({
    courseId: "", section: "", dueDate: "", academicYear: "",
  });

  // Group fees by Course + Branch
  const cohorts = useMemo(() => {
    const map = new Map();
    fees.forEach(f => {
      const cId = f.courseId?._id || f.courseId || "unknown_course";
      const cName = f.courseId?.name || "General Course";
      const cCode = f.courseId?.code || "COURSE";
      const branch = f.branch || f.studentId?.branch || f.section || "General";
      const key = `${cId}_${branch}`;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          courseId: cId,
          courseName: cName,
          courseCode: cCode,
          branch: branch,
          totalFees: 0,
          totalCollected: 0,
          totalPending: 0,
          paidCount: 0,
          pendingCount: 0,
          partialCount: 0,
          overdueCount: 0,
          students: new Set(),
          fees: [],
          semesters: new Set(),
          academicYear: f.academicYear || "",
          pendingDueDates: [],
        });
      }

      const c = map.get(key);
      c.totalFees += f.amount || 0;
      c.totalCollected += f.paidAmount || 0;
      c.totalPending += (f.amount || 0) - (f.paidAmount || 0);
      if (f.studentId?._id) c.students.add(String(f.studentId._id));
      if (f.semester) c.semesters.add(f.semester);
      if (f.dueDate && f.status !== "paid" && f.status !== "waived") {
        c.pendingDueDates.push(new Date(f.dueDate));
      }
      c.fees.push(f);

      if (f.status === "paid") c.paidCount++;
      else if (f.status === "pending") c.pendingCount++;
      else if (f.status === "partial") c.partialCount++;
      else if (f.status === "overdue") c.overdueCount++;
    });

    return Array.from(map.values()).map(c => ({
      ...c,
      studentCount: c.students.size || c.fees.length,
      semestersList: Array.from(c.semesters).sort((a, b) => a - b),
      earliestPendingDueDate: c.pendingDueDates.length > 0 ? new Date(Math.min(...c.pendingDueDates)) : null,
      isFullyPaid: c.totalFees > 0 && c.totalPending <= 0,
    }));
  }, [fees]);

  const selectedCourse = courses.find(c => c._id === generateData.courseId);
  const courseBranches = selectedCourse ? (selectedCourse.branches || []).filter(b => b.isActive !== false) : [];
  const [generating, setGenerating] = useState(false);
  const [paymentData, setPaymentData] = useState({ amount: "", mode: "cash", notes: "" });
  const [planModules, setPlanModules] = useState(null);
  const [tenantSettings, setTenantSettings] = useState(null);

  const { modalProps, openUpgrade, setPlanCode } = useUpgradeModal();
  const { can, loading: permsLoading } = usePermissions();
  const canCollect = can("fee:collect");
  const canWaive = can("fee:waive");
  const canRead = can("fee:read") || canCollect || canWaive;

  useEffect(() => {
    fetchInitial();
    checkPlanAccess();
    fetchTransactions();
  }, []);

  useEffect(() => {
    fetchFees();
    fetchSummary();
  }, [filterCourse, filterBranch, filterStatus, selectedSection]);

  useEffect(() => {
    setFilterBranch("");
  }, [filterCourse]);

  const checkPlanAccess = async () => {
    try {
      const res = await api.get('/tenant/usage');
      if (res.data.success) {
        const modules = res.data.data?.plan?.modules || {};
        setPlanModules(modules);
        setPlanCode(res.data.data?.tenant?.subscription?.plan || null);
      }
    } catch (err) { /* ignore */ }
  };

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  // Auto-fill fee fields from student's enrollment data when student is selected
  useEffect(() => {
    if (!formData.studentId || formData.studentId === "bulk") return;
    const student = students.find(s => s._id === formData.studentId || s.userId === formData.studentId);
    if (!student) return;

    const course = courses.find(c => c._id === student.courseId);
    const semestersPerYear = tenantSettings?.semesterStructure?.semestersPerYear || 2;
    const durationYears = course?.durationYears || 4;
    const totalSemesters = (course?.semestersPerYear ? course.durationYears * course.semestersPerYear : durationYears * semestersPerYear) || 8;
    const academicStartMonth = tenantSettings?.semesterStructure?.academicStartMonth ?? 3;

    // Resolve per-semester amount from course fee structure
    let amount = "";
    if (formData.feeType === "tuition" && course?.feeStructure?.enabled && course.feeStructure.totalFee > 0) {
      amount = String((course.feeStructure.totalFee / totalSemesters).toFixed(2));
    }
    // Try branch-level fee first
    if (formData.feeType === "tuition" && course?.branches) {
      const branchObj = course.branches.find(b => b.code === student.branch || b.name?.toLowerCase() === (student.branch || "").toLowerCase());
      if (branchObj?.feeStructure?.enabled && branchObj.feeStructure.totalFee > 0) {
        amount = String((branchObj.feeStructure.totalFee / totalSemesters).toFixed(2));
      }
    }

    // Compute due date: end of current semester
    let dueDate = "";
    if (student.semester) {
      const semIndex = (student.semester - 1) % semestersPerYear;
      const now = new Date();
      const currentYear = now.getFullYear();
      const startMonth = (academicStartMonth + semIndex * (12 / semestersPerYear)) % 12;
      const startYear = currentYear + Math.floor((academicStartMonth + semIndex * (12 / semestersPerYear)) / 12);
      const endMonth = (startMonth + 12 / semestersPerYear) % 12;
      const endYear = startYear + Math.floor((startMonth + 12 / semestersPerYear) / 12);
      dueDate = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-${new Date(endYear, endMonth + 1, 0).getDate().toString().padStart(2, "0")}`;
    }

    setFormData(prev => ({
      ...prev,
      courseId: student.courseId || "",
      branch: student.branch || "",
      semester: student.semester || "",
      amount: prev.amount || amount,
      dueDate: prev.dueDate || dueDate,
    }));
  }, [formData.studentId, students, courses, tenantSettings, formData.feeType]);

  // Auto-fill for bulk: derive course/branch/amount from first student in selected section
  useEffect(() => {
    if (formData.studentId !== "bulk" || !selectedSection) return;
    const firstStudent = students.find(s => s.section === selectedSection && s._id);
    if (!firstStudent) return;
    const course = courses.find(c => c._id === firstStudent.courseId);
    const semestersPerYear = tenantSettings?.semesterStructure?.semestersPerYear || 2;
    const totalSemesters = (course?.semestersPerYear ? course.durationYears * course.semestersPerYear : 8);
    let amount = "";
    if (formData.feeType === "tuition" && course?.feeStructure?.enabled && course.feeStructure.totalFee > 0) {
      amount = String((course.feeStructure.totalFee / totalSemesters).toFixed(2));
    }
    if (formData.feeType === "tuition" && course?.branches) {
      const branchObj = course.branches.find(b => b.code === firstStudent.branch || b.name?.toLowerCase() === (firstStudent.branch || "").toLowerCase());
      if (branchObj?.feeStructure?.enabled && branchObj.feeStructure.totalFee > 0) {
        amount = String((branchObj.feeStructure.totalFee / totalSemesters).toFixed(2));
      }
    }
    setFormData(prev => ({
      ...prev,
      courseId: prev.courseId || firstStudent.courseId || "",
      branch: prev.branch || firstStudent.branch || "",
      amount: prev.amount || amount,
    }));
  }, [selectedSection, students, courses, tenantSettings, formData.studentId, formData.feeType]);

  const fetchStudentsForModal = async () => {
    if (students.length > 0) return;
    try {
      const res = await api.get("/attendance/admin/students?limit=2000");
      const list = res.data?.data || [];
      setStudents(list);
    } catch (err) {
      logError("Fetch Students For Modal", err);
    }
  };

  const fetchInitial = async () => {
    try {
      const [sectionsRes, coursesRes, tenantRes] = await Promise.all([
        api.get("/admin/active-sections").catch(() => ({ data: { data: [] } })),
        api.get("/academic/courses").catch(() => ({ data: { data: [] } })),
        api.get("/tenant/info").catch(() => ({ data: { data: {} } })),
      ]);
      const s = sectionsRes.data?.data || sectionsRes.data?.sections || [];
      if (Array.isArray(s) && s.length > 0) {
        setSections(s.sort());
      }
      const c = coursesRes.data?.data || [];
      setCourses(c);
      const ts = tenantRes.data?.data || tenantRes.data?.tenant || {};
      setTenantSettings(ts);
    } catch (err) {
      logError("Fetch Initial Settings", err);
    }
  };

  const fetchFees = async () => {
    try {
      setLoading(true);
      let params = new URLSearchParams();
      if (selectedSection) params.append("section", selectedSection);
      if (filterCourse) params.append("courseId", filterCourse);
      if (filterBranch) params.append("branch", filterBranch);
      if (filterStatus) params.append("status", filterStatus);
      const res = await api.get(`/fees?${params}`);
      setFees(res.data?.data || []);
      setVisibleFeeCount(25);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch fees");
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get('/fees/summary');
      setSummary(res.data.data);
    } catch (err) { /* ignore */ }
  };

  const fetchTransactions = async () => {
    try {
      const res = await api.get('/fees/transactions');
      setTransactions(res.data.data || []);
      setVisibleTxnCount(25);
    } catch (err) { /* ignore */ }
  };

  // Infinite Scroll Observers
  const feeObserver = useRef();
  const lastFeeElementRef = useCallback(node => {
    if (loading) return;
    if (feeObserver.current) feeObserver.current.disconnect();
    feeObserver.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleFeeCount < fees.length) {
        setVisibleFeeCount(prev => prev + 25);
      }
    });
    if (node) feeObserver.current.observe(node);
  }, [loading, visibleFeeCount, fees.length]);

  const txnObserver = useRef();
  const lastTxnElementRef = useCallback(node => {
    if (txnObserver.current) txnObserver.current.disconnect();
    txnObserver.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && visibleTxnCount < transactions.length) {
        setVisibleTxnCount(prev => prev + 25);
      }
    });
    if (node) txnObserver.current.observe(node);
  }, [visibleTxnCount, transactions.length]);

  const cohortFeeObserver = useRef();
  const lastCohortFeeElementRef = useCallback(node => {
    if (cohortFeeObserver.current) cohortFeeObserver.current.disconnect();
    cohortFeeObserver.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCohortFeeCount(prev => prev + 25);
      }
    });
    if (node) cohortFeeObserver.current.observe(node);
  }, []);

  const autoAcademicYear = useMemo(() => {
    const startMonth = tenantSettings?.semesterStructure?.academicStartMonth ?? 3;
    const now = new Date();
    const year = now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }, [tenantSettings]);

  const openCreate = () => {
    fetchStudentsForModal();
    setSelectedFee(null);
    setFormData({ studentId: "", feeType: "tuition", amount: "", dueDate: "", description: "", lateFee: 0, academicYear: autoAcademicYear, courseId: "", branch: "", semester: "" });
    setShowForm(true);
  };

  const openBulkCreate = () => {
    fetchStudentsForModal();
    setSelectedFee(null);
    setFormData({ studentId: "bulk", feeType: "tuition", amount: "", dueDate: "", description: "", lateFee: 0, academicYear: autoAcademicYear, courseId: "", branch: "", semester: "" });
    setShowForm(true);
  };

  const openGenerate = () => {
    const now = new Date();
    const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
    const academicYear = `${year}-${(year + 1).toString().slice(-2)}`;
    setGenerateData({ courseId: "", section: "", dueDate: "", academicYear });
    setShowGenerateModal(true);
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!generateData.courseId || !generateData.section) {
      setError("Fill all required fields"); return;
    }
    try {
      setGenerating(true);
      const res = await api.post('/fees/generate-course', {
        courseId: generateData.courseId,
        section: generateData.section,
        dueDate: generateData.dueDate || undefined,
        academicYear: generateData.academicYear,
      });
      setSuccess(res.data.message);
      setShowGenerateModal(false);
      fetchFees(); fetchSummary();
    } catch (err) { setError(err.response?.data?.message || "Failed to generate fees"); }
    finally { setGenerating(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || !formData.dueDate || !formData.feeType) {
      setError("Fill all required fields"); return;
    }

    try {
      if (formData.studentId === "bulk") {
        if (!selectedSection) { setError("Select a section for bulk creation"); return; }
        const sectionStudents = students.filter(s => s.section === selectedSection && s._id);
        if (sectionStudents.length === 0) { setError("No students found in this section"); return; }
        const fees = sectionStudents.map(s => ({
          studentId: s._id, feeType: formData.feeType, amount: parseFloat(formData.amount),
          dueDate: formData.dueDate, description: formData.description, lateFee: parseFloat(formData.lateFee) || 0,
          academicYear: formData.academicYear,
          courseId: s.courseId || formData.courseId || undefined,
          branch: s.branch || formData.branch || undefined,
          semester: s.semester || formData.semester || undefined,
        }));
        await api.post('/fees', { fees });
        setSuccess(`Fees created for ${fees.length} students`);
      } else {
        await api.post('/fees', {
          fees: [{ studentId: formData.studentId, feeType: formData.feeType, amount: parseFloat(formData.amount),
            dueDate: formData.dueDate, description: formData.description, lateFee: parseFloat(formData.lateFee) || 0,
            academicYear: formData.academicYear,
            courseId: formData.courseId || undefined,
            branch: formData.branch || undefined,
            semester: formData.semester || undefined,
          }]
        });
        setSuccess("Fee created");
      }
      setShowForm(false);
      fetchFees(); fetchSummary();
    } catch (err) { setError(err.response?.data?.message || "Failed to save"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this fee record?")) return;
    try {
      await api.delete(`/fees/${id}`);
      setSuccess("Fee deleted");
      fetchFees(); fetchSummary();
    } catch (err) { setError(err.response?.data?.message || "Failed to delete"); }
  };

  const handleWaive = async (id) => {
    if (!window.confirm("Waive this fee? This action cannot be undone.")) return;
    try {
      await api.patch(`/fees/${id}/waive`);
      setSuccess("Fee waived");
      fetchFees(); fetchSummary();
    } catch (err) { setError(err.response?.data?.message || "Failed to waive"); }
  };

  const openCollect = (fee) => {
    setSelectedFee(fee);
    const remaining = fee.amount - fee.paidAmount;
    setPaymentData({ amount: remaining, mode: "cash", notes: "" });
    setShowCollectModal(true);
  };

  const handleCollectPayment = async (e) => {
    e.preventDefault();
    if (!paymentData.amount || paymentData.amount <= 0) {
      setError("Valid amount is required"); return;
    }
    try {
      await api.post(`/fees/${selectedFee._id}/pay`, paymentData);
      setSuccess("Payment collected");
      setShowCollectModal(false);
      setSelectedFee(null);
      fetchFees(); fetchSummary(); fetchTransactions();
    } catch (err) { setError(err.response?.data?.message || "Failed to collect payment"); }
  };

  const viewDetail = async (id) => {
    try {
      const res = await api.get(`/fees/${id}`);
      setFeeDetail(res.data.data);
    } catch (err) { setError("Failed to load fee details"); }
  };

  const getStatusBadge = (status) => {
    const tones = {
      paid: "success", partial: "warning", pending: "info", waived: "neutral", overdue: "danger",
    };
    return <Badge tone={tones[status] || "neutral"} className="capitalize">{status}</Badge>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(amount);
  };

  const transactionColumns = [
    { header: "Receipt", cell: (row) => <span className="font-mono text-xs font-medium">{row.receiptNumber}</span> },
    { header: "Student", cell: (row) => row.studentId?.name || "—" },
    { header: "Amount", cell: (row) => <span className="font-semibold text-emerald-600">{formatCurrency(row.amount)}</span> },
    { header: "Mode", cell: (row) => <span className="capitalize">{row.mode}</span> },
    { header: "Date", cell: (row) => <span className="text-ink-soft">{formatDateDMY(row.transactionDate)}</span> },
    { header: "Collected By", cell: (row) => row.collectedBy?.name || "—" },
  ];

  const paymentColumns = [
    { header: "Receipt", cell: (row) => <span className="font-mono text-xs">{row.receiptNumber}</span> },
    { header: "Amount", cell: (row) => <span className="font-semibold text-emerald-600">{formatCurrency(row.amount)}</span> },
    { header: "Mode", cell: (row) => <span className="capitalize">{row.mode}</span> },
    { header: "Date", cell: (row) => <span className="text-ink-soft">{formatDateDMY(row.transactionDate)}</span> },
    { header: "Collected By", cell: (row) => row.collectedBy?.name || "—" },
  ];

  if (planModules && !planModules.financeManagement) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-center py-16">
        <Card className="max-w-lg w-full text-center">
          <div className="w-20 h-20 rounded-full bg-background flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-ink-faint" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-3">Fee Management</h2>
          <p className="text-ink-soft mb-6">This feature is not included in your current plan. Upgrade to manage fees, collect payments, and track dues.</p>
          <Button
            onClick={() => openUpgrade({ resourceType: "financeManagement", message: "Upgrade to unlock fee management.", requiredPlan: "professional" })}
            leftIcon={Crown}
          >
            Upgrade to Unlock
          </Button>
          <div className="mt-4">
            <PricingModal {...modalProps} onPlanChanged={() => checkPlanAccess()} />
          </div>
        </Card>
      </motion.div>
    );
  }

  if (permsLoading) {
    return (
      <div className="space-y-6">
        <DashboardHeader greeting="Institutional Fee & Revenue Management" meta="Manage fee ledgers, track collections, record transactions, and oversee cohort finances" />
        <Card padding="lg" bordered><Skeleton rows={6} /></Card>
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="space-y-6">
        <DashboardHeader greeting="Institutional Fee & Revenue Management" meta="Manage fee ledgers, track collections, record transactions, and oversee cohort finances" />
        <EmptyState icon={Lock} title="Access Restricted" description="You don't have permission to manage fees. Contact your admin to assign a role with fee management access." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Institutional Fee & Revenue Management"
        meta="Manage fee ledgers, track collections, record transactions, and oversee cohort finances"
        actions={
          canCollect && (
            <div className="flex items-center gap-2">
              <Button variant="subtle" size="sm" onClick={openGenerate} leftIcon={DollarSign}>Generate by Course</Button>
              <Button variant="primary" size="sm" onClick={openCreate} leftIcon={Plus}>Create Single Fee</Button>
            </div>
          )
        }
      />

      {error && <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-semibold"><AlertCircle className="w-4 h-4" />{error}</div>}
      {success && <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-600 text-xs font-semibold"><Check className="w-4 h-4" />{success}</div>}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <StatCard label="Total Invoiced" value={formatCurrency(summary.totalFees)} icon={DollarSign} tone="primary" />
          <StatCard label="Collected Revenue" value={formatCurrency(summary.totalCollected)} icon={CheckCircle} tone="success" />
          <StatCard label="Pending Receivables" value={formatCurrency(summary.totalPending)} icon={Clock} tone="warning" />
          <StatCard label="Overdue Invoices" value={`${summary.overdueCount} records`} icon={AlertCircle} tone="danger" />
        </div>
      )}

      <div className="flex gap-1 bg-surface rounded-xl p-1 border border-line w-fit">
        {["fees", "transactions"].map(tab => (
          <Button key={tab} onClick={() => setActiveTab(tab)} variant={activeTab === tab ? "primary" : "ghost"}>
            {tab === "fees" ? "Fee Records" : "Transactions"}
          </Button>
        ))}
      </div>

      {activeTab === "fees" && (
        <div className="space-y-6">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="w-44">
              <Select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
                <option value="">All Courses</option>
                {courses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="w-40">
              <Select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                <option value="">All Branches</option>
                {courses.find(c => c._id === filterCourse)?.branches?.filter(b => b.isActive !== false).map(b => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                )) || []}
              </Select>
            </div>
            <div className="w-40">
              <Select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); }}>
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </Select>
            </div>
            <Button variant="subtle" onClick={() => { setFilterCourse(""); setFilterBranch(""); setFilterStatus(""); setSelectedSection(""); }} leftIcon={X}>Clear Filters</Button>

            <div className="ml-auto flex items-center gap-1 bg-surface rounded-xl p-1 border border-line">
              <Button
                size="sm"
                variant={viewLayout === "cohorts" ? "primary" : "ghost"}
                onClick={() => setViewLayout("cohorts")}
                leftIcon={LayoutGrid}
              >
                Cohort Cards
              </Button>
              <Button
                size="sm"
                variant={viewLayout === "all" ? "primary" : "ghost"}
                onClick={() => setViewLayout("all")}
                leftIcon={List}
              >
                All Records ({fees.length})
              </Button>
            </div>
          </div>

          {loading ? (
            <Card padding="lg"><Skeleton rows={4} /></Card>
          ) : fees.length === 0 ? (
            <EmptyState
              title="No Fee Records"
              description="No fee records found for the current filters"
              icon={DollarSign}
              action={canCollect ? <Button onClick={openCreate} leftIcon={Plus}>Create Fee</Button> : null}
            />
          ) : viewLayout === "cohorts" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {cohorts.map((cohort) => {
                const percentCollected = cohort.totalFees > 0 ? Math.round((cohort.totalCollected / cohort.totalFees) * 100) : 0;
                return (
                  <motion.div
                    key={cohort.id}
                    whileHover={{ y: -3 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card padding="lg" className="h-full flex flex-col justify-between hover:shadow-md transition-shadow border-line">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <Badge tone="primary" className="font-semibold">{cohort.courseCode}</Badge>
                              <Badge tone="info" className="font-semibold">{cohort.branch}</Badge>
                            </div>
                            <h3 className="font-bold text-ink text-base leading-snug">{cohort.courseName}</h3>
                          </div>
                          <Badge tone="neutral" className="shrink-0">{cohort.studentCount} {cohort.studentCount === 1 ? "Student" : "Students"}</Badge>
                        </div>

                        {/* Semesters & Academic Year */}
                        <div className="flex items-center gap-2 flex-wrap text-xs text-ink-soft">
                          {cohort.semestersList.map(s => (
                            <span key={s} className="px-2 py-0.5 rounded-md bg-surface-raised border border-line font-medium text-ink">
                              Sem {s}
                            </span>
                          ))}
                          {cohort.academicYear && <span className="text-ink-faint">AY {cohort.academicYear}</span>}
                          {cohort.isFullyPaid ? (
                            <span className="text-emerald-600 font-semibold ml-auto flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Settled
                            </span>
                          ) : cohort.earliestPendingDueDate ? (
                            <span className="text-amber-600 font-medium ml-auto flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Due {new Date(cohort.earliestPendingDueDate).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>

                        {/* Financial Progress */}
                        <div className="space-y-1.5 p-3 rounded-xl bg-background border border-line/60">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-ink-soft">Collection Progress</span>
                            <span className="text-ink font-semibold">{percentCollected}%</span>
                          </div>
                          <div className="w-full h-2 bg-line rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(percentCollected, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-xs pt-1">
                            <div>
                              <span className="text-ink-faint block text-[10px] uppercase">Collected</span>
                              <span className="font-semibold text-emerald-600">{formatCurrency(cohort.totalCollected)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-ink-faint block text-[10px] uppercase">Outstanding</span>
                              <span className="font-semibold text-amber-600">{formatCurrency(cohort.totalPending)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status Breakdown Pills */}
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          {cohort.paidCount > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[11px] border border-emerald-200">{cohort.paidCount} Paid</span>}
                          {cohort.pendingCount > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium text-[11px] border border-blue-200">{cohort.pendingCount} Pending</span>}
                          {cohort.partialCount > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium text-[11px] border border-amber-200">{cohort.partialCount} Partial</span>}
                          {cohort.overdueCount > 0 && <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium text-[11px] border border-red-200">{cohort.overdueCount} Overdue</span>}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-line/60 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center"
                          onClick={() => { setSelectedCohort(cohort); setCohortSearch(""); setCohortStatusFilter(""); }}
                          rightIcon={Eye}
                        >
                          View Student Records ({cohort.fees.length})
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4">
              {fees.slice(0, visibleFeeCount).map((fee, index) => {
                const isOverdue = fee.status === "overdue";
                const isLast = index === Math.min(fees.length, visibleFeeCount) - 1;
                return (
                <Card
                  ref={isLast ? lastFeeElementRef : null}
                  key={fee._id}
                  padding="lg"
                  className={isOverdue ? "border-l-4 border-l-red-500" : ""}
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-ink">{fee.studentId?.name || "Unknown"}</h3>
                        {getStatusBadge(fee.status)}
                        <Badge tone="neutral" className="capitalize">{fee.feeType}</Badge>
                        {fee.semester && <Badge tone={fee.semester % 2 === 1 ? "primary" : "info"}>Sem {fee.semester}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
                        <span>Roll: {fee.studentId?.rollNo || "—"}</span>
                        <span>Section {fee.studentId?.section || fee.section || "—"}</span>
                        {fee.courseId?.name && <span className="font-medium text-ink">{fee.courseId.name}</span>}
                        {(fee.branch || fee.studentId?.branch) && <span className="text-primary font-medium">{fee.branch || fee.studentId?.branch}</span>}
                        <span className="font-semibold text-ink">{formatCurrency(fee.amount)}</span>
                        {fee.paidAmount > 0 && <span className="text-emerald-600 font-semibold">Paid: {formatCurrency(fee.paidAmount)}</span>}
                        {fee.lateFee > 0 && <span className="text-red-500">Late: {formatCurrency(fee.lateFee)}</span>}
                        {fee.status !== "paid" && fee.status !== "waived" ? (
                          <span>Due: {formatDateDMY(fee.dueDate)}</span>
                        ) : (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Fully Paid
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => viewDetail(fee._id)} leftIcon={Eye} title="View" />
                      {(fee.status === "pending" || fee.status === "partial") && canCollect && (
                        <Button variant="subtle" size="sm" onClick={() => openCollect(fee)} leftIcon={DollarSign} title="Collect Payment" />
                      )}
                      {fee.status !== "paid" && fee.status !== "waived" && canWaive && (
                        <Button variant="ghost" size="sm" onClick={() => handleWaive(fee._id)} leftIcon={X} title="Waive" />
                      )}
                      {canCollect && (
                        <Button variant="dangerSubtle" size="sm" onClick={() => handleDelete(fee._id)} leftIcon={Trash2} title="Delete" />
                      )}
                    </div>
                  </div>
                </Card>
              )})}

              {visibleFeeCount < fees.length && (
                <div className="py-6 flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-2 text-xs text-ink-soft">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    <span>Loading more fee records ({visibleFeeCount} of {fees.length})...</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleFeeCount(prev => Math.min(fees.length, prev + 25))}
                    className="text-xs"
                  >
                    Load More ({fees.length - visibleFeeCount} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cohort Detailed Student Fees Modal */}
      <Modal
        isOpen={!!selectedCohort}
        onClose={() => {
          setSelectedCohort(null);
          setVisibleCohortFeeCount(25);
        }}
        title={selectedCohort ? `${selectedCohort.courseName} (${selectedCohort.branch}) — Fee Records` : "Cohort Details"}
        size="xl"
      >
        {selectedCohort && (
          <div className="space-y-5">
            {/* Cohort Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-background rounded-xl border border-line">
              <div>
                <span className="text-[11px] uppercase text-ink-faint font-medium">Total Fees</span>
                <p className="text-base font-bold text-ink">{formatCurrency(selectedCohort.totalFees)}</p>
              </div>
              <div>
                <span className="text-[11px] uppercase text-ink-faint font-medium">Collected</span>
                <p className="text-base font-bold text-emerald-600">{formatCurrency(selectedCohort.totalCollected)}</p>
              </div>
              <div>
                <span className="text-[11px] uppercase text-ink-faint font-medium">Pending Due</span>
                <p className="text-base font-bold text-amber-600">{formatCurrency(selectedCohort.totalPending)}</p>
              </div>
              <div>
                <span className="text-[11px] uppercase text-ink-faint font-medium">Students / Records</span>
                <p className="text-base font-bold text-ink">{selectedCohort.studentCount} / {selectedCohort.fees.length}</p>
              </div>
            </div>

            {/* In-Modal Search & Filters */}
            <div className="flex gap-3 flex-wrap items-center justify-between">
              <div className="w-64">
                <Input
                  placeholder="Search student or roll no..."
                  value={cohortSearch}
                  onChange={e => {
                    setCohortSearch(e.target.value);
                    setVisibleCohortFeeCount(25);
                  }}
                />
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-36">
                  <Select value={cohortStatusFilter} onChange={e => {
                    setCohortStatusFilter(e.target.value);
                    setVisibleCohortFeeCount(25);
                  }}>
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="waived">Waived</option>
                  </Select>
                </div>
              </div>
            </div>

            {/* Filtered Student Fees List */}
            {(() => {
              const filteredList = selectedCohort.fees.filter(f => {
                const name = f.studentId?.name || "";
                const roll = f.studentId?.rollNo || "";
                const query = cohortSearch.toLowerCase();
                const matchesSearch = !query || name.toLowerCase().includes(query) || roll.toLowerCase().includes(query);
                const matchesStatus = !cohortStatusFilter || f.status === cohortStatusFilter;
                return matchesSearch && matchesStatus;
              });

              if (filteredList.length === 0) {
                return (
                  <div className="py-8 text-center text-ink-soft bg-surface rounded-xl border border-line">
                    No matching student fee records found.
                  </div>
                );
              }

              return (
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                  {filteredList.slice(0, visibleCohortFeeCount).map((fee, index) => {
                    const isLast = index === Math.min(filteredList.length, visibleCohortFeeCount) - 1;
                    return (
                    <div
                      ref={isLast ? lastCohortFeeElementRef : null}
                      key={fee._id}
                      className="p-3.5 bg-surface rounded-xl border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-ink text-sm">{fee.studentId?.name || "Unknown"}</span>
                          <span className="text-xs text-ink-soft">({fee.studentId?.rollNo || "—"})</span>
                          {getStatusBadge(fee.status)}
                          {fee.semester && <Badge tone="info" className="text-[11px]">Sem {fee.semester}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-ink-soft flex-wrap">
                          <span>Amount: <strong className="text-ink">{formatCurrency(fee.amount)}</strong></span>
                          {fee.paidAmount > 0 && <span className="text-emerald-600 font-semibold">Paid: {formatCurrency(fee.paidAmount)}</span>}
                          {fee.status !== "paid" && fee.status !== "waived" ? (
                            <>
                              <span>Balance: <strong className="text-amber-600">{formatCurrency(fee.amount - fee.paidAmount)}</strong></span>
                              <span>Due: {formatDateDMY(fee.dueDate)}</span>
                            </>
                          ) : (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Fully Settled
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => viewDetail(fee._id)} leftIcon={Eye} title="View Details" />
                        {(fee.status === "pending" || fee.status === "partial") && canCollect && (
                          <Button variant="subtle" size="sm" onClick={() => openCollect(fee)} leftIcon={DollarSign}>
                            Collect
                          </Button>
                        )}
                        {fee.status !== "paid" && fee.status !== "waived" && canWaive && (
                          <Button variant="ghost" size="sm" onClick={() => handleWaive(fee._id)} leftIcon={X} title="Waive" />
                        )}
                        {canCollect && (
                          <Button variant="dangerSubtle" size="sm" onClick={() => handleDelete(fee._id)} leftIcon={Trash2} title="Delete" />
                        )}
                      </div>
                    </div>
                  )})}

                  {visibleCohortFeeCount < filteredList.length && (
                    <div className="py-3 text-center">
                      <Button
                        variant="subtle"
                        size="sm"
                        onClick={() => setVisibleCohortFeeCount(prev => Math.min(filteredList.length, prev + 25))}
                        className="text-xs"
                      >
                        Load More Records ({filteredList.length - visibleCohortFeeCount} more)
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end pt-3 border-t border-line">
              <Button variant="outline" onClick={() => setSelectedCohort(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {activeTab === "transactions" && (
        <div className="space-y-4">
          <Table
            columns={transactionColumns}
            data={transactions.slice(0, visibleTxnCount)}
            emptyTitle="No Transactions"
            emptyMessage="No transactions yet"
            rowKey="_id"
          />
          {visibleTxnCount < transactions.length && (
            <div ref={lastTxnElementRef} className="py-4 flex items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleTxnCount(prev => Math.min(transactions.length, prev + 25))}
                className="text-xs"
              >
                Load More Transactions ({transactions.length - visibleTxnCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={formData.studentId === "bulk" ? "Bulk Create Fees" : "Create Fee Record"} size="lg" error={error}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(formData.courseId || formData.branch || formData.semester) && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex flex-wrap gap-x-4 gap-y-1">
              {formData.courseId && <span>Course: <strong>{courses.find(c => c._id === formData.courseId)?.name || formData.courseId}</strong></span>}
              {formData.branch && <span>Branch: <strong>{formData.branch}</strong></span>}
              {formData.semester && <span>Semester: <strong>{formData.semester}</strong></span>}
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {formData.studentId !== "bulk" ? (
              <Select label="Student *" value={formData.studentId} onChange={e => setFormData(p => ({ ...p, studentId: e.target.value }))} required>
                <option value="">Select Student</option>
                {students.map(s => (
                  <option key={s._id} value={s._id}>{s.firstName} {s.lastName} ({s.section})</option>
                ))}
              </Select>
            ) : (
              <Select label="Section (Bulk) *" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} required>
                <option value="">Select Section</option>
                {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
              </Select>
            )}
            <Select label="Fee Type" value={formData.feeType} onChange={e => setFormData(p => ({ ...p, feeType: e.target.value }))}>
              {FEE_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
            </Select>
            <Input label="Amount *" type="number" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} required min="1" />
            <Input label="Due Date *" type="date" value={formData.dueDate} onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))} required />
            <Input label="Late Fee" type="number" value={formData.lateFee} onChange={e => setFormData(p => ({ ...p, lateFee: e.target.value }))} min="0" />
            <Input label="Academic Year" value={formData.academicYear} onChange={e => setFormData(p => ({ ...p, academicYear: e.target.value }))} placeholder="e.g. 2025-26" />
            <Input label="Semester" type="number" value={formData.semester} onChange={e => setFormData(p => ({ ...p, semester: e.target.value }))} min="1" placeholder="Auto-filled" />
          </div>
          <Textarea label="Description" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" leftIcon={Save}>{formData.studentId === "bulk" ? "Create for Section" : "Create"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showCollectModal} onClose={() => { setShowCollectModal(false); setSelectedFee(null); }} title="Collect Payment" size="md">
        {selectedFee && (
          <form onSubmit={handleCollectPayment} className="space-y-4">
            <div className="p-4 bg-background rounded-xl space-y-1">
              <p className="text-sm text-ink-soft">Student: <span className="font-semibold text-ink">{selectedFee.studentId?.name}</span></p>
              <p className="text-sm text-ink-soft">Fee Amount: <span className="font-semibold text-ink">{formatCurrency(selectedFee.amount)}</span></p>
              <p className="text-sm text-ink-soft">Paid: <span className="font-semibold text-emerald-600">{formatCurrency(selectedFee.paidAmount)}</span></p>
              <p className="text-sm text-ink-soft">Remaining: <span className="font-semibold text-amber-600">{formatCurrency(selectedFee.amount - selectedFee.paidAmount)}</span></p>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Input label="Amount *" type="number" value={paymentData.amount} onChange={e => setPaymentData(p => ({ ...p, amount: parseFloat(e.target.value) }))} required min="1" max={selectedFee.amount - selectedFee.paidAmount} />
              <Select label="Payment Mode *" value={paymentData.mode} onChange={e => setPaymentData(p => ({ ...p, mode: e.target.value }))}>
                {PAYMENT_MODES.map(m => <option key={m} value={m} className="capitalize">{m.replace("_", " ")}</option>)}
              </Select>
            </div>
            <Textarea label="Notes" value={paymentData.notes} onChange={e => setPaymentData(p => ({ ...p, notes: e.target.value }))} rows={2} />
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => { setShowCollectModal(false); setSelectedFee(null); }}>Cancel</Button>
              <Button type="submit" leftIcon={DollarSign}>Collect Payment</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!feeDetail} onClose={() => setFeeDetail(null)} title="Fee Details" size="lg">
        {feeDetail && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Student</p><p className="font-semibold text-ink">{feeDetail.fee.studentId?.name}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Status</p><div className="mt-1">{getStatusBadge(feeDetail.fee.status)}</div></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Amount</p><p className="font-semibold text-ink">{formatCurrency(feeDetail.fee.amount)}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Paid</p><p className="font-semibold text-emerald-600">{formatCurrency(feeDetail.fee.paidAmount)}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Due Date</p><p className="font-semibold text-ink">{new Date(feeDetail.fee.dueDate).toLocaleDateString()}</p></div>
              <div className="p-4 bg-background rounded-xl"><p className="text-xs text-ink-faint uppercase">Type</p><p className="font-semibold text-ink capitalize">{feeDetail.fee.feeType}</p></div>
            </div>
            <div>
              <h3 className="font-semibold text-ink mb-3">Payment History ({feeDetail.transactions?.length || 0})</h3>
              {feeDetail.transactions?.length > 0 ? (
                <Table columns={paymentColumns} data={feeDetail.transactions} rowKey="_id" />
              ) : (
                <p className="text-sm text-ink-faint">No payments recorded</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} title="Generate Course Fees" size="lg" error={error}>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            Automatically creates tuition fee records for all students in the selected course and branch, using the fee amount configured in the course.
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Select label="Course *" value={generateData.courseId} onChange={e => setGenerateData(p => ({ ...p, courseId: e.target.value, section: "" }))} required>
              <option value="">Select Course</option>
              {courses.map(c => <option key={c._id} value={c._id}>{c.name} ({c.code})</option>)}
            </Select>
            <Select label="Branch *" value={generateData.section} onChange={e => setGenerateData(p => ({ ...p, section: e.target.value }))} required disabled={!selectedCourse}>
              <option value="">{selectedCourse ? "Select Branch" : "Select a course first"}</option>
              {courseBranches.map(b => <option key={b.code} value={b.code}>{b.name} ({b.code})</option>)}
            </Select>
            {selectedCourse && generateData.section && (
              <div className="md:col-span-2 p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex justify-between items-center">
                <span>Branch Fee Structure:</span>
                <span className="font-semibold text-purple-700">
                  {(() => {
                    const b = courseBranches.find(br => br.code === generateData.section || br.name === generateData.section);
                    const bFee = b?.feeStructure?.totalFee || b?.totalFee || b?.feeAmount;
                    if (bFee && Number(bFee) > 0) return `${formatCurrency(bFee)} (Branch Specific)`;
                    if (selectedCourse.feeStructure?.totalFee && Number(selectedCourse.feeStructure.totalFee) > 0) return `${formatCurrency(selectedCourse.feeStructure.totalFee)} (Course Default)`;
                    return "Not configured";
                  })()}
                </span>
              </div>
            )}
            <Input label="Due Date (optional)" type="date" value={generateData.dueDate} onChange={e => setGenerateData(p => ({ ...p, dueDate: e.target.value }))} />
            <p className="text-xs text-ink-faint md:col-span-2">If left blank, due dates are set automatically to each semester's end date.</p>
            <Input label="Academic Year" value={generateData.academicYear} onChange={e => setGenerateData(p => ({ ...p, academicYear: e.target.value }))} placeholder="e.g. 2025-26" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
            <Button type="submit" loading={generating} leftIcon={DollarSign}>Generate Fees</Button>
          </div>
        </form>
      </Modal>

      <PricingModal {...modalProps} onPlanChanged={() => { checkPlanAccess(); fetchFees(); fetchSummary(); fetchTransactions(); }} />
    </div>
  );
};

export default FeeManager;
