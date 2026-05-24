import React, { useEffect, useState, useCallback } from "react";
import { Tab } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  AirVent,
  LineChart as ChartIcon,
  Bell,
  File,
  Image as ImageIcon,
  X,
  User,
  Settings,
  LogOut,
  Calendar,
  Clock,
  TrendingUp,
  Bookmark,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Dialog, Transition, Menu as HeadlessMenu } from "@headlessui/react";
import { Fragment } from "react";
import AttendanceDetailModal from "../AttendanceDetailModal";
import axios from "axios";

const useAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const addAlert = useCallback((alert) => {
    const id = Date.now();
    setAlerts((prevAlerts) => [...prevAlerts, { ...alert, id }]);
  }, []);
  return { alerts, addAlert };
};

export default function StudentDashboard({ userId, userName, userEmail, role }) {
  const [tickets, setTickets] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [token, setToken] = useState(null);
  const { alerts, addAlert } = useAlerts();
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const POLLING_INTERVAL = 30000; // Increased to 30 seconds
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8011";

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      console.log("✅ Token found:", storedToken.substring(0, 20) + "...");
      setToken(storedToken);
    } else {
      console.error("❌ No token found in localStorage");
      setError("No authentication token found. Please login again.");
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        console.log("🔄 Fetching student data...");
        console.log("🔑 Token being used:", token?.substring(0, 20) + "...");
        
        const config = {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };

        console.log("📤 Headers being sent:", config.headers);

        // Fetch tickets
        const ticketsResponse = await axios.get(`${API_URL}/tickets/student`, config);
        console.log("✅ Tickets response:", ticketsResponse.data);
        setTickets(Array.isArray(ticketsResponse.data) ? ticketsResponse.data : []);

        // Fetch attendance records
        const attendanceResponse = await axios.get(`${API_URL}/attendance/records`, config);
        console.log("✅ Attendance response:", attendanceResponse.data);
        setAttendance(Array.isArray(attendanceResponse.data) ? attendanceResponse.data : []);

        // Fetch alerts
        try {
          const alertsResponse = await axios.get(`${API_URL}/alerts/alerts`, config);
          if (Array.isArray(alertsResponse.data)) {
            alertsResponse.data.forEach(addAlert);
          }
        } catch (alertError) {
          console.warn("⚠️ Could not fetch alerts:", alertError.message);
        }

        setError(null);
      } catch (error) {
        console.error("❌ Error fetching data:", error);
        
        if (error.response) {
          console.error("Error status:", error.response.status);
          console.error("Error data:", error.response.data);
          
          if (error.response.status === 401) {
            setError("Authentication failed. Please login again.");
            // Clear invalid token
            localStorage.removeItem("token");
          } else if (error.response.status === 403) {
            setError("Access forbidden. You don't have permission to access this data.");
          } else if (error.response.status === 404) {
            setError("Endpoint not found. Please check API configuration.");
          } else {
            setError(`Server error: ${error.response.data.message || error.response.statusText}`);
          }
        } else if (error.request) {
          setError("No response from server. Please check your connection.");
        } else {
          setError(`Error: ${error.message}`);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Set up polling only if token exists
    const intervalId = setInterval(() => {
      if (token) {
        fetchData();
      }
    }, POLLING_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, [token, addAlert]);

  const aggregatedAttendance = attendance.reduce((acc, record) => {
    if (!record || !record.subject) return acc;
    
    const { subject } = record;
    if (!acc[subject.code]) {
      acc[subject.code] = {
        name: subject.name || subject.code,
        code: subject.code,
        totalAttended: 0,
        totalClasses: 0,
      };
    }
    acc[subject.code].totalAttended += record.attendedClasses || 0;
    acc[subject.code].totalClasses += record.totalClasses || 0;
    return acc;
  }, {});

  const totalOverallAttended = Object.values(aggregatedAttendance).reduce(
    (total, subject) => total + (subject.totalAttended || 0),
    0
  );
  const totalOverallClasses = Object.values(aggregatedAttendance).reduce(
    (total, subject) => total + (subject.totalClasses || 0),
    0
  );
  const overallAttendancePercentage = totalOverallClasses > 0 
    ? ((totalOverallAttended / totalOverallClasses) * 100).toFixed(2)
    : 0;

  const chartData = Object.values(aggregatedAttendance).map((subject) => {
    const attendancePercentage = subject.totalClasses > 0
      ? ((subject.totalAttended / subject.totalClasses) * 100).toFixed(2)
      : 0;
    return {
      name: subject.code,
      attendance: parseFloat(attendancePercentage),
    };
  });

  const renderFileIcon = (file) => {
    if (!file) return null;
    const extension = file.split(".").pop().toLowerCase();
    return extension.match(/^(jpg|jpeg|png)$/) ? (
      <ImageIcon className="w-8 h-8 text-purple-600" />
    ) : (
      <File className="w-8 h-8 text-purple-600" />
    );
  };

  const handleFileClick = async (ticketId, file) => {
    if (!token) {
      setError("No authentication token available");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/tickets/${ticketId}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.status}`);
      }
      
      const blob = await response.blob();
      const fileType = response.headers.get("content-type");

      if (fileType.startsWith("image/")) {
        setFileContent({ type: "image", content: URL.createObjectURL(blob) });
      } else if (fileType === "application/pdf") {
        setFileContent({ type: "pdf", content: URL.createObjectURL(blob) });
      } else {
        setFileContent({
          type: "download",
          content: URL.createObjectURL(blob),
          fileName: file,
        });
      }
      setSelectedFile({ ticketId, file });
    } catch (error) {
      console.error("Error fetching file:", error);
      setFileContent({ type: "error", content: "Error loading file" });
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.href = "/login"}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading student dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <div className="pt-8 px-6 pb-8">
        <div className="max-w-7xl mx-auto">
          {/* Welcome Banner */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-6 text-white mb-8 shadow-lg"
          >
            <h1 className="text-2xl font-bold mb-2">Welcome back, {userName || "Student"}!</h1>
            <p className="opacity-90">Here's your academic dashboard for today</p>
            <div className="flex items-center space-x-4 mt-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span className="text-sm">{userEmail || "student@college.edu"}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Bookmark className="w-5 h-5" />
                <span className="text-sm">Student ID: {userId?.substring(0, 8) || "N/A"}</span>
              </div>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          >
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-medium text-gray-600">
                  Today's Classes
                </h3>
              </div>
              <p className="text-2xl font-semibold text-gray-800">
                {attendance.length > 0 ? attendance.length : "0"} Classes
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <AirVent className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-medium text-gray-600">
                  Overall Attendance
                </h3>
              </div>
              <p className="text-2xl font-semibold text-gray-800">
                {overallAttendancePercentage}%
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Ticket className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-medium text-gray-600">
                  Open Tickets
                </h3>
              </div>
              <p className="text-2xl font-semibold text-gray-800">
                {tickets.length}
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center space-x-2 mb-2">
                <Bell className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-medium text-gray-600">
                  Notifications
                </h3>
              </div>
              <p className="text-2xl font-semibold text-gray-800">
                {alerts.length}
              </p>
            </div>
          </motion.div>

          {/* Tabs */}
          <Tab.Group>
            <Tab.List className="flex space-x-1 rounded-xl bg-white p-1 shadow-sm mb-6">
              <Tab
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200
                  ${
                    selected
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                  }`
                }
              >
                <div className="flex items-center justify-center space-x-2">
                  <Ticket className="w-5 h-5" />
                  <span>Tickets ({tickets.length})</span>
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200
                  ${
                    selected
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                  }`
                }
              >
                <div className="flex items-center justify-center space-x-2">
                  <AirVent className="w-5 h-5" />
                  <span>Attendance</span>
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all duration-200
                  ${
                    selected
                      ? "bg-purple-100 text-purple-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                  }`
                }
              >
                <div className="flex items-center justify-center space-x-2">
                  <ChartIcon className="w-5 h-5" />
                  <span>Analytics</span>
                </div>
              </Tab>
            </Tab.List>

            <Tab.Panels>
              <AnimatePresence mode="wait">
                {/* Tickets Tab */}
                <Tab.Panel
                  as={motion.div}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-xl p-6 shadow-sm"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800">
                      My Tickets
                    </h2>
                    <button
                      onClick={() => window.location.href = "/tickets"}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                    >
                      Submit New Ticket
                    </button>
                  </div>
                  
                  {tickets.length === 0 ? (
                    <div className="text-center py-12">
                      <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No tickets submitted yet</p>
                      <button
                        onClick={() => window.location.href = "/tickets"}
                        className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Submit Your First Ticket
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tickets.map((ticket) => (
                        <motion.div
                          key={ticket._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="text-sm text-purple-600 mb-1">
                                Ticket ID: {ticket._id?.substring(0, 8) || "N/A"}
                              </p>
                              <p className="font-semibold text-gray-800 mb-2">
                                {ticket.section || "No Section"}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              ticket.status === 'approved' ? 'bg-green-100 text-green-800' :
                              ticket.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {ticket.status || 'pending'}
                            </span>
                          </div>
                          
                          <p className="text-gray-600 mb-4">
                            {ticket.document || "No description provided"}
                          </p>
                          
                          {ticket.response && (
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4 rounded">
                              <p className="text-sm font-medium text-blue-800 mb-1">Teacher Response:</p>
                              <p className="text-blue-700">{ticket.response}</p>
                            </div>
                          )}
                          
                          {ticket.file && (
                            <div className="mt-4">
                              <button
                                onClick={() => handleFileClick(ticket._id, ticket.file)}
                                className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                              >
                                {renderFileIcon(ticket.file)}
                                <span>{ticket.file}</span>
                              </button>
                            </div>
                          )}
                          
                          <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                            Created: {new Date(ticket.createdAt).toLocaleDateString()}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Tab.Panel>

                {/* Attendance Tab */}
                <Tab.Panel
                  as={motion.div}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-xl p-6 shadow-lg"
                >
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800">
                        Attendance Overview
                      </h2>
                      <p className="text-gray-500 mt-1">
                        Click on any subject for detailed view
                      </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="text-purple-600" size={20} />
                        <span className="font-semibold text-purple-600">
                          {overallAttendancePercentage}% Overall
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Calendar className="text-purple-600" />
                        <div>
                          <p className="text-gray-500">Total Classes</p>
                          <p className="text-xl font-bold text-gray-800">
                            {totalOverallClasses}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <User className="text-purple-600" />
                        <div>
                          <p className="text-gray-500">Classes Attended</p>
                          <p className="text-xl font-bold text-gray-800">
                            {totalOverallAttended}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center gap-3">
                        <AirVent className="text-purple-600" />
                        <div>
                          <p className="text-gray-500">Attendance %</p>
                          <p className="text-xl font-bold text-gray-800">
                            {overallAttendancePercentage}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {Object.keys(aggregatedAttendance).length === 0 ? (
                    <div className="text-center py-12">
                      <AirVent className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No attendance records found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-100">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                              Subject
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                              Attended / Total
                            </th>
                            <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">
                              Attendance
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {Object.values(aggregatedAttendance).map((subject) => {
                            const attendancePercentage = subject.totalClasses > 0
                              ? (subject.totalAttended / subject.totalClasses) * 100
                              : 0;
                            const getAttendanceColor = (percentage) => {
                              if (percentage >= 75) return "bg-green-500";
                              if (percentage >= 60) return "bg-yellow-500";
                              return "bg-red-500";
                            };

                            return (
                              <motion.tr
                                key={subject.code}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => {
                                  setSelectedSubject(subject);
                                  setIsAttendanceModalOpen(true);
                                }}
                              >
                                <td className="px-6 py-4">
                                  <div>
                                    <p className="font-medium text-gray-800">
                                      {subject.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {subject.code}
                                    </p>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-gray-600">
                                  {subject.totalAttended} / {subject.totalClasses}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-full max-w-[200px] bg-gray-100 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${getAttendanceColor(
                                          attendancePercentage
                                        )}`}
                                        style={{
                                          width: `${Math.min(attendancePercentage, 100)}%`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium text-gray-600">
                                      {attendancePercentage.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Tab.Panel>

                <AttendanceDetailModal
                  isOpen={isAttendanceModalOpen}
                  onClose={() => setIsAttendanceModalOpen(false)}
                  subject={selectedSubject}
                  token={token}
                  API_URL={API_URL}
                />

                {/* Analytics Tab */}
                <Tab.Panel
                  as={motion.div}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-xl p-6 shadow-sm"
                >
                  <h2 className="text-2xl font-semibold mb-6 text-gray-800">
                    Attendance Analytics
                  </h2>
                  {chartData.length === 0 ? (
                    <div className="text-center py-12">
                      <ChartIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No attendance data available for analytics</p>
                    </div>
                  ) : (
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis dataKey="name" stroke="#4B5563" />
                          <YAxis stroke="#4B5563" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "white",
                              border: "1px solid #E5E7EB",
                            }}
                            labelStyle={{ color: "#374151" }}
                            formatter={(value) => [`${value}%`, "Attendance"]}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="attendance"
                            stroke="#7C3AED"
                            strokeWidth={2}
                            name="Attendance %"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Tab.Panel>
              </AnimatePresence>
            </Tab.Panels>
          </Tab.Group>
        </div>
      </div>

      {/* Alerts Sidebar */}
      <Transition.Root show={showAlerts} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={setShowAlerts}>
          <Transition.Child
            as={Fragment}
            enter="ease-in-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in-out duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-300"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-300"
                  leaveFrom="translate-x-0"
                  leaveTo="translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                    <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                      <div className="bg-purple-700 px-4 py-6 sm:px-6">
                        <div className="flex items-center justify-between">
                          <Dialog.Title className="text-xl font-semibold text-white">
                            Notifications ({alerts.length})
                          </Dialog.Title>
                          <button
                            type="button"
                            className="text-white hover:text-purple-200"
                            onClick={() => setShowAlerts(false)}
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                      <div className="relative flex-1 px-4 py-6 sm:px-6">
                        {alerts.length === 0 ? (
                          <div className="text-center py-8">
                            <Bell className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">
                              No notifications
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              You're all caught up!
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {alerts.map((alert) => (
                              <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="rounded-lg border-l-4 border-purple-500 bg-purple-50 p-4"
                              >
                                <h3 className="text-lg font-medium text-purple-800">
                                  {alert.title || "Notification"}
                                </h3>
                                <p className="mt-2 text-sm text-purple-700">
                                  {alert.message || "No message"}
                                </p>
                                <p className="mt-2 text-xs text-purple-500">
                                  {new Date(alert.timestamp || alert.id).toLocaleString()}
                                </p>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* File Preview Modal */}
      <Transition appear show={!!selectedFile} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            setSelectedFile(null);
            setFileContent(null);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <Dialog.Title className="text-lg font-medium text-gray-900">
                      {selectedFile?.file}
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setFileContent(null);
                      }}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="mt-4">
                    {fileContent?.type === "image" && (
                      <img
                        src={fileContent.content}
                        alt="Preview"
                        className="max-w-full h-auto rounded-lg"
                      />
                    )}
                    {fileContent?.type === "pdf" && (
                      <iframe
                        src={fileContent.content}
                        title="PDF Viewer"
                        className="w-full h-96 rounded-lg"
                      />
                    )}
                    {fileContent?.type === "download" && (
                      <div className="text-center py-8">
                        <p className="text-gray-600 mb-4">
                          This file type cannot be previewed in the browser
                        </p>
                        <a
                          href={fileContent.content}
                          download={fileContent.fileName}
                          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          Download File
                        </a>
                      </div>
                    )}
                    {fileContent?.type === "error" && (
                      <p className="text-red-500 text-center py-4">
                        {fileContent.content}
                      </p>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}