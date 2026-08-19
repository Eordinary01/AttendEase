import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Mail, Lock, Hash, ArrowRight, 
  Key, GraduationCap, School, AlertCircle, Globe, Eye, EyeOff 
} from "lucide-react";
import axios from "axios";
import { logError } from "../../utils/logger";
import { validatePassword, PasswordRequirements } from "../../utils/passwordValidation";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

const Register = ({ setIsRegistered, onRegisterSuccess }) => {
  const location = useLocation();
  const initialUserType = location.state?.userType || ""; // "student" or "teacher" from login page
  const [userType, setUserType] = useState(initialUserType); // "student" or "teacher"
  const [subdomain, setSubdomain] = useState("");

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [formData, setFormData] = useState({
    // Student fields
    email: "",
    enrollmentNumber: "",
    password: "",
    confirmPassword: "",
    
    // Teacher fields
    tempPassword: "",
    newPassword: "",
    teacherConfirmPassword: ""
  });
  
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(initialUserType ? 2 : 1); // Step 1: Select user type, Step 2: Form
  
  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_API_URL;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
    setError("");
  };

  const handleSubdomainChange = (e) => {
    setSubdomain(e.target.value.toLowerCase().trim());
    setError("");
  };

  const handleUserTypeSelect = (type) => {
    setUserType(type);
    setStep(2);
    setError("");
    setFormData({
      email: "",
      enrollmentNumber: "",
      password: "",
      confirmPassword: "",
      tempPassword: "",
      newPassword: "",
      teacherConfirmPassword: ""
    });
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validation
    if (!formData.email || !formData.enrollmentNumber || !formData.password || !formData.confirmPassword) {
      setError("All fields are required");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.message);
      setIsLoading(false);
      return;
    }

    if (!subdomain) {
      setError("Institution subdomain is required. Please enter your college subdomain.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/register/student`, {
        email: formData.email.toLowerCase().trim(),
        enrollmentNumber: formData.enrollmentNumber.toUpperCase().trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        subdomain: subdomain.toLowerCase().trim()
      });

      setShowSuccessMessage(true);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      setShowSuccessMessage(true);
      setIsRegistered(true);
      if (onRegisterSuccess) onRegisterSuccess();

      // Redirect to the institution's unique login page after success
      setTimeout(() => {
        navigate(`/login/${subdomain.toLowerCase().trim()}`);
      }, 2000);

    } catch (error) {
      logError("Register Student", error);
      
      // Handle specific error messages
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError("An error occurred during registration. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTeacherSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validation
    if (!formData.email || !formData.tempPassword || !formData.newPassword || !formData.teacherConfirmPassword) {
      setError("All fields are required");
      setIsLoading(false);
      return;
    }

    if (formData.newPassword !== formData.teacherConfirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    const teacherPassValidation = validatePassword(formData.newPassword);
    if (!teacherPassValidation.isValid) {
      setError(teacherPassValidation.message);
      setIsLoading(false);
      return;
    }

    if (!subdomain) {
      setError("Institution subdomain is required. Please enter your college subdomain.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/register/teacher/first-login`, {
        email: formData.email.toLowerCase().trim(),
        tempPassword: formData.tempPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.teacherConfirmPassword,
        subdomain: subdomain.toLowerCase().trim()
      });

      setShowSuccessMessage(true);
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      setShowSuccessMessage(true);
      setIsRegistered(true);
      if (onRegisterSuccess) onRegisterSuccess();

      // Redirect to the institution's unique login page after success
      setTimeout(() => {
        navigate(`/login/${subdomain.toLowerCase().trim()}`);
      }, 2000);

    } catch (error) {
      logError("Activate Teacher", error);
      
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError("An error occurred. Please check your credentials and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    if (step === 2) {
      setStep(1);
      setUserType("");
      setError("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-purple-50 to-purple-100 text-gray-800 flex flex-col justify-center items-center p-6">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-purple-100">
          <div className="p-8">
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-8 flex justify-between items-center"
            >
              <h2 className="text-2xl font-bold text-gray-800">
                {step === 1 ? "Select Registration Type" : 
                 userType === "student" ? "Student Registration" : "Teacher Account Activation"}
              </h2>
              {step === 2 && (
                <div className="text-sm text-purple-600">
                  {userType === "student" ? "Student" : "Teacher"}
                </div>
              )}
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
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-purple-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </div>
                ) : showSuccessMessage ? 
                  `${userType === "student" ? "Registration" : "Activation"} successful! Redirecting...` :
                  error}
              </motion.div>
            )}
            
            {/* Step 1: User Type Selection */}
            {step === 1 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Student Card */}
                  <motion.div
                    whileHover={{ scale: 1.03, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleUserTypeSelect("student")}
                    className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6 cursor-pointer hover:border-blue-400 transition-all duration-200"
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                        <GraduationCap className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">Student Registration</h3>
                      <p className="text-gray-600 text-sm">
                        Register using your enrollment number and email provided by the college
                      </p>
                      <div className="flex items-center text-blue-600 font-medium">
                        <span>Register as Student</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </div>
                  </motion.div>

                  {/* Teacher Card */}
                  <motion.div
                    whileHover={{ scale: 1.03, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleUserTypeSelect("teacher")}
                    className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-6 cursor-pointer hover:border-purple-400 transition-all duration-200"
                  >
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                        <School className="w-8 h-8 text-purple-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800">Teacher Activation</h3>
                      <p className="text-gray-600 text-sm">
                        Activate your account using temporary credentials provided by admin
                      </p>
                      <div className="flex items-center text-purple-600 font-medium">
                        <span>Activate Account</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Subdomain Input on Step 1 */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
                  <div className="flex items-center">
                    <Globe className="w-5 h-5 text-purple-600 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Institution Subdomain *
                      </label>
                      <input
                        type="text"
                        value={subdomain}
                        onChange={handleSubdomainChange}
                        placeholder="Enter your college subdomain (e.g., mit)"
                        className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {subdomain ? `You are registering for: ${subdomain}` : "Enter your institution's subdomain (e.g., 'mit' for mit.college.edu)"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Important Information:</p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Students must have their enrollment number and registered email</li>
                        <li>Teachers must have temporary credentials provided by administrator</li>
                        <li>Enter your institution's subdomain correctly</li>
                        <li>If you're not sure, contact your college administrator</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Step 2: Registration Form */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {/* Back Button */}
                <button
                  onClick={goBack}
                  className="flex items-center text-purple-600 hover:text-purple-700 font-medium mb-4"
                >
                  <ArrowRight className="w-4 h-4 rotate-180 mr-2" />
                  Back to Selection
                </button>

                {/* Subdomain Input (editable so direct registration links work) */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <Globe className="w-5 h-5 text-purple-600 mt-1 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Institution Subdomain *
                      </label>
                      <input
                        type="text"
                        value={subdomain}
                        onChange={handleSubdomainChange}
                        placeholder="Enter your college subdomain (e.g., mit)"
                        className="w-full px-3 py-2 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {subdomain
                          ? `You are registering for: ${subdomain}`
                          : "Enter your institution's subdomain (e.g., 'mit')"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Student Registration Form */}
                {userType === "student" ? (
                  <form onSubmit={handleStudentSubmit}>
                    <div className="space-y-6">
                      {/* Enrollment Number */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Hash className="h-5 w-5 text-purple-500" />
                        </div>
                        <input
                          type="text"
                          name="enrollmentNumber"
                          value={formData.enrollmentNumber}
                          onChange={handleChange}
                          placeholder="Enrollment Number (e.g., EN001234)"
                          required
                          className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                        />
                      </div>

                      {/* Email */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-purple-500" />
                        </div>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Email Address (as provided by college)"
                          required
                          className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                        />
                      </div>

                      {/* Password */}
                      <div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-purple-500" />
                          </div>
                          <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Create Password (min. 8 characters)"
                            required
                            className="w-full pl-10 pr-10 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(prev => !prev)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-purple-600 focus:outline-none"
                            title={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="h-5 w-5 text-purple-600" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        <PasswordRequirements password={formData.password} />
                      </div>

                      {/* Confirm Password */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-purple-500" />
                        </div>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          placeholder="Confirm Password"
                          required
                          className="w-full pl-10 pr-10 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(prev => !prev)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-purple-600 focus:outline-none"
                          title={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5 text-purple-600" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {isLoading ? "Registering..." : "Register as Student"}
                      </motion.button>
                    </div>
                  </form>
                ) : (
                  /* Teacher Activation Form */
                  <form onSubmit={handleTeacherSubmit}>
                    <div className="space-y-6">
                      {/* Email */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-purple-500" />
                        </div>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Your Email Address"
                          required
                          className="w-full pl-10 pr-4 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                        />
                      </div>

                      {/* Temporary Password */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Key className="h-5 w-5 text-purple-500" />
                        </div>
                        <input
                          type={showTempPassword ? "text" : "password"}
                          name="tempPassword"
                          value={formData.tempPassword}
                          onChange={handleChange}
                          placeholder="Temporary Password (provided by admin)"
                          required
                          className="w-full pl-10 pr-10 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTempPassword(prev => !prev)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-purple-600 focus:outline-none"
                          title={showTempPassword ? "Hide password" : "Show password"}
                        >
                          {showTempPassword ? <EyeOff className="h-5 w-5 text-purple-600" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>

                      {/* New Password */}
                      <div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-purple-500" />
                          </div>
                          <input
                            type={showPassword ? "text" : "password"}
                            name="newPassword"
                            value={formData.newPassword}
                            onChange={handleChange}
                            placeholder="New Password (min. 8 characters)"
                            required
                            className="w-full pl-10 pr-10 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(prev => !prev)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-purple-600 focus:outline-none"
                            title={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="h-5 w-5 text-purple-600" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                        <PasswordRequirements password={formData.newPassword} />
                      </div>

                      {/* Confirm New Password */}
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-purple-500" />
                        </div>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="teacherConfirmPassword"
                          value={formData.teacherConfirmPassword}
                          onChange={handleChange}
                          placeholder="Confirm New Password"
                          required
                          className="w-full pl-10 pr-10 py-3 border border-purple-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(prev => !prev)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-purple-600 focus:outline-none"
                          title={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-5 w-5 text-purple-600" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-6 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {isLoading ? "Activating..." : "Activate Teacher Account"}
                      </motion.button>
                    </div>
                  </form>
                )}

                {/* Help Text */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    <p className="font-medium mb-1">
                      {userType === "student" ? "Need help with student registration?" : "Need help with teacher activation?"}
                    </p>
                    <p>
                      Contact your college administrator or IT department for assistance with your credentials.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Login Link */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center mt-8 pt-6 border-t border-gray-200"
            >
              <p className="text-gray-600">
                Already have an active account?{" "}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={() => navigate(subdomain ? `/login/${subdomain}` : "/login")}
                  className="text-purple-600 hover:text-purple-700 font-medium"
                >
                  Login here
                </motion.button>
              </p>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;