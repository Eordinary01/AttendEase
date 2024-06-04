import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function StudentDashboard() {
  const [tickets, setTickets] = useState([]);
  const [alerts, setAlerts] = useState([]);
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

    const fetchAlerts = async () => {
      try {
        const response = await axios.get(
          "https://attendease-gajo.onrender.com/api/alerts",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setAlerts(response.data);
      } catch (error) {
        console.error("Error fetching alerts:", error);
      }
    };

    fetchTickets();
    fetchAlerts();

    const intervalId = setInterval(fetchTickets, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [token]);

  useEffect(() => {
    const removeAlertsAfterTimeout = () => {
      setTimeout(() => {
        setAlerts([]);
      }, 300000); // 5 minutes
    };

    if (alerts.length > 0) {
      removeAlertsAfterTimeout();
    }

  }, [alerts]);

  return (
    <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center py-8">
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-4xl">
        <h1 className="text-3xl font-semibold mb-6 text-center">
          Student's Dashboard
        </h1>
        {alerts.length > 0 && (
          <div className="fixed top-16 right-0 bg-red-500 text-white p-4 rounded-md shadow-md animate-slide-in">
            {alerts.map((alert) => (
              <p key={alert._id}>{alert.message}</p>
            ))}
          </div>
        )}
        <h2 className="text-xl font-semibold mb-4">Tickets:</h2>
        {tickets.length === 0 ? (
          <p className="text-gray-400">No tickets available</p>
        ) : (
          <ul className="space-y-4">
            {tickets.map((ticket) => (
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
                  <span className="font-semibold">Application:</span>{" "}
                  <span className="text-purple-500">{ticket.application}</span>
                </p>
                <p>
                  <span className="font-semibold">Status:</span>{" "}
                  <span className="text-purple-500">{ticket.response}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
