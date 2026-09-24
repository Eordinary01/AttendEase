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
    <div className="min-h-screen bg-background text-ink flex flex-col justify-center items-center p-6">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xl"
      >
        <div className="bg-surface rounded-2xl overflow-hidden border border-line/50 shadow-sm p-6 md:p-8 space-y-6">
          <div className="flex justify-between items-center pb-3 border-b border-line/50">
            <div>
              <h2 className="text-xl font-bold text-ink tracking-tight">
                {step === 1 ? "Account Setup" : 
                 userType === "student" ? "Student Registration" : "Teacher Account Activation"}
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                {step === 1 ? "Choose your role to get started" : "Complete your profile to access your campus portal"}
              </p>
            </div>
            {step === 2 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 capitalize">
                {userType}
              </span>
            )}
          </div>

          {(isLoading || showSuccessMessage || error) && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2 font-medium ${
                isLoading ? "bg-primary/10 border border-primary/20 text-primary" :
                showSuccessMessage ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600" :
                "bg-rose-500/10 border border-rose-500/20 text-rose-600"
              }`}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span>Processing...</span>
                </div>
              ) : showSuccessMessage ? 
                `${userType === "student" ? "Registration" : "Activation"} successful! Redirecting...` :
                <span>{error}</span>}
            </motion.div>
          )}
          
          {/* Step 1: User Type Selection */}
          {step === 1 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Student Card */}
                <div
                  onClick={() => handleUserTypeSelect("student")}
                  className="bg-background border border-line/50 hover:border-primary/40 rounded-2xl p-5 cursor-pointer transition flex flex-col items-center text-center space-y-3 group"
                >
                  <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">Student Registration</h3>
                    <p className="text-xs text-ink-soft mt-1">
                      Register with enrollment number & institutional email
                    </p>
                  </div>
                  <div className="flex items-center text-xs font-bold text-primary gap-1 pt-1">
                    <span>Register</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Teacher Card */}
                <div
                  onClick={() => handleUserTypeSelect("teacher")}
                  className="bg-background border border-line/50 hover:border-primary/40 rounded-2xl p-5 cursor-pointer transition flex flex-col items-center text-center space-y-3 group"
                >
                  <div className="w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                    <School className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">Teacher Activation</h3>
                    <p className="text-xs text-ink-soft mt-1">
                      Activate account using temporary admin credentials
                    </p>
                  </div>
                  <div className="flex items-center text-xs font-bold text-primary gap-1 pt-1">
                    <span>Activate</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Subdomain Input on Step 1 */}
              <div className="bg-background border border-line/50 rounded-xl p-4 space-y-1.5">
                <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                  Campus Subdomain *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-faint">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={subdomain}
                    onChange={handleSubdomainChange}
                    placeholder="e.g. apex-univ"
                    className="w-full pl-9 pr-3 py-2 border border-line/50 rounded-xl bg-surface text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                    required
                  />
                </div>
                <p className="text-[11px] text-ink-faint">
                  {subdomain ? `Connecting to: ${subdomain}.attendease.com` : "Enter your institution's subdomain prefix"}
                </p>
              </div>
            </motion.div>
          ) : (
            /* Step 2: Registration Form */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Back Button */}
              <button
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                <span>Back to Role Selection</span>
              </button>

              {/* Subdomain Input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                  Campus Subdomain *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={subdomain}
                    onChange={handleSubdomainChange}
                    placeholder="e.g. apex-univ"
                    className="w-full pl-10 pr-4 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                    required
                  />
                </div>
              </div>

              {/* Student Registration Form */}
              {userType === "student" ? (
                <form onSubmit={handleStudentSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Enrollment Number *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                        <Hash className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        name="enrollmentNumber"
                        value={formData.enrollmentNumber}
                        onChange={handleChange}
                        placeholder="e.g. EN2026-0012"
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Email Address *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="student@university.edu"
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                        Password *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                          <Lock className="h-4 w-4" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="••••••••"
                          required
                          className="w-full pl-10 pr-10 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(prev => !prev)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-faint hover:text-ink cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <PasswordRequirements password={formData.password} />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                          <Lock className="h-4 w-4" />
                        </div>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          placeholder="••••••••"
                          required
                          className="w-full pl-10 pr-10 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(prev => !prev)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-faint hover:text-ink cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {isLoading ? "Registering..." : "Register as Student"}
                  </button>
                </form>
              ) : (
                /* Teacher Activation Form */
                <form onSubmit={handleTeacherSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Teacher Email Address *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="teacher@university.edu"
                        required
                        className="w-full pl-10 pr-4 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Temporary Password (from Admin) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                        <Key className="h-4 w-4" />
                      </div>
                      <input
                        type={showTempPassword ? "text" : "password"}
                        name="tempPassword"
                        value={formData.tempPassword}
                        onChange={handleChange}
                        placeholder="Provided by administrator"
                        required
                        className="w-full pl-10 pr-10 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTempPassword(prev => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-faint hover:text-ink cursor-pointer"
                      >
                        {showTempPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                        New Permanent Password *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                          <Lock className="h-4 w-4" />
                        </div>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="newPassword"
                          value={formData.newPassword}
                          onChange={handleChange}
                          placeholder="••••••••"
                          required
                          className="w-full pl-10 pr-10 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(prev => !prev)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-faint hover:text-ink cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <PasswordRequirements password={formData.newPassword} />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                        Confirm Permanent Password *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                          <Lock className="h-4 w-4" />
                        </div>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="teacherConfirmPassword"
                          value={formData.teacherConfirmPassword}
                          onChange={handleChange}
                          placeholder="••••••••"
                          required
                          className="w-full pl-10 pr-10 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(prev => !prev)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-faint hover:text-ink cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                  >
                    {isLoading ? "Activating..." : "Activate Teacher Account"}
                  </button>
                </form>
              )}
            </motion.div>
          )}

          {/* Login Link */}
          <div className="text-center pt-3 border-t border-line/50 text-xs text-ink-soft">
            Already have an active account?{" "}
            <button
              onClick={() => navigate(subdomain ? `/login/${subdomain}` : "/login")}
              className="text-primary hover:underline font-bold cursor-pointer ml-1"
            >
              Sign in here
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;