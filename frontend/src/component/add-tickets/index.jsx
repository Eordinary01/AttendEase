import axios from "axios";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaPaperPlane, FaClock, FaCheckCircle, FaExclamationCircle, FaUser, FaIdCard, FaBook, FaUpload, FaFile } from "react-icons/fa";

const API_URL = process.env.REACT_APP_API_URL;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const InputField = ({ id, icon, placeholder, value, onChange, disabled }) => (
  <motion.div 
    className="mb-4 relative"
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <label htmlFor={id} className="block text-gray-300 font-medium mb-2 capitalize">
      {id.replace(/([A-Z])/g, ' $1').trim()}:
    </label>
    <div className="relative">
      {icon}
      <input
        id={id}
        type="text"
        className="w-full pl-10 pr-4 py-2 border-2 border-purple-500 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all duration-300"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  </motion.div>
);

const SubmitButton = ({ isSubmitting, disableSubmit }) => (
  <motion.button
    type="submit"
    className="w-full bg-purple-600 text-white px-6 py-3 rounded-md font-semibold flex items-center justify-center"
    disabled={disableSubmit || isSubmitting}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    animate={disableSubmit || isSubmitting ? { opacity: 0.5 } : { opacity: 1 }}
  >
    <AnimatePresence mode="wait">
      {isSubmitting ? (
        <motion.span
          key="submitting"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center"
        >
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="mr-2"
          >
            <FaPaperPlane />
          </motion.span>
          Submitting...
        </motion.span>
      ) : (
        <motion.span
          key="submit"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center"
        >
          <FaPaperPlane className="mr-2" />
          Submit Ticket
        </motion.span>
      )}
    </AnimatePresence>
  </motion.button>
);

const FileUploadArea = ({ file, setFile }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  return (
    <motion.div
      className={`border-2 border-dashed rounded-lg p-4 text-center ${
        dragActive ? "border-purple-500 bg-purple-100 bg-opacity-10" : "border-gray-300"
      }`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {file ? (
        <div className="flex flex-col items-center">
          <FaFile className="text-4xl text-purple-500 mb-2" />
          <p className="text-sm">{file.name}</p>
          <button
            onClick={() => setFile(null)}
            className="mt-2 text-red-400 hover:text-red-600 transition-colors"
          >
            Remove
          </button>
        </div>
      ) : (
        <>
          <FaUpload className="text-4xl text-purple-500 mx-auto mb-2" />
          <p>Drag and drop your file here, or</p>
          <button
            onClick={onButtonClick}
            className="mt-2 text-purple-400 hover:text-purple-600 transition-colors"
          >
            Select a file
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleChange}
            accept=".pdf,.doc,.docx"
          />
        </>
      )}
    </motion.div>
  );
};

