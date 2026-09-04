// src/components/AttendanceOverview.jsx
import React, { useEffect, useState, useMemo } from 'react';
import api from '../../utils/api';
import { logError } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  Calendar,
  Loader2,
  AlertCircle,
  User,
  CreditCard,
  School,
  BookOpen,
  Award,
  Percent,
  X,
  Filter,
  Download,
  TrendingUp,
  CheckCircle,
  XCircle,
  CalendarDays,
  GraduationCap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Search,
  ChevronDown,
  Users,
} from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { useTheme } from '../../contexts/ThemeContexts';
import DashboardHeader from '../common/ui/DashboardHeader';
import Card from '../common/ui/Card';
import StatCard from '../common/ui/StatCard';
import Badge from '../common/ui/Badge';
import Button from '../common/ui/Button';
import EmptyState from '../common/ui/EmptyState';
import Modal from '../common/ui/Modal';

function hexToRgbStr(hex = "#6366f1") {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

const safeFormatDate = (dateVal, formatStr = 'MMM dd, yyyy') => {
  if (!dateVal) return 'N/A';
  try {
    if (dateVal instanceof Date) {
      return format(dateVal, formatStr);
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return format(d, formatStr);
    }
    if (typeof dateVal === 'string' && dateVal.includes('-') && !dateVal.includes('T')) {
      const parts = dateVal.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return format(new Date(year, month, day), formatStr);
      }
    }
    return 'N/A';
  } catch (err) {
    logError("Safe Format Date", err);
    return 'N/A';
  }
};

