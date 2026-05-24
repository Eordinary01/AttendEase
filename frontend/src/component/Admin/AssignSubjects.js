// src/components/Admin/AssignSubjects.jsx
import React, { useState, useEffect, useMemo } from "react";
import { 
  Grid, 
  Search,
  Filter,
  BookOpen,
  Users,
  Award,
  Plus,
  Trash2,
  Edit,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  Calendar,
  UserCheck,
  BookMarked,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Layers,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import Card from "./common/Card";
import Modal from "./common/Modal";

const AssignSubjects = () => {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [selectedSectionFilter, setSelectedSectionFilter] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [sortBy, setSortBy] = useState("teacher"); // teacher, subject, date
  const [sortOrder, setSortOrder] = useState("asc");
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalSubjects: 0,
    totalAssignments: 0,
    totalSections: 0,
    teachersWithAssignments: 0,
    totalGroups: 0
  });
  
  // For multi-section input
  const [sectionInput, setSectionInput] = useState("");
  const [selectedSections, setSelectedSections] = useState([]);

  const [formData, setFormData] = useState({
    teacherId: "",
    subjectId: "",
  });

  const API_URL = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (assignments.length > 0) {
      // Extract all unique sections from assignments
      const sections = new Set();
      assignments.forEach(a => {
        (a.sections || []).forEach(s => sections.add(s));
      });
      setAvailableSections([...sections].sort());
    }
  }, [assignments]);

  // Group assignments by teacher-subject combination
  const groupedAssignments = useMemo(() => {
    const groups = new Map();
    
    assignments.forEach(assignment => {
      const key = `${assignment.teacher?._id}-${assignment.subject?._id}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          teacher: assignment.teacher,
          subject: assignment.subject,
          sections: new Set(),
          assignments: [],
          firstAssignedDate: assignment.assignedDate,
          lastAssignedDate: assignment.assignedDate,
          totalStudentsUpdated: 0
        });
      }
      
      const group = groups.get(key);
      group.sections.add(assignment.section);
      group.assignments.push(assignment);
      
      // Track dates
      if (new Date(assignment.assignedDate) < new Date(group.firstAssignedDate)) {
        group.firstAssignedDate = assignment.assignedDate;
      }
      if (new Date(assignment.assignedDate) > new Date(group.lastAssignedDate)) {
        group.lastAssignedDate = assignment.assignedDate;
      }
      
      group.totalStudentsUpdated += assignment.studentsUpdated || 0;
    });
    
    // Convert Sets to Arrays and sort sections
    return Array.from(groups.values()).map(group => ({
      ...group,
      sections: Array.from(group.sections).sort(),
      assignments: group.assignments.sort((a, b) => 
        new Date(b.assignedDate) - new Date(a.assignedDate)
      )
    }));
  }, [assignments]);

  // Filter and sort groups
  useEffect(() => {
    let filtered = [...groupedAssignments];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g => 
        g.teacher?.name?.toLowerCase().includes(term) ||
        g.teacher?.email?.toLowerCase().includes(term) ||
        g.subject?.subjectName?.toLowerCase().includes(term) ||
        g.subject?.subjectCode?.toLowerCase().includes(term) ||
        g.sections.some(s => s.toLowerCase().includes(term))
      );
    }

    // Apply teacher filter
    if (filterTeacher) {
      filtered = filtered.filter(g => g.teacher?._id === filterTeacher);
    }

    // Apply subject filter
    if (filterSubject) {
      filtered = filtered.filter(g => g.subject?._id === filterSubject);
    }

    // Apply section filter (multiple selection)
    if (selectedSectionFilter.length > 0) {
      filtered = filtered.filter(g => 
        selectedSectionFilter.some(section => g.sections.includes(section))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "teacher":
          comparison = (a.teacher?.name || "").localeCompare(b.teacher?.name || "");
          break;
        case "subject":
          comparison = (a.subject?.subjectName || "").localeCompare(b.subject?.subjectName || "");
          break;
        case "sections":
          comparison = a.sections.length - b.sections.length;
          break;
        case "date":
        default:
          comparison = new Date(b.lastAssignedDate) - new Date(a.lastAssignedDate);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

    setFilteredGroups(filtered);
    setStats(prev => ({ ...prev, totalGroups: filtered.length }));
  }, [searchTerm, filterTeacher, filterSubject, selectedSectionFilter, sortBy, sortOrder, groupedAssignments]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const [teachersRes, subjectsRes, assignmentsRes] = await Promise.all([
        fetch(`${API_URL}/admin/teachers`, { headers }),
        fetch(`${API_URL}/admin/subjects`, { headers }),
        fetch(`${API_URL}/admin/assignments`, { headers }),
      ]);

      if (!teachersRes.ok) throw new Error("Failed to fetch teachers");
      if (!subjectsRes.ok) throw new Error("Failed to fetch subjects");
      if (!assignmentsRes.ok) throw new Error("Failed to fetch assignments");

      const teachersData = await teachersRes.json();
      const subjectsData = await subjectsRes.json();
      const assignmentsData = await assignmentsRes.json();

      // Handle different response structures
      const teachersList = teachersData.data || teachersData || [];
      const subjectsList = subjectsData.data || subjectsData || [];
      const assignmentsList = assignmentsData.data || [];

      setTeachers(teachersList);
      setSubjects(subjectsList);
      setAssignments(assignmentsList);

      // Update stats
      setStats({
        totalTeachers: teachersList.length,
        totalSubjects: subjectsList.length,
        totalAssignments: assignmentsList.length,
        totalSections: [...new Set(assignmentsList.flatMap(a => a.sections || []))].length,
        teachersWithAssignments: assignmentsData.stats?.teachersWithAssignments || 
          new Set(assignmentsList.map(a => a.teacher?._id)).size,
        totalGroups: 0 // Will be updated in filter effect
      });

      console.log("📥 Data loaded:", { 
        teachers: teachersList.length, 
        subjects: subjectsList.length, 
        assignments: assignmentsList.length 
      });
      
    } catch (error) {
      console.error("Error loading data:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle section filter toggle
  const toggleSectionFilter = (section) => {
    setSelectedSectionFilter(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const clearSectionFilters = () => {
    setSelectedSectionFilter([]);
  };

  // Handle adding a section
  const handleAddSection = () => {
    if (!sectionInput.trim()) return;
    
    // Handle comma-separated input
    const input = sectionInput.trim().toUpperCase();
    if (input.includes(',')) {
      const multipleSections = input.split(',').map(s => s.trim()).filter(s => s);
      const newSections = multipleSections.filter(s => !selectedSections.includes(s));
      setSelectedSections([...selectedSections, ...newSections]);
    } else {
      if (!selectedSections.includes(input)) {
        setSelectedSections([...selectedSections, input]);
      }
    }
    setSectionInput("");
  };

  // Handle removing a section
  const handleRemoveSection = (sectionToRemove) => {
    setSelectedSections(selectedSections.filter(s => s !== sectionToRemove));
  };

  // Handle key press in section input
  const handleSectionKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSection();
    }
  };

  const toggleGroupExpand = (groupId) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleViewDetails = (group) => {
    setSelectedGroup(group);
    setShowDetailsModal(true);
  };

  const handleEdit = (group) => {
    // Populate form with group data for editing
    setFormData({
      teacherId: group.teacher?._id || "",
      subjectId: group.subject?._id || "",
    });
    setSelectedSections(group.sections || []);
    setShowForm(true);
  };

  const handleDelete = async (assignmentId) => {
    if (!window.confirm("Are you sure you want to delete this assignment?")) return;
    
    try {
      // You'll need to implement this endpoint
      const res = await fetch(`${API_URL}/admin/assignments/${assignmentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete assignment");

      setAssignments(prev => prev.filter(a => a._id !== assignmentId));
      setSuccessMessage("Assignment deleted successfully!");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.teacherId || !formData.subjectId || selectedSections.length === 0) {
      setError("Please select a teacher, subject, and add at least one section");
      return;
    }

    const teacher = teachers.find(t => t._id === formData.teacherId);
    const subject = subjects.find(s => s._id === formData.subjectId);

    const tempId = "temp-" + Date.now();
    const optimisticAssignments = selectedSections.map(section => ({
      _id: `${tempId}-${section}`,
      teacher,
      subject,
      section,
      sections: [section],
      optimistic: true,
      assignedDate: new Date().toISOString(),
      studentsUpdated: 0
    }));

    setAssignments(prev => [...optimisticAssignments, ...prev]);
    setShowForm(false);
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    // Reset form
    setFormData({
      teacherId: "",
      subjectId: "",
    });
    const submittedSections = [...selectedSections];
    setSelectedSections([]);
    setSectionInput("");

    try {
      console.log("📤 Sending request with sections:", submittedSections);
      
      const res = await fetch(`${API_URL}/admin/assign-subject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teacherId: formData.teacherId,
          subjectId: formData.subjectId,
          sections: submittedSections
        }),
      });

      const data = await res.json();
      console.log("📥 Response:", data);

      if (!res.ok) throw new Error(data.message || "Failed to assign subject");

      // Remove optimistic assignments and add real ones
      setAssignments(prev => 
        prev.filter(a => !a._id.startsWith(tempId))
      );

      // Refresh data to get real assignments
      await fetchData();

      setSuccessMessage(
        `✅ Subject assigned successfully! ${data.data?.studentsUpdated || 0} students updated.`
      );

    } catch (err) {
      console.error("❌ Error:", err);
      setAssignments(prev => prev.filter(a => !a._id.startsWith(tempId)));
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getUniqueTeachers = () => {
    const uniqueTeachers = new Map();
    groupedAssignments.forEach(g => {
      if (g.teacher?._id && !uniqueTeachers.has(g.teacher._id)) {
        uniqueTeachers.set(g.teacher._id, g.teacher);
      }
    });
    return Array.from(uniqueTeachers.values());
  };

  const getUniqueSubjects = () => {
    const uniqueSubjects = new Map();
    groupedAssignments.forEach(g => {
      if (g.subject?._id && !uniqueSubjects.has(g.subject._id)) {
        uniqueSubjects.set(g.subject._id, g.subject);
      }
    });
    return Array.from(uniqueSubjects.values());
  };

  const handleCloseModal = () => {
    setShowForm(false);
    setFormData({
      teacherId: "",
      subjectId: "",
    });
    setSelectedSections([]);
    setSectionInput("");
    setError(null);
  };

  const refreshData = () => {
    fetchData();
  };

  const exportAssignments = () => {
    const exportData = {
      groups: groupedAssignments,
      totalGroups: groupedAssignments.length,
      totalAssignments: assignments.length,
      exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `assignments_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Assign Subjects</h1>
            <p className="text-gray-500 mt-1">
              Map subjects to teachers across multiple sections
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportAssignments}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              title="Export assignments"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Export</span>
            </button>
            <button
              onClick={refreshData}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden md:inline">Refresh</span>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Assignment
            </button>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Teachers</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalTeachers}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Subjects</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalSubjects}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Grid className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Assignments</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalAssignments}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Layers className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Groups</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalGroups}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Award className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Sections</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalSections}</p>
              </div>
            </div>
          </Card>
          <Card padding="md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Active Teachers</p>
                <p className="text-xl font-bold text-gray-900">{stats.teachersWithAssignments}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters and Sorting */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by teacher, subject, or section..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="md:col-span-2 relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={filterTeacher}
                onChange={(e) => setFilterTeacher(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
              >
                <option value="">All Teachers</option>
                {getUniqueTeachers().map(t => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
              >
                <option value="">All Subjects</option>
                {getUniqueSubjects().map(s => (
                  <option key={s._id} value={s._id}>{s.subjectName}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <div className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white min-h-[42px] flex flex-wrap gap-1 items-center">
                  {selectedSectionFilter.length === 0 && (
                    <span className="text-gray-400 text-sm">Filter by sections...</span>
                  )}
                  {selectedSectionFilter.map(section => (
                    <span
                      key={section}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-sm"
                    >
                      {section}
                      <button
                        onClick={() => toggleSectionFilter(section)}
                        className="hover:text-indigo-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                {/* Dropdown for section selection */}
                {availableSections.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {availableSections.map(section => (
                      <label
                        key={section}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSectionFilter.includes(section)}
                          onChange={() => toggleSectionFilter(section)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Section {section}</span>
                      </label>
                    ))}
                    {selectedSectionFilter.length > 0 && (
                      <div className="p-2 border-t border-gray-200">
                        <button
                          onClick={clearSectionFilters}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="teacher">Sort by Teacher</option>
                <option value="subject">Sort by Subject</option>
                <option value="sections">Sort by Sections</option>
                <option value="date">Sort by Date</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {sortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </Card>

        {/* Groups List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-1/4 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card className="text-center py-12">
            <Grid className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Assignments Found</h3>
            <p className="text-gray-500">
              {searchTerm || filterTeacher || filterSubject || selectedSectionFilter.length > 0
                ? "Try adjusting your filters"
                : "Create your first subject assignment"}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => (
              <Card key={group.id} className="overflow-hidden">
                {/* Group Header */}
                <div className="p-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 font-bold text-xl">
                          {group.teacher?.name?.charAt(0)?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="font-bold text-xl text-gray-900">
                            {group.teacher?.name}
                          </h3>
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                            {group.teacher?.email}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 mb-3">
                          <span className="text-lg font-semibold text-indigo-700">
                            {group.subject?.subjectName}
                          </span>
                          <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                            {group.subject?.subjectCode}
                          </span>
                          {group.subject?.semester && (
                            <span className="text-sm text-gray-500">
                              Semester {group.subject.semester}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex flex-wrap gap-2">
                            {group.sections.map(section => (
                              <span 
                                key={section} 
                                className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium border border-indigo-200"
                              >
                                Section {section}
                              </span>
                            ))}
                          </div>
                          
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(group.lastAssignedDate).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {group.totalStudentsUpdated} students
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:flex-col md:items-end">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleViewDetails(group)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="View details"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleEdit(group)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit assignment"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => toggleGroupExpand(group.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                          title={expandedGroups.has(group.id) ? "Show less" : "Show all assignments"}
                        >
                          {expandedGroups.has(group.id) ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <span className="text-xs text-gray-400">
                        {group.assignments.length} assignment{group.assignments.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded View - Individual Assignments */}
                {expandedGroups.has(group.id) && (
                  <div className="p-4 bg-gray-50 space-y-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Assignment History
                    </h4>
                    {group.assignments.map((assignment, index) => (
                      <div
                        key={assignment._id}
                        className="bg-white rounded-lg p-4 flex items-center justify-between hover:shadow-sm transition"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-medium">
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Section {assignment.section}
                            </p>
                            <p className="text-xs text-gray-500">
                              Assigned: {new Date(assignment.assignedDate).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {assignment.studentsUpdated > 0 && (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {assignment.studentsUpdated} students
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(assignment._id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete this assignment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* New Assignment Modal */}
        <Modal isOpen={showForm} onClose={handleCloseModal} title="Create New Assignment" size="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Teacher <span className="text-red-500">*</span>
              </label>
              <select
                name="teacherId"
                value={formData.teacherId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Choose a teacher...</option>
                {teachers.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.name} - {t.email}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Subject <span className="text-red-500">*</span>
              </label>
              <select
                name="subjectId"
                value={formData.subjectId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Choose a subject...</option>
                {subjects.map(s => (
                  <option key={s._id} value={s._id}>
                    {s.subjectCode} - {s.subjectName} (Sem {s.semester})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add Sections <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Enter section names (e.g., A, B, SA, SH, SI) and press Enter or click Add
              </p>
              
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={sectionInput}
                  onChange={(e) => setSectionInput(e.target.value)}
                  onKeyPress={handleSectionKeyPress}
                  placeholder="Enter section name..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition whitespace-nowrap"
                >
                  Add
                </button>
              </div>

              {/* Selected Sections Tags */}
              {selectedSections.length > 0 && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selected Sections:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {selectedSections.map(section => (
                      <span
                        key={section}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                      >
                        {section}
                        <button
                          type="button"
                          onClick={() => handleRemoveSection(section)}
                          className="hover:text-indigo-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedSections.length === 0 && (
                <p className="text-sm text-amber-600 mt-2">
                  ⚠️ Please add at least one section
                </p>
              )}
              
              {selectedSections.length > 0 && (
                <p className="text-sm text-green-600 mt-2">
                  ✓ {selectedSections.length} section(s) selected
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formData.teacherId || !formData.subjectId || selectedSections.length === 0 || submitting}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Assigning...
                  </>
                ) : (
                  'Create Assignment'
                )}
              </button>
            </div>
          </form>
        </Modal>

        {/* Group Details Modal */}
        <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title="Assignment Group Details" size="lg">
          {selectedGroup && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-indigo-600 font-semibold">
                    {selectedGroup.teacher?.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedGroup.teacher?.name}</h2>
                  <p className="text-gray-500">{selectedGroup.teacher?.email}</p>
                  <p className="text-sm text-gray-400">Roll No: {selectedGroup.teacher?.rollNo || 'N/A'}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Subject</p>
                  <p className="font-medium text-gray-900">{selectedGroup.subject?.subjectName}</p>
                  <p className="text-sm text-gray-500">Code: {selectedGroup.subject?.subjectCode}</p>
                  {selectedGroup.subject?.semester && (
                    <p className="text-sm text-gray-500">Semester: {selectedGroup.subject.semester}</p>
                  )}
                  {selectedGroup.subject?.credits > 0 && (
                    <p className="text-sm text-gray-500">Credits: {selectedGroup.subject.credits}</p>
                  )}
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Assigned Sections</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedGroup.sections.map(section => (
                      <span key={section} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                        Section {section}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Total: {selectedGroup.sections.length} sections
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">Assignment Statistics</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Total Assignments</p>
                    <p className="text-xl font-bold text-gray-900">{selectedGroup.assignments.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Students Updated</p>
                    <p className="text-xl font-bold text-green-600">{selectedGroup.totalStudentsUpdated}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">First Assigned</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(selectedGroup.firstAssignedDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Last Assigned</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(selectedGroup.lastAssignedDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-3">Assignment History</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedGroup.assignments.map((assignment, idx) => (
                    <div key={assignment._id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-500">#{idx + 1}</span>
                        <span className="text-sm font-medium text-indigo-600">Section {assignment.section}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400">
                          {new Date(assignment.assignedDate).toLocaleString()}
                        </span>
                        {assignment.studentsUpdated > 0 && (
                          <span className="text-xs text-green-600">
                            {assignment.studentsUpdated} students
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default AssignSubjects;