import { useEffect, useState } from "react";
import axios from "axios";

export default function StudentDashboard() {
  const [tickets, setTickets] = useState([]);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await axios.get("https://attendease-gajo.onrender.com/api/tickets", {
          headers: {
            Authorization: `Bearer ${token}`,
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
    return "yellow";
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center py-8">
      <div className="bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-3xl">
        <h1 className="text-3xl font-semibold mb-6 text-center">Student's Dashboard</h1>
        <h2 className="text-xl font-semibold mb-4">My Tickets</h2>
        {tickets.length === 0 ? (
          <p className="text-gray-400 text-center">No tickets available</p>
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <div key={ticket._id} className="bg-black p-6 rounded-lg shadow-md">
                <p className="mb-2"><span className="font-semibold">Ticket ID:</span> <span className="text-purple-500">{ticket._id}</span></p>
                <p className="mb-2"><span className="font-semibold">Roll No:</span> <span className="text-purple-500">{ticket.rollNo}</span></p>
                <p className="mb-2"><span className="font-semibold">Section:</span> <span className="text-purple-500">{ticket.section}</span></p>
                <p className="mb-2"><span className="font-semibold">Document:</span> <span className="text-purple-500">{ticket.document}</span></p>
                <p className="mb-2"><span className="font-semibold">Status:</span> <span style={{ color: getStatusColor(ticket.response) }}>{ticket.response || "Pending"}</span></p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
