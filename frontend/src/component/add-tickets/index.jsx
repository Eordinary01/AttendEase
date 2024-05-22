import axios from "axios";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Ticket() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    section: localStorage.getItem("section") || "",
    rollNo: localStorage.getItem("rollNo") || "",
    document: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(false);
  const [responseStatus, setResponseStatus] = useState(null);
  const [lastSubmitTime, setLastSubmitTime] = useState(
    localStorage.getItem("lastSubmitTime") || null
  );

  useEffect(() => {
    const localSection = localStorage.getItem("section") || "";
    const localRollNo = localStorage.getItem("rollNo") || "";
    setFormData((prevFormData) => ({
      ...prevFormData,
      section: localSection,
      rollNo: localRollNo,
    }));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await axios.post(
        "http://localhost:8011/api/tickets",
        { document: formData.document },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      console.log(response.data);
      setDisableSubmit(true);
      const currentTime = Date.now();
      setLastSubmitTime(currentTime);
      localStorage.setItem("lastSubmitTime", currentTime);
      setResponseStatus(response.data.ticket.response);

      navigate("/dashboard");

      setTimeout(() => {
        setDisableSubmit(false);
      }, 100000); // Enable submit button after 100 seconds

      setFormData({
        section: localStorage.getItem("section") || "",
        rollNo: localStorage.getItem("rollNo") || "",
        document: "",
      });
    } catch (error) {
      console.error("Error creating ticket:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const formattedTime = lastSubmitTime
    ? new Date(parseInt(lastSubmitTime)).toLocaleString()
    : "";

  return (
    <div className="bg-gray-900 text-white h-screen flex flex-col justify-center items-center">
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4">Create Ticket:</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="section"
              className="block text-gray-300 font-medium"
            >
              Section:
            </label>
            <input
              id="section"
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
              placeholder="Enter your section"
              value={formData.section}
              onChange={handleChange}
              disabled
            />
          </div>
          <div className="mb-4">
            <label htmlFor="rollNo" className="block text-gray-300 font-medium">
              Roll No:
            </label>
            <input
              id="rollNo"
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
              placeholder="Enter your roll no"
              value={formData.rollNo}
              onChange={handleChange}
              disabled
            />
          </div>
          <div className="mb-4">
            <label
              htmlFor="document"
              className="block text-gray-300 font-medium"
            >
              Document:
            </label>
            <textarea
              id="document"
              className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
              placeholder="Enter your document details"
              value={formData.document}
              onChange={handleChange}
              disabled={disableSubmit}
            ></textarea>
          </div>
          <button
            type="submit"
            className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors duration-300"
            disabled={disableSubmit || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </form>
        {disableSubmit && (
          <div className="text-red-500 mt-4">
            You cannot raise another ticket at this time.
          </div>
        )}
        {lastSubmitTime && (
          <div className="text-gray-500 mt-4">
            Last submit time: {formattedTime}
          </div>
        )}
        {responseStatus && (
          <div className="text-green-500 mt-4">
            Ticket Status: {responseStatus}
          </div>
        )}
      </div>
    </div>
  );
}
