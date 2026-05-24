// src/components/AttendanceOverview.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { 
  FaSort, 
  FaSortUp, 
  FaSortDown, 
  FaCalendarAlt, 
  FaUser, 
  FaIdCard, 
  FaUniversity, 
  FaBook, 
  FaChalkboardTeacher, 
  FaPercentage, 
  FaTimes,
  FaFilter,
  FaDownload,
  FaChartLine,
  FaCheckCircle,
  FaTimesCircle,
  FaCalendarWeek,
  FaChartBar,
  FaUserGraduate
} from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

const AttendanceOverview = () => {
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

  const API_URL = process.env.REACT_APP_API_URL;
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
      const response = await axios.get(`${API_URL}/subjects/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = response.data;
      setTeacherInfo(data.teacherInfo);
      
      const subjects = data.assignedSubjects?.subjects || [];
      setTeacherSubjects(subjects);
      
      if (subjects.length > 0) {
        const firstSubject = subjects[0];
        setSelectedSubject(firstSubject.subject?.id);
        setSelectedSection(firstSubject.section);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching teacher subjects:', error);
      setError('Failed to load your subjects');
      setIsLoading(false);
    }
  };

  // Handle subject change - resets section and selects first available section
  const handleSubjectChange = (subjectId) => {
    setSelectedSubject(subjectId);
    
    // Reset section when subject changes
    setSelectedSection('');
    
    // Find the first available section for this subject and set it
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
      
      let url = `${API_URL}/attendance/summary`;
      const params = new URLSearchParams();
      
      if (userRole === 'teacher') {
        params.append('subjectId', selectedSubject);
        params.append('section', selectedSection);
        if (selectedDate) {
          params.append('date', selectedDate);
        }
      }
      
      const response = await axios.get(`${url}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data;
      
      setClassSessions(data.classSessions || []);
      setOverallStats(data.overallStats || null);
      
      const transformedStudents = (data.studentSummary || []).map(student => ({
        studentId: student.studentId || student._id,
        name: student.name,
        rollNo: student.rollNo,
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
      console.error('Error fetching attendance summary:', error);
      setError('Failed to load attendance data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudentDetails = async (studentId) => {
    try {
      const response = await axios.get(
        `${API_URL}/attendance/stats?studentId=${studentId}&subjectId=${selectedSubject}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSelectedStudent(response.data.data);
    } catch (error) {
      console.error('Error fetching student details:', error);
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
      return sortConfig.direction === 'ascending' ? <FaSortUp /> : <FaSortDown />;
    }
    return <FaSort />;
  };

  const filteredData = attendanceSummary.filter(student =>
    (student.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (student.rollNo?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ['Name', 'Roll No', 'Section', 'Total Classes', 'Classes Attended', 'Attendance %'];
    const csvData = filteredData.map(s => [
      s.name || '',
      s.rollNo || '',
      s.section || '',
      s.totalClasses || 0,
      s.classesAttended || 0,
      (s.attendancePercentage || 0).toFixed(2)
    ]);
    
    const csvContent = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedDate}.csv`;
    a.click();
  };

  const getAttendanceStatusColor = (percentage) => {
    if (percentage >= 75) return 'text-green-600 bg-green-50';
    if (percentage >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getAttendanceRateColor = (rate) => {
    if (rate >= 75) return 'bg-green-500';
    if (rate >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="loader ease-linear rounded-full border-8 border-t-8 border-indigo-600 h-24 w-24 animate-spin mb-4"></div>
          <p className="text-gray-600">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative m-4"
      >
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </motion.div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-indigo-800">Attendance Overview</h1>
              {teacherInfo && (
                <p className="text-gray-600 mt-1">
                  Welcome, <span className="font-semibold">{teacherInfo.name}</span> ({teacherInfo.email})
                </p>
              )}
              <p className="text-gray-600">
                {userRole === 'teacher' ? 'View your class attendance' : 'Your attendance summary'}
              </p>
            </div>
            
            {userRole === 'teacher' && (
              <div className="flex flex-wrap gap-4">
                <select
                  value={selectedSubject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Subject</option>
                  {/* Show unique subjects */}
                  {[...new Map(teacherSubjects.map(item => [item.subject?.id, item])).values()].map((item) => (
                    <option key={item.assignmentId} value={item.subject?.id}>
                      {item.subject?.subjectName} ({item.subject?.subjectCode})
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
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

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />

                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                >
                  <FaDownload />
                  Export CSV
                </button>
              </div>
            )}
          </div>

          {/* Overall Stats Cards */}
          {overallStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="text-sm text-indigo-600 mb-1">Total Sessions</p>
                <p className="text-2xl font-bold text-indigo-800">{overallStats.totalSessions || 0}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-1">Average Attendance</p>
                <p className="text-2xl font-bold text-green-800">{overallStats.averageAttendance || 0}%</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 mb-1">Total Records</p>
                <p className="text-2xl font-bold text-blue-800">{overallStats.totalAttendanceRecords || 0}</p>
              </div>
            </div>
          )}

          {/* Student Stats Cards */}
          {!overallStats && attendanceSummary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-indigo-50 rounded-lg p-4">
                <p className="text-sm text-indigo-600 mb-1">Total Students</p>
                <p className="text-2xl font-bold text-indigo-800">{stats.totalStudents}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 mb-1">Average Attendance</p>
                <p className="text-2xl font-bold text-green-800">{stats.averageAttendance.toFixed(1)}%</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 mb-1">Highest Attendance</p>
                <p className="text-2xl font-bold text-blue-800">{stats.highestAttendance.toFixed(1)}%</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-orange-600 mb-1">Lowest Attendance</p>
                <p className="text-2xl font-bold text-orange-800">{stats.lowestAttendance.toFixed(1)}%</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        {(attendanceSummary.length > 0 || classSessions.length > 0) && (
          <div className="bg-white rounded-xl shadow-lg mb-6">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('students')}
                className={`flex-1 py-4 px-6 text-center font-semibold transition-all duration-300 ${
                  activeTab === 'students'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                    : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                <FaUserGraduate className="inline mr-2" />
                Student Summary
              </button>
              <button
                onClick={() => setActiveTab('sessions')}
                className={`flex-1 py-4 px-6 text-center font-semibold transition-all duration-300 ${
                  activeTab === 'sessions'
                    ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50'
                    : 'text-gray-500 hover:text-indigo-600'
                }`}
              >
                <FaCalendarWeek className="inline mr-2" />
                Class Sessions
              </button>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {activeTab === 'students' && attendanceSummary.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or roll number..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <FaFilter className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>
        )}

        {/* Students Table */}
        {activeTab === 'students' && (
          attendanceSummary.length > 0 ? (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-indigo-600 text-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer"
                          onClick={() => sortData('name')}>
                        <div className="flex items-center">
                          <FaUser className="mr-1" />
                          Student Name
                          <span className="ml-1">{getSortIcon('name')}</span>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer"
                          onClick={() => sortData('rollNo')}>
                        <div className="flex items-center">
                          <FaIdCard className="mr-1" />
                          Roll No
                          <span className="ml-1">{getSortIcon('rollNo')}</span>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer"
                          onClick={() => sortData('section')}>
                        <div className="flex items-center">
                          <FaUniversity className="mr-1" />
                          Section
                          <span className="ml-1">{getSortIcon('section')}</span>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer"
                          onClick={() => sortData('totalClasses')}>
                        <div className="flex items-center">
                          <FaBook className="mr-1" />
                          Total Classes
                          <span className="ml-1">{getSortIcon('totalClasses')}</span>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer"
                          onClick={() => sortData('classesAttended')}>
                        <div className="flex items-center">
                          <FaCheckCircle className="mr-1" />
                          Attended
                          <span className="ml-1">{getSortIcon('classesAttended')}</span>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer"
                          onClick={() => sortData('attendancePercentage')}>
                        <div className="flex items-center">
                          <FaPercentage className="mr-1" />
                          Attendance %
                          <span className="ml-1">{getSortIcon('attendancePercentage')}</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredData.map((student) => (
                      <motion.tr
                        key={student.studentId}
                        whileHover={{ scale: 1.01 }}
                        className="hover:bg-indigo-50 transition duration-150 ease-in-out cursor-pointer"
                        onClick={() => fetchStudentDetails(student.studentId)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{student.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{student.rollNo}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{student.section}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{student.totalClasses || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{student.classesAttended || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-2/3 bg-gray-200 rounded-full h-2.5">
                              <div
                                className={`h-2.5 rounded-full ${getAttendanceRateColor(student.attendancePercentage)}`}
                                style={{ width: `${student.attendancePercentage || 0}%` }}
                              ></div>
                            </div>
                            <span className={`font-medium px-2 py-1 rounded ${getAttendanceStatusColor(student.attendancePercentage)}`}>
                              {(student.attendancePercentage || 0).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <FaChartLine className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No student records found</h3>
              <p className="text-gray-500">
                {selectedSubject && selectedSection 
                  ? `No attendance data available for the selected subject and section.`
                  : 'Please select a subject and section to view attendance.'}
              </p>
            </div>
          )
        )}

        {/* Class Sessions Table */}
        {activeTab === 'sessions' && (
          classSessions.length > 0 ? (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-indigo-600 text-white">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        <div className="flex items-center">
                          <FaCalendarAlt className="mr-1" />
                          Date
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        <div className="flex items-center">
                          <FaUserGraduate className="mr-1" />
                          Total Students
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        <div className="flex items-center">
                          <FaCheckCircle className="mr-1" />
                          Present
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        <div className="flex items-center">
                          <FaTimesCircle className="mr-1" />
                          Absent
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                        <div className="flex items-center">
                          <FaPercentage className="mr-1" />
                          Attendance Rate
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {classSessions.map((session, index) => (
                      <motion.tr
                        key={session.sessionId || index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="hover:bg-indigo-50 transition duration-150 ease-in-out"
                      >
                        <td className="px-6 py-4 whitespace-nowrap font-medium">
                          {format(new Date(session.date), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{session.totalStudents || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-green-600 font-semibold">
                          {session.presentCount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-red-600 font-semibold">
                          {session.absentCount || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-2/3 bg-gray-200 rounded-full h-2.5">
                              <div
                                className={`h-2.5 rounded-full ${getAttendanceRateColor(session.attendanceRate)}`}
                                style={{ width: `${session.attendanceRate || 0}%` }}
                              ></div>
                            </div>
                            <span className={`font-medium px-2 py-1 rounded ${getAttendanceStatusColor(session.attendanceRate)}`}>
                              {session.attendanceRate || 0}%
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-12 text-center">
              <FaCalendarWeek className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No class sessions found</h3>
              <p className="text-gray-500">No session data available for the selected filters.</p>
            </div>
          )
        )}

        {/* Student Details Modal */}
        <AnimatePresence>
          {selectedStudent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50"
              onClick={() => setSelectedStudent(null)}
            >
              <div className="relative top-20 mx-auto p-6 border w-11/12 md:w-3/4 lg:w-1/2 shadow-2xl rounded-xl bg-white"
                   onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-indigo-800">
                    {selectedStudent.name}
                  </h2>
                  <button 
                    onClick={() => setSelectedStudent(null)}
                    className="text-gray-500 hover:text-gray-700 transition"
                  >
                    <FaTimes size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Roll Number</p>
                    <p className="text-lg font-semibold">{selectedStudent.rollNo}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Section</p>
                    <p className="text-lg font-semibold">{selectedStudent.section}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Classes</p>
                    <p className="text-lg font-semibold">{selectedStudent.totalClasses || 0}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Classes Attended</p>
                    <p className="text-lg font-semibold">{selectedStudent.classesAttended || 0}</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-4">Subject-wise Attendance</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedStudent.subjectAttendance?.length > 0 ? (
                    selectedStudent.subjectAttendance.map((subject, index) => (
                      <div key={index} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{subject.subjectName}</span>
                          <span className={`px-2 py-1 rounded text-sm ${getAttendanceStatusColor(subject.percentage)}`}>
                            {subject.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Attended: {subject.attended}/{subject.total}</span>
                          <span>Last class: {subject.lastAttended ? format(new Date(subject.lastAttended), 'PP') : 'N/A'}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">No subject attendance data available</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Tooltip id="attendance-tooltip" />
      </div>
    </div>
  );
};

export default AttendanceOverview;