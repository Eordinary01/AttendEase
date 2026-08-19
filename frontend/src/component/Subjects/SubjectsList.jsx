// src/components/Subject/SubjectList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../utils/api';
import { logError } from '../../utils/logger';
import SubjectCard from './SubjectsCard';
import SubjectFilters from './SubjectsFilters';
import { useTheme } from '../../contexts/ThemeContexts';
import PageHeader from '../common/ui/PageHeader';
import StatCard from '../common/ui/StatCard';
import EmptyState from '../common/ui/EmptyState';
import Card from '../common/ui/Card';
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
  CheckCircle
} from 'lucide-react';

const SubjectsList = ({ role, userId, userName, userEmail }) => {
  const { colors } = useTheme();
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
      const response = await api.get('/subjects/all');

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
      else if (role === 'student' || role === 'parent') {
        // Student & Parent view - using subjects array directly
        const studentSubjects = response.data.subjects || response.data.data || [];
        setSubjects(studentSubjects);
        setFilteredGroups(studentSubjects); // For student/parent, we don't group
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
      logError("Fetch Subjects", err);
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
          <div
            className="w-16 h-16 border-4 rounded-full animate-spin mb-4"
            style={{
              borderColor: `${colors.primary}33`,
              borderTopColor: colors.primary
            }}
          ></div>
          <div style={{ color: colors.primary }} className="font-semibold">
            Loading subjects...
          </div>
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
            className="px-6 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: colors.primary }}
            onMouseEnter={(e) => e.target.style.backgroundColor = colors.accent}
            onMouseLeave={(e) => e.target.style.backgroundColor = colors.primary}
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
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="My Teaching Subjects"
          subtitle={
            <span style={{ color: colors.primary }}>
              You are teaching {groupedSubjects.length} subject{groupedSubjects.length !== 1 ? 's' : ''} across {stats.totalSections || 0} sections
            </span>
          }
          icon={BookOpen}
          actions={
            <>
              {teacherInfo && (
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: `${colors.primary}20`,
                      color: colors.primary
                    }}
                  >
                    {teacherInfo.name}
                  </span>
                  <span className="text-sm text-ink-soft">
                    {teacherInfo.email}
                  </span>
                </div>
              )}

              {/* View Toggle */}
              <div className="flex items-center space-x-2 bg-surface border border-line rounded-lg shadow-sm p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'grid'
                      ? 'text-white'
                      : 'text-ink-soft hover:bg-background'
                  }`}
                  style={viewMode === 'grid' ? { backgroundColor: colors.primary } : {}}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded transition-colors ${
                    viewMode === 'list'
                      ? 'text-white'
                      : 'text-ink-soft hover:bg-background'
                  }`}
                  style={viewMode === 'list' ? { backgroundColor: colors.primary } : {}}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </>
          }
        />

        {/* Teacher Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Subjects" value={groupedSubjects.length} icon={BookOpen} tone="primary" subtitle="Unique subjects" />
          <StatCard label="Total Sections" value={stats.totalSections || 0} icon={Layers} tone="secondary" subtitle="Across all subjects" />
          <StatCard label="Total Students" value={groupedSubjects.reduce((sum, g) => sum + g.totalStudents, 0)} icon={Users} tone="info" subtitle="Across all sections" />
          <StatCard label="Assignments" value={subjects.length} icon={CheckCircle} tone="warning" subtitle="Individual assignments" />
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
          <EmptyState
            icon={BookOpen}
            title="No Subjects Found"
            description={
              filters.search || filters.semester || filters.section
                ? "Try adjusting your filters"
                : "You haven't been assigned any subjects yet"
            }
          />
        ) : viewMode === 'grid' ? (
          // Grid View with Groups
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredGroups.map((group) => (
              <Card key={group.id} padding="none" hoverable className="overflow-hidden">
                {/* Group Header */}
                <div
                  className="p-6 border-b"
                  style={{
                    background: `linear-gradient(135deg, ${colors.background} 0%, white 100%)`,
                    borderColor: `${colors.primary}20`
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold" style={{ color: colors.primary }}>
                          {group.subjectName}
                        </h3>
                        <span
                          className="px-2 py-1 rounded text-sm font-medium"
                          style={{
                            backgroundColor: `${colors.primary}20`,
                            color: colors.primary
                          }}
                        >
                          {group.subjectCode}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 mb-3">
                        <span className="text-sm text-ink-soft flex items-center gap-1">
                          <Calendar className="w-4 h-4" style={{ color: colors.primary }} />
                          Semester {group.semester}
                        </span>
                        {group.credits > 0 && (
                          <span className="text-sm text-ink-soft">
                            {group.credits} Credits
                          </span>
                        )}
                      </div>

                      {/* Sections Tags */}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {group.sections.map(section => (
                          <span
                            key={section}
                            className="px-3 py-1 rounded-full text-sm font-medium border"
                            style={{
                              backgroundColor: `${colors.secondary}20`,
                              color: colors.secondary,
                              borderColor: `${colors.secondary}40`
                            }}
                          >
                            Section {section}
                          </span>
                        ))}
                      </div>

                      {/* Quick Stats */}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-ink-soft">
                          <Users className="w-4 h-4" />
                          {group.totalStudents} students
                        </span>
                        <span className="flex items-center gap-1 text-ink-soft">
                          <Layers className="w-4 h-4" />
                          {group.sections.length} section{group.sections.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleGroupExpand(group.id)}
                      className="p-2 rounded-full transition hover:bg-background"
                    >
                      {expandedGroups.has(group.id) ? (
                        <ChevronUp className="w-5 h-5" style={{ color: colors.primary }} />
                      ) : (
                        <ChevronDown className="w-5 h-5" style={{ color: colors.primary }} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedGroups.has(group.id) && (
                  <div className="p-4 bg-background space-y-3">
                    <h4 className="text-sm font-medium text-ink mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" style={{ color: colors.primary }} />
                      Assignment Details by Section
                    </h4>
                    {group.assignments.map((assignment, idx) => (
                      <div
                        key={assignment.assignmentId || idx}
                        className="bg-surface rounded-lg p-3 flex items-center justify-between hover:shadow-sm transition"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${colors.primary}20` }}
                          >
                            <span className="font-medium text-sm" style={{ color: colors.primary }}>
                              {assignment.section}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-ink">
                              Section {assignment.section}
                            </p>
                            <p className="text-xs text-ink-soft">
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
              </Card>
            ))}
          </div>
        ) : (
          // List View with Groups
          <div className="space-y-4">
            {filteredGroups.map((group) => (
              <Card key={group.id} padding="none" hoverable className="overflow-hidden">
                {/* List View Header */}
                <div
                  className="p-4 cursor-pointer transition hover:bg-background"
                  style={{
                    background: `linear-gradient(135deg, ${colors.background} 0%, white 100%)`,
                  }}
                  onClick={() => toggleGroupExpand(group.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${colors.primary}20` }}
                      >
                        <BookOpen className="w-5 h-5" style={{ color: colors.primary }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold" style={{ color: colors.primary }}>
                            {group.subjectName}
                          </h3>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${colors.primary}20`,
                              color: colors.primary
                            }}
                          >
                            {group.subjectCode}
                          </span>
                          <span className="text-xs text-ink-soft">
                            Sem {group.semester}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1 text-ink-soft">
                            <Users className="w-4 h-4" />
                            {group.totalStudents} students
                          </span>
                          <span className="flex flex-wrap gap-1">
                            {group.sections.map(s => (
                              <span
                                key={s}
                                className="text-xs px-2 py-0.5 rounded"
                                style={{
                                  backgroundColor: `${colors.secondary}20`,
                                  color: colors.secondary
                                }}
                              >
                                Sec {s}
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-faint">
                        {group.assignments.length} assignment{group.assignments.length !== 1 ? 's' : ''}
                      </span>
                      {expandedGroups.has(group.id) ? (
                        <ChevronUp className="w-5 h-5 text-ink-faint" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-ink-faint" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded List View Details */}
                {expandedGroups.has(group.id) && (
                  <div className="p-4 bg-background border-t border-line">
                    <div className="space-y-2">
                      {group.assignments.map((assignment, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-ink-soft">Section {assignment.section}</span>
                          <span className="text-ink-soft">
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
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Student or Admin View
  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={role === 'admin' ? 'Subject Management' : role === 'parent' ? "My Child's Subjects" : 'My Subjects'}
        subtitle={
          <span style={{ color: colors.primary }}>
            {role === 'admin' && `Total Subjects: ${stats.totalSubjects || subjects.length}`}
            {(role === 'student' || role === 'parent') && `Enrolled Subjects: ${filteredGroups.length}`}
          </span>
        }
        icon={BookOpen}
        actions={
          /* View Toggle */
          <div className="flex items-center space-x-2 bg-surface border border-line rounded-lg shadow-sm p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'text-white'
                  : 'text-ink-soft hover:bg-background'
              }`}
              style={viewMode === 'grid' ? { backgroundColor: colors.primary } : {}}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'list'
                  ? 'text-white'
                  : 'text-ink-soft hover:bg-background'
              }`}
              style={viewMode === 'list' ? { backgroundColor: colors.primary } : {}}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        }
      />

      {(role === 'student' || role === 'parent') && studentInfo && (
        <p className="text-sm" style={{ color: colors.secondary }}>
          Section {studentInfo.section} {studentInfo.enrollmentNumber ? `• Roll/Enrollment: ${studentInfo.enrollmentNumber}` : ''}
        </p>
      )}

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
        <EmptyState
          icon={BookOpen}
          title="No Subjects Found"
          description={
            filters.search || filters.semester
              ? 'Try adjusting your filters'
              : role === 'student'
                ? "No subjects are available for your section yet"
                : 'No subjects have been created yet'
          }
        />
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
  );
};

export default SubjectsList;
