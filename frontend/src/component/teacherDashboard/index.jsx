import React, { useEffect, useState } from "react";
import axios from "axios";
import { Tab } from "@headlessui/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Filter,
  Check,
  X,
  File,
  Calendar,
  AlertTriangle,
  AlertOctagon,
  Users,
  AlertCircle,
  BarChart3,
} from "lucide-react";


export default function TeacherDashboard() {
  const [tickets, setTickets] = useState([]);
  const [responseMessage, setResponseMessage] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterRollNo, setFilterRollNo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [token, setToken] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);

  const POLLING_INTERVAL = 5000;
  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) setToken(storedToken);
  }, []);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await axios.get(`${API_URL}/tickets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTickets(response.data);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      }
    };

    if (token) {
      fetchTickets();
      const intervalId = setInterval(fetchTickets, POLLING_INTERVAL);
      return () => clearInterval(intervalId);
    }
  }, [token, API_URL]);

  const handleApprove = async (ticketId) => {
    try {
      const response = await axios.put(
        `${API_URL}/tickets/${ticketId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResponseMessage(response.data.message);
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket._id === ticketId ? { ...ticket, response: "Approved" } : ticket
        )
      );
      setTimeout(() => setResponseMessage(""), 5000);
    } catch (error) {
      console.error("Error approving ticket:", error);
    }
  };

  const handleReject = async (ticketId) => {
    try {
      const response = await axios.put(
        `${API_URL}/tickets/${ticketId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResponseMessage(response.data.message);
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket._id === ticketId ? { ...ticket, response: "Rejected" } : ticket
        )
      );
      setTimeout(() => setResponseMessage(""), 5000);
    } catch (error) {
      console.error("Error rejecting ticket:", error);
    }
  };

  const handleCreateAlert = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/alerts`,
        { message: alertMessage },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResponseMessage(response.data.message);
      setAlertMessage("");
      setTimeout(() => setResponseMessage(""), 5000);
    } catch (error) {
      console.error("Error creating alert:", error);
    }
  };

  const handleFileClick = async (ticketId, file) => {
    try {
      const response = await axios.get(`${API_URL}/tickets/${ticketId}/file`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });

      const fileType = response.headers["content-type"];

      if (fileType.startsWith("image/")) {
        setFileContent({
          type: "image",
          content: URL.createObjectURL(response.data),
        });
      } else if (fileType === "application/pdf") {
        setFileContent({
          type: "pdf",
          content: URL.createObjectURL(response.data),
        });
      } else if (
        fileType === "application/zip" ||
        fileType.includes("officedocument")
      ) {
        setFileContent({
          type: "download",
          content: URL.createObjectURL(response.data),
          fileName: file,
        });
      } else {
        try {
          const textContent = await response.data.text();
          setFileContent({ type: "text", content: textContent });
        } catch (error) {
          setFileContent({
            type: "download",
            content: URL.createObjectURL(response.data),
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

  const filteredTickets = tickets.filter((ticket) => {
    return (
      (filterSection ? ticket.section === filterSection : true) &&
      (filterRollNo ? ticket.rollNo.includes(filterRollNo) : true) &&
      (filterStatus ? ticket.response === filterStatus : true)
    );
  });

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
            className="w-full h-96"
          />
        );
      case "text":
        return (
          <pre className="whitespace-pre-wrap p-4 bg-gray-50 rounded-lg">
            {fileContent.content}
          </pre>
        );
      case "download":
        return (
          <div className="text-center p-6">
            <p className="mb-4">
              This file type cannot be displayed in the browser.
            </p>
            <a
              href={fileContent.content}
              download={fileContent.fileName}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <File className="w-4 h-4 mr-2" />
              Download File
            </a>
          </div>
        );
      case "error":
        return (
          <AlertTriangle variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertOctagon>{fileContent.content}</AlertOctagon>
          </AlertTriangle>
        );
      default:
        return <p>Unsupported file type</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-purple-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-purple-900">
            Teacher Dashboard
          </h1>
          <p className="text-purple-600 mt-2">
            Manage tickets and alerts efficiently
          </p>
        </header>

        {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total Students</p>
                <p className="text-2xl font-semibold text-purple-900">1,234</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <File className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Open Tickets</p>
                <p className="text-2xl font-semibold text-purple-900">
                  {tickets.filter((t) => t.response === "Pending").length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Check className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Resolved Today</p>
                <p className="text-2xl font-semibold text-purple-900">12</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Response Rate</p>
                <p className="text-2xl font-semibold text-purple-900">94%</p>
              </div>
            </div>
          </div>
        </div> */}

        <Tab.Group>
          <Tab.List className="flex space-x-4 mb-6">
            <Tab
              className={({ selected }) =>
                `px-4 py-2 rounded-lg font-medium transition-colors ${
                  selected
                    ? "bg-purple-600 text-white"
                    : "text-purple-600 hover:bg-purple-50"
                }`
              }
            >
              Tickets
            </Tab>
            <Tab
              className={({ selected }) =>
                `px-4 py-2 rounded-lg font-medium transition-colors ${
                  selected
                    ? "bg-purple-600 text-white"
                    : "text-purple-600 hover:bg-purple-50"
                }`
              }
            >
              Alerts
            </Tab>
          </Tab.List>

          <Tab.Panels className="bg-white rounded-xl shadow-sm p-6">
            <Tab.Panel>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-purple-900">
                  Manage Tickets
                </h2>
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </button>
              </div>

              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
                  >
                    <select
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value)}
                      className="px-3 py-2 bg-purple-50 rounded-lg text-purple-900 border-2 border-purple-100 focus:border-purple-300 focus:ring-0"
                    >
                      <option value="">All Sections</option>
                      {[...new Set(tickets.map((t) => t.section))].map(
                        (section) => (
                          <option key={section} value={section}>
                            {section}
                          </option>
                        )
                      )}
                    </select>

                    <input
                      type="text"
                      value={filterRollNo}
                      onChange={(e) => setFilterRollNo(e.target.value)}
                      placeholder="Search by Roll No"
                      className="px-3 py-2 bg-purple-50 rounded-lg text-purple-900 border-2 border-purple-100 focus:border-purple-300 focus:ring-0"
                    />

                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-3 py-2 bg-purple-50 rounded-lg text-purple-900 border-2 border-purple-100 focus:border-purple-300 focus:ring-0"
                    >
                      <option value="">All Status</option>
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                {filteredTickets.map((ticket) => (
                  <motion.div
                    key={ticket._id}
                    className="p-4 rounded-lg border-2 border-purple-100 hover:border-purple-200 transition-colors"
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm text-gray-500">
                          Ticket #{ticket._id}
                        </p>
                        <p className="text-lg font-medium text-purple-900 mt-1">
                          {ticket.document}
                        </p>
                        <div className="flex items-center mt-2 space-x-4">
                          <span className="text-sm text-purple-600">
                            Section: {ticket.section}
                          </span>
                          <span className="text-sm text-purple-600">
                            Roll No: {ticket.rollNo}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          ticket.response === "Approved"
                            ? "bg-green-100 text-green-600"
                            : ticket.response === "Rejected"
                            ? "bg-red-100 text-red-600"
                            : "bg-yellow-100 text-yellow-600"
                        }`}
                      >
                        {ticket.response}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center space-x-4">
                      {ticket.file && (
                        <button
                          onClick={() =>
                            handleFileClick(ticket._id, ticket.file)
                          }
                          className="inline-flex items-center px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                        >
                          <File className="w-4 h-4 mr-2" />
                          View File
                        </button>
                      )}

                      {ticket.response === "Pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(ticket._id)}
                            className="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(ticket._id)}
                            className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}

                {filteredTickets.length === 0 && (
                  <div className="text-center py-12">
                    <File className="w-12 h-12 text-purple-200 mx-auto mb-4" />
                    <p className="text-purple-900 font-medium">
                      No tickets found
                    </p>
                    <p className="text-purple-600 text-sm mt-1">
                      Try adjusting your filters
                    </p>
                  </div>
                )}
              </div>
            </Tab.Panel>

            <Tab.Panel>
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Bell className="w-6 h-6 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-purple-900 ml-4">
                    Create Alert
                  </h2>
                </div>

                <div className="space-y-4">
                  <textarea
                    value={alertMessage}
                    onChange={(e) => setAlertMessage(e.target.value)}
                    placeholder="Type your alert message here..."
                    className="w-full px-4 py-3 bg-purple-50 rounded-lg text-purple-900 border-2 border-purple-100 focus:border-purple-300 focus:ring-0 min-h-[120px] resize-none"
                  />

                  <button
                    onClick={handleCreateAlert}
                    className="w-full inline-flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Send Alert
                  </button>
                </div>
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>

        <AnimatePresence>
          {responseMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed bottom-4 right-4 bg-white px-6 py-3 rounded-lg shadow-lg border-l-4 border-green-500"
            >
              <p className="text-green-600">{responseMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedFile && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedFile(null);
                setFileContent(null);
              }}
            >
              <motion.div
                className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-auto"
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-purple-100 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-purple-900">
                    {selectedFile.file}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setFileContent(null);
                    }}
                    className="p-2 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-purple-600" />
                  </button>
                </div>
                <div className="p-6">{renderFileContent()}</div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
