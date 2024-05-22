import { useEffect, useState } from "react";
import axios from "axios";

export default function TeacherDashboard() {
  const [tickets, setTickets] = useState([]);
  const [responseMessage, setResponseMessage] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [token, setToken] = useState(null);

  const POLLING_INTERVAL = 5000;

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

  const filteredTickets = tickets.filter((ticket) =>
    filterSection ? ticket.section === filterSection : true
  );

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center py-8">
      {responseMessage && (
        <div className="bg-green-500 text-white p-4 rounded-md mb-4">
          {responseMessage}
        </div>
      )}
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-3xl">
        <h1 className="text-3xl font-semibold mb-6 text-center">
          Teacher's Dashboard
        </h1>
        <h2 className="text-xl font-semibold mb-4">Tickets:</h2>
        <div className="mb-4">
          <label htmlFor="filter" className="mr-2">Filter by Section:</label>
          <select
            id="filter"
            value={filterSection}
            onChange={handleFilterChange}
            className="bg-gray-700 text-white p-2 rounded-md"
          >
            <option value="">All</option>
            {[...new Set(tickets.map(ticket => ticket.section))].map(section => (
              <option key={section} value={section}>{section}</option>
            ))}
          </select>
        </div>
        {filteredTickets.length === 0 ? (
          <p className="text-gray-400">No tickets available</p>
        ) : (
          <ul className="space-y-4">
            {filteredTickets.map((ticket) => (
              <li
                key={ticket._id}
                className="bg-gray-700 p-4 rounded-lg shadow-md"
              >
                <p>
                  Ticket ID: <span className="text-purple-500">{ticket._id}</span>
                </p>
                <p>
                  Roll No: <span className="text-purple-500">{ticket.rollNo}</span>
                </p>
                <p>
                  Section:{" "}
                  <span className="text-purple-500">{ticket.section}</span>
                </p>
                <p>
                  Document:{" "}
                  <span className="text-purple-500">{ticket.document}</span>
                </p>
                <p>
                  Status:{" "}
                  <span className="text-purple-500">{ticket.response || "Pending"}</span>
                </p>
                {!ticket.response || ticket.response === "Pending" ? (
                  <div className="mt-4 flex space-x-4">
                    <button
                      onClick={() => handleApprove(ticket._id)}
                      className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors duration-300"
                    >
                      Agree
                    </button>
                    <button
                      onClick={() => handleReject(ticket._id)}
                      className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 transition-colors duration-300"
                    >
                      Disagree
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-lg font-semibold text-green-500">
                    {ticket.response}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
