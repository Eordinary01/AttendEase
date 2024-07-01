import { useEffect, useState } from "react";
import axios from "axios";
import Calendar from "react-calendar";
import { motion, AnimatePresence } from "framer-motion";
import { FaFilter, FaBell, FaCalendarAlt, FaTicketAlt, FaCheck, FaTimes, FaFile, FaImage } from "react-icons/fa";

export default function TeacherDashboard() {
  const [tickets, setTickets] = useState([]);
  const [responseMessage, setResponseMessage] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterRollNo, setFilterRollNo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [attendance, setAttendance] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attendanceData, setAttendanceData] = useState({});
  const [token, setToken] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tickets");
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);

  const POLLING_INTERVAL = 5000;
  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const response = await axios.get(`${API_URL}/tickets`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setTickets(response.data);
      } catch (error) {
        console.error("Error fetching tickets:", error);
      }
    };

    const fetchAttendance = async () => {
      try {
        const response = await axios.get(`${API_URL}/attendance`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setAttendance(response.data);
      } catch (error) {
        console.error("Error fetching attendance:", error);
      }
    };

    if (token) {
      fetchTickets();
      fetchAttendance();
      const intervalId = setInterval(fetchTickets, POLLING_INTERVAL);
      return () => clearInterval(intervalId);
    }
  }, [token, API_URL]);

  const handleApprove = async (ticketId) => {
    try {
      const response = await axios.put(
        `${API_URL}/tickets/${ticketId}/approve`,
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
        `${API_URL}/tickets/${ticketId}/reject`,
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

  const handleRollNoFilterChange = (event) => {
    setFilterRollNo(event.target.value);
  };

  const handleStatusFilterChange = (event) => {
    setFilterStatus(event.target.value);
  };

  const handleAlertMessageChange = (event) => {
    setAlertMessage(event.target.value);
  };

  const handleCreateAlert = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/alerts`,
        { message: alertMessage },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setResponseMessage(response.data.message);
      setAlertMessage("");
      setTimeout(() => {
        setResponseMessage("");
      }, 5000);
    } catch (error) {
      console.error("Error creating alert:", error);
    }
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleAttendanceChange = (event, studentId, subject) => {
    const { checked } = event.target;
    setAttendanceData((prevAttendanceData) => ({
      ...prevAttendanceData,
      [studentId]: {
        ...prevAttendanceData[studentId],
        [subject]: checked,
      },
    }));
  };

  const handleUpdateAttendance = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/attendance`,
        { date: selectedDate, data: attendanceData },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setResponseMessage(response.data.message);
      setTimeout(() => {
        setResponseMessage("");
      }, 5000);
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
  };

  const handleFileClick = async (ticketId, file) => {
    try {
      const response = await axios.get(`${API_URL}/tickets/${ticketId}/file`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const fileExtension = file.split('.').pop().toLowerCase();
      const fileType = response.headers['content-type'];

      if (fileType.startsWith('image/')) {
        const imageUrl = URL.createObjectURL(response.data);
        setFileContent({ type: 'image', content: imageUrl });
      } else if (fileType === 'application/pdf') {
        const pdfUrl = URL.createObjectURL(response.data);
        setFileContent({ type: 'pdf', content: pdfUrl });
      } else if (fileType === 'application/zip' || 
                 fileType.includes('officedocument') ||
                 fileType === 'application/octet-stream') {
        const downloadUrl = URL.createObjectURL(response.data);
        setFileContent({ type: 'download', content: downloadUrl, fileName: file });
      } else {
        // Attempt to read as text, but have a fallback for binary files
        try {
          const textContent = await response.data.text();
          setFileContent({ type: 'text', content: textContent });
        } catch (error) {
          const downloadUrl = URL.createObjectURL(response.data);
          setFileContent({ type: 'download', content: downloadUrl, fileName: file });
        }
      }
      
      setSelectedFile({ ticketId, file });
    } catch (error) {
      console.error('Error fetching file:', error);
      setFileContent({ type: 'error', content: 'Error loading file' });
    }
  };

  const renderFileContent = () => {
    if (!fileContent) return null;

    switch (fileContent.type) {
      case 'image':
        return <img src={fileContent.content} alt="Uploaded file" className="max-w-full h-auto" />;
      case 'pdf':
        return (
          <iframe
            src={fileContent.content}
            title="PDF Viewer"
            width="100%"
            height="600px"
            style={{ border: 'none' }}
          />
        );
      case 'text':
        return <pre className="whitespace-pre-wrap">{fileContent.content}</pre>;
      case 'download':
        return (
          <div>
            <p className="my-7">This file type cannot be displayed in the browser.</p>
            <a 
              href={fileContent.content} 
              download={fileContent.fileName}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Download File
            </a>
          </div>
        );
      case 'error':
        return <p className="text-red-500">{fileContent.content}</p>;
      default:
        return <p>Unsupported file type</p>;
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    return (
      (filterSection ? ticket.section === filterSection : true) &&
      (filterRollNo ? ticket.rollNo.includes(filterRollNo) : true) &&
      (filterStatus ? ticket.response === filterStatus : true)
    );
  });

  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  return (
    <motion.div 
      className="bg-gradient-to-br from-gray-900 to-gray-800 text-white min-h-screen flex flex-col items-center py-8 px-4"
      initial="hidden"
      animate="visible"
      variants={fadeIn}
    >
      <AnimatePresence>
        {responseMessage && (
          <motion.div 
            className="bg-green-500 text-white p-4 rounded-md mb-4 fixed top-4 right-4 z-50"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
          >
            {responseMessage}
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-4xl">
        <h1 className="text-3xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Teacher's Dashboard
        </h1>
        
        <div className="flex justify-center mb-6">
          <button
            className={`px-4 py-2 rounded-l-lg transition-colors duration-300 ${activeTab === 'tickets' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            onClick={() => setActiveTab('tickets')}
          >
            <FaTicketAlt className="inline mr-2" /> Tickets
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg transition-colors duration-300 ${activeTab === 'alerts' ? 'bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            onClick={() => setActiveTab('alerts')}
          >
            <FaBell className="inline mr-2" /> Alerts
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'tickets' && (
            <motion.div
              key="tickets"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Tickets</h2>
                <button
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-full flex items-center transition-colors duration-300"
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                >
                  <FaFilter className="mr-2" /> Filter
                </button>
              </div>

              <AnimatePresence>
                {isFilterOpen && (
                  <motion.div 
                    className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div>
                      <label htmlFor="filterSection" className="block mb-2">Section:</label>
                      <select
                        id="filterSection"
                        value={filterSection}
                        onChange={handleFilterChange}
                        className="w-full bg-gray-700 text-white p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">All</option>
                        {[...new Set(tickets.map((ticket) => ticket.section))].map(
                          (section) => (
                            <option key={section} value={section}>
                              {section}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="filterRollNo" className="block mb-2">Roll No:</label>
                      <input
                        type="text"
                        id="filterRollNo"
                        value={filterRollNo}
                        onChange={handleRollNoFilterChange}
                        className="w-full bg-gray-700 text-white p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        placeholder="Enter Roll No"
                      />
                    </div>
                    <div>
                      <label htmlFor="filterStatus" className="block mb-2">Status:</label>
                      <select
                        id="filterStatus"
                        value={filterStatus}
                        onChange={handleStatusFilterChange}
                        className="w-full bg-gray-700 text-white p-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      >
                        <option value="">All</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {filteredTickets.length === 0 ? (
                <p className="text-gray-400">No tickets available</p>
              ) : (
                <ul className="space-y-4">
                  {filteredTickets.map((ticket) => (
                    <motion.li
                      key={ticket._id}
                      className="bg-gray-700 p-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <p>
                        <span className="font-semibold">Ticket ID:</span>{" "}
                        <span className="text-purple-400">{ticket._id}</span>
                      </p>
                      <p>
                        <span className="font-semibold">Roll No:</span>{" "}
                        <span className="text-purple-400">{ticket.rollNo}</span>
                      </p>
                      <p>
                        <span className="font-semibold">Section:</span>{" "}
                        <span className="text-purple-400">{ticket.section}</span>
                      </p>
                      <p>
                        <span className="font-semibold">Description:</span>{" "}
                        {ticket.document}
                      </p>
                      <p>
                        <span className="font-semibold">Response:</span>{" "}
                        <span className={`font-semibold ${
                          ticket.response === "Approved" ? "text-green-400" :
                          ticket.response === "Rejected" ? "text-red-400" :
                          "text-yellow-400"
                        }`}>
                          {ticket.response}
                        </span>
                      </p>
                      {ticket.file && (
                        <button
                          className="mt-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-full flex items-center transition-colors duration-300"
                          onClick={() => handleFileClick(ticket._id, ticket.file)}
                        >
                          <FaFile className="mr-2" /> View File
                        </button>
                      )}
                      {ticket.response === "Pending" && (
                        <div className="mt-4 flex space-x-4">
                          <button
                            className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-full flex items-center transition-colors duration-300"
                            onClick={() => handleApprove(ticket._id)}
                          >
                            <FaCheck className="mr-2" /> Approve
                          </button>
                          <button
                            className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-full flex items-center transition-colors duration-300"
                            onClick={() => handleReject(ticket._id)}
                          >
                            <FaTimes className="mr-2" /> Reject
                          </button>
                        </div>
                      )}
                    </motion.li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <FaBell className="mr-2" /> Create Alert
              </h2>
              <textarea
                value={alertMessage}
                onChange={handleAlertMessageChange}
                className="w-full p-4 mb-4 bg-gray-700 text-white rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Enter alert message"
                rows="4"
              />
              <button
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-full transition-colors duration-300"
                onClick={handleCreateAlert}
              >
                Create Alert
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedFile && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setSelectedFile(null);
              setFileContent(null);
            }}
          >
            <motion.div
              className="bg-gray-800 p-6 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto"
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
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-full transition-colors duration-300"
                >
                  Close
                </button>
              </div>
              {renderFileContent()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}