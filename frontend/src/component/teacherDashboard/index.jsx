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
  Search,
  Download,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Image,
  Archive,
  RefreshCw,
  Send,
  TrendingUp,
  Activity,
  Ticket,
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
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [verificationStats, setVerificationStats] = useState(null);

  const POLLING_INTERVAL = 30000; // 30 seconds
  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      console.log("✅ Teacher token found:", storedToken.substring(0, 20) + "...");
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const config = {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };

        // Fetch pending tickets - UPDATED ENDPOINT
        const ticketsResponse = await axios.get(`${API_URL}/tickets/teacher/pending`, config);
        console.log("✅ Teacher tickets response:", ticketsResponse.data);
        setTickets(Array.isArray(ticketsResponse.data?.tickets) ? ticketsResponse.data.tickets : []);

        // Fetch verification stats - NEW ENDPOINT
        const statsResponse = await axios.get(`${API_URL}/tickets/teacher/stats`, config);
        console.log("✅ Teacher stats response:", statsResponse.data);
        setVerificationStats(statsResponse.data?.stats);

      } catch (error) {
        console.error("❌ Error fetching teacher data:", error);
        if (error.response?.status === 401) {
          console.error("Authentication failed, clearing token");
          localStorage.removeItem("token");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchData();
      const intervalId = setInterval(fetchData, POLLING_INTERVAL);
      return () => clearInterval(intervalId);
    }
  }, [token, API_URL]);

  const handleVerify = async (ticketId, verificationStatus, verificationRemarks = "") => {
    try {
      const response = await axios.put(
        `${API_URL}/api/tickets/${ticketId}/verify`,
        { verificationStatus, verificationRemarks },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      setResponseMessage(response.data.message);
      
      // Update local state
      setTickets(prevTickets => 
        prevTickets.map(ticket => 
          ticket.id === ticketId 
            ? { 
                ...ticket, 
                verificationStatus: verificationStatus,
                status: verificationStatus === 'verified' ? 'verified' : 
                       verificationStatus === 'rejected' ? 'rejected' : 'under-review'
              } 
            : ticket
        )
      );
      
      setTimeout(() => setResponseMessage(""), 5000);
    } catch (error) {
      console.error("Error verifying ticket:", error);
      setResponseMessage(error.response?.data?.message || "Error verifying ticket");
    }
  };

  const handleMarkAttendance = async (ticketId) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/tickets/${ticketId}/mark-attendance`,
        {},
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      setResponseMessage(response.data.message);
      
      // Update local state
      setTickets(prevTickets => 
        prevTickets.map(ticket => 
          ticket.id === ticketId 
            ? { 
                ...ticket, 
                attendanceMarked: true,
                status: 'attendance-updated'
              } 
            : ticket
        )
      );
      
      setTimeout(() => setResponseMessage(""), 5000);
    } catch (error) {
      console.error("Error marking attendance:", error);
      setResponseMessage(error.response?.data?.message || "Error marking attendance");
    }
  };

  const handleAddNote = async (ticketId, noteContent) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/tickets/${ticketId}/notes`,
        { content: noteContent },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      
      setResponseMessage("Note added successfully");
      setTimeout(() => setResponseMessage(""), 5000);
    } catch (error) {
      console.error("Error adding note:", error);
      setResponseMessage(error.response?.data?.message || "Error adding note");
    }
  };

  const handleCreateAlert = async () => {
    try {
      setIsLoading(true);
      const response = await axios.post(
        `${API_URL}/api/alerts`,
        { message: alertMessage },
        { 
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      setResponseMessage(response.data.message);
      setAlertMessage("");
      setTimeout(() => setResponseMessage(""), 5000);
    } catch (error) {
      console.error("Error creating alert:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileClick = async (ticketId, file) => {
    try {
      setIsLoading(true);
      // Extract fileId from file object
      const fileId = file.id || file._id;
      
      const response = await axios.get(`${API_URL}/api/tickets/${ticketId}/files/${fileId}`, {
        headers: { 
          'Authorization': `Bearer ${token}` 
        },
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
      } else {
        setFileContent({
          type: "download",
          content: URL.createObjectURL(response.data),
          fileName: file.originalName || file.filename,
        });
      }
      setSelectedFile({ ticketId, file });
    } catch (error) {
      console.error("Error fetching file:", error);
      setFileContent({ type: "error", content: "Error loading file" });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch = 
      ticket.reasonDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.student?.rollNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.student?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return (
      matchesSearch &&
      (filterSection ? ticket.student?.section === filterSection : true) &&
      (filterRollNo ? ticket.student?.rollNo?.includes(filterRollNo) : true) &&
      (filterStatus ? ticket.verificationStatus === filterStatus : true)
    );
  });

  const getFileIcon = (file) => {
    const fileName = file?.originalName || file?.filename || "";
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FileText className="w-4 h-4" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <Image className="w-4 h-4" />;
      case 'zip':
      case 'rar':
        return <Archive className="w-4 h-4" />;
      default:
        return <File className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (verificationStatus) => {
    switch (verificationStatus) {
      case 'verified':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      case 'needs-more-info':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (verificationStatus) => {
    switch (verificationStatus) {
      case 'verified':
        return "bg-green-100 text-green-700";
      case 'rejected':
        return "bg-red-100 text-red-700";
      case 'needs-more-info':
        return "bg-yellow-100 text-yellow-700";
      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  const getStatusText = (verificationStatus) => {
    switch (verificationStatus) {
      case 'verified':
        return "Verified";
      case 'rejected':
        return "Rejected";
      case 'needs-more-info':
        return "Needs More Info";
      default:
        return "Pending";
    }
  };

  const renderFileContent = () => {
    if (!fileContent) return null;

    switch (fileContent.type) {
      case "image":
        return (
          <div className="flex justify-center">
            <img
              src={fileContent.content}
              alt="Uploaded file"
              className="max-w-full h-auto rounded-lg shadow-sm"
            />
          </div>
        );
      case "pdf":
        return (
          <iframe
            src={fileContent.content}
            title="PDF Viewer"
            className="w-full h-96 rounded-lg"
          />
        );
      case "download":
        return (
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Download className="w-8 h-8 text-purple-600" />
            </div>
            <p className="text-gray-600 mb-4">
              This file type cannot be displayed in the browser.
            </p>
            <a
              href={fileContent.content}
              download={fileContent.fileName}
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <Download className="w-4 h-4 mr-2" />
              Download File
            </a>
          </div>
        );
      case "error":
        return (
          <div className="text-center p-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-red-600">{fileContent.content}</p>
          </div>
        );
      default:
        return <p className="text-center text-gray-500 p-8">Unsupported file type</p>;
    }
  };

  const stats = verificationStats || {
    totalTickets: 0,
    pendingTickets: 0,
    verifiedTickets: 0,
    rejectedTickets: 0,
    needsMoreInfoTickets: 0,
    attendanceMarkedCount: 0
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.header 
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-900 to-indigo-900 bg-clip-text text-transparent">
                Teacher Dashboard
              </h1>
              <p className="text-slate-600 mt-2 text-lg">
                Verify absence proofs and manage attendance
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full shadow-sm">
                <Activity className="w-4 h-4 text-green-500" />
                <span className="text-sm text-slate-600">Live Updates</span>
              </div>
              {isLoading && (
                <div className="flex items-center space-x-2 bg-purple-100 px-4 py-2 rounded-full">
                  <RefreshCw className="w-4 h-4 text-purple-600 animate-spin" />
                  <span className="text-sm text-purple-600">Loading...</span>
                </div>
              )}
            </div>
          </div>
        </motion.header>

        {/* Stats Cards */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Tickets</p>
                <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalTickets}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Ticket className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">Pending</span>
                <span className="font-medium">{stats.pendingTickets}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-slate-600">Verified</span>
                <span className="font-medium text-green-600">{stats.verifiedTickets}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Rejected</span>
                <span className="font-medium text-red-600">{stats.rejectedTickets}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Needs More Info</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{stats.needsMoreInfoTickets}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <div className="mt-4 text-sm">
              <span className="text-slate-500">Requires follow-up from students</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-100 hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Attendance Marked</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.attendanceMarkedCount}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 text-sm">
              <span className="text-green-600">
                {stats.verifiedTickets > 0 
                  ? Math.round((stats.attendanceMarkedCount / stats.verifiedTickets) * 100) 
                  : 0}% of verified tickets
              </span>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Tab.Group>
            <Tab.List className="flex space-x-2 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
              <Tab
                className={({ selected }) =>
                  `flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    selected
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                <div className="flex items-center justify-center space-x-2">
                  <Ticket className="w-4 h-4" />
                  <span>Absence Proofs</span>
                </div>
              </Tab>
              <Tab
                className={({ selected }) =>
                  `flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-200 ${
                    selected
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`
                }
              >
                <div className="flex items-center justify-center space-x-2">
                  <Bell className="w-4 h-4" />
                  <span>Alerts</span>
                </div>
              </Tab>
            </Tab.List>

            <Tab.Panels className="bg-white rounded-2xl shadow-sm border border-slate-100">
              <Tab.Panel className="p-8">
                {/* Tickets Header */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Manage Absence Proofs</h2>
                    <p className="text-slate-600 mt-1">Verify student absence documentation</p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by student or reason..."
                        className="pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-slate-900 border border-slate-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 focus:outline-none transition-all duration-200"
                      />
                    </div>
                    
                    {/* Filter Button */}
                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={`inline-flex items-center px-4 py-2 rounded-xl font-medium transition-all duration-200 ${
                        isFilterOpen
                          ? "bg-purple-600 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      Filters
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <AnimatePresence>
                  {isFilterOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Section</label>
                        <select
                          value={filterSection}
                          onChange={(e) => setFilterSection(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-lg text-slate-900 border border-slate-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 focus:outline-none transition-all duration-200"
                        >
                          <option value="">All Sections</option>
                          {[...new Set(tickets.map(t => t.student?.section))].map(
                            (section) => (
                              <option key={section} value={section}>
                                {section}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Verification Status</label>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-lg text-slate-900 border border-slate-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 focus:outline-none transition-all duration-200"
                        >
                          <option value="">All Status</option>
                          <option value="pending">Pending</option>
                          <option value="verified">Verified</option>
                          <option value="rejected">Rejected</option>
                          <option value="needs-more-info">Needs More Info</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Absence Reason</label>
                        <select
                          value={filterRollNo}
                          onChange={(e) => setFilterRollNo(e.target.value)}
                          className="w-full px-3 py-2 bg-white rounded-lg text-slate-900 border border-slate-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 focus:outline-none transition-all duration-200"
                        >
                          <option value="">All Reasons</option>
                          <option value="medical">Medical</option>
                          <option value="family-emergency">Family Emergency</option>
                          <option value="institutional-work">Institutional Work</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tickets List */}
                <div className="space-y-4">
                  {filteredTickets.map((ticket, index) => (
                    <motion.div
                      key={ticket.id || ticket._id}
                      className="group p-6 rounded-xl border border-slate-200 hover:border-purple-200 hover:shadow-md transition-all duration-200 bg-white"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ y: -2 }}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.verificationStatus)}`}>
                              {getStatusIcon(ticket.verificationStatus)}
                              <span>{getStatusText(ticket.verificationStatus)}</span>
                            </span>
                            <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-1 rounded">
                              {ticket.reason || 'No reason'}
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-purple-600 transition-colors duration-200">
                            {ticket.student?.name || 'Unknown Student'}
                          </h3>
                          
                          <div className="flex items-center space-x-6 text-sm text-slate-600 mb-3">
                            <div className="flex items-center space-x-1">
                              <Users className="w-4 h-4" />
                              <span>Section {ticket.student?.section || 'N/A'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="font-mono">Roll: {ticket.student?.rollNo || 'N/A'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{new Date(ticket.absentDate).toLocaleDateString()}</span>
                            </div>
                          </div>

                          <p className="text-slate-700 bg-slate-50 p-3 rounded-lg text-sm mb-3">
                            {ticket.reasonDescription || 'No description provided'}
                          </p>
                          
                          {/* Documents */}
                          {ticket.documentsCount > 0 && (
                            <div className="flex items-center space-x-2 mb-3">
                              <span className="text-sm text-slate-600">Documents:</span>
                              <div className="flex flex-wrap gap-2">
                                {ticket.documents?.map((doc, idx) => (
                                  <button
                                    key={doc.id || idx}
                                    onClick={() => handleFileClick(ticket.id || ticket._id, doc)}
                                    className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-all duration-200 text-xs"
                                  >
                                    {getFileIcon(doc)}
                                    <span className="ml-2 truncate max-w-[100px]">
                                      {doc.originalName || `Document ${idx + 1}`}
                                    </span>
                                  </button>
                                )) || (
                                  <span className="text-sm text-slate-500">
                                    {ticket.documentsCount} document(s)
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <div className="text-sm text-slate-500">
                          Submitted: {new Date(ticket.createdAt).toLocaleString()}
                        </div>

                        {ticket.verificationStatus === 'pending' || ticket.verificationStatus === 'needs-more-info' ? (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleVerify(ticket.id || ticket._id, 'verified')}
                              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Verify
                            </button>
                            <button
                              onClick={() => handleVerify(ticket.id || ticket._id, 'rejected')}
                              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Reject
                            </button>
                            <button
                              onClick={() => handleVerify(ticket.id || ticket._id, 'needs-more-info', 'Please provide more information')}
                              className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                            >
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Need More Info
                            </button>
                          </div>
                        ) : ticket.verificationStatus === 'verified' && !ticket.attendanceMarked ? (
                          <button
                            onClick={() => handleMarkAttendance(ticket.id || ticket._id)}
                            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark Attendance
                          </button>
                        ) : (
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(ticket.verificationStatus)}`}>
                            {getStatusText(ticket.verificationStatus)}
                            {ticket.attendanceMarked && " (Attendance Marked)"}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {filteredTickets.length === 0 && (
                    <motion.div 
                      className="text-center py-16"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Ticket className="w-10 h-10 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">No absence proofs found</h3>
                      <p className="text-slate-600">
                        {searchQuery || filterSection || filterRollNo || filterStatus
                          ? "Try adjusting your search or filters"
                          : "No absence proof requests pending"}
                      </p>
                    </motion.div>
                  )}
                </div>
              </Tab.Panel>

              {/* Alerts Tab remains the same */}
              <Tab.Panel className="p-8">
                <div className="max-w-2xl mx-auto">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bell className="w-8 h-8 text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Create Alert</h2>
                    <p className="text-slate-600">Send important notifications to all students</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Alert Message
                      </label>
                      <textarea
                        value={alertMessage}
                        onChange={(e) => setAlertMessage(e.target.value)}
                        placeholder="Type your alert message here..."
                        className="w-full px-4 py-3 bg-slate-50 rounded-xl text-slate-900 border border-slate-200 focus:border-purple-300 focus:ring-2 focus:ring-purple-100 focus:outline-none min-h-[120px] resize-none transition-all duration-200"
                      />
                    </div>

                    <button
                      onClick={handleCreateAlert}
                      disabled={!alertMessage.trim() || isLoading}
                      className="w-full inline-flex items-center justify-center px-6 py-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-5 h-5 mr-2" />
                      )}
                      Send Alert
                    </button>
                  </div>
                </div>
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </motion.div>

        {/* Success Message */}
        <AnimatePresence>
          {responseMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="fixed bottom-6 right-6 bg-white px-6 py-4 rounded-xl shadow-lg border-l-4 border-green-500 max-w-sm"
            >
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                <p className="text-green-700 font-medium">{responseMessage}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Modal */}
        <AnimatePresence>
          {selectedFile && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedFile(null);
                setFileContent(null);
              }}
            >
              <motion.div
                className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(selectedFile.file)}
                    <h3 className="text-lg font-semibold text-slate-900">
                      {selectedFile.file?.originalName || selectedFile.file?.filename || 'Document'}
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setFileContent(null);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                  >
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
                  {renderFileContent()}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}