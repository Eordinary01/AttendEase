import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { User, Mail, Lock, BookOpen, UserCircle, Hash, ArrowRight } from "lucide-react";
import axios from "axios";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const Register = ({ setIsRegistered, onRegisterSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    section: "",
    role: "",
    rollNo: ""
  });
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  
  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_API_URL;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    setError(""); // Clear error when user makes changes
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const normalizedData = Object.entries(formData).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'string' ? value.toLowerCase() : value;
        return acc;
      }, {});

      const response = await axios.post(`${API_URL}/register`, normalizedData);
      console.log(response.data);

      setIsRegistered(true);
      onRegisterSuccess();
      setShowSuccessMessage(true);

      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Error registering user:', error);
      setError(error.response?.data?.message || "An error occurred during registration. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!formData.name || !formData.email || !formData.password)) {
      setError("Please fill all required fields");
      return;
    }
    setStep(2);
    setError("");
  };

  const prevStep = () => {
    setStep(1);
    setError("");
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
                <h1 className="text-3xl font-bold mb-4">Welcome to ERP System</h1>
                <p className="text-purple-200 mb-6">Create your account to get started with our enterprise resource planning platform.</p>
                
                <div className="space-y-3 mt-8">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-white text-purple-600' : 'bg-purple-400 text-white'} mr-3`}>1</div>
                    <span className={step >= 1 ? 'text-white' : 'text-purple-300'}>Account Information</span>
                  </div>
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-white text-purple-600' : 'bg-purple-400 text-white'} mr-3`}>2</div>
                    <span className={step >= 2 ? 'text-white' : 'text-purple-300'}>Academic Details</span>
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
                className="mb-8 flex justify-between items-center"
              >
                <h2 className="text-2xl font-bold text-gray-800">
                  {step === 1 ? "Create Your Account" : "Academic Information"}
                </h2>
                <div className="text-sm text-purple-600">Step {step} of 2</div>
              </motion.div>

              {(isLoading || showSuccessMessage || error) && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg mb-6 ${
                    isLoading ? "bg-purple-100 text-purple-700" :
                    showSuccessMessage ? "bg-green-100 text-green-700" :
                    "bg-red-100 text-red-700"
                  }`}
                >
                  {isLoading ? "Processing..." : 
                   showSuccessMessage ? "Registration successful! Redirecting to login..." :
                   error}
                </motion.div>
              )}
              
              <form onSubmit={handleSubmit}>
                {step === 1 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Name Input */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1 min-w-[240px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-purple-500" />
                        </div>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Full Name"
                          required
                          className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                        />
                      </div>
                    </div>
                    
                    {/* Email Input */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1 min-w-[240px]">
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
                          className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                        />
                      </div>
                    </div>
                    
                    {/* Password Input */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1 min-w-[240px]">
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
                          className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                        />
                      </div>
                    </div>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={nextStep}
                      className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
                    >
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-6"
                  >
                    {/* Section Input */}
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1 min-w-[240px]">
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
                    </div>
                    
                    {/* Role Select */}
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserCircle className="h-5 w-5 text-purple-500" />
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
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1 min-w-[240px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Hash className="h-5 w-5 text-purple-500" />
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
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={prevStep}
                        className="flex-1 py-3 px-6 border border-purple-500 rounded-lg text-purple-600 font-medium hover:bg-purple-50 transition-colors duration-200"
                      >
                        Back
                      </motion.button>
                      
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isLoading}
                        className="flex-1 py-3 px-6 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? "Creating Account..." : "Register"}
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </form>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center mt-8"
              >
                <p className="text-gray-600">
                  Already have an account?{" "}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    onClick={() => navigate("/login")}
                    className="text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Login here
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

export default Register;