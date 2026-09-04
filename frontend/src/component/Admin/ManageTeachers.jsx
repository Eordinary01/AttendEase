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

  const handleAssignRole = async (roleId) => {
    if (!selectedTeacher) return;
    try {
      await api.post('/roles/assign', {
        teacherId: selectedTeacher._id,
        roleId,
      });
      fetchTeacherRoles(selectedTeacher._id);
      setSuccessMessage("Role assigned successfully");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to assign role");
    }
  };

  const handleUnassignRole = async (roleId) => {
    if (!selectedTeacher) return;
    try {
      await api.delete(`/roles/assign/${selectedTeacher._id}/${roleId}`);
      fetchTeacherRoles(selectedTeacher._id);
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
      header: "Roles",
      cell: (row) => {
        const assignedCount = row.customRoles?.length || 0;
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-background border border-line/50 text-ink-soft">
            <Shield className="w-3 h-3 text-primary" />
            {assignedCount > 0 ? `${assignedCount} role${assignedCount > 1 ? 's' : ''}` : 'None'}
          </span>
        );
      },
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex items-center gap-1.5 justify-end">
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
              <p className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-primary" />
                Administrative Roles
              </p>
              {teacherRoles.length > 0 ? (
                <div className="space-y-1.5 mb-3">
                  {teacherRoles.map(tr => (
                    <div key={tr._id} className="flex items-center justify-between p-2 bg-surface rounded-xl border border-line/50">
                      <div>
                        <p className="text-xs font-bold text-ink">{tr.roleId?.name || "Role"}</p>
                        {tr.roleId?.description && <p className="text-[11px] text-ink-soft">{tr.roleId.description}</p>}
                      </div>
                      <button onClick={() => handleUnassignRole(tr.roleId?._id)} className="p-1 hover:bg-rose-500/10 text-rose-500 rounded-lg transition cursor-pointer" title="Remove role">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink-soft mb-3">No additional administrative roles assigned.</p>
              )}
              {availableRoles.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-ink-faint uppercase mb-1.5">Assign Role:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {availableRoles.filter(r => !teacherRoles.some(tr => tr.roleId?._id === r._id)).map(role => (
                      <button key={role._id} onClick={() => handleAssignRole(role._id)}
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
