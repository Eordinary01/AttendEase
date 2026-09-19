// src/components/Admin/ManageTeachers.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  UserPlus,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  BookOpen,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  X,
  Check,
  AlertCircle,
  Users,
  ChevronDown,
  Building2,
  GraduationCap,
  Loader2,
  Shield,
  Upload,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import Button from "../common/ui/Button";
import Modal from "../common/ui/Modal";
import Table from "../common/ui/Table";
import Badge from "../common/ui/Badge";
import Input, { Select, Textarea } from "../common/ui/Input";
import DashboardHeader from "../common/ui/DashboardHeader";
import Card from "../common/ui/Card";
import BulkImportModal from "../common/ui/BulkImportModal";
import PricingModal from "../common/PricingModal";
import { useUpgradeModal } from "../../utils/billing";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { useTheme } from "../../contexts/ThemeContexts";
import { useToast } from "../../contexts/ToastContext";

const BULK_TEACHERS_EXAMPLE = `[
  {
    "name": "Dr. Sarah Jenkins",
    "email": "sarah.jenkins@institution.edu",
    "rollNo": "TCH-1001",
    "phone": "+19876543210",
    "qualification": "Ph.D. Computer Science",
    "specialization": "Artificial Intelligence & ML",
    "address": "Building B, Office 302",
    "joiningDate": "2026-01-15",
    "isActive": true
  },
  {
    "name": "Prof. Alan Turing",
    "email": "alan.turing@institution.edu",
    "rollNo": "TCH-1002",
    "phone": "+19876543211",
    "qualification": "M.Tech Mathematics",
    "specialization": "Algorithms & Cryptography",
    "address": "Building A, Office 101",
    "joiningDate": "2026-02-01",
    "isActive": true
  }
]`;

const BULK_TEACHERS_COLUMNS = [
  { key: "name", label: "Full Name", required: true, description: "Teacher's full name", example: "Dr. Sarah Jenkins" },
  { key: "email", label: "Email", required: true, description: "Unique institutional email used for login", example: "sarah.jenkins{{i}}@institution.edu" },
  { key: "rollNo", label: "Roll No", required: false, description: "Teacher ID. Auto-generated (TCH-xxxx) if blank", example: "TCH-10{{i}}" },
  { key: "phone", label: "Phone", required: false, description: "Contact number", example: "+198765432{{i}}0" },
  { key: "qualification", label: "Qualification", required: false, description: "Highest degree earned", example: "Ph.D. Computer Science" },
  { key: "specialization", label: "Specialization", required: false, description: "Area of expertise", example: "Artificial Intelligence & ML" },
  { key: "address", label: "Address", required: false, description: "Office / home address", example: "Building B, Office 302" },
  { key: "joiningDate", label: "Joining Date", required: false, description: "Format YYYY-MM-DD", example: "2026-01-15" },
  { key: "isActive", label: "Is Active", required: false, description: "Active status (true/false, default: true)", example: "true" },
];

