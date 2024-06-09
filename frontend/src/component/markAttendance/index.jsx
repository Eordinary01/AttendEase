import React, { useState, useEffect } from "react";
import axios from "axios";

const MarkAttendance = () => {
  const [students, setStudents] = useState([]);
  const [subject, setSubject] = useState("");
  const [attendance, setAttendance] = useState({});

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await axios.get("https://attendease-gajo.onrender.com/api/users");
        setStudents(response.data);
      } catch (error) {
        console.error("Error fetching students:", error);
      }
    };

    fetchStudents();
  }, []);

  const handleAttendanceChange = (studentId, attended) => {
    setAttendance((prevAttendance) => ({
      ...prevAttendance,
      [studentId]: {
        ...prevAttendance[studentId],
        [subject]: attended,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const date = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
      await axios.post("https://attendease-gajo.onrender.com/api/attendance", {
        date,
        data: attendance,
      });

      alert("Attendance marked successfully!");
    } catch (error) {
      console.error("Error marking attendance:", error);
    }
  };

  return (
    <div className="bg-gray-900 text-white h-screen p-8">
      <h2 className="text-2xl font-semibold mb-4">Mark Attendance</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="subject" className="block text-gray-300 font-medium">
            Subject:
          </label>
          <input
            id="subject"
            type="text"
            className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />
        </div>
        <table className="min-w-full bg-gray-800 rounded-md shadow-md">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Section</th>
              <th className="px-4 py-2 text-left">Roll No</th>
              <th className="px-4 py-2 text-center">Attended</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student._id}>
                <td className="px-4 py-2">{student.name}</td>
                <td className="px-4 py-2">{student.section}</td>
                <td className="px-4 py-2">{student.rollNo}</td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={
                      attendance[student._id]?.[subject] || false
                    }
                    onChange={(e) =>
                      handleAttendanceChange(student._id, e.target.checked)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="submit"
          className="mt-4 bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors duration-300"
        >
          Submit Attendance
        </button>
      </form>
    </div>
  );
};

export default MarkAttendance;
