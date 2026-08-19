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
  Shield
} from "lucide-react";
import { motion } from "framer-motion";
import Button from "../common/ui/Button";
import Modal from "../common/ui/Modal";
import Table from "../common/ui/Table";
import Badge from "../common/ui/Badge";
import Input, { Select, Textarea } from "../common/ui/Input";
import PageHeader from "../common/ui/PageHeader";
import PricingModal from "../common/PricingModal";
import { useUpgradeModal } from "../../utils/billing";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { useTheme } from '../../contexts/ThemeContexts';

import BulkImportModal from "../common/ui/BulkImportModal";
import { Upload } from "lucide-react";
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



  // Theme colors
  const themeColors = {
    primary: colors?.primary || '#6366f1',
    secondary: colors?.secondary || '#8b5cf6',
    light: colors?.primary ? `${colors.primary}20` : '#eef2ff',
    lighter: colors?.primary ? `${colors.primary}10` : '#f5f3ff',
  };

  useEffect(() => {
    fetchTenantInfo();
    fetchTeachers();
    fetchRoles();
  }, []);


  // Clear messages after 5 seconds
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
      
      // Extract unique sections from assigned subjects
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
        
        // Reset form
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
      header: "Teacher",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ 
              backgroundColor: `${themeColors.primary}20`,
              color: themeColors.primary
            }}
          >
            <span className="font-semibold">
              {row.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-ink">{row.name}</p>
            <p className="text-sm text-ink-soft">{row.email}</p>
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
                className="px-2 py-1 rounded text-xs"
                style={{ 
                  backgroundColor: `${themeColors.primary}20`,
                  color: themeColors.primary
                }}
              >
                {section}
              </span>
            ))
          ) : (
            <span className="text-ink-faint text-sm">No sections assigned</span>
          )}
        </div>
      ),
    },
    {
      header: "Roll No",
      accessor: "rollNo",
    },
    {
      header: "Assigned Subjects",
      cell: (row) => (
        <span className="text-sm text-ink-soft">
          {row.assignedSubjects?.length || 0} subjects
        </span>
      ),
    },
    {
      header: "Status",
      cell: (row) => (
        <span className="flex items-center gap-1">
          {row.optimistic ? (
            <Badge tone="warning" dot>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
            </Badge>
          ) : (
            <Badge tone="success" dot>
              <Check className="w-3.5 h-3.5" /> Active
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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{
              backgroundColor: assignedCount > 0 ? `${themeColors.primary}15` : '#f3f4f6',
              color: assignedCount > 0 ? themeColors.primary : '#9ca3af'
            }}
          >
            <Shield className="w-3 h-3" />
            {assignedCount > 0 ? `${assignedCount} role${assignedCount > 1 ? 's' : ''}` : 'No roles'}
          </span>
        );
      },
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => viewTeacherDetails(row)}
            className="p-1 hover:bg-background rounded transition"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-ink-soft" />
          </button>
          <button 
            className="p-1 hover:bg-background rounded transition"
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
            className="p-1 hover:bg-background rounded transition"
            title="Delete"
            onClick={() => handleDelete(row._id)}
          >
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <PageHeader
        title="Manage Teachers"
        subtitle={`Add, update, and manage teacher profiles for ${tenantInfo?.name || "your institution"}`}
        icon={Users}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              leftIcon={Upload}
              onClick={() => setShowBulkModal(true)}
            >
              Bulk Operations
            </Button>
            <Button
              leftIcon={UserPlus}
              onClick={() => setShowForm(true)}
              style={{
                background: `linear-gradient(135deg, ${themeColors.primary}, ${themeColors.secondary})`
              }}
            >
              Add Teacher
            </Button>
          </div>
        }
      />



      {/* Filters */}
      <div>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink placeholder:text-ink-faint rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-line bg-surface text-ink rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none"
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
      </div>

      {/* Teachers Table */}
      <Table
        columns={columns}
        data={paginatedTeachers}
        loading={loading}
        emptyMessage="No teachers found."
        rowKey="_id"
        pagination={paginationInfo}
        onPageChange={setPage}
      />

      {/* Add Teacher Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setError(null);
        }}
        title="Add New Teacher"
        size="lg"
        error={error}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Full Name *" name="name" value={formData.name} onChange={handleInputChange} required />
            <Input label="Email *" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
            <Input label="Teacher Roll No / ID *" name="rollNo" value={formData.rollNo} onChange={handleInputChange} required placeholder="e.g. TCH001" />
            <Input label="Phone Number" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="e.g. +91 9876543210" />
            <Input label="Qualification" name="qualification" value={formData.qualification} onChange={handleInputChange} placeholder="e.g. M.Tech, PhD" />
            <Input label="Specialization" name="specialization" value={formData.specialization} onChange={handleInputChange} placeholder="e.g. Machine Learning, DBMS" />
            <Input label="Joining Date" name="joiningDate" type="date" value={formData.joiningDate} onChange={handleInputChange} />
          </div>
          <Textarea label="Address" name="address" rows={2} value={formData.address} onChange={handleInputChange} placeholder="Enter teacher address..." />
          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create Teacher
            </Button>
          </div>
        </form>
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} title="Teacher Details" size="lg">
        {selectedTeacher && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-inner"
                style={{ 
                  backgroundColor: `${themeColors.primary}15`,
                  color: themeColors.primary
                }}
              >
                <span className="text-3xl font-bold">
                  {selectedTeacher.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-ink tracking-tight">
                  {selectedTeacher.name}
                </h2>
                <p className="text-ink-soft font-medium">{selectedTeacher.email}</p>
                <p className="text-sm font-bold text-ink-faint mt-1 uppercase tracking-wider">Roll No: {selectedTeacher.rollNo}</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-5 bg-background rounded-2xl border border-line">
                <p className="text-sm font-bold text-ink-faint uppercase tracking-wider mb-3">Teaching Sections</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTeacher.teachingSections?.length > 0 ? (
                    selectedTeacher.teachingSections.map(section => (
                      <span 
                        key={section} 
                        className="px-3 py-1 rounded-lg text-sm font-semibold"
                        style={{ 
                          backgroundColor: `${themeColors.primary}15`,
                          color: themeColors.primary
                        }}
                      >
                        Section {section}
                      </span>
                    ))
                  ) : (
                    <p className="text-ink-soft text-sm font-medium">No sections assigned</p>
                  )}
                </div>
              </div>
              <div className="p-5 bg-background rounded-2xl border border-line">
                <p className="text-sm font-bold text-ink-faint uppercase tracking-wider mb-3">Assigned Subjects</p>
                <div className="space-y-3">
                  {selectedTeacher.assignmentsBySection ? (
                    Object.entries(selectedTeacher.assignmentsBySection).map(([section, subjects]) => (
                      <div key={section}>
                        <p className="text-sm font-bold text-ink-soft mb-1">Section {section}</p>
                        <div className="flex flex-wrap gap-2">
                          {subjects.map(subject => (
                            <span 
                              key={subject.subjectId} 
                              className="text-xs px-2.5 py-1 rounded-lg font-medium"
                              style={{ 
                                backgroundColor: `${themeColors.primary}10`,
                                color: themeColors.primary
                              }}
                            >
                              {subject.subjectName}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-ink-soft text-sm font-medium">No subjects assigned</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 bg-background rounded-2xl border border-line">
              <p className="text-sm font-bold text-ink-faint uppercase tracking-wider mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Assigned Roles
              </p>
              {teacherRoles.length > 0 ? (
                <div className="space-y-2 mb-3">
                  {teacherRoles.map(tr => (
                    <div key={tr._id} className="flex items-center justify-between p-2 bg-surface rounded-lg border border-line">
                      <div>
                        <p className="text-sm font-semibold text-ink">{tr.roleId?.name || "Unknown Role"}</p>
                        {tr.roleId?.description && <p className="text-xs text-ink-soft">{tr.roleId.description}</p>}
                      </div>
                      <button onClick={() => handleUnassignRole(tr.roleId?._id)} className="p-1 hover:bg-red-50 rounded transition" title="Remove role">
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-soft mb-3">No roles assigned</p>
              )}
              {availableRoles.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-ink-faint mb-2">Assign a role:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableRoles.filter(r => !teacherRoles.some(tr => tr.roleId?._id === r._id)).map(role => (
                      <button key={role._id} onClick={() => handleAssignRole(role._id)}
                        className="px-3 py-1.5 bg-surface border border-primary/40 text-primary-dark rounded-lg text-xs font-medium hover:bg-primary-soft transition"
                      >
                        + {role.name}
                      </button>
                    ))}
                    {availableRoles.filter(r => !teacherRoles.some(tr => tr.roleId?._id === r._id)).length === 0 && (
                      <span className="text-xs text-ink-faint">All roles assigned</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(selectedTeacher.phone || selectedTeacher.qualification || selectedTeacher.specialization) && (
              <div className="grid md:grid-cols-3 gap-4">
                {selectedTeacher.phone && (
                  <div className="p-4 bg-background rounded-xl border border-line">
                    <p className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-1">Phone</p>
                    <p className="font-semibold text-ink">{selectedTeacher.phone}</p>
                  </div>
                )}
                {selectedTeacher.qualification && (
                  <div className="p-4 bg-background rounded-xl border border-line">
                    <p className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-1">Qualification</p>
                    <p className="font-semibold text-ink">{selectedTeacher.qualification}</p>
                  </div>
                )}
                {selectedTeacher.specialization && (
                  <div className="p-4 bg-background rounded-xl border border-line">
                    <p className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-1">Specialization</p>
                    <p className="font-semibold text-ink">{selectedTeacher.specialization}</p>
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
    </motion.div>
  );
};

export default ManageTeachers;