const ManageTeachers = () => {
  const { colors } = useTheme();
  const { success: toastSuccess, error: toastError } = useToast();
  const [teachers, setTeachers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [sections, setSections] = useState([]);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [teacherRoles, setTeacherRoles] = useState([]);

  // Academic Structure & Scoping State for Custom Roles (Option B)
  const [courses, setCourses] = useState([]);
  const [activeSectionsList, setActiveSectionsList] = useState([]);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState("");
  const [isBeyondClass, setIsBeyondClass] = useState(false);
  const [assignCourseId, setAssignCourseId] = useState("");
  const [assignBranch, setAssignBranch] = useState("");
  const [assignSemester, setAssignSemester] = useState("1");
  const [assignSection, setAssignSection] = useState("A");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");

  const { modalProps, openUpgradeForError } = useUpgradeModal();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    rollNo: "",
    phone: "",
    address: "",
    qualification: "",
    specialization: "",
    joiningDate: "",
  });

  const themeColors = {
    primary: colors?.primary || '#7c3aed',
    secondary: colors?.secondary || '#06b6d4',
  };

  useEffect(() => {
    fetchTenantInfo();
    fetchTeachers();
    fetchRoles();
    fetchAcademicData();
  }, []);

  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const fetchTenantInfo = async () => {
    try {
      const response = await api.get('/auth/tenant-info');
      if (response.data.success) {
        setTenantInfo(response.data.data?.tenant);
      }
    } catch (error) {
      logError("Fetch Tenant Info", error);
    }
  };

  const fetchAcademicData = async () => {
    try {
      const [coursesRes, sectionsRes] = await Promise.all([
        api.get("/academic/courses").catch(() => ({ data: { data: [] } })),
        api.get("/admin/active-sections").catch(() => ({ data: { data: [] } })),
      ]);

      const courseList = coursesRes.data?.data || [];
      setCourses(courseList);

      const activeSecList = sectionsRes.data?.data || sectionsRes.data?.sections || [];
      const combinedSections = [...new Set([...activeSecList, "A", "B", "C", "D", "E"])]
        .filter(Boolean)
        .map(s => String(s).toUpperCase())
        .sort();
      setActiveSectionsList(combinedSections);
    } catch (err) {
      logError("Fetch Academic Data", err);
    }
  };

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/teachers');

      const teachersList = response.data.data || [];
      setTeachers(teachersList);
      
      const uniqueSections = new Set();
      teachersList.forEach(teacher => {
        if (teacher.teachingSections) {
          teacher.teachingSections.forEach(section => uniqueSections.add(section));
        }
      });
      setSections([...uniqueSections].sort());
    } catch (error) {
      logError("Fetch Teachers", error);
      if (!openUpgradeForError(error)) {
        setError(error.response?.data?.message || "Failed to fetch teachers");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('/roles');
      setAvailableRoles(res.data.data || []);
    } catch (err) {
      logError("Fetch Roles", err);
    }
  };

  const fetchTeacherRoles = async (teacherId) => {
    try {
      const res = await api.get(`/roles/teachers/${teacherId}`);
      setTeacherRoles(res.data.data || []);
    } catch (err) {
      logError("Fetch Teacher Roles", err);
    }
  };

  const openAssignRoleModal = (roleId = "", teacher = null) => {
    setAssignError("");
    if (teacher) {
      setSelectedTeacher(teacher);
      fetchTeacherRoles(teacher._id);
    } else if (!selectedTeacher && teachers.length > 0) {
      setSelectedTeacher(teachers[0]);
      fetchTeacherRoles(teachers[0]._id);
    }
    if (availableRoles.length === 0) {
      fetchRoles();
    }
    const chosenRoleId = roleId || availableRoles[0]?._id || "";
    setAssignRoleId(chosenRoleId);

    const role = availableRoles.find(r => r._id === chosenRoleId);
    const isBroadRole = role ? /hod|head|dean|director|coordinator|controller|proctor/i.test(role.name) : false;
    setIsBeyondClass(isBroadRole);

    const defaultCourse = courses[0];
    setAssignCourseId(defaultCourse?._id || "");
    setAssignBranch(defaultCourse?.branches?.[0]?.name || "");
    setAssignSemester(isBroadRole ? "" : "1");
    setAssignSection(isBroadRole ? "" : (activeSectionsList[0] || "A"));
    setAssignModalOpen(true);
  };

  const handleRoleSelectionChange = (newRoleId) => {
    setAssignRoleId(newRoleId);
    const role = availableRoles.find(r => r._id === newRoleId);
    if (role) {
      const isBroadRole = /hod|head|dean|director|coordinator|controller|proctor/i.test(role.name);
      setIsBeyondClass(isBroadRole);
      if (isBroadRole) {
        setAssignSection("");
        setAssignSemester("");
      } else {
        if (!assignSemester) setAssignSemester("1");
        if (!assignSection) setAssignSection(activeSectionsList[0] || "A");
      }
    }
  };

  const handleCourseSelectionChange = (newCourseId) => {
    setAssignCourseId(newCourseId);
    const course = courses.find(c => c._id === newCourseId);
    const firstBranch = course?.branches?.[0]?.name || "";
    setAssignBranch(firstBranch);
    if (!isBeyondClass) {
      setAssignSemester("1");
    }
  };

  const handleConfirmAssignRole = async (e) => {
    if (e) e.preventDefault();
    if (!selectedTeacher || !assignRoleId) return;
    if (!isBeyondClass && !assignSection) {
      setAssignError("Please select an academic section for this class role.");
      return;
    }

    try {
      setAssignLoading(true);
      setAssignError("");
      await api.post('/roles/assign', {
        teacherId: selectedTeacher._id,
        roleId: assignRoleId,
        courseId: assignCourseId || null,
        branch: assignBranch || "",
        semester: assignSemester ? Number(assignSemester) : null,
        section: isBeyondClass ? "" : assignSection.trim().toUpperCase(),
        isPrimary: !isBeyondClass,
      });

      fetchTeacherRoles(selectedTeacher._id);
      fetchTeachers();
      setAssignModalOpen(false);
      setSuccessMessage("Role and academic duties assigned successfully");
    } catch (err) {
      setAssignError(err.response?.data?.message || "Failed to assign role");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUnassignRole = async (roleId, assignmentId, section) => {
    if (!selectedTeacher) return;
    try {
      const params = new URLSearchParams();
      if (assignmentId) params.append("assignmentId", assignmentId);
      if (section) params.append("section", section);
      const queryStr = params.toString() ? `?${params.toString()}` : "";
      await api.delete(`/roles/assign/${selectedTeacher._id}/${roleId || assignmentId}${queryStr}`);
      fetchTeacherRoles(selectedTeacher._id);
      fetchTeachers();
      setSuccessMessage("Role unassigned successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to unassign role");
    }
  };

  const filteredTeachers = useMemo(() => {
    let filtered = [...teachers];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name?.toLowerCase().includes(term) ||
          t.email?.toLowerCase().includes(term) ||
          t.rollNo?.toLowerCase().includes(term)
      );
    }

    if (filterSection) {
      filtered = filtered.filter((t) => 
        t.teachingSections?.includes(filterSection)
      );
    }

    return filtered;
  }, [teachers, searchTerm, filterSection]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterSection]);

  const paginationInfo = useMemo(() => ({
    page,
    limit: pageSize,
    total: filteredTeachers.length,
    pages: Math.ceil(filteredTeachers.length / pageSize) || 1
  }), [page, pageSize, filteredTeachers.length]);

  const paginatedTeachers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTeachers.slice(start, start + pageSize);
  }, [filteredTeachers, page, pageSize]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.rollNo) {
      const msg = "Please fill all required fields";
      setError(msg);
      toastError(msg);
      return;
    }

    const tempId = "temp-" + Date.now();
    const optimisticTeacher = {
      _id: tempId,
      name: formData.name,
      email: formData.email,
      rollNo: formData.rollNo,
      phone: formData.phone,
      address: formData.address,
      qualification: formData.qualification,
      specialization: formData.specialization,
      optimistic: true,
      createdAt: new Date().toISOString(),
    };

    setTeachers((prev) => [optimisticTeacher, ...prev]);
    setShowForm(false);
    setSubmitting(true);
    setError(null);

    try {
      const response = await api.post('/admin/create-teacher', formData);

      if (response.data.success) {
        setTeachers((prev) =>
          prev.map((t) =>
            t._id === tempId ? { ...response.data.teacher, optimistic: false } : t
          )
        );
        const msg = "Teacher created successfully!";
        setSuccessMessage(msg);
        toastSuccess(msg);
        
        setFormData({
          name: "",
          email: "",
          rollNo: "",
          phone: "",
          address: "",
          qualification: "",
          specialization: "",
          joiningDate: "",
        });
      }
    } catch (err) {
      setTeachers((prev) => prev.filter((t) => t._id !== tempId));
      if (!openUpgradeForError(err)) {
        const msg = err.response?.data?.message || "Failed to create teacher";
        setError(msg);
        toastError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (teacherId) => {
    if (!window.confirm("Are you sure you want to delete this teacher?")) return;
    
    try {
      const response = await api.delete(`/users/teachers/${teacherId}`);

      if (response.data.success) {
        setTeachers(prev => prev.filter(t => t._id !== teacherId));
        const msg = "Teacher deleted successfully!";
        setSuccessMessage(msg);
        toastSuccess(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to delete teacher";
      setError(msg);
      toastError(msg);
      setTimeout(() => setError(null), 3000);
    }
  };

  const viewTeacherDetails = (teacher) => {
    setSelectedTeacher(teacher);
    setShowDetails(true);
    fetchTeacherRoles(teacher._id);
  };

  const columns = [
    {
      header: "Faculty Member",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div 
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-xs text-white"
            style={{ 
              backgroundColor: themeColors.primary
            }}
          >
            {row.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-ink text-xs">{row.name}</p>
            <p className="text-[11px] text-ink-soft">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Teaching Sections",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.teachingSections?.length > 0 ? (
            row.teachingSections.map(section => (
              <span 
                key={section} 
                className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-primary/10 text-primary border border-primary/20"
              >
                {section}
              </span>
            ))
          ) : (
            <span className="text-ink-faint text-xs">No sections</span>
          )}
        </div>
      ),
    },
    {
      header: "Teacher ID",
      accessor: "rollNo",
    },
    {
      header: "Assigned Subjects",
      cell: (row) => (
        <span className="text-xs text-ink-soft font-semibold">
          {row.assignedSubjects?.length || 0} subjects
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row) => (
        <span className="flex items-center gap-1">
          {row.optimistic ? (
            <Badge tone="warning" size="sm" dot>
              <Loader2 className="w-3 h-3 animate-spin" /> Saving...
            </Badge>
          ) : (
            <Badge tone="success" size="sm" dot>
              Active
            </Badge>
          )}
        </span>
      ),
    },
    {
      header: "Roles & Duties",
      cell: (row) => {
        const assigned = row.customRoles || [];
        return (
          <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
            {assigned.length > 0 ? (
              assigned.map((cr, idx) => (
                <span
                  key={cr._id || idx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-primary/10 text-primary border border-primary/20"
                >
                  <Shield className="w-2.5 h-2.5" />
                  {cr.roleId?.name || "Role"}
                  {cr.section ? (
                    <span className="text-[10px] bg-primary/20 px-1 rounded">
                      Sec {cr.section}
                    </span>
                  ) : cr.branch ? (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-600 px-1 rounded">
                      {cr.branch}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-surface-alt px-1 rounded text-ink-soft">
                      Campus
                    </span>
                  )}
                </span>
              ))
            ) : (
              <span className="text-xs text-ink-faint italic">No roles</span>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openAssignRoleModal("", row);
              }}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-surface border border-line text-ink-soft hover:text-primary hover:border-primary/40 transition cursor-pointer"
              title="Assign another role"
            >
              <Plus className="w-2.5 h-2.5" />
              Assign
            </button>
          </div>
        );
      },
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            onClick={() => openAssignRoleModal("", row)}
            className="p-1.5 hover:bg-primary/10 rounded-lg text-primary hover:text-primary-dark transition cursor-pointer"
            title="Assign Role & Academic Duties (Mentor / Advisor)"
          >
            <Shield className="w-4 h-4 text-primary" />
          </button>
          <button
            onClick={() => viewTeacherDetails(row)}
            className="p-1.5 hover:bg-background rounded-lg text-ink-soft hover:text-primary transition cursor-pointer"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button 
            className="p-1.5 hover:bg-background rounded-lg text-ink-soft hover:text-primary transition cursor-pointer"
            title="Edit"
            onClick={() => {
              setFormData({
                name: row.name,
                email: row.email,
                rollNo: row.rollNo,
                phone: row.phone || "",
                address: row.address || "",
                qualification: row.qualification || "",
                specialization: row.specialization || "",
                joiningDate: row.joiningDate || "",
              });
              setShowForm(true);
            }}
          >
            <Edit className="w-4 h-4 text-primary" />
          </button>
          <button 
            className="p-1.5 hover:bg-rose-500/10 rounded-lg text-ink-soft hover:text-rose-600 transition cursor-pointer"
            title="Delete"
            onClick={() => handleDelete(row._id)}
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Faculty Directory & Profiles"
        meta={`Add, update, and manage teacher profiles for ${tenantInfo?.name || "your campus"}`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={Shield}
              onClick={() => openAssignRoleModal()}
            >
              Assign Role / Duties
            </Button>
            <Button
              variant="subtle"
              size="sm"
              leftIcon={Upload}
              onClick={() => setShowBulkModal(true)}
            >
              Bulk Import
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={UserPlus}
              onClick={() => setShowForm(true)}
            >
              Add Faculty
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <Card padding="md" bordered>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto flex-1">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" />
              <input
                type="text"
                placeholder="Search by faculty name, email, roll no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" />
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-line/50 bg-background text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="">All Sections</option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-ink-soft font-semibold self-end sm:self-center">
            <span>{filteredTeachers.length} faculty registered</span>
          </div>
        </div>
      </Card>

      {/* Teachers Table Card */}
      <Card padding="none" bordered className="overflow-hidden">
        <Table
          columns={columns}
          data={paginatedTeachers}
          loading={loading}
          emptyMessage="No faculty records found matching criteria."
          rowKey="_id"
          pagination={paginationInfo}
          onPageChange={setPage}
        />
      </Card>

      {/* Add Teacher Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setError(null);
        }}
        title="Add Faculty Member"
        size="lg"
        error={error}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3.5">
            <Input label="Full Name *" name="name" value={formData.name} onChange={handleInputChange} required placeholder="Dr. Sarah Jenkins" />
            <Input label="Institutional Email *" name="email" type="email" value={formData.email} onChange={handleInputChange} required placeholder="sarah@institution.edu" />
            <Input label="Faculty ID / Roll No *" name="rollNo" value={formData.rollNo} onChange={handleInputChange} required placeholder="e.g. TCH001" />
            <Input label="Phone Number" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="e.g. +91 9876543210" />
            <Input label="Qualification" name="qualification" value={formData.qualification} onChange={handleInputChange} placeholder="e.g. Ph.D, M.Tech" />
            <Input label="Specialization" name="specialization" value={formData.specialization} onChange={handleInputChange} placeholder="e.g. Artificial Intelligence, Networks" />
            <Input label="Joining Date" name="joiningDate" type="date" value={formData.joiningDate} onChange={handleInputChange} />
          </div>
          <Textarea label="Address" name="address" rows={2} value={formData.address} onChange={handleInputChange} placeholder="Office room / address..." className="resize-none" />
          <div className="flex justify-end pt-3 gap-2.5 border-t border-line/50">
            <Button type="button" variant="subtle" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={submitting}>
              Create Faculty Profile
            </Button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} title="Faculty Profile" size="lg">
        {selectedTeacher && (
          <div className="space-y-5">
            <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-background border border-line/50">
              <div 
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-xs"
                style={{ 
                  backgroundColor: themeColors.primary,
                }}
              >
                {selectedTeacher.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-bold text-ink tracking-tight">
                  {selectedTeacher.name}
                </h2>
                <p className="text-xs text-ink-soft">{selectedTeacher.email}</p>
                <p className="text-[11px] font-bold text-primary font-mono mt-0.5">ID: {selectedTeacher.rollNo}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-background rounded-2xl border border-line/50">
                <p className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-2.5">Teaching Sections</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTeacher.teachingSections?.length > 0 ? (
                    selectedTeacher.teachingSections.map(section => (
                      <span 
                        key={section} 
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20"
                      >
                        Section {section}
                      </span>
                    ))
                  ) : (
                    <p className="text-ink-soft text-xs">No sections assigned</p>
                  )}
                </div>
              </div>
              <div className="p-4 bg-background rounded-2xl border border-line/50">
                <p className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-2.5">Assigned Subjects</p>
                <div className="space-y-2">
                  {selectedTeacher.assignmentsBySection ? (
                    Object.entries(selectedTeacher.assignmentsBySection).map(([section, subjects]) => (
                      <div key={section}>
                        <p className="text-xs font-bold text-ink mb-1">Section {section}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {subjects.map(subject => (
                            <span 
                              key={subject.subjectId} 
                              className="text-[11px] px-2 py-0.5 rounded-lg font-semibold bg-surface border border-line/50 text-ink"
                            >
                              {subject.subjectName}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-ink-soft text-xs">No subjects assigned</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 bg-background rounded-2xl border border-line/50">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  Administrative Roles & Academic Duties
                </p>
                {availableRoles.length > 0 && (
                  <button
                    onClick={() => openAssignRoleModal()}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Assign Role
                  </button>
                )}
              </div>

              {teacherRoles.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {teacherRoles.map(tr => (
                    <div key={tr._id} className="p-3 bg-surface rounded-xl border border-line/50 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-ink">{tr.roleId?.name || "Role"}</p>
                          {tr.isPrimary && (
                            <Badge tone="purple" size="sm">Primary</Badge>
                          )}
                          {tr.section && (
                            <Badge tone="primary" size="sm">Section {tr.section}</Badge>
                          )}
                          {tr.courseId && (
                            <span className="text-[10px] font-medium text-ink-soft bg-background px-1.5 py-0.5 rounded border border-line/40">
                              {tr.courseId?.code || tr.courseId?.name}
                            </span>
                          )}
                          {tr.branch && (
                            <span className="text-[10px] font-medium text-ink-soft bg-background px-1.5 py-0.5 rounded border border-line/40">
                              {tr.branch}
                            </span>
                          )}
                          {tr.semester && (
                            <span className="text-[10px] font-medium text-ink-soft bg-background px-1.5 py-0.5 rounded border border-line/40">
                              Sem {tr.semester}
                            </span>
                          )}
                        </div>
                        {tr.roleId?.description && (
                          <p className="text-[11px] text-ink-soft mt-0.5 truncate">{tr.roleId.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnassignRole(tr.roleId?._id, tr._id, tr.section)}
                        className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition cursor-pointer shrink-0"
                        title="Remove role assignment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-soft mb-3">No administrative or cohort roles assigned yet.</p>
              )}

              {availableRoles.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-ink-faint uppercase mb-1.5">Quick Assign:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableRoles.map(role => (
                      <button
                        key={role._id}
                        onClick={() => openAssignRoleModal(role._id)}
                        className="px-2.5 py-1 bg-surface border border-primary/30 text-primary hover:bg-primary/10 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        + {role.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {(selectedTeacher.phone || selectedTeacher.qualification || selectedTeacher.specialization) && (
              <div className="grid md:grid-cols-3 gap-3">
                {selectedTeacher.phone && (
                  <div className="p-3 bg-background rounded-xl border border-line/50">
                    <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider mb-0.5">Phone</p>
                    <p className="text-xs font-bold text-ink">{selectedTeacher.phone}</p>
                  </div>
                )}
                {selectedTeacher.qualification && (
                  <div className="p-3 bg-background rounded-xl border border-line/50">
                    <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider mb-0.5">Qualification</p>
                    <p className="text-xs font-bold text-ink">{selectedTeacher.qualification}</p>
                  </div>
                )}
                {selectedTeacher.specialization && (
                  <div className="p-3 bg-background rounded-xl border border-line/50">
                    <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider mb-0.5">Specialization</p>
                    <p className="text-xs font-bold text-ink">{selectedTeacher.specialization}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Role Assignment & Academic Scoping Modal (Option B) */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={selectedTeacher ? `Assign Role: ${selectedTeacher.name}` : "Assign Role"}
        size="md"
      >
        <form onSubmit={handleConfirmAssignRole} className="space-y-4 pt-1">
          {assignError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-600 text-xs font-semibold">
              {assignError}
            </div>
          )}

          {/* Faculty Member Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-1">
              Faculty Member *
            </label>
            <Select
              value={selectedTeacher?._id || ""}
              onChange={(e) => {
                const found = teachers.find(t => t._id === e.target.value);
                setSelectedTeacher(found || null);
                if (found) fetchTeacherRoles(found._id);
              }}
              className="text-xs"
              required
            >
              <option value="">-- Choose Faculty Member --</option>
              {teachers.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.email})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-soft mb-1">
              Select Role *
            </label>
            <Select
              value={assignRoleId}
              onChange={(e) => handleRoleSelectionChange(e.target.value)}
              className="text-xs"
              required
            >
              <option value="">-- Choose Role --</option>
              {availableRoles.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>

          {teacherRoles.length > 0 && (
            <div className="p-3 bg-surface-alt/40 rounded-xl border border-line/60 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
                Currently Assigned Duties for this Faculty
              </span>
              <div className="flex flex-wrap gap-1.5">
                {teacherRoles.map((tr) => (
                  <span
                    key={tr._id}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs bg-surface border border-line text-ink"
                  >
                    <Shield className="w-3 h-3 text-primary" />
                    <span className="font-semibold">{tr.roleId?.name || "Role"}</span>
                    {tr.section ? (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-1 rounded">
                        Sec {tr.section}
                      </span>
                    ) : tr.branch ? (
                      <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-600 px-1 rounded">
                        {tr.branch}
                      </span>
                    ) : (
                      <span className="text-[10px] text-ink-soft italic">Campus-wide</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUnassignRole(tr.roleId?._id, tr._id, tr.section)}
                      className="text-rose-500 hover:text-rose-700 ml-1 p-0.5 hover:bg-rose-500/10 rounded cursor-pointer"
                      title="Unassign this duty"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="p-3.5 bg-surface-alt/50 rounded-xl border border-line/60 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isBeyondClass}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsBeyondClass(checked);
                  if (checked) {
                    setAssignSection("");
                    setAssignSemester("");
                  } else {
                    if (!assignSemester) setAssignSemester("1");
                    if (!assignSection) setAssignSection(activeSectionsList[0] || "A");
                  }
                }}
                className="mt-0.5 rounded border-line text-primary focus:ring-primary h-4 w-4"
              />
              <div>
                <span className="text-xs font-bold text-ink">
                  Role applies beyond a single class (Department / Institution-wide)
                </span>
                <p className="text-[11px] text-ink-soft mt-0.5">
                  Enable this for broad leadership roles like HOD, Deputy HOD, Dean, or Coordinator.
                  Leave unchecked for class-specific roles like Academic Mentor or Class Advisor.
                </p>
              </div>
            </label>

            <div className="space-y-3 pt-2.5 border-t border-line/50">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                  isBeyondClass
                    ? "bg-indigo-500/10 text-indigo-600 border border-indigo-500/20"
                    : "bg-primary/10 text-primary border border-primary/20"
                }`}>
                  {isBeyondClass ? "Department / Institution-wide Scope" : "Class / Section Scope"}
                </span>
              </div>

              {/* Course Dropdown */}
              <div>
                <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                  Course / Program {!isBeyondClass && "*"}
                </label>
                <Select
                  value={assignCourseId}
                  onChange={(e) => handleCourseSelectionChange(e.target.value)}
                  className="text-xs"
                  required={!isBeyondClass}
                >
                  <option value="">{isBeyondClass ? "All Programs / Campus-wide" : "-- Choose Course --"}</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.code ? `(${c.code})` : ""}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Branch & Semester Dropdowns */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                    {isBeyondClass ? "Department / Branch" : "Branch / Stream"}
                  </label>
                  <Select
                    value={assignBranch}
                    onChange={(e) => setAssignBranch(e.target.value)}
                    className="text-xs"
                  >
                    <option value="">{isBeyondClass ? "All Departments / General" : "All Branches / General"}</option>
                    {courses
                      .find((c) => c._id === assignCourseId)
                      ?.branches?.filter((b) => b.isActive !== false)
                      .map((b) => (
                        <option key={b._id || b.name} value={b.name}>
                          {b.name} {b.code ? `(${b.code})` : ""}
                        </option>
                      ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                    Semester {isBeyondClass && "(Optional)"}
                  </label>
                  <Select
                    value={assignSemester}
                    onChange={(e) => setAssignSemester(e.target.value)}
                    className="text-xs"
                  >
                    {isBeyondClass && (
                      <option value="">All Semesters / Across Dept</option>
                    )}
                    {(() => {
                      const curCourse = courses.find((c) => c._id === assignCourseId);
                      const curBranch = curCourse?.branches?.find(
                        (b) => b.name?.toLowerCase() === (assignBranch || "").toLowerCase()
                      );
                      const totalSems =
                        curBranch?.totalSemesters ||
                        (curCourse?.durationYears ? curCourse.durationYears * 2 : 8);
                      return Array.from({ length: totalSems }, (_, idx) => idx + 1).map((s) => (
                        <option key={s} value={String(s)}>
                          Semester {s}
                        </option>
                      ));
                    })()}
                  </Select>
                </div>
              </div>

              {/* Section Dropdown (HIDDEN when isBeyondClass is true) */}
              {!isBeyondClass && (
                <div>
                  <label className="block text-[11px] font-semibold text-ink-soft mb-1">
                    Academic Section *
                  </label>
                  <Select
                    value={assignSection}
                    onChange={(e) => setAssignSection(e.target.value)}
                    className="text-xs"
                    required={!isBeyondClass}
                  >
                    <option value="">-- Choose Section --</option>
                    {activeSectionsList.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </Select>
                  <p className="text-[10px] text-ink-faint mt-1">
                    Specific class cohort this teacher will mentor or advise.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAssignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={assignLoading}
            >
              {assignLoading ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Assigning...</span>
                </div>
              ) : (
                "Confirm & Assign Role"
              )}
            </Button>
          </div>
        </form>
      </Modal>

      <BulkImportModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        endpoint="/admin/bulk-teachers"
        bodyKey="teachers"
        itemLabel="teachers"
        example={BULK_TEACHERS_EXAMPLE}
        columns={BULK_TEACHERS_COLUMNS}
        exportData={teachers}
        onImported={() => {
          setShowBulkModal(false);
          fetchTeachers();
        }}
      />

      <PricingModal
        {...modalProps}
        currentPlanCode={tenantInfo?.subscription?.plan}
      />
    </div>
  );
};

export default ManageTeachers;
