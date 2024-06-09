import { useEffect, useState } from "react";
import axios from "axios";
import Calendar from 'react-calendar';
// import 'react-calendar/dist/Calendar.css';

export default function StudentDashboard() {
  const [tickets, setTickets] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
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
              Authorization: `Bearer ${token}`,
            },
          }
        );
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

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const totalClasses = attendance.reduce((acc, record) => acc + record.totalClasses, 0);
  const attendedClasses = attendance.reduce((acc, record) => acc + record.attendedClasses, 0);
  const overallAttendance = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center py-8">
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-4xl">
        <h1 className="text-3xl font-semibold mb-6 text-center">
          Student's Dashboard
        </h1>
        <h2 className="text-xl font-semibold mb-4">My Tickets:</h2>
        {tickets.length === 0 ? (
          <p className="text-gray-400">No tickets available</p>
        ) : (
          <ul className="space-y-4">
            {tickets.map((ticket) => (
              <li key={ticket._id} className="bg-black p-4 rounded-lg shadow-md">
                <p>
                  <span className="font-semibold">Ticket ID:</span>{" "}
                  <span className="text-purple-500">{ticket._id}</span>
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
              </li>
            ))}
          </ul>
        )}
        <h2 className="text-xl font-semibold mt-8 mb-4">Attendance:</h2>
        <div className="mb-4">
          <Calendar onChange={handleDateChange} value={selectedDate} />
        </div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Overall Attendance: {overallAttendance.toFixed(2)}%</h3>
          {attendance.map((record) => (
            <div key={record.subject} className="mb-2">
              <p>
                <span className="font-semibold">{record.subject}:</span>{" "}
                {(record.attendedClasses / record.totalClasses) * 100}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
