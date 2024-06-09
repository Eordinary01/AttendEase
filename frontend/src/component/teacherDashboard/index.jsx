import { useEffect, useState } from "react";
import axios from "axios";
import Calendar from "react-calendar";
// import 'react-calendar/dist/Calendar.css';

export default function TeacherDashboard() {
  const [tickets, setTickets] = useState([]);
  const [responseMessage, setResponseMessage] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterRollNo, setFilterRollNo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState({});
  const [token, setToken] = useState(null);

  const POLLING_INTERVAL = 5000;

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await axios.get(
          "https://attendease-gajo.onrender.com/api/tickets",
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        // console.log(response.data)
        setTickets(response.data);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      }
    };

    const fetchAttendance = async () => {
      try {
        const response = await axios.get(
          "https://attendease-gajo.onrender.com/api/attendance",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setAttendance(response.data);
      } catch (error) {
        console.error("Error fetching attendance:", error);
      }
    };

    fetchTickets();
    fetchAttendance();

    const intervalId = setInterval(fetchTickets, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [token]);

  const handleApprove = async (ticketId) => {
    try {
      const response = await axios.put(
        `https://attendease-gajo.onrender.com/api/tickets/${ticketId}/approve`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setResponseMessage(response.data.message);
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket._id === ticketId ? { ...ticket, response: "Approved" } : ticket
        )
      );

      setTimeout(() => {
        setResponseMessage("");
      }, 5000);
    } catch (error) {
      console.error("Error approving ticket:", error);
    }
  };

  const handleReject = async (ticketId) => {
    try {
      const response = await axios.put(
        `https://attendease-gajo.onrender.com/api/tickets/${ticketId}/reject`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setResponseMessage(response.data.message);
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket._id === ticketId ? { ...ticket, response: "Rejected" } : ticket
        )
      );

      setTimeout(() => {
        setResponseMessage("");
      }, 5000);
    } catch (error) {
      console.error("Error rejecting ticket:", error);
    }
  };

  const handleFilterChange = (event) => {
    setFilterSection(event.target.value);
  };

  const handleRollNoFilterChange = (event) => {
    setFilterRollNo(event.target.value);
  };

  const handleStatusFilterChange = (event) => {
    setFilterStatus(event.target.value);
  };

  const handleAlertMessageChange = (event) => {
    setAlertMessage(event.target.value);
  };

  const handleCreateAlert = async () => {
    try {
      const response = await axios.post(
        "https://attendease-gajo.onrender.com/api/alerts",
        { message: alertMessage },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setResponseMessage(response.data.message);
      setAlertMessage("");
      setTimeout(() => {
        setResponseMessage("");
      }, 5000);
    } catch (error) {
      console.error("Error creating alert:", error);
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleAttendanceChange = (event, studentId, subject) => {
    const { checked } = event.target;
    setAttendanceData((prevAttendanceData) => ({
      ...prevAttendanceData,
      [studentId]: {
        ...prevAttendanceData[studentId],
        [subject]: checked,
      },
    }));
  };

  const handleUpdateAttendance = async () => {
    try {
      const response = await axios.post(
        "http://127.0.0.1:8011/api/attendance",
        { date: selectedDate, data: attendanceData },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setResponseMessage(response.data.message);
      setTimeout(() => {
        setResponseMessage("");
      }, 5000);
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    return (
      (filterSection ? ticket.section === filterSection : true) &&
      (filterRollNo ? ticket.rollNo.includes(filterRollNo) : true) &&
      (filterStatus ? ticket.response === filterStatus : true)
    );
  });

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center py-8">
      {responseMessage && (
        <div className="bg-green-500 text-white p-4 rounded-md mb-4">
          {responseMessage}
        </div>
      )}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-4xl">
        <h1 className="text-3xl font-semibold mb-6 text-center">
          Teacher's Dashboard
        </h1>
        <div className="mb-4 flex flex-wrap justify-between">
          <div className="mb-2">
            <label htmlFor="filterSection" className="mr-2">
              Filter by Section:
            </label>
            <select
              id="filterSection"
              value={filterSection}
              onChange={handleFilterChange}
              className="bg-gray-700 text-white p-2 rounded-md"
            >
              <option value="">All</option>
              {[...new Set(tickets.map((ticket) => ticket.section))].map(
                (section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="mb-2">
            <label htmlFor="filterRollNo" className="mr-2">
              Filter by Roll No:
            </label>
            <input
              type="text"
              id="filterRollNo"
              value={filterRollNo}
              onChange={handleRollNoFilterChange}
              className="bg-gray-700 text-white p-2 rounded-md"
              placeholder="Enter Roll No"
            />
          </div>
          <div className="mb-2">
            <label htmlFor="filterStatus" className="mr-2">
              Filter by Status:
            </label>
            <select
              id="filterStatus"
              value={filterStatus}
              onChange={handleStatusFilterChange}
              className="bg-gray-700 text-white p-2 rounded-md"
            >
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
        <h2 className="text-xl font-semibold mb-4">Tickets:</h2>
        {filteredTickets.length === 0 ? (
          <p className="text-gray-400">No tickets available</p>
        ) : (
          <ul className="space-y-4">
            {filteredTickets.map((ticket) => (
              <li
                key={ticket._id}
                className="bg-black p-4 rounded-lg shadow-md"
              >
                <p>
                  <span className="font-semibold">Ticket ID:</span>{" "}
                  <span className="text-purple-500">{ticket._id}</span>
                </p>
                <p>
                  <span className="font-semibold">Roll No:</span>{" "}
                  <span className="text-purple-500">{ticket.rollNo}</span>
                </p>
                <p>
                  <span className="font-semibold">Section:</span>{" "}
                  <span className="text-purple-500">{ticket.section}</span>
                </p>
                <p>
                  <span className="font-semibold">Description:</span>{" "}
                  {ticket.description}
                </p>
                <p>
                  <span className="font-semibold">Response:</span>{" "}
                  {ticket.response}
                </p>
                {ticket.response === "Pending" && (
                  <div className="mt-4 flex space-x-4">
                    <button
                      className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded"
                      onClick={() => handleApprove(ticket._id)}
                    >
                      Approve
                    </button>
                    <button
                      className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded"
                      onClick={() => handleReject(ticket._id)}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-4xl mt-8">
        <h2 className="text-xl font-semibold mb-4">Attendance Management:</h2>
        <Calendar
          onChange={handleDateChange}
          value={selectedDate}
          className="mb-4"
        />
        <ul>
          {attendance.map((student) => (
            <li key={student._id}>
              <p className="font-semibold mb-2">{student.name}</p>
              <div className="flex space-x-4 mb-4">
                {student.subjects.map((subject) => (
                  <div key={subject}>
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          attendanceData[student._id]?.[subject] || false
                        }
                        onChange={(event) =>
                          handleAttendanceChange(event, student._id, subject)
                        }
                      />
                      {subject}
                    </label>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded mt-4"
          onClick={handleUpdateAttendance}
        >
          Update Attendance
        </button>
      </div> */}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-4xl mt-8">
        <h2 className="text-xl font-semibold mb-4">Create Alert:</h2>
        <textarea
          value={alertMessage}
          onChange={handleAlertMessageChange}
          className="w-full p-4 mb-4 bg-gray-700 text-white rounded-md"
          placeholder="Enter alert message"
        />
        <button
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
          onClick={handleCreateAlert}
        >
          Create Alert
        </button>
      </div>
    </div>
  );
}