const AttendanceOverview = () => {
  const { colors } = useTheme();
  const primary = colors?.primary || "#7c3aed";
  const secondary = colors?.secondary || primary;

  const cssVars = {
    "--theme-primary": primary,
    "--theme-secondary": secondary,
    "--theme-primary-rgb": hexToRgbStr(primary),
  };

  const [attendanceSummary, setAttendanceSummary] = useState([]);
  const [classSessions, setClassSessions] = useState([]);
  const [overallStats, setOverallStats] = useState(null);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [activeTab, setActiveTab] = useState('students');

  const [stats, setStats] = useState({
    totalStudents: 0,
    averageAttendance: 0,
    highestAttendance: 0,
    lowestAttendance: 0
  });

  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  useEffect(() => {
    if (token) {
      if (userRole === 'teacher') {
        fetchTeacherSubjects();
      } else {
        fetchAttendanceSummary();
      }
    }
  }, [token, userRole]);

  useEffect(() => {
    if (userRole === 'teacher' && selectedSubject && selectedSection) {
      fetchAttendanceSummary();
    }
  }, [selectedSubject, selectedSection, selectedDate]);

  const fetchTeacherSubjects = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/subjects/all');

      const data = response.data;
      setTeacherInfo(data.teacherInfo);

      const subjects = data.assignedSubjects?.subjects || [];
      setTeacherSubjects(subjects);

      if (subjects.length > 0) {
        const firstSubject = subjects[0];
        setSelectedSubject(firstSubject.subject?.id);
        setSelectedSection(firstSubject.section);
      }
    } catch (error) {
      logError("Fetch Teacher Subjects", error);
      setError('Failed to load your subjects');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubjectChange = (subjectId) => {
    setSelectedSubject(subjectId);
    setSelectedSection('');

    const subjectSections = teacherSubjects.filter(
      item => item.subject?.id === subjectId
    );

    if (subjectSections.length > 0) {
      setSelectedSection(subjectSections[0].section);
    }
  };

  const fetchAttendanceSummary = async () => {
    try {
      setIsLoading(true);
      const url = '/attendance/summary';
      const params = new URLSearchParams();

      if (userRole === 'teacher') {
        params.append('subjectId', selectedSubject);
        params.append('section', selectedSection);
        if (selectedDate) {
          params.append('date', selectedDate);
        }
      }

      const response = await api.get(`${url}?${params.toString()}`);

      const data = response.data;
      setClassSessions(data.classSessions || []);
      setOverallStats(data.overallStats || null);

      const transformedStudents = (data.studentSummary || [])
        .filter(Boolean)
        .map(student => ({
          studentId: student.studentId || student._id,
          name: student.name,
          rollNo: student.rollNo || '',
          section: data.subject?.section || selectedSection,
          totalClasses: student.totalClasses,
          classesAttended: student.presentCount,
          attendancePercentage: student.percentage,
          presentCount: student.presentCount,
          absentCount: student.absentCount,
          leaveCount: student.leaveCount
        }));

      setAttendanceSummary(transformedStudents);

      if (transformedStudents.length > 0) {
        const percentages = transformedStudents.map(s => s.attendancePercentage || 0);
        setStats({
          totalStudents: transformedStudents.length,
          averageAttendance: percentages.reduce((a, b) => a + b, 0) / percentages.length,
          highestAttendance: Math.max(...percentages),
          lowestAttendance: Math.min(...percentages)
        });
      } else {
        setStats({
          totalStudents: 0,
          averageAttendance: 0,
          highestAttendance: 0,
          lowestAttendance: 0
        });
      }

      setError(null);
    } catch (error) {
      logError("Fetch Attendance Summary", error);
      setError('Failed to load attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudentDetails = async (studentId) => {
    try {
      const response = await api.get(
        `/attendance/stats?studentId=${studentId}&subjectId=${selectedSubject}`
      );
      setSelectedStudent(response.data.data);
    } catch (error) {
      logError("Fetch Student Details", error);
    }
  };

  const sortData = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });

    setAttendanceSummary(prevData => [...prevData].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      if (key === 'attendancePercentage') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (aVal < bVal) return direction === 'ascending' ? -1 : 1;
      if (aVal > bVal) return direction === 'ascending' ? 1 : -1;
      return 0;
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
    }
    return <ArrowUpDown className="w-3.5 h-3.5 text-ink-faint" />;
  };

  const filteredData = useMemo(() => {
    return attendanceSummary.filter(student =>
      student &&
      ((student.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (student.rollNo?.toLowerCase() || '').includes(searchTerm.toLowerCase()))
    );
  }, [attendanceSummary, searchTerm]);

  const exportToCSV = () => {
    const headers = ['Name', 'Roll No', 'Section', 'Total Classes', 'Classes Attended', 'Attendance %'];
    const csvData = filteredData.map(s => [
      s?.name || '',
      s?.rollNo || '',
      s?.section || '',
      s.totalClasses || 0,
      s.classesAttended || 0,
      (s.attendancePercentage || 0).toFixed(2)
    ]);

    const csvContent = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_summary_${selectedDate}.csv`;
    a.click();
  };

  const getAttendanceRateColor = (rate) => {
    if (rate >= 75) return 'bg-green-500';
    if (rate >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const attendanceTone = (percentage) => {
    if (percentage >= 75) return 'success';
    if (percentage >= 50) return 'warning';
    return 'danger';
  };

  if (isLoading && attendanceSummary.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-ink-faint" />
          <p className="text-ink-soft font-semibold text-sm">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex justify-center items-start">
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-xl shadow-sm w-full max-w-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <h3 className="font-bold text-sm">Retrieval Failure</h3>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" style={cssVars}>
      <DashboardHeader
        greeting="Cohort Attendance Register"
        meta={teacherInfo ? `${teacherInfo.name} (${teacherInfo.email}) • Real-time attendance audit, session registers, and records` : 'Track, export, and audit attendance across classroom cohorts'}
        actions={userRole === 'teacher' ? (
          <Button variant="subtle" size="sm" leftIcon={Download} onClick={exportToCSV}>
            Export CSV
          </Button>
        ) : null}
      />

      {userRole === 'teacher' && (
        <Card padding="md">
          <div className="flex flex-wrap gap-3 items-center w-full">
            <div className="relative flex-1 md:flex-initial">
              <select
                value={selectedSubject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full md:w-56 px-3.5 py-2 border border-line rounded-xl text-sm font-semibold text-ink-soft bg-surface hover:bg-background transition outline-none pr-8 appearance-none"
              >
                <option value="">Select Subject</option>
                {[...new Map(teacherSubjects.map(item => [item.subject?.id, item])).values()].map((item) => (
                  <option key={item.assignmentId} value={item.subject?.id}>
                    {item.subject?.subjectName} ({item.subject?.subjectCode})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
            </div>

            <div className="relative flex-1 md:flex-initial">
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full md:w-44 px-3.5 py-2 border border-line rounded-xl text-sm font-semibold text-ink-soft bg-surface hover:bg-background transition outline-none pr-8 appearance-none"
                disabled={!selectedSubject}
              >
                <option value="">Select Section</option>
                {teacherSubjects
                  .filter(item => item.subject?.id === selectedSubject)
                  .map(item => (
                    <option key={item.section} value={item.section}>
                      Section {item.section} ({item.studentsCount || 0} students)
                    </option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint pointer-events-none" />
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3.5 py-2 border border-line rounded-xl text-sm font-semibold text-ink-soft bg-surface hover:bg-background transition outline-none"
            />
          </div>
        </Card>
      )}

      {/* Overall Stats Cards */}
      {overallStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard label="Total Sessions" value={overallStats.totalSessions || 0} tone="primary" icon={Calendar} />
          <StatCard label="Average Attendance" value={`${overallStats.averageAttendance || 0}%`} tone="success" icon={TrendingUp} />
          <StatCard label="Total Records" value={overallStats.totalAttendanceRecords || 0} tone="secondary" icon={User} />
        </div>
      )}

      {/* Student Stats Cards */}
      {!overallStats && attendanceSummary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={stats.totalStudents} tone="neutral" icon={Users} />
          <StatCard label="Average Attendance" value={`${stats.averageAttendance.toFixed(1)}%`} tone="success" icon={TrendingUp} />
          <StatCard label="Highest Record" value={`${stats.highestAttendance.toFixed(1)}%`} tone="primary" icon={Award} />
          <StatCard label="Lowest Record" value={`${stats.lowestAttendance.toFixed(1)}%`} tone="warning" icon={ArrowDown} />
        </div>
      )}

      {/* Tab Selection */}
      {(attendanceSummary.length > 0 || classSessions.length > 0) && (
        <div className="bg-surface p-1.5 rounded-2xl border border-line shadow-sm flex space-x-2 w-full sm:w-80">
          {[
            { id: 'students', label: 'Student Summary', icon: <GraduationCap className="w-4 h-4" /> },
            { id: 'sessions', label: 'Class Sessions', icon: <CalendarDays className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 outline-none ${activeTab === tab.id ? 'text-white shadow-sm' : 'text-ink-soft hover:bg-background'
                }`}
              style={activeTab === tab.id ? { background: `linear-gradient(135deg, ${primary}, ${secondary})` } : {}}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Search Bar */}
      {activeTab === 'students' && attendanceSummary.length > 0 && (
        <div className="bg-surface p-4 rounded-2xl border border-line shadow-sm flex items-center relative">
          <input
            type="text"
            placeholder="Search by student name or roll number..."
            className="w-full pl-10 pr-4 py-2 border border-line rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 transition text-ink placeholder:text-ink-faint"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
        </div>
      )}

      {/* Students Table Panel */}
      {activeTab === 'students' && (
        attendanceSummary.length > 0 ? (
          <div className="bg-surface rounded-2xl border border-line shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-xs font-bold text-ink-faint uppercase tracking-wider bg-background/50">
                    <th className="py-3.5 pl-6 cursor-pointer" onClick={() => sortData('name')}>
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-ink-faint" />
                        Student Name
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th className="py-3.5 cursor-pointer" onClick={() => sortData('rollNo')}>
                      <div className="flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-ink-faint" />
                        Roll No
                        {getSortIcon('rollNo')}
                      </div>
                    </th>
                    <th className="py-3.5 cursor-pointer" onClick={() => sortData('section')}>
                      <div className="flex items-center gap-1">
                        <School className="w-3.5 h-3.5 text-ink-faint" />
                        Section
                        {getSortIcon('section')}
                      </div>
                    </th>
                    <th className="py-3.5 cursor-pointer" onClick={() => sortData('totalClasses')}>
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-ink-faint" />
                        Total Classes
                        {getSortIcon('totalClasses')}
                      </div>
                    </th>
                    <th className="py-3.5 cursor-pointer" onClick={() => sortData('classesAttended')}>
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-ink-faint" />
                        Attended
                        {getSortIcon('classesAttended')}
                      </div>
                    </th>
                    <th className="py-3.5 pr-6 cursor-pointer" onClick={() => sortData('attendancePercentage')}>
                      <div className="flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-ink-faint" />
                        Attendance %
                        {getSortIcon('attendancePercentage')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm">
                  {filteredData.map((student) => (
                    <tr
                      key={student.studentId}
                      className="hover:bg-background/70 transition cursor-pointer"
                      onClick={() => fetchStudentDetails(student.studentId)}
                    >
                      <td className="py-4 pl-6 font-bold text-ink">{student.name}</td>
                      <td className="py-4 font-semibold text-ink-soft font-mono text-xs">{student.rollNo}</td>
                      <td className="py-4 text-ink-soft">Section {student.section}</td>
                      <td className="py-4 text-ink-soft">{student.totalClasses || 0}</td>
                      <td className="py-4 text-ink-soft">{student.classesAttended || 0}</td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-line rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${getAttendanceRateColor(student.attendancePercentage)}`}
                              style={{ width: `${student.attendancePercentage || 0}%` }}
                            />
                          </div>
                          <Badge tone={attendanceTone(student.attendancePercentage)}>
                            {(student.attendancePercentage || 0).toFixed(1)}%
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No student records found"
            description={selectedSubject && selectedSection
              ? "No attendance data available for the selected parameters."
              : "Please select a subject and section to query records."}
          />
        )
      )}

      {/* Class Sessions Panel */}
      {activeTab === 'sessions' && (
        classSessions.length > 0 ? (
          <div className="bg-surface rounded-2xl border border-line shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-xs font-bold text-ink-faint uppercase tracking-wider bg-background/50">
                    <th className="py-3.5 pl-6">Date</th>
                    <th className="py-3.5">Total Students</th>
                    <th className="py-3.5">Present</th>
                    <th className="py-3.5">Absent</th>
                    <th className="py-3.5 pr-6">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm">
                  {classSessions.map((session, index) => (
                    <tr key={session.sessionId || index} className="hover:bg-background/70 transition">
                      <td className="py-4 pl-6 font-bold text-ink">
                        {safeFormatDate(session.date, 'MMM dd, yyyy')}
                      </td>
                      <td className="py-4 text-ink-soft font-semibold">{session.totalStudents || 0}</td>
                      <td className="py-4 text-emerald-600 font-bold">{session.presentCount || 0}</td>
                      <td className="py-4 text-red-600 font-bold">{session.absentCount || 0}</td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-line rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${getAttendanceRateColor(session.attendanceRate)}`}
                              style={{ width: `${session.attendanceRate || 0}%` }}
                            />
                          </div>
                          <Badge tone={attendanceTone(session.attendanceRate)}>
                            {session.attendanceRate || 0}%
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="No class sessions found"
            description="No recorded class checks are matching details."
          />
        )
      )}

      {/* Student Details Modal */}
      <Modal
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        title={selectedStudent ? `Student File: ${selectedStudent.name}` : 'Student File'}
        size="md"
      >
        {selectedStudent && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 bg-background border border-line rounded-2xl">
              <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Roll Number</p>
              <p className="text-base font-bold text-ink mt-0.5 font-mono">{selectedStudent.rollNo || '—'}</p>
            </div>
            <div className="p-3.5 bg-background border border-line rounded-2xl">
              <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Section</p>
              <p className="text-base font-bold text-ink mt-0.5">Section {selectedStudent.section || '—'}</p>
            </div>
            <div className="p-3.5 bg-background border border-line rounded-2xl">
              <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Total Class Registrations</p>
              <p className="text-base font-bold text-ink mt-0.5">{selectedStudent.totalClasses || 0}</p>
            </div>
            <div className="p-3.5 bg-background border border-line rounded-2xl">
              <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Classes Attended</p>
              <p className="text-base font-bold text-emerald-600 mt-0.5">{selectedStudent.classesAttended || 0}</p>
            </div>
          </div>

          <h3 className="text-sm font-bold text-ink uppercase tracking-wider mt-4">Subject-wise Summary</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {selectedStudent.subjectAttendance?.length > 0 ? (
              selectedStudent.subjectAttendance.map((subject, idx) => (
                <div key={idx} className="p-3.5 bg-background rounded-2xl border border-line flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-ink text-xs truncate max-w-[70%]">
                      {subject.subjectName}
                    </span>
                    <Badge tone={attendanceTone(subject.percentage)}>
                      {subject.percentage?.toFixed(1) ?? '0'}%
                    </Badge>
                  </div>
                  <div className="flex justify-between text-[10px] text-ink-faint font-semibold">
                    <span>Attended: {subject.attended ?? 0} / {subject.total ?? 0}</span>
                    <span>Last class: {subject.lastAttended ? safeFormatDate(subject.lastAttended, 'PP') : 'N/A'}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-ink-faint text-xs text-center py-4">No subject attendance statistics logged.</p>
            )}
          </div>
        </div>
        )}
      </Modal>

      <Tooltip id="attendance-tooltip" />
    </div>
  );
};

export default AttendanceOverview;
