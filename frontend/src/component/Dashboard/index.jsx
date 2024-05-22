import { useEffect, useState } from "react";
import axios from "axios";

export default function StudentDashboard() {
  const [tickets, setTickets] = useState([]);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Retrieve the token from localStorage on component mount
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await axios.get("http://localhost:8011/api/tickets", {
          headers: {
            Authorization: `Bearer ${token}`, // Added a space after "Bearer"
          },
        });
        setTickets(response.data);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      }
    };
  
    fetchTickets();
    const intervalId = setInterval(fetchTickets, 5000);
    return () => clearInterval(intervalId);
  }, [token]);

  const getStatusColor = (status) => {
    if (status === "Approved") {
      return "green";
    } else if (status === "Rejected") {
      return "red";
    }
    return "yellow"; // Default color
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center py-8">
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-3xl">
        <h1 className="text-3xl font-semibold mb-6 text-center">
          Student's Dashboard
        </h1>
        <h2 className="text-xl font-semibold mb-4">My Tickets:</h2>
        {tickets.length === 0 ? (
          <p className="text-gray-400">No tickets available</p>
        ) : (
          <ul className="space-y-4">
            {tickets.map((ticket) => (
              <li key={ticket._id} className="bg-gray-700 p-4 rounded-lg shadow-md">
                <p>Ticket ID: <span className="text-purple-500">{ticket._id}</span></p>
                <p>Roll No: <span className="text-purple-500">{ticket.rollNo}</span></p>
                <p>Section: <span className="text-purple-500">{ticket.section}</span></p>
                <p>Document: <span className="text-purple-500">{ticket.document}</span></p>
                <p>Status: <span style={{ color: getStatusColor(ticket.response) }}>{ticket.response || "Pending"}</span></p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
