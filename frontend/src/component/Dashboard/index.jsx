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

const useAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const addAlert = useCallback((alert) => {
    const id = Date.now();
    setAlerts((prevAlerts) => [...prevAlerts, { ...alert, id }]);
  }, []);
  return { alerts, addAlert };
};

export default function StudentDashboard() {
  const [tickets, setTickets] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [token, setToken] = useState(null);
  const { alerts, addAlert } = useAlerts();
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  const POLLING_INTERVAL = 5000;
  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) setToken(storedToken);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;

      try {
        const [ticketsResponse, attendanceResponse, alertsResponse] =
          await Promise.all([
            fetch(`${API_URL}/tickets`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_URL}/attendance`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
            fetch(`${API_URL}/alerts`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);

        const [ticketsData, attendanceData, alertsData] = await Promise.all([
          ticketsResponse.json(),
          attendanceResponse.json(),
          alertsResponse.json(),
        ]);

        setTickets(ticketsData);
        setAttendance(attendanceData);
        alertsData.forEach(addAlert);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [token, addAlert]);

  const aggregatedAttendance = attendance.reduce((acc, record) => {
    const { subject } = record;
    if (!acc[subject.code]) {
      acc[subject.code] = {
        name: subject.name,
        code: subject.code,
        totalAttended: 0,
        totalClasses: 0,
      };
    }
    acc[subject.code].totalAttended += record.attendedClasses;
    acc[subject.code].totalClasses += record.totalClasses;
    return acc;
  }, {});

  const totalOverallAttended = Object.values(aggregatedAttendance).reduce(
    (total, subject) => total + subject.totalAttended,
    0
  );
  const totalOverallClasses = Object.values(aggregatedAttendance).reduce(
    (total, subject) => total + subject.totalClasses,
    0
  );
  const overallAttendancePercentage = (
    (totalOverallAttended / totalOverallClasses) *
    100
  ).toFixed(2);

  const chartData = Object.values(aggregatedAttendance).map((subject) => ({
    name: subject.code,
    attendance: ((subject.totalAttended / subject.totalClasses) * 100).toFixed(
      2
    ),
  }));

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
    try {
      const response = await fetch(`${API_URL}/tickets/${ticketId}/file`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Topbar */}
      {/* <motion.div
        className="fixed top-0 left-0 right-0 h-16 bg-white shadow-sm z-50 px-4"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="h-full flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold text-gray-800">
              Student ERP Portal
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAlerts(!showAlerts)}
              className="p-2 hover:bg-gray-100 rounded-full relative"
            >
              <Bell className="w-5 h-5 text-gray-600" />
              {alerts.length > 0 && (
                <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </motion.button>

            <HeadlessMenu as="div" className="relative">
              <HeadlessMenu.Button className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">
                  John Doe
                </span>
              </HeadlessMenu.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <HeadlessMenu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1">
                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? "bg-gray-100" : ""
                        } flex items-center space-x-2 px-4 py-2 text-sm text-gray-700 w-full`}
                      >
                        <Settings className="w-4 h-4" />
                        <span>Settings</span>
                      </button>
                    )}
                  </HeadlessMenu.Item>
                  <HeadlessMenu.Item>
                    {({ active }) => (
                      <button
                        className={`${
                          active ? "bg-gray-100" : ""
                        } flex items-center space-x-2 px-4 py-2 text-sm text-red-600 w-full`}
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    )}
                  </HeadlessMenu.Item>
                </HeadlessMenu.Items>
              </Transition>
            </HeadlessMenu>
          </div>
        </div>
      </motion.div> */}

      {/* Main Content */}
      <div className="pt-24 px-6 pb-8">
        <div className="max-w-7xl mx-auto">
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
              <p className="text-2xl font-semibold text-gray-800">4 Classes</p>
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
                <Bookmark className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-medium text-gray-600">
                  Current Semester
                </h3>
              </div>
              <p className="text-2xl font-semibold text-gray-800">Fall 2024</p>
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
                  <span>Tickets</span>
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
                <Tab.Panel
                  as={motion.div}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="bg-white rounded-xl p-6 shadow-sm"
                >
                  <h2 className="text-2xl font-semibold mb-6 text-gray-800">
                    My Tickets
                  </h2>
                  {tickets.length === 0 ? (
                    <p className="text-gray-500">No tickets available</p>
                  ) : (
                    <div className="space-y-4">
                      {tickets.map((ticket) => (
                        <motion.div
                          key={ticket._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
                        >
                          <p className="text-sm text-purple-600 mb-2">
                            Ticket ID: {ticket._id}
                          </p>
                          <p className="font-semibold text-gray-800 mb-2">
                            {ticket.section}
                          </p>
                          <p className="text-gray-600 mb-2">
                            {ticket.document}
                          </p>
                          <p className="text-sm italic text-green-600">
                            {ticket.response}
                          </p>
                          {ticket.file && (
                            <div className="mt-4">
                              <button
                                onClick={() =>
                                  handleFileClick(ticket._id, ticket.file)
                                }
                                className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                              >
                                {renderFileIcon(ticket.file)}
                                <span>{ticket.file}</span>
                              </button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Tab.Panel>

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
                   
                  </div>

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
                          const attendancePercentage =
                            (subject.totalAttended / subject.totalClasses) *
                            100;
                          const getAttendanceColor = (percentage) => {
                            if (percentage >= 75) return "bg-purple-600";
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
                                        width: `${attendancePercentage}%`,
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
                </Tab.Panel>

                <AttendanceDetailModal
                  isOpen={isAttendanceModalOpen}
                  onClose={() => setIsAttendanceModalOpen(false)}
                  subject={selectedSubject}
                  token={token}
                  API_URL={API_URL}
                />

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
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="attendance"
                          stroke="#7C3AED"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
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
                            Notifications
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
                                  {alert.title}
                                </h3>
                                <p className="mt-2 text-sm text-purple-700">
                                  {alert.message}
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
