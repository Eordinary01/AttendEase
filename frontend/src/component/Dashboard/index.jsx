import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import AttendanceDetailModal from "../AttendanceDetailModal";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  FaTicketAlt,
  FaChalkboardTeacher,
  FaChartLine,
  FaBell,
  FaFile,
  FaImage,
} from "react-icons/fa";
import styled from "styled-components";

// Styled components for the alert
const AlertSidebar = styled(motion.div)`
  position: fixed;
  top: 0;
  right: 0;
  width: 300px;
  height: 100vh;
  background: rgba(31, 41, 55, 0.95);
  backdrop-filter: blur(5px);
  z-index: 1000;
  padding: 20px;
  overflow-y: auto;
`;

const AlertButton = styled.button`
  position: fixed;
  top: 100px;
  right: 20px;
  background: rgba(79, 70, 229, 0.9);
  color: white;
  padding: 10px;
  border-radius: 50%;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  outline: none;
`;

const AlertItem = styled.div`
  background: rgba(79, 70, 229, 0.2);
  border-left: 4px solid #8b5cf6;
  padding: 12px;
  margin-bottom: 12px;
  border-radius: 4px;
`;

const AlertTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
`;

const AlertMessage = styled.p`
  font-size: 14px;
  line-height: 1.4;
`;

// Styled components for file showcase
const FileShowcase = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
`;

const FileCard = styled(motion.div)`
  background: rgba(79, 70, 229, 0.1);
  border-radius: 8px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
`;

const FileIcon = styled.div`
  font-size: 2rem;
  margin-bottom: 0.5rem;
`;

const FileName = styled.p`
  font-size: 0.9rem;
  text-align: center;
  word-break: break-word;
`;

const Modal = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled(motion.div)`
  background: #1f2937;
  padding: 2rem;
  border-radius: 8px;
  max-width: 80%;
  max-height: 80%;
  overflow: auto;
  width: 100%; // Add this to ensure the modal takes full width up to max-width
`;

