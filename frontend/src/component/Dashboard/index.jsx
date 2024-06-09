import React, { useEffect, useState } from 'react';
import axios from 'axios';

export default function StudentDashboard() {
  const [tickets, setTickets] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [token, setToken] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [alertTimers, setAlertTimers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState({});

  const POLLING_INTERVAL = 5000;
  const ALERTS_EXPIRATION_TIME = 300000; // 5 minutes
  const UPDATE_INTERVAL = 1000; // 1 second

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

        const now = Date.now();
        const newAlerts = response.data;

        // Update alert timers for new alerts
        const newAlertTimers = { ...alertTimers };
        newAlerts.forEach(alert => {
          if (!alertTimers[alert._id]) {
            newAlertTimers[alert._id] = now + ALERTS_EXPIRATION_TIME;
          }
        });
        
        setAlerts(newAlerts);
        setAlertTimers(newAlertTimers);
      } catch (error) {
        console.error("Error fetching alerts:", error);
      }
    };

    fetchTickets();
    fetchAlerts();

    const ticketsIntervalId = setInterval(fetchTickets, POLLING_INTERVAL);
    const alertsIntervalId = setInterval(fetchAlerts, POLLING_INTERVAL);

    return () => {
      clearInterval(ticketsIntervalId);
      clearInterval(alertsIntervalId);
    };
  }, [token]);

  useEffect(() => {
    const updateAlertTimers = () => {
      const now = Date.now();
      const newTimeRemaining = {};
      const activeAlerts = alerts.filter(alert => {
        const timeLeft = alertTimers[alert._id] - now;
        if (timeLeft > 0) {
          newTimeRemaining[alert._id] = {
            minutes: Math.floor((timeLeft / 1000 / 60) % 60),
            seconds: Math.floor((timeLeft / 1000) % 60)
          };
          return true;
        }
        return false;
      });
      setAlerts(activeAlerts);
      setTimeRemaining(newTimeRemaining);
    };

    const intervalId = setInterval(updateAlertTimers, UPDATE_INTERVAL);

    return () => clearInterval(intervalId);
  }, [alerts, alertTimers]);

  return (
    <div className="bg-gray-900 text-white min-h-screen flex">
      <div className={`fixed inset-y-0 left-0 transform ${showSidebar ? "translate-x-0" : "-translate-x-full"} transition-transform duration-300 ease-in-out bg-gray-800 w-64 p-6`}>
        <h2 className="text-2xl font-semibold mb-4">Important Alerts</h2>
        {alerts.length > 0 ? (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert._id}
                className="bg-red-500 text-white p-4 rounded-md shadow-md"
              >
                {alert.message}
                {timeRemaining[alert._id] && (
                  <p className="text-gray-400 mt-2">
                    Expires in: {timeRemaining[alert._id].minutes}:{timeRemaining[alert._id].seconds.toString().padStart(2, '0')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400">No alerts available</p>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center py-8 px-6 ml-64">
        <button
          className="bg-purple-600 text-white p-2 rounded-md mb-4"
          onClick={() => setShowSidebar(!showSidebar)}
        >
          {showSidebar ? "Hide Alerts" : "Show Alerts"}
        </button>
        <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-4xl">
          <h1 className="text-3xl font-semibold mb-6 text-center">
            Student's Dashboard
          </h1>
          {/* Tickets section */}
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
    </div>
  );
}
