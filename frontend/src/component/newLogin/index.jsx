import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { UserCircle2, Mail, Lock, BookOpen, Users, IdCard, ArrowRight } from "lucide-react";
import { Transition } from "@headlessui/react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const NewLogin = ({ onLogin, setIsRegistered }) => {
  const [formData, setFormData] = useState({
    name: "",
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
      const formattedData = Object.entries(formData).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'string' ? value.toLowerCase() : value;
        return acc;
      }, {});

      const response = await fetch(`${process.env.REACT_APP_API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedData),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const { token, userId, name: userName, role } = data;
      
      onLogin(token, role, userId);
      
      // Store user data
      const storageData = { token, role, section: formData.section, rollNo: formData.rollNo, name: userName, userId };
      Object.entries(storageData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      if (role === "teacher" || role === "student") {
        setIsRegistered(true);
      }

      setMessage("Login successful! Redirecting to dashboard...");
      setTimeout(() => navigate("/dashboard"), 2000);
    } catch (error) {
      console.error("Error logging in:", error);
      setMessage(error.message || "An unknown error occurred. Please try again later.");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-purple-50 to-purple-100 text-gray-800 flex flex-col justify-center items-center p-6">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl"
      >
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-purple-100">
          <div className="flex flex-col md:flex-row">
            {/* Left Panel */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-purple-600 text-white p-8 md:w-1/3 flex flex-col justify-center"
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <BookOpen className="w-12 h-12 mb-6 text-purple-200" />
                <h1 className="text-3xl font-bold mb-4">Welcome Back</h1>
                <p className="text-purple-200 mb-6">Sign in to your account to continue using our ERP system.</p>
                
                <div className="space-y-3 mt-8">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white text-purple-600 mr-3">
                      <Mail className="w-4 h-4" />
                    </div>
                    <span className="text-white">Enter your credentials</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-purple-400 text-white mr-3">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-purple-300">Access your dashboard</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
            
            {/* Right Panel */}
            <div className="p-8 md:w-2/3">
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
              >
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign In</h2>
                <p className="text-gray-600">Please enter your details to continue</p>
              </motion.div>

              {/* Message display */}
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg mb-6 ${
                    message.includes("successful") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {message}
                </motion.div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCircle2 className="h-5 w-5 text-purple-500" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Full Name"
                    className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                  />
                </div>
                
                {/* Email Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-purple-500" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Email Address"
                    className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                  />
                </div>
                
                {/* Password Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-purple-500" />
                  </div>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Password"
                    className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                  />
                </div>
                
                {/* Section Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <BookOpen className="h-5 w-5 text-purple-500" />
                  </div>
                  <input
                    type="text"
                    name="section"
                    value={formData.section}
                    onChange={handleChange}
                    placeholder="Section"
                    className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                  />
                </div>
                
                {/* Role Select */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-5 w-5 text-purple-500" />
                  </div>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm appearance-none"
                  >
                    <option value="">Select Role</option>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </div>
                
                {/* Roll Number Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IdCard className="h-5 w-5 text-purple-500" />
                  </div>
                  <input
                    type="text"
                    name="rollNo"
                    value={formData.rollNo}
                    onChange={handleChange}
                    placeholder="Roll Number"
                    className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                  />
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center mt-8"
              >
                <p className="text-gray-600">
                  Don't have an account?{" "}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={() => navigate("/register")}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Register here
                  </motion.button>
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NewLogin;