// Custom hook for managing alerts
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
  const [activeTab, setActiveTab] = useState("tickets");
  const { alerts, addAlert } = useAlerts();
  const [showAlerts, setShowAlerts] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);

  // modal state
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  const POLLING_INTERVAL = 5000;
  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (token) {
        try {
          const [ticketsResponse, attendanceResponse, alertsResponse] =
            await Promise.all([
              axios.get(`${API_URL}/tickets`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
              axios.get(`${API_URL}/attendance`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
              axios.get(`${API_URL}/alerts`, {
                headers: { Authorization: `Bearer ${token}` },
              }),
            ]);
          setTickets(ticketsResponse.data);
          setAttendance(attendanceResponse.data);
          alertsResponse.data.forEach((alert) => addAlert(alert));
        } catch (error) {
          console.error("Error fetching data:", error);
        }
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [token, addAlert, API_URL]);

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

  const tabVariants = {
    active: { backgroundColor: "white", color: "purple" },
    inactive: { backgroundColor: "#1F2937", color: "#9CA3AF" },
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  const renderFileIcon = (file) => {
    if (!file) return null;
    const extension = file.split(".").pop().toLowerCase();
    switch (extension) {
      case "pdf":
        return <FaFile color="purple" />;
      case "jpg":
      case "jpeg":
      case "png":
        return <FaImage color="purple" />;
      default:
        return <FaFile color="purple" />;
    }
  };

  const handleFileClick = async (ticketId, file) => {
    try {
      const response = await axios.get(`${API_URL}/tickets/${ticketId}/file`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const fileExtension = file.split(".").pop().toLowerCase();
      const fileType = response.headers["content-type"];

      if (fileType.startsWith("image/")) {
        const imageUrl = URL.createObjectURL(response.data);
        setFileContent({ type: "image", content: imageUrl });
      } else if (fileType === "application/pdf") {
        const pdfUrl = URL.createObjectURL(response.data);
        setFileContent({ type: "pdf", content: pdfUrl });
      } else if (
        fileType === "application/zip" ||
        fileType.includes("officedocument") ||
        fileType === "application/octet-stream"
      ) {
        const downloadUrl = URL.createObjectURL(response.data);
        setFileContent({
          type: "download",
          content: downloadUrl,
          fileName: file,
        });
      } else {
        // Attempt to read as text, but have a fallback for binary files
        try {
          const textContent = await response.data.text();
          setFileContent({ type: "text", content: textContent });
        } catch (error) {
          const downloadUrl = URL.createObjectURL(response.data);
          setFileContent({
            type: "download",
            content: downloadUrl,
            fileName: file,
          });
        }
      }

      setSelectedFile({ ticketId, file });
    } catch (error) {
      console.error("Error fetching file:", error);
      setFileContent({ type: "error", content: "Error loading file" });
    }
  };

  const renderFileContent = () => {
    if (!fileContent) return null;

    switch (fileContent.type) {
      case "image":
        return (
          <img
            src={fileContent.content}
            alt="Uploaded file"
            className="max-w-full h-auto"
          />
        );
      case "pdf":
        return (
          <iframe
            src={fileContent.content}
            title="PDF Viewer"
            width="100%"
            height="600px"
            style={{ border: "none" }}
          />
        );
      case "text":
        return <pre className="whitespace-pre-wrap">{fileContent.content}</pre>;
      case "download":
        return (
          <div>
            <p className="my-7">
              This file type cannot be displayed in the browser.
            </p>
            <a
              href={fileContent.content}
              download={fileContent.fileName}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-5  mx-5 rounded"
            >
              Download File
            </a>
          </div>
        );
      case "error":
        return <p className="text-red-500">{fileContent.content}</p>;
      default:
        return <p>Unsupported file type</p>;
    }
  };

  const handleAttendanceClick = (subject) => {
    setSelectedSubject(subject);
    setIsAttendanceModalOpen(true);
  };

  const closeAttendanceModal = () => {
    setIsAttendanceModalOpen(false);
    setSelectedSubject(null);
  };

  return (
    <div className="bg-purple-200 text-white min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center text-purple-700">
          Student Dashboard 
        </h1>

        {/* Alert Button */}
        <AlertButton onClick={() => setShowAlerts(!showAlerts)}>
          <FaBell size={20} />
        </AlertButton>

        {/* Alert Sidebar */}
        <AnimatePresence>
          {showAlerts && (
            <AlertSidebar
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <h2 className="text-2xl font-semibold mb-4">Alerts</h2>
              {alerts.length === 0 ? (
                <p>No new alerts</p>
              ) : (
                alerts.map((alert) => (
                  <AlertItem key={alert.id}>
                    <AlertTitle>{alert.title}</AlertTitle>
                    <AlertMessage>{alert.message}</AlertMessage>
                  </AlertItem>
                ))
              )}
            </AlertSidebar>
          )}
        </AnimatePresence>

        <div className="flex space-x-4 mb-8">
          <motion.button
            variants={tabVariants}
            animate={activeTab === "tickets" ? "active" : "inactive"}
            onClick={() => setActiveTab("tickets")}
            className="flex items-center px-4 py-2 rounded-lg transition duration-300"
          >
            <FaTicketAlt className="mr-2" /> Tickets
          </motion.button>
          <motion.button
            variants={tabVariants}
            animate={activeTab === "attendance" ? "active" : "inactive"}
            onClick={() => setActiveTab("attendance")}
            className="flex items-center px-4 py-2 rounded-lg transition duration-300"
          >
            <FaChalkboardTeacher className="mr-2" /> Attendance
          </motion.button>
          <motion.button
            variants={tabVariants}
            animate={activeTab === "chart" ? "active" : "inactive"}
            onClick={() => setActiveTab("chart")}
            className="flex items-center px-4 py-2 rounded-lg transition duration-300"
          >
            <FaChartLine className="mr-2" /> Chart
          </motion.button>
        </div>

        <motion.div
          variants={contentVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5 }}
        >
          {activeTab === "tickets" && (
            <div className="bg-white p-6 rounded-lg shadow-xl">
              <h2 className="text-2xl font-semibold mb-4 text-purple-600">My Tickets</h2>
              {tickets.length === 0 ? (
                <p className="text-gray-400">No tickets available</p>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => (
                    <motion.div
                      key={ticket._id}
                      className=" p-4 rounded-lg shadow-md"
                      whileHover={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <p className="text-sm text-purple-600 mb-2">
                        Ticket ID: {ticket._id}
                      </p>
                      <p className="font-semibold mb-2 text-purple-500">{ticket.section}</p>
                      <p className="text-gray-700 mb-2">{ticket.document}</p>
                      <p className="text-sm italic text-green-400">
                        {ticket.response}
                      </p>
                      {ticket.file && (
                        <FileShowcase>
                          <FileCard
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() =>
                              handleFileClick(ticket._id, ticket.file)
                            }
                          >
                            <FileIcon>{renderFileIcon(ticket.file)}</FileIcon>
                            <FileName className="text-purple-500">{ticket.file}</FileName>
                          </FileCard>
                        </FileShowcase>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="bg-white text-purple-700 p-6 rounded-lg shadow-xl">
              <h2 className="text-2xl font-semibold mb-4">
                Attendance Overview
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="px-4 py-2 text-left">Subject</th>
                      <th className="px-4 py-2 text-left">Attended / Total</th>
                      <th className="px-4 py-2 text-left">Attendance (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(aggregatedAttendance).map((subject) => (
                      <motion.tr
                        key={subject.code}
                        className="border-b border-gray-700"
                        whileHover={{ backgroundColor: "#374151" }}
                        onClick={() => handleAttendanceClick(subject)}
                      >
                        <td className="px-4 py-2">
                          {subject.name} ({subject.code})
                        </td>
                        <td className="px-4 py-2">{`${subject.totalAttended} / ${subject.totalClasses}`}</td>
                        <td className="px-4 py-2">
                          <div className="w-full bg-gray-700 rounded-full h-2.5">
                            <div
                              className="bg-purple-600 h-2.5 rounded-full"
                              style={{
                                width: `${
                                  (subject.totalAttended /
                                    subject.totalClasses) *
                                  100
                                }%`,
                              }}
                            ></div>
                          </div>
                          <span className="ml-2 text-sm">
                            {(
                              (subject.totalAttended / subject.totalClasses) *
                              100
                            ).toFixed(2)}
                            %
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-200 font-semibold">
                      <td className="px-4 py-2">Overall Attendance:</td>
                      <td className="px-4 py-2">{`${totalOverallAttended} / ${totalOverallClasses}`}</td>
                      <td className="px-4 py-2">
                        {overallAttendancePercentage}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          <AttendanceDetailModal
            isOpen={isAttendanceModalOpen}
            onClose={closeAttendanceModal}
            subject={selectedSubject}
            token={token}
            API_URL={API_URL}
          />

          {activeTab === "chart" && (
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
              <h2 className="text-2xl font-semibold mb-4">Attendance Chart</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1F2937",
                        border: "none",
                      }}
                      labelStyle={{ color: "#E5E7EB" }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="attendance"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </motion.div>
      </div>
      <AnimatePresence>
        {selectedFile && (
          <Modal
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setSelectedFile(null);
              setFileContent(null);
            }}
          >
            <ModalContent
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">{selectedFile.file}</h3>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setFileContent(null);
                  }}
                  className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                >
                  Cancel
                </button>
              </div>
              {renderFileContent()}
            </ModalContent>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
