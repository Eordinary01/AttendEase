import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const NewLogin = ({ onLogin, setIsRegistered }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    section: "",
    role: "",
    rollNo: "",
  });
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Convert to lowercase
      const email = formData.email.toLowerCase();
      const password = formData.password.toLowerCase();
      const section = formData.section.toLowerCase();
      const role = formData.role.toLowerCase();
      const rollNo = formData.rollNo.toLowerCase();

      const response = await axios.post("https://attendease-gajo.onrender.com/api/login", {
        email,
        password,
        section,
        role,
        rollNo,
      });
      const { token } = response.data;
      onLogin(token, role);

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("role", role);
      localStorage.setItem("section", section);
      localStorage.setItem("rollNo", rollNo);

      if (role === "teacher" || role === "student") {
        setIsRegistered(true);
      }

      setMessage("Login successful! Redirecting to dashboard...");
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error logging in:", error);
      if (error.response) {
        setMessage(`Error: ${error.response.data.message}`);
        setTimeout(() => {
          setMessage("");
        }, 3000);
      } else {
        setMessage("An unknown error occurred. Please try again later.");
        setTimeout(() => {
          setMessage("");
        }, 3000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="bg-gray-900 text-white h-screen flex flex-col justify-center items-center">
        <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-semibold mb-4">Login</h2>
          {isLoading ? (
            <div className="p-4 rounded-md mb-4 bg-blue-700 text-white">
              Loading...
            </div>
          ) : message ? (
            <div
              className={`p-4 rounded-md mb-4 ${
                message.includes("successful")
                  ? "bg-green-500 text-white"
                  : "bg-red-500 text-white"
              }`}
            >
              {message}
            </div>
          ) : null}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-300 font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
                placeholder="Enter your Email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="block text-gray-300 font-medium">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
                placeholder="Enter your Password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="section" className="block text-gray-300 font-medium">
                Section
              </label>
              <input
                id="section"
                name="section"
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
                placeholder="Enter your Section"
                value={formData.section}
                onChange={handleChange}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="role" className="block text-gray-300 font-medium">
                Role
              </label>
              <select
                id="role"
                name="role"
                className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="">Select Role</option>
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="rollNo" className="block text-gray-300 font-medium">Roll No</label>
              <input
                id="rollNo"
                name="rollNo"
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
                placeholder="Enter your Roll No"
                value={formData.rollNo}
                onChange={handleChange}
              />
            </div>
            <button
              type="submit"
              className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewLogin;
