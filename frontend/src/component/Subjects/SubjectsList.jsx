// src/components/Subject/SubjectList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import SubjectCard from './SubjectsCard';
import SubjectFilters from './SubjectsFilters';
import { 
  BookOpen, 
  Grid, 
  List, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  Layers,
  Users,
  Calendar,
  Eye,
  CheckCircle,
  XCircle
} from 'lucide-react';

const SubjectsList = ({ role, userId, userName, userEmail }) => {
  const [subjects, setSubjects] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [stats, setStats] = useState({});
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [filters, setFilters] = useState({
    search: '',
    semester: '',
    section: '',
    status: 'all'
  });
  
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8011";

  useEffect(() => {
    fetchSubjects();
  }, [role]);

  // Group subjects by subject ID for teacher view
  const groupedSubjects = useMemo(() => {
    if (role !== 'teacher') return [];
    
    const groups = new Map();
    
    subjects.forEach(item => {
      const subjectId = item.subject?.id || item.subject?._id;
      const subjectName = item.subject?.subjectName;
      const subjectCode = item.subject?.subjectCode;
      const semester = item.subject?.semester;
      const credits = item.subject?.credits;
      const description = item.subject?.description;
      
      if (!subjectId) return;
      
      const key = subjectId;
      
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          subjectId,
          subjectName,
          subjectCode,
          semester,
          credits,
          description,
          sections: [],
          assignments: [],
          totalStudents: 0,
          firstAssigned: item.assignedDate,
          lastAssigned: item.assignedDate
        });
      }
      
      const group = groups.get(key);
      group.sections.push(item.section);
      group.assignments.push(item);
      group.totalStudents += item.studentsCount || 0;
      
      // Track assignment dates
      if (new Date(item.assignedDate) < new Date(group.firstAssigned)) {
        group.firstAssigned = item.assignedDate;
      }
      if (new Date(item.assignedDate) > new Date(group.lastAssigned)) {
        group.lastAssigned = item.assignedDate;
      }
    });
    
    // Convert to array and sort sections
    return Array.from(groups.values()).map(group => ({
      ...group,
      sections: [...new Set(group.sections)].sort(),
      assignments: group.assignments.sort((a, b) => 
        new Date(b.assignedDate) - new Date(a.assignedDate)
      )
    }));
  }, [subjects, role]);

  // Apply filters for teacher view
  useEffect(() => {
    if (role === 'teacher') {
      let filtered = [...groupedSubjects];

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = filtered.filter(group => 
          group.subjectName?.toLowerCase().includes(searchLower) ||
          group.subjectCode?.toLowerCase().includes(searchLower) ||
          group.description?.toLowerCase().includes(searchLower) ||
          group.sections.some(s => s.toLowerCase().includes(searchLower))
        );
      }

      // Semester filter
      if (filters.semester) {
        filtered = filtered.filter(group => group.semester === filters.semester);
      }

      // Section filter
      if (filters.section) {
        filtered = filtered.filter(group => group.sections.includes(filters.section));
      }

      setFilteredGroups(filtered);
    }
  }, [filters, groupedSubjects, role]);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/subjects/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('📚 Subjects fetched:', response.data);
      
      // Handle different response structures based on role
      if (role === 'teacher') {
        // Teacher view - using assignedSubjects.subjects
        const teacherSubjects = response.data.assignedSubjects?.subjects || [];
        setSubjects(teacherSubjects);
        setTeacherInfo(response.data.teacherInfo);
        setStats({
          totalSubjects: response.data.assignedSubjects?.count || 0,
          bySection: response.data.bySection || {},
          totalGroups: new Set(teacherSubjects.map(s => s.subject?.id || s.subject?._id)).size,
          totalSections: Object.keys(response.data.bySection || {}).length
        });
      } 
      else if (role === 'student') {
        // Student view - using subjects array directly
        const studentSubjects = response.data.subjects || [];
        setSubjects(studentSubjects);
        setFilteredGroups(studentSubjects); // For student, we don't group
        setStudentInfo(response.data.studentInfo);
        setStats({});
      } 
      else {
        // Admin view - using subjects array
        const adminSubjects = response.data.subjects || [];
        setSubjects(adminSubjects);
        setFilteredGroups(adminSubjects);
        setStats(response.data.stats || {});
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setError(err.response?.data?.message || 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  // For student and admin views - regular filtering
  useEffect(() => {
    if (role !== 'teacher') {
      let result = [...subjects];

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(item => {
          const subject = item.subject || item;
          return (
            subject.subjectName?.toLowerCase().includes(searchLower) ||
            subject.subjectCode?.toLowerCase().includes(searchLower) ||
            subject.description?.toLowerCase().includes(searchLower)
          );
        });
      }

      if (filters.semester) {
        result = result.filter(item => {
          const subject = item.subject || item;
          return subject.semester === filters.semester;
        });
      }

      setFilteredGroups(result);
    }
  }, [filters, subjects, role]);

  // Get unique semesters for filter
  const uniqueSemesters = useMemo(() => {
    if (role === 'teacher') {
      return [...new Set(groupedSubjects.map(g => g.semester).filter(Boolean))];
    }
    return [...new Set(
      subjects.map(item => {
        const subject = item.subject || item;
        return subject.semester;
      }).filter(Boolean)
    )];
  }, [groupedSubjects, subjects, role]);

  // Get unique sections for filter (teacher view only)
  const uniqueSections = role === 'teacher' && stats.bySection 
    ? Object.keys(stats.bySection).sort()
    : [];

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      semester: '',
      section: '',
      status: 'all'
    });
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

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
          <div className="text-purple-700 font-semibold">Loading subjects...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-red-800 mb-2">Error Loading Subjects</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchSubjects}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Teacher View with Grouping
  if (role === 'teacher') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-purple-900 mb-2">
                  My Teaching Subjects
                </h1>
                <p className="text-purple-600">
                  You are teaching {groupedSubjects.length} subject{groupedSubjects.length !== 1 ? 's' : ''} across {stats.totalSections || 0} sections
                </p>
                
                {teacherInfo && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                      {teacherInfo.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {teacherInfo.email}
                    </span>
                  </div>
                )}
              </div>
              
              {/* View Toggle */}
              <div className="flex items-center space-x-2 bg-white rounded-lg shadow-sm p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-purple-600 text-white' 
                      : 'text-gray-600 hover:bg-purple-50'
                  }`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-purple-600 text-white' 
                      : 'text-gray-600 hover:bg-purple-50'
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Teacher Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
                <p className="text-sm text-gray-600">Total Subjects</p>
                <p className="text-2xl font-bold text-purple-900">{groupedSubjects.length}</p>
                <p className="text-xs text-gray-500">Unique subjects</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
                <p className="text-sm text-gray-600">Total Sections</p>
                <p className="text-2xl font-bold text-green-900">{stats.totalSections || 0}</p>
                <p className="text-xs text-gray-500">Across all subjects</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
                <p className="text-sm text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-blue-900">
                  {groupedSubjects.reduce((sum, g) => sum + g.totalStudents, 0)}
                </p>
                <p className="text-xs text-gray-500">Across all sections</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-orange-500">
                <p className="text-sm text-gray-600">Assignments</p>
                <p className="text-2xl font-bold text-orange-900">{subjects.length}</p>
                <p className="text-xs text-gray-500">Individual assignments</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <SubjectFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClear={clearFilters}
            semesters={uniqueSemesters}
            sections={uniqueSections}
            showSectionFilter={true}
            showStatusFilter={false}
          />

          {/* Subjects Grid/List */}
          {filteredGroups.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <BookOpen className="w-16 h-16 text-purple-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-purple-900 mb-2">No Subjects Found</h3>
              <p className="text-purple-600">
                {filters.search || filters.semester || filters.section
                  ? "Try adjusting your filters"
                  : "You haven't been assigned any subjects yet"}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            // Grid View with Groups
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {filteredGroups.map((group) => (
                <div key={group.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-all">
                  {/* Group Header */}
                  <div className="p-6 bg-gradient-to-r from-purple-50 to-white border-b border-purple-100">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold text-purple-900">
                            {group.subjectName}
                          </h3>
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                            {group.subjectCode}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Semester {group.semester}
                          </span>
                          {group.credits > 0 && (
                            <span className="text-sm text-gray-600">
                              {group.credits} Credits
                            </span>
                          )}
                        </div>

                        {/* Sections Tags */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {group.sections.map(section => (
                            <span
                              key={section}
                              className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium border border-indigo-200"
                            >
                              Section {section}
                            </span>
                          ))}
                        </div>

                        {/* Quick Stats */}
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-gray-600">
                            <Users className="w-4 h-4" />
                            {group.totalStudents} students
                          </span>
                          <span className="flex items-center gap-1 text-gray-600">
                            <Layers className="w-4 h-4" />
                            {group.sections.length} section{group.sections.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleGroupExpand(group.id)}
                        className="p-2 hover:bg-purple-100 rounded-full transition"
                      >
                        {expandedGroups.has(group.id) ? (
                          <ChevronUp className="w-5 h-5 text-purple-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-purple-600" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedGroups.has(group.id) && (
                    <div className="p-4 bg-gray-50 space-y-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Assignment Details by Section
                      </h4>
                      {group.assignments.map((assignment, idx) => (
                        <div
                          key={assignment.assignmentId || idx}
                          className="bg-white rounded-lg p-3 flex items-center justify-between hover:shadow-sm transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center">
                              <span className="text-purple-600 font-medium text-sm">
                                {assignment.section}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Section {assignment.section}
                              </p>
                              <p className="text-xs text-gray-500">
                                Assigned: {new Date(assignment.assignedDate).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {assignment.studentsCount || 0} students
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            // List View with Groups
            <div className="space-y-4">
              {filteredGroups.map((group) => (
                <div key={group.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {/* List View Header */}
                  <div 
                    className="p-4 bg-gradient-to-r from-purple-50 to-white cursor-pointer hover:bg-purple-50/50 transition"
                    onClick={() => toggleGroupExpand(group.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold text-purple-900">
                              {group.subjectName}
                            </h3>
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                              {group.subjectCode}
                            </span>
                            <span className="text-xs text-gray-500">
                              Sem {group.semester}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1 text-gray-600">
                              <Users className="w-4 h-4" />
                              {group.totalStudents} students
                            </span>
                            <span className="flex flex-wrap gap-1">
                              {group.sections.map(s => (
                                <span key={s} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                                  Sec {s}
                                </span>
                              ))}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {group.assignments.length} assignment{group.assignments.length !== 1 ? 's' : ''}
                        </span>
                        {expandedGroups.has(group.id) ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded List View Details */}
                  {expandedGroups.has(group.id) && (
                    <div className="p-4 bg-gray-50 border-t border-gray-200">
                      <div className="space-y-2">
                        {group.assignments.map((assignment, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Section {assignment.section}</span>
                            <span className="text-gray-500">
                              {new Date(assignment.assignedDate).toLocaleDateString()}
                            </span>
                            <span className="text-green-600">
                              {assignment.studentsCount || 0} students
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Student or Admin View (unchanged)
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-purple-900 mb-2">
                {role === 'admin' ? 'Subject Management' : 'My Subjects'}
              </h1>
              <p className="text-purple-600">
                {role === 'admin' && `Total Subjects: ${stats.totalSubjects || subjects.length}`}
                {role === 'student' && `Your Subjects: ${filteredGroups.length}`}
              </p>
              
              {role === 'student' && studentInfo && (
                <p className="text-sm text-purple-500 mt-1">
                  Section {studentInfo.section} • Enrollment: {studentInfo.enrollmentNumber}
                </p>
              )}
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center space-x-2 bg-white rounded-lg shadow-sm p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-600 hover:bg-purple-50'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-gray-600 hover:bg-purple-50'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <SubjectFilters
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={clearFilters}
          semesters={uniqueSemesters}
          sections={[]}
          showSectionFilter={false}
          showStatusFilter={role === 'admin'}
        />

        {/* Subjects Grid/List */}
        {filteredGroups.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <BookOpen className="w-16 h-16 text-purple-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-purple-900 mb-2">No Subjects Found</h3>
            <p className="text-purple-600">
              {filters.search || filters.semester
                ? 'Try adjusting your filters'
                : role === 'student'
                  ? "No subjects are available for your section yet"
                  : 'No subjects have been created yet'}
            </p>
          </div>
        ) : (
          <div className={
            viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
              : 'space-y-4'
          }>
            {filteredGroups.map((item, index) => (
              <SubjectCard
                key={item._id || item.id || `subject-${index}`}
                subject={item}
                role={role}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubjectsList;