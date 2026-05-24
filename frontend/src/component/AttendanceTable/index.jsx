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
  FaTimesCircle
} from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

const AttendanceOverview = () => {
  const [attendanceSummary, setAttendanceSummary] = useState([]);
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
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
      const response = await axios.get(`${API_URL}/subjects/teacher/assignments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const subjects = response.data.assignedSubjects?.subjects || [];
      setTeacherSubjects(subjects);
      
      if (subjects.length > 0) {
        // Set default selections
        const firstSubject = subjects[0];
        setSelectedSubject(firstSubject.subject?.id || firstSubject.subject?._id);
        setSelectedSection(firstSubject.section);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching teacher subjects:', error);
      setError('Failed to load your subjects');
      setIsLoading(false);
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
        params.append('date', selectedDate);
      }
      
      const response = await axios.get(`${url}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = response.data.data || [];
      setAttendanceSummary(data);
      
      // Calculate statistics
      if (data.length > 0) {
        const percentages = data.map(s => s.attendancePercentage);
        setStats({
          totalStudents: data.length,
          averageAttendance: percentages.reduce((a, b) => a + b, 0) / data.length,
          highestAttendance: Math.max(...percentages),
          lowestAttendance: Math.min(...percentages)
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
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
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
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.rollNo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = ['Name', 'Roll No', 'Section', 'Total Classes', 'Classes Attended', 'Attendance %'];
    const csvData = filteredData.map(s => [
      s.name,
      s.rollNo,
      s.section,
      s.totalClasses,
      s.classesAttended,
      s.attendancePercentage.toFixed(2)
    ]);
    
    const csvContent = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedDate}.csv`;
    a.click();
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
              <p className="text-gray-600 mt-1">
                {userRole === 'teacher' ? 'View your class attendance' : 'Your attendance summary'}
              </p>
            </div>
            
            {userRole === 'teacher' && (
              <div className="flex flex-wrap gap-4">
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Subject</option>
                  {teacherSubjects.map((item) => (
                    <option key={item.assignmentId} value={item.subject?.id || item.subject?._id}>
                      {item.subject?.subjectName} ({item.subject?.subjectCode}) - Section {item.section}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {teacherSubjects
                    .filter(item => (item.subject?.id || item.subject?._id) === selectedSubject)
                    .map(item => (
                      <option key={item.section} value={item.section}>
                        Section {item.section}
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

          {/* Stats Cards */}
          {userRole === 'teacher' && attendanceSummary.length > 0 && (
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
                <p className="text-sm text-blue-600 mb-1">Highest</p>
                <p className="text-2xl font-bold text-blue-800">{stats.highestAttendance.toFixed(1)}%</p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-orange-600 mb-1">Lowest</p>
                <p className="text-2xl font-bold text-orange-800">{stats.lowestAttendance.toFixed(1)}%</p>
              </div>
            </div>
          )}
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
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
          </div>
        </div>

        {/* Attendance Table */}
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
                      <FaChalkboardTeacher className="mr-1" />
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
                    <td className="px-6 py-4 whitespace-nowrap">{student.totalClasses}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{student.classesAttended}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-2/3 bg-gray-200 rounded-full h-2.5 mr-2">
                          <div
                            className={`h-2.5 rounded-full ${
                              student.attendancePercentage >= 75 
                                ? 'bg-green-600' 
                                : student.attendancePercentage >= 50
                                ? 'bg-yellow-600'
                                : 'bg-red-600'
                            }`}
                            style={{ width: `${student.attendancePercentage}%` }}
                          ></div>
                        </div>
                        <span className="font-medium">{student.attendancePercentage.toFixed(1)}%</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredData.length === 0 && (
            <div className="text-center py-12">
              <FaChartLine className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No attendance records found</h3>
              <p className="text-gray-500">No data available for the selected filters.</p>
            </div>
          )}
        </div>

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
                    <p className="text-lg font-semibold">{selectedStudent.totalClasses}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Classes Attended</p>
                    <p className="text-lg font-semibold">{selectedStudent.classesAttended}</p>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-4">Subject-wise Attendance</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {selectedStudent.subjectAttendance?.map((subject, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{subject.subjectName}</span>
                        <span className={`px-2 py-1 rounded text-sm ${
                          subject.percentage >= 75 
                            ? 'bg-green-100 text-green-700'
                            : subject.percentage >= 50
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {subject.percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Attended: {subject.attended}/{subject.total}</span>
                        <span>Last class: {subject.lastAttended ? format(new Date(subject.lastAttended), 'PP') : 'N/A'}</span>
                      </div>
                    </div>
                  ))}
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