export default function Ticket() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    section: localStorage.getItem("section") || "",
    rollNo: localStorage.getItem("rollNo") || "",
    name: localStorage.getItem("name") || "",
    document: "",
  });
  const [file, setFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(false);
  const [responseStatus, setResponseStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [lastSubmitTime, setLastSubmitTime] = useState(
    localStorage.getItem("lastSubmitTime") || null
  );

  useEffect(() => {
    const localSection = localStorage.getItem("section") || "";
    const localRollNo = localStorage.getItem("rollNo") || "";
    const localName = localStorage.getItem("name") || "";
    setFormData((prevFormData) => ({
      ...prevFormData,
      section: localSection,
      rollNo: localRollNo,
      name: localName,
    }));
  }, []);

  useEffect(() => {
    if (lastSubmitTime) {
      const elapsed = Date.now() - lastSubmitTime;
      if (elapsed < 100000) {
        setDisableSubmit(true);
        const timeout = setTimeout(() => {
          setDisableSubmit(false);
        }, 100000 - elapsed);
        return () => clearTimeout(timeout);
      }
    }
  }, [lastSubmitTime]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleFileChange = (newFile) => {
    if (newFile && newFile.size > MAX_FILE_SIZE) {
      setErrorMessage("File is too large. Maximum size is 5MB.");
      setFile(null);
    } else {
      setErrorMessage(null);
      setFile(newFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
  
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('document', formData.document);
      formDataToSend.append('name', formData.name.toLowerCase());
      if (file) {
        formDataToSend.append('file', file, file.name);
      }
  
      const response = await axios.post(
        `${API_URL}/tickets`,
        formDataToSend,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.status >= 200 && response.status < 300) {
        console.log(response.data);
        setDisableSubmit(true);
        const currentTime = Date.now();
        setLastSubmitTime(currentTime);
        localStorage.setItem("lastSubmitTime", currentTime);
        setResponseStatus(response.data.ticket.response);

        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);

        setTimeout(() => {
          setDisableSubmit(false);
        }, 100000);

        setFormData({
          ...formData,
          document: "",
        });
        setFile(null);
      } else {
        console.error("Error creating ticket:", response.data);
        setResponseStatus("error");
        setErrorMessage(response.data.message || "An error occurred while creating the ticket.");
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      setResponseStatus("error");
      if (error.response) {
        setErrorMessage(error.response.data.message || "An error occurred while creating the ticket.");
      } else if (error.request) {
        setErrorMessage("No response received from the server. Please try again.");
      } else {
        setErrorMessage("An error occurred while creating the ticket. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedTime = lastSubmitTime
    ? new Date(parseInt(lastSubmitTime)).toLocaleString()
    : "";

  return (
    <div className="bg-gradient-to-br from-gray-900 to-purple-900 text-white min-h-screen flex flex-col justify-center items-center p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md"
      >
        <h2 className="text-3xl font-bold mb-6 text-center text-purple-300">Create Ticket</h2>
        <form onSubmit={handleSubmit}>
          <InputField
            id="section"
            icon={<FaBook className="absolute top-3 left-3 text-purple-400" />}
            placeholder="Enter your section"
            value={formData.section}
            onChange={handleChange}
            disabled
          />
          <InputField
            id="rollNo"
            icon={<FaIdCard className="absolute top-3 left-3 text-purple-400" />}
            placeholder="Enter your roll number"
            value={formData.rollNo}
            onChange={handleChange}
            disabled
          />
          <InputField
            id="name"
            icon={<FaUser className="absolute top-3 left-3 text-purple-400" />}
            placeholder="Enter your name"
            value={formData.name}
            onChange={handleChange}
            disabled
          />
          <motion.div 
            className="mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <label htmlFor="document" className="block text-gray-300 font-medium mb-2">
              Document:
            </label>
            <textarea
              id="document"
              className="w-full px-4 py-2 border-2 border-purple-500 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all duration-300 h-32 resize-none"
              placeholder="Enter your document details"
              value={formData.document}
              onChange={handleChange}
              disabled={disableSubmit}
            />
          </motion.div>
          <motion.div 
            className="mb-6"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <label className="block text-gray-300 font-medium mb-2">
              Upload File:
            </label>
            <FileUploadArea file={file} setFile={handleFileChange} />
          </motion.div>
          <SubmitButton isSubmitting={isSubmitting} disableSubmit={disableSubmit} />
        </form>
        <AnimatePresence>
          {disableSubmit && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-red-400 mt-4 flex items-center"
            >
              <FaExclamationCircle className="mr-2" />
              You cannot raise another ticket at this time.
            </motion.div>
          )}
        </AnimatePresence>
        {lastSubmitTime && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-gray-400 mt-4 flex items-center"
          >
            <FaClock className="mr-2" />
            Last submit time: {formattedTime}
          </motion.div>
        )}
        <AnimatePresence>
          {responseStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mt-4 flex items-center ${
                responseStatus === "error" ? "text-red-400" : "text-green-400"
              }`}
            >
              {responseStatus === "error" ? (
                <FaExclamationCircle className="mr-2" />
              ) : (
                <FaCheckCircle className="mr-2" />
              )}
              Ticket Status: {responseStatus}
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-red-400 mt-4 flex items-center"
            >
              <FaExclamationCircle className="mr-2" />
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}