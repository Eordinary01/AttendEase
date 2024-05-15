import axios from "axios";
import React, { useState, useEffect } from "react";

export default function Ticket() {
  const [formData, setFormData] = useState({
    section: localStorage.getItem("section") || "",
    rollNo: localStorage.getItem("rollNo") || "",
    document: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(false);
  // const [lastSubmitTime, setLastSubmitTime] = useState(null);

  // Extract localStorage items to variables
  const localSection = localStorage.getItem("section") || "";
  const localRollNo = localStorage.getItem("rollNo") || "";

  useEffect(() => {
    setFormData((prevFormData) => ({
      ...prevFormData,
      section: localSection,
      rollNo: localRollNo,
    }));
  }, [localSection, localRollNo]); // Use variables in the dependency array

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await axios.post(
        "http://localhost:8011/api/tickets",
        formData
      );
      console.log(response.data);
      setDisableSubmit(true);
      setLastSubmitTime(Date.now());
      localStorage.setItem("lastSubmitTime", Date.now());

      setTimeout(() => {
        setDisableSubmit(false);
      }, 100000); // Enable submit button after 1 second
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

  const [lastSubmitTime, setLastSubmitTime] = useState(
    localStorage.getItem("lastSubmitTime") || null
  );

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

  const formattedTime = new Date(lastSubmitTime).toLocaleString();

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
              disabled={disableSubmit}
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
      </div>
    </div>
  );
}
