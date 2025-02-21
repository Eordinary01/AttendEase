import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  User,
  BookOpen,
  IdCard,
  Upload,
  FileText,
  X
} from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const InputField = ({ id, icon: Icon, label, value, onChange, disabled }) => (
  <div className="flex-1">
    <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
      {label}
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <input
        id={id}
        type="text"
        className={`
          w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-600 rounded-lg
          text-gray-100 transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500
          disabled:opacity-50 disabled:bg-gray-700
        `}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  </div>
);

const FileUploadArea = ({ file, setFile }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) setFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`
        relative h-full min-h-[200px] rounded-lg border-2 border-dashed
        transition-all duration-200
        ${dragActive ? 'border-violet-500 bg-violet-500/10' : 'border-gray-600'}
      `}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
        accept=".pdf,.doc,.docx"
      />
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="h-10 w-10 text-violet-500" />
            <p className="text-sm text-gray-300">{file.name}</p>
            <button
              onClick={() => setFile(null)}
              className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-violet-500 mb-2" />
            <p className="text-sm text-gray-300 mb-2">Drag and drop your file here, or</p>
            <button
              onClick={() => inputRef.current?.click()}
              className="text-violet-500 hover:text-violet-400 transition-colors"
            >
              Select a file
            </button>
          </>
        )}
      </div>
    </div>
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
    setFormData((prev) => ({
      ...prev,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
  
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("document", formData.document);
      formDataToSend.append("name", formData.name.toLowerCase());
      if (file) {
        formDataToSend.append("file", file);
      }
  
      const response = await fetch(`${API_URL}/tickets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formDataToSend,
      });
  
      const data = await response.json();
  
      if (response.ok) {
        setDisableSubmit(true);
        const currentTime = Date.now();
        setLastSubmitTime(currentTime);
        localStorage.setItem("lastSubmitTime", currentTime);
        setResponseStatus("success");
  
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
  
        setFormData({ ...formData, document: "" });
        setFile(null);
      } else {
        setResponseStatus("error");
        setErrorMessage(data.message || "An error occurred while creating the ticket.");
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
  
      // Extract and stringify error details if error is an object
      const errorDetails = error?.message || JSON.stringify(error);
      setResponseStatus("error");
      setErrorMessage(`An error occurred: ${errorDetails}`);
    } finally {
      setIsSubmitting(false);
    }
  };
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-violet-900 p-6">
      <div className="max-w-6xl mx-auto bg-gray-900/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-violet-300">Create Support Ticket</h1>
            {lastSubmitTime && (
              <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded-full">
                <Clock className="h-4 w-4" />
                <span>Last submitted: {new Date(parseInt(lastSubmitTime)).toLocaleString()}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex gap-6">
              <InputField
                id="section"
                icon={BookOpen}
                label="Section"
                value={formData.section}
                onChange={handleChange}
                disabled
              />
              <InputField
                id="rollNo"
                icon={IdCard}
                label="Roll Number"
                value={formData.rollNo}
                onChange={handleChange}
                disabled
              />
              <InputField
                id="name"
                icon={User}
                label="Name"
                value={formData.name}
                onChange={handleChange}
                disabled
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Document Details
                </label>
                <textarea
                  id="document"
                  className={`
                    w-full h-[200px] px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg
                    text-gray-100 resize-none transition-all duration-200
                    focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500
                    disabled:opacity-50 disabled:bg-gray-700
                  `}
                  value={formData.document}
                  onChange={handleChange}
                  disabled={disableSubmit}
                  placeholder="Enter your document details here..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Upload File
                </label>
                <FileUploadArea file={file} setFile={setFile} />
              </div>
            </div>

            <div className="flex justify-end items-center gap-4">
              {errorMessage && (
                <div className="flex items-center text-red-400 text-sm">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {errorMessage}
                </div>
              )}
              
              <button
                type="submit"
                disabled={disableSubmit || isSubmitting}
                className={`
                  px-6 py-2 bg-violet-600 rounded-lg font-medium flex items-center gap-2
                  transition-all duration-200
                  hover:bg-violet-700
                  disabled:opacity-50 disabled:hover:bg-violet-600
                  focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-gray-900
                `}
                title={disableSubmit ? "Please wait before submitting another ticket" : "Submit ticket"}
              >
                {isSubmitting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Send className="h-4 w-4" />
                    </motion.div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit Ticket
                  </>
                )}
              </button>
            </div>

            {responseStatus && (
              <div className={`flex items-center gap-2 ${
                responseStatus === "error" ? "text-red-400" : "text-green-400"
              }`}>
                {responseStatus === "error" ? 
                  <AlertCircle className="h-4 w-4" /> : 
                  <CheckCircle className="h-4 w-4" />
                }
                Status: {responseStatus}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}