import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { FaSort, FaSortUp, FaSortDown, FaCalendarAlt, FaUser, FaIdCard, FaUniversity, FaBook, FaChalkboardTeacher, FaPercentage, FaTimes } from 'react-icons/fa';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

const AttendanceOverview = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/overview`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAttendanceData(response.data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching attendance data:', error);
        setError('Failed to fetch attendance data. Please try again.');
        setIsLoading(false);
      }
    };

    fetchAttendanceData();
  }, []);

  const sortData = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });

    setAttendanceData(prevData => [...prevData].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'ascending' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'ascending' ? 1 : -1;
      return 0;
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? <FaSortUp /> : <FaSortDown />;
    }
    return <FaSort />;
  };

  const filteredData = attendanceData.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.rollNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex justify-center items-center h-screen bg-gray-100"
    >
      <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-24 w-24"></div>
    </motion.div>
  );

  if (error) return (
    <motion.div
      initial={{ opacity: 0, y: -50 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative m-4"
      role="alert"
    >
      <strong className="font-bold">Error!</strong>
      <span className="block sm:inline"> {error}</span>
    </motion.div>
  );

  return (
    <div className="bg-gray-100 min-h-screen">
     
      <div className="container mx-auto p-4">
        <div className="mb-4 flex justify-between items-center">
          <input
            type="text"
            placeholder="Search by name or roll number"
            className="p-2 border rounded-lg w-1/3"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-indigo-600 text-white">
                <tr>
                  {[
                    { label: 'Student Name', icon: <FaUser className="mr-1" /> },
                    { label: 'Roll No', icon: <FaIdCard className="mr-1" /> },
                    { label: 'Section', icon: <FaUniversity className="mr-1" /> },
                    { label: 'Total Classes', icon: <FaBook className="mr-1" /> },
                    { label: 'Classes Attended', icon: <FaChalkboardTeacher className="mr-1" /> },
                    { label: 'Attendance Percentage', icon: <FaPercentage className="mr-1" /> }
                  ].map((header, index) => (
                    <th
                      key={index}
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer"
                      onClick={() => sortData(header.label.toLowerCase().replace(/\s+/g, ''))}
                    >
                      <div className="flex items-center">
                        {header.icon}
                        {header.label}
                        <span className="ml-1">{getSortIcon(header.label.toLowerCase().replace(/\s+/g, ''))}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((student) => (
                  <motion.tr
                    key={student._id}
                    whileHover={{ scale: 1.01 }}
                    className="hover:bg-indigo-50 transition duration-150 ease-in-out cursor-pointer"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">{student.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{student.rollNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{student.section}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{student.totalClasses}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{student.classesAttended}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-2/3 bg-gray-200 rounded-full h-2.5 mr-2">
                          <div
                            className="bg-indigo-600 h-2.5 rounded-full"
                            style={{ width: `${student.attendancePercentage}%` }}
                          ></div>
                        </div>
                        <span>{student.attendancePercentage.toFixed(2)}%</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <AnimatePresence>
          {selectedStudent && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full"
              onClick={() => setSelectedStudent(null)}
            >
              <div className="relative top-20 mx-auto p-5 border w-11/12 shadow-lg rounded-md bg-white"
                   onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-semibold text-indigo-600">Details for {selectedStudent.name}</h2>
                  <button onClick={() => setSelectedStudent(null)} className="text-gray-500 hover:text-gray-700">
                    <FaTimes size={24} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <p><FaIdCard className="inline mr-2" /> Roll No: {selectedStudent.rollNo}</p>
                  <p><FaUniversity className="inline mr-2" /> Section: {selectedStudent.section}</p>
                  <p><FaBook className="inline mr-2" /> Total Classes: {selectedStudent.totalClasses}</p>
                  <p><FaChalkboardTeacher className="inline mr-2" /> Classes Attended: {selectedStudent.classesAttended}</p>
                  <p><FaPercentage className="inline mr-2" /> Overall Attendance: {selectedStudent.attendancePercentage.toFixed(2)}%</p>
                </div>
                
                <h3 className="text-xl font-semibold mt-6 mb-3 text-indigo-600">Attendance Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedStudent.attendanceDetails.map((detail, index) => (
                    <div key={index} className="bg-indigo-50 p-4 rounded-lg shadow">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold">{detail.subject.name} ({detail.subject.code})</span>
                        <span className={`px-2 py-1 rounded ${detail.status === 'present' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                          {detail.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 flex items-center mb-1">
                        <FaCalendarAlt className="mr-2" />
                        {format(new Date(detail.date), 'MMMM d, yyyy')}
                      </div>
                      <p className="text-sm">Attended: {detail.attendedClasses} / {detail.totalClasses}</p>
                      <p className="text-sm">Percentage: {detail.individualPercentage.toFixed(2)}%</p>
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