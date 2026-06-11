// src/components/StudentDashboard.jsx
import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket,
  GraduationCap,
  Bell,
  File,
  Image as ImageIcon,
  X,
  User,
  Calendar,
  Clock,
  TrendingUp,
  BookOpen,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Download,
  Eye,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Dialog, Transition, Tab } from "@headlessui/react";
import { Fragment } from "react";
import axios from "axios";

const COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

export default function StudentDashboard({ userId, userName, userEmail }) {
  const [tickets, setTickets] = useState([]);
  const [attendanceData, setAttendanceData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const API_URL = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem("token");

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!token) {
      setError("No authentication token found");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const config = { headers: { Authorization: `Bearer ${token}` } };

      // Fetch tickets
      const ticketsRes = await axios.get(`${API_URL}/tickets/student`, config);
      setTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : []);

      // Fetch attendance records
      const attendanceRes = await axios.get(
        `${API_URL}/attendance/records`,
        config
      );
      setAttendanceData(attendanceRes.data);

      // Fetch announcements
      const announcementsRes = await axios.get(`${API_URL}/alerts/alerts`, config);
      setAnnouncements(Array.isArray(announcementsRes.data) ? announcementsRes.data : []);

      setError(null);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.response?.data?.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle file preview
  const handleFilePreview = async (ticketId, fileName) => {
    try {
      const response = await fetch(`${API_URL}/api/tickets/${ticketId}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch file");

      const blob = await response.blob();
      const fileType = response.headers.get("content-type");
      const url = URL.createObjectURL(blob);

      if (fileType.startsWith("image/")) {
        setFileContent({ type: "image", content: url });
      } else if (fileType === "application/pdf") {
        setFileContent({ type: "pdf", content: url });
      } else {
        setFileContent({ type: "download", content: url, fileName });
      }
      setSelectedFile({ ticketId, fileName });
    } catch (error) {
      console.error("Error fetching file:", error);
      setFileContent({ type: "error", content: "Error loading file" });
    }
  };

  // Stats from attendance data
  const stats = attendanceData?.stats || {
    totalClasses: 0,
    presentCount: 0,
    absentCount: 0,
    leaveCount: 0,
    attendancePercentage: "0",
    bySubject: [],
  };

  const studentInfo = attendanceData?.student || {
    name: userName,
    rollNo: "N/A",
    section: "N/A",
  };

  // Pie chart data
  const pieData = [
    { name: "Present", value: stats.presentCount, color: "#10b981" },
    { name: "Absent", value: stats.absentCount, color: "#ef4444" },
    { name: "Leave", value: stats.leaveCount, color: "#f59e0b" },
  ].filter((item) => item.value > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 mb-8 text-white shadow-xl"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                Welcome back, {studentInfo.name || userName}!
              </h1>
              <p className="text-purple-100">Track your academic progress here</p>
            </div>
            <div className="mt-4 md:mt-0 flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                <User className="w-4 h-4" />
                <span>{studentInfo.rollNo}</span>
              </div>
              <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-lg">
                <GraduationCap className="w-4 h-4" />
                <span>Section {studentInfo.section}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <StatCard
            title="Total Classes"
            value={stats.totalClasses}
            icon={<BookOpen className="w-6 h-6" />}
            color="purple"
          />
          <StatCard
            title="Classes Attended"
            value={stats.presentCount}
            icon={<CheckCircle className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title="Classes Missed"
            value={stats.absentCount + stats.leaveCount}
            icon={<XCircle className="w-6 h-6" />}
            color="red"
          />
          <StatCard
            title="Attendance"
            value={`${stats.attendancePercentage}%`}
            icon={<TrendingUp className="w-6 h-6" />}
            color="orange"
          />
        </motion.div>

        {/* Announcements Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-800">
                Announcements
              </h2>
              <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
                {announcements.length}
              </span>
            </div>
          </div>

          {announcements.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No announcements at the moment</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {announcements.map((announcement, idx) => (
                <motion.div
                  key={announcement._id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition cursor-pointer border-l-4 border-purple-500"
                  onClick={() => setSelectedAnnouncement(announcement)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-purple-600" />
                        <span className="text-xs text-gray-400">
                          {new Date(announcement.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            }
                          )}
                        </span>
                      </div>
                      <p className="text-gray-700 line-clamp-2">
                        {announcement.message}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Tabs Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tab.Group selectedIndex={activeTab} onChange={setActiveTab}>
            <Tab.List className="flex space-x-2 bg-white rounded-xl p-1 shadow-sm mb-6">
              <Tab
                className={({ selected }) =>
                  `flex-1 py-3 rounded-lg font-medium transition-all ${
                    selected
                      ? "bg-purple-600 text-white shadow-md"
                      : "text-gray-600 hover:bg-purple-50"
                  }`
                }
              >
                <div className="flex items-center justify-center gap-2">
                  <Award className="w-5 h-5" />
                  <span>Subject-wise Attendance</span>
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  `flex-1 py-3 rounded-lg font-medium transition-all ${
                    selected
                      ? "bg-purple-600 text-white shadow-md"
                      : "text-gray-600 hover:bg-purple-50"
                  }`
                }
              >
                <div className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  <span>Analytics</span>
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  `flex-1 py-3 rounded-lg font-medium transition-all ${
                    selected
                      ? "bg-purple-600 text-white shadow-md"
                      : "text-gray-600 hover:bg-purple-50"
                  }`
                }
              >
                <div className="flex items-center justify-center gap-2">
                  <Ticket className="w-5 h-5" />
                  <span>My Tickets ({tickets.length})</span>
                </div>
              </Tab>
            </Tab.List>

            <Tab.Panels>
              {/* Subject-wise Attendance Tab */}
              <Tab.Panel>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  {stats.bySubject.length === 0 ? (
                    <div className="text-center py-12">
                      <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No attendance records found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-4 px-4 font-semibold text-gray-700">
                              Subject
                            </th>
                            <th className="text-left py-4 px-4 font-semibold text-gray-700">
                              Subject Code
                            </th>
                            <th className="text-left py-4 px-4 font-semibold text-gray-700">
                              Attended / Total
                            </th>
                            <th className="text-left py-4 px-4 font-semibold text-gray-700">
                              Attendance %
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.bySubject.map((subject, idx) => {
                            const percentage = parseFloat(
                              subject.attendancePercentage
                            );
                            const getColor = () => {
                              if (percentage >= 75) return "bg-green-500";
                              if (percentage >= 60) return "bg-yellow-500";
                              return "bg-red-500";
                            };
                            return (
                              <motion.tr
                                key={subject.subjectCode}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className="border-b border-gray-100 hover:bg-gray-50 transition"
                              >
                                <td className="py-4 px-4 font-medium text-gray-800">
                                  {subject.subjectName}
                                </td>
                                <td className="py-4 px-4 text-gray-600">
                                  {subject.subjectCode}
                                </td>
                                <td className="py-4 px-4 text-gray-600">
                                  {subject.present} / {subject.total}
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-32 bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${getColor()}`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                    <span
                                      className={`text-sm font-medium ${
                                        percentage >= 75
                                          ? "text-green-600"
                                          : percentage >= 60
                                          ? "text-yellow-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {subject.attendancePercentage}%
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
                </div>
              </Tab.Panel>

              {/* Analytics Tab */}
              <Tab.Panel>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  {stats.bySubject.length === 0 ? (
                    <div className="text-center py-12">
                      <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No data available for analytics</p>
                    </div>
                  ) : (
                    <div className="grid lg:grid-cols-2 gap-8">
                      {/* Bar Chart */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">
                          Subject-wise Attendance
                        </h3>
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={stats.bySubject.map((s) => ({
                                name: s.subjectCode,
                                attendance: parseFloat(s.attendancePercentage),
                              }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis domain={[0, 100]} />
                              <Tooltip
                                formatter={(value) => [`${value}%`, "Attendance"]}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="attendance"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                name="Attendance %"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Pie Chart */}
                      {pieData.length > 0 && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800 mb-4">
                            Attendance Distribution
                          </h3>
                          <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={100}
                                  paddingAngle={5}
                                  dataKey="value"
                                  label={({ name, percent }) =>
                                    `${name} ${(percent * 100).toFixed(0)}%`
                                  }
                                >
                                  {pieData.map((entry, index) => (
                                    <Cell key={index} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Tab.Panel>

              {/* Tickets Tab */}
              <Tab.Panel>
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-800">My Tickets</h2>
                    <button
                      onClick={() => (window.location.href = "/tickets")}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                    >
                      + New Ticket
                    </button>
                  </div>

                  {tickets.length === 0 ? (
                    <div className="text-center py-12">
                      <Ticket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No tickets submitted yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tickets.map((ticket) => (
                        <div
                          key={ticket._id}
                          className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">
                                Ticket #{ticket._id?.slice(-8)}
                              </p>
                              <p className="font-medium text-gray-800">
                                {ticket.section || "General Inquiry"}
                              </p>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                ticket.status === "approved"
                                  ? "bg-green-100 text-green-700"
                                  : ticket.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {ticket.status || "pending"}
                            </span>
                          </div>

                          <p className="text-gray-600 mb-3">{ticket.document}</p>

                          {ticket.response && (
                            <div className="bg-blue-50 rounded-lg p-3 mb-3">
                              <p className="text-xs font-medium text-blue-600 mb-1">
                                Response:
                              </p>
                              <p className="text-sm text-blue-700">{ticket.response}</p>
                            </div>
                          )}

                          {ticket.file && (
                            <button
                              onClick={() =>
                                handleFilePreview(ticket._id, ticket.file)
                              }
                              className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
                            >
                              <Eye className="w-4 h-4" />
                              View Attachment
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </motion.div>
      </div>

      {/* Announcement Detail Modal */}
      <Transition appear show={!!selectedAnnouncement} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setSelectedAnnouncement(null)}
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
                <Dialog.Panel className="w-full max-w-md transform rounded-2xl bg-white p-6 shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-purple-600" />
                      <Dialog.Title className="text-lg font-semibold text-gray-800">
                        Announcement
                      </Dialog.Title>
                    </div>
                    <button
                      onClick={() => setSelectedAnnouncement(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs text-gray-400">
                      {selectedAnnouncement?.createdAt &&
                        new Date(selectedAnnouncement.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <p className="text-gray-700 leading-relaxed">
                    {selectedAnnouncement?.message}
                  </p>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

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
                      {selectedFile?.fileName}
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
                          This file type cannot be previewed
                        </p>
                        <a
                          href={fileContent.content}
                          download={fileContent.fileName}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                          <Download className="w-4 h-4" />
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

// Stat Card Component
const StatCard = ({ title, value, icon, color }) => {
  const colorClasses = {
    purple: "bg-purple-50 text-purple-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    orange: "bg-orange-50 text-orange-600",
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>{icon}</div>
        <TrendingUp
          className={`w-5 h-5 ${
            value > 75
              ? "text-green-500"
              : value > 60
              ? "text-yellow-500"
              : "text-red-500"
          }`}
        />
      </div>
      <p className="text-gray-500 text-sm mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  );
};