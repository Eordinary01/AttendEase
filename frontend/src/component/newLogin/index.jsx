import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, ArrowRight, GraduationCap, School, UserPlus } from "lucide-react";
import axios from "axios";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const NewLogin = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showRegistrationOptions, setShowRegistrationOptions] = useState(false);
  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8011";

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage("");
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setIsLoading(true);
  setMessage("");

  if (!formData.email || !formData.password) {
    setMessage("Please enter both email and password");
    setIsLoading(false);
    return;
  }

  try {
    console.log("🔄 Attempting login...");
    console.log("📤 Request to:", `${API_URL}/login`);
    
    const response = await axios.post(`${API_URL}/login`, {
      email: formData.email.toLowerCase().trim(),
      password: formData.password
    });

    console.log("✅ Full login response:", response); // Log entire response
    console.log("✅ Response data:", response.data);
    console.log("✅ Token:", response.data.token);
    console.log("✅ User:", response.data.user);

    if (response.data.token) {
      const { token, user } = response.data;
      
      // Store token and user data
      localStorage.setItem("token", token);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("userName", user.name);
      localStorage.setItem("userEmail", user.email);
      localStorage.setItem("role", user.role);
      
      // Verify storage
      console.log("📝 Stored token:", localStorage.getItem("token")?.substring(0, 20) + "...");
      console.log("📝 Stored role:", localStorage.getItem("role"));
      
      // Update parent state
      onLogin(
        token, 
        user.role, 
        user.id, 
        user.name, 
        user.email
      );

      setMessage({
        text: `Login successful! Welcome ${user.name} (${user.role})`,
        type: "success"
      });

      // Navigate to dashboard
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    } else {
      throw new Error("No token received");
    }
  } catch (error) {
    console.error("❌ Full login error:", error);
    console.error("❌ Error response:", error.response?.data);
    
    let errorMessage = "An error occurred. Please try again.";
    
    if (error.response) {
      errorMessage = error.response.data.message || `Login failed (${error.response.status})`;
    } else if (error.request) {
      errorMessage = "No response from server. Please check your connection.";
    } else {
      errorMessage = error.message;
    }
    
    setMessage({
      text: errorMessage,
      type: "error"
    });
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
        className="w-full max-w-md"
      >
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-purple-100">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">AttendEase</h1>
                <p className="text-purple-100 text-sm">College Attendance System</p>
              </div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center"
              >
                <div className="w-6 h-6 rounded-full bg-white"></div>
              </motion.div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Welcome Back</h2>
            <p className="text-gray-600 mb-6">Sign in to your account</p>

            {/* Message display */}
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-lg mb-6 ${
                  message.type === "success" 
                    ? "bg-green-50 border border-green-200 text-green-700" 
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                <div className="flex items-center">
                  {message.type === "success" ? (
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{message.text}</span>
                </div>
              </motion.div>
            )}
            
            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  required
                  className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
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
                  required
                  className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg text-white font-medium transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing In...
                  </span>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>
            
            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="flex-shrink mx-4 text-gray-500 text-sm">Or</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Registration Section */}
            {!showRegistrationOptions ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <button
                  onClick={() => setShowRegistrationOptions(true)}
                  className="w-full py-3 px-6 border-2 border-purple-500 text-purple-600 hover:bg-purple-50 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <UserPlus className="w-5 h-5" />
                  <span>Create Account</span>
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-3"
              >
                <button
                  onClick={() => navigate("/register")}
                  className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg text-white font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <GraduationCap className="w-5 h-5" />
                  <span>Register as Student</span>
                </button>

                <button
                  onClick={() => navigate("/register")}
                  className="w-full py-3 px-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 rounded-lg text-white font-medium transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <School className="w-5 h-5" />
                  <span>Activate Teacher Account</span>
                </button>

                <button
                  onClick={() => setShowRegistrationOptions(false)}
                  className="w-full py-2 text-gray-600 hover:text-gray-800 font-medium text-sm transition-colors duration-200"
                >
                  Back to Login
                </button>
              </motion.div>
            )}
            
            {/* Role Information */}
            <div className="mt-6 bg-gray-50 border border-gray-100 rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
                <svg className="w-4 h-4 mr-2 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Available Roles
              </h3>
              <div className="space-y-2">
                <div className="flex items-center text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>
                  <span className="font-medium text-gray-700">Admin:</span>
                  <span className="text-gray-600 ml-1">Full system access</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                  <span className="font-medium text-gray-700">Teacher:</span>
                  <span className="text-gray-600 ml-1">Mark attendance, verify tickets</span>
                </div>
                <div className="flex items-center text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span className="font-medium text-gray-700">Student:</span>
                  <span className="text-gray-600 ml-1">Submit tickets, view attendance</span>
                </div>
              </div>
            </div>

            {/* Registration Info */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h3 className="font-semibold text-gray-700 mb-3">New to AttendEase?</h3>
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <div className="flex items-start">
                    <GraduationCap className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                    <div>
                      <div className="font-medium text-blue-800">Students</div>
                      <p className="text-sm text-blue-700">Use your enrollment number and college email to register</p>
                    </div>
                  </div>
                </div>
                <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                  <div className="flex items-start">
                    <School className="w-5 h-5 text-purple-600 mr-3 mt-0.5" />
                    <div>
                      <div className="font-medium text-purple-800">Teachers</div>
                      <p className="text-sm text-purple-700">Use temporary credentials provided by administrator</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Need help?{" "}
                <button
                  onClick={() => {
                    console.log("Debug Info:");
                    console.log("API_URL:", API_URL);
                    console.log("Token:", localStorage.getItem("token"));
                  }}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Contact Support
                </button>
              </p>
              <div className="text-xs text-gray-500">
                v1.0.0
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NewLogin;