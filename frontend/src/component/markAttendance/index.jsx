import { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { FaCalendarAlt, FaBook, FaFilter, FaPlus, FaCheck, FaTimes } from "react-icons/fa";

export default function MarkAttendance() {
  const [subjects, setSubjects] = useState([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [token, setToken] = useState(null);
  const [filterRollNo, setFilterRollNo] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isNewSubjectOpen, setIsNewSubjectOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");

  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchSubjects();
      fetchStudents();
    }
  }, [token]);

  const fetchSubjects = async () => {
    try {
      const response = await axios.get(`${API_URL}/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubjects(response.data);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudents(response.data);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const handleDateChange = (e) => setSelectedDate(e.target.value);
  const handleSubjectChange = (e) => setSelectedSubject(e.target.value);
  const handleAttendanceChange = (studentId, isPresent) => {
    setAttendanceData((prevData) => ({
      ...prevData,
      [studentId]: {
        ...prevData[studentId],
        [selectedSubject]: isPresent,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${API_URL}/attendance`,
        { date: selectedDate, subject: selectedSubject, data: attendanceData },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResponseMessage("Attendance updated successfully!");
      setSelectedDate("");
      setSelectedSubject("");
      setAttendanceData({});
      setTimeout(() => setResponseMessage(""), 5000);
    } catch (error) {
      console.error("Error updating attendance:", error);
      setResponseMessage("Error updating attendance. Please try again.");
      setTimeout(() => setResponseMessage(""), 5000);
    }
  };

  const handleCreateSubject = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/subjects`,
        { name: newSubjectName, code: newSubjectCode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubjects([...subjects, response.data]);
      setNewSubjectName("");
      setNewSubjectCode("");
      setIsNewSubjectOpen(false);
      setResponseMessage("Subject created successfully!");
      setTimeout(() => setResponseMessage(""), 5000);
    } catch (error) {
      console.error("Error creating subject:", error);
      setResponseMessage("Error creating subject. Please try again.");
      setTimeout(() => setResponseMessage(""), 5000);
    }
  };

  const filteredStudents = students.filter((student) => {
    return (
      (!filterRollNo || student.rollNo.includes(filterRollNo)) &&
      (!filterSection || student.section.includes(filterSection))
    );
  });

  return (
    <motion.div 
      className="bg-gradient-to-br from-purple-200 to-purple-400 text-white min-h-screen flex flex-col items-center py-8 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="bg-white text-purple-500 p-6 rounded-lg shadow-lg w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Mark Attendance
        </h1>
        
        <AnimatePresence>
          {responseMessage && (
            <motion.div 
              className="bg-green-500 text-white p-4 rounded-md mb-4"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
            >
              {responseMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex space-x-4">
            <div className="flex-1 space-y-2">
              <label htmlFor="date" className="block text-lg font-semibold">
                <FaCalendarAlt className="inline mr-2" /> Select Date
              </label>
              <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="w-full p-2 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                required
              />
            </div>
            <div className="flex-1 space-y-2">
              <label htmlFor="subject" className="block text-lg font-semibold">
                <FaBook className="inline mr-2" /> Select Subject
              </label>
              <select
                id="subject"
                value={selectedSubject}
                onChange={handleSubjectChange}
                className="w-full p-2 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                required
              >
                <option value="" disabled>Select subject</option>
                {subjects.map((subject) => (
                  <option key={subject._id} value={subject.code}>
                    {subject.name} ({subject.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Students</h2>
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-full transition-colors duration-300 flex items-center"
            >
              <FaFilter className="mr-2" /> Filter
            </button>
          </div>

          <AnimatePresence>
            {isFilterOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <input
                  type="text"
                  placeholder="Filter by Roll Number"
                  value={filterRollNo}
                  onChange={(e) => setFilterRollNo(e.target.value)}
                  className="w-full p-2 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Filter by Section"
                  value={filterSection}
                  onChange={(e) => setFilterSection(e.target.value)}
                  className="w-full p-2 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black">
                  <th className="p-3  rounded-tl-md">Student Name</th>
                  <th className="p-3 ">Roll Number</th>
                  <th className="p-3 ">Section</th>
                  <th className="p-3 ">Present</th>
                  <th className="p-3  rounded-tr-md">Absent</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student._id} className="bg-gray-100 hover:bg-gray-700 transition-colors duration-150">
                    <td className="p-3">{student.name}</td>
                    <td className="p-3">{student.rollNo}</td>
                    <td className="p-3">{student.section}</td>
                    <td className="p-3">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name={`attendance-${student._id}`}
                          value="present"
                          checked={attendanceData[student._id]?.[selectedSubject] === true}
                          onChange={() => handleAttendanceChange(student._id, true)}
                          className="form-radio h-5 w-5 text-green-500"
                        />
                        <FaCheck className="ml-2 text-green-500" />
                      </label>
                    </td>
                    <td className="p-3">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name={`attendance-${student._id}`}
                          value="absent"
                          checked={attendanceData[student._id]?.[selectedSubject] === false}
                          onChange={() => handleAttendanceChange(student._id, false)}
                          className="form-radio h-5 w-5 text-red-500"
                        />
                        <FaTimes className="ml-2 text-red-500" />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="submit"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-2 px-4 rounded-full w-full mt-4 transition-all duration-300 transform hover:scale-105"
          >
            Submit Attendance
          </button>
        </form>

        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Subjects</h2>
            <button
              onClick={() => setIsNewSubjectOpen(!isNewSubjectOpen)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full transition-colors duration-300 flex items-center"
            >
              <FaPlus className="mr-2" /> New Subject
            </button>
          </div>
          
          <AnimatePresence>
            {isNewSubjectOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <input
                  type="text"
                  placeholder="Subject Name"
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="w-full p-2 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Subject Code"
                  value={newSubjectCode}
                  onChange={(e) => setNewSubjectCode(e.target.value)}
                  className="w-full p-2 rounded-md bg-gray-700 text-white focus:ring-2 focus:ring-green-500 focus:outline-none"
                />
                <button
                  onClick={handleCreateSubject}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-full w-full transition-colors duration-300"
                >
                  Create Subject
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}