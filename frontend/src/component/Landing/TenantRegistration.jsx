// src/components/Landing/TenantRegistration.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Lock,
  User,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  GraduationCap,
  Globe,
  Calendar,
  Palette,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { validatePassword, PasswordRequirements } from '../../utils/passwordValidation';

const API_URL = process.env.REACT_APP_API_URL;

const TenantRegistration = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registered, setRegistered] = useState(null); // { name, subdomain }
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    institutionName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    pincode: '',
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    welcomeMessage: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const validateStep1 = () => {
    if (!formData.institutionName.trim()) {
      setError('Institution name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    const passCheck = validatePassword(formData.password);
    if (!passCheck.isValid) {
      setError(passCheck.message);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
      return;
    }

    // Submit registration
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_URL}/tenant/register`, {
        institutionName: formData.institutionName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        pincode: formData.pincode,
        primaryColor: formData.primaryColor,
        secondaryColor: formData.secondaryColor,
        welcomeMessage: formData.welcomeMessage,
      });

      if (response.data.success) {
        // Store auth data
        localStorage.setItem('token', response.data.data.token);
        localStorage.setItem('role', 'admin');
        localStorage.setItem('userId', response.data.data.user.id);
        localStorage.setItem('userName', response.data.data.user.name);
        localStorage.setItem('userEmail', response.data.data.user.email);
        localStorage.setItem('tenantId', response.data.data.tenant.id);
        localStorage.setItem('tenantSubdomain', response.data.data.tenant.subdomain);

        setRegistered({
          name: response.data.data.tenant.name,
          subdomain: response.data.data.tenant.subdomain,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    const loginLink = `${window.location.origin}/login/${registered.subdomain}`;
    const handleCopy = () => {
      navigator.clipboard?.writeText(loginLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    return (
      <div className="min-h-screen bg-background text-ink py-12 px-4 flex flex-col justify-center">
        <div className="max-w-xl mx-auto w-full">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface rounded-2xl border border-line/50 p-8 text-center space-y-6 shadow-sm"
          >
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-ink">
                Institution Registered!
              </h1>
              <p className="text-xs text-ink-soft">
                <strong className="text-ink font-semibold">{registered.name}</strong> is ready.
                Share this unique login link with your staff, teachers, and students. Only members
                of your institution can sign in through it.
              </p>
            </div>

            <div className="bg-background border border-line/50 rounded-xl p-4 space-y-2 text-left">
              <p className="text-xs font-bold text-primary uppercase tracking-wider">
                Your Unique Login Link
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={loginLink}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 px-3 py-2 border border-line/50 rounded-xl bg-surface text-xs text-ink font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition cursor-pointer shrink-0 shadow-sm"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <button
              onClick={() => navigate('/onboarding')}
              className="w-full py-2.5 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary/90 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <span>Continue to Setup Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-ink py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 border border-primary/20 rounded-2xl text-primary mb-2"
          >
            <GraduationCap className="w-7 h-7" />
          </motion.div>
          <h1 className="text-2xl font-bold text-ink tracking-tight">
            Set Up Your Institution
          </h1>
          <p className="text-xs text-ink-soft">
            Start your 14-day free trial. No credit card required.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="space-y-2 max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-line'}`} />
            <div className={`w-7 h-7 rounded-full flex items-center justify-center mx-2 text-xs font-bold ${
              step >= 1 ? 'bg-primary text-white' : 'bg-surface border border-line text-ink-faint'
            }`}>
              1
            </div>
            <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-line'}`} />
            <div className={`w-7 h-7 rounded-full flex items-center justify-center mx-2 text-xs font-bold ${
              step >= 2 ? 'bg-primary text-white' : 'bg-surface border border-line text-ink-faint'
            }`}>
              2
            </div>
            <div className={`flex-1 h-1.5 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-line'}`} />
          </div>
          <div className="flex justify-between text-[11px] font-bold text-ink-soft uppercase tracking-wider">
            <span>Account Setup</span>
            <span>Institution Details</span>
            <span>Complete</span>
          </div>
        </div>

        {/* Form Card */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl border border-line/50 p-6 md:p-8 shadow-sm"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 ? (
              // Step 1: Account Setup
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                    Institution Name *
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                    <input
                      type="text"
                      name="institutionName"
                      value={formData.institutionName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="e.g., Apex University"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-ink-faint">
                    Subdomain identifier: <span className="font-mono text-primary">{formData.institutionName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'your-campus'}.attendease.com</span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                    Admin Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="admin@university.edu"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full pl-10 pr-10 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(prev => !prev)}
                        className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordRequirements password={formData.password} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full pl-10 pr-10 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(prev => !prev)}
                        className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-ink-faint hover:text-ink cursor-pointer"
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Step 2: Institution Details
              <div className="space-y-5">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <Sparkles className="w-4 h-4" />
                    <span>Standard Platform Theme Included</span>
                  </div>
                  <p className="text-ink-soft">
                    Your 14-day Free Trial starts with the standard AttendEase platform theme. Custom branding (custom colors, logo, and white-labeling) is unlocked on the Professional and Enterprise plans.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                    Welcome Message
                  </label>
                  <input
                    type="text"
                    name="welcomeMessage"
                    value={formData.welcomeMessage}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    placeholder="e.g., Empowering students for a brighter future"
                  />
                </div>

                <hr className="border-line/50" />

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        placeholder="+91 9876543210"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Address
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint" />
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        placeholder="Street address, campus building"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      City
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="State"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 border border-line/50 rounded-xl bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="PIN code"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-600 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-line/50">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2 border border-line/50 rounded-xl text-xs font-semibold hover:bg-background transition cursor-pointer"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className={`ml-auto px-6 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition flex items-center gap-2 shadow-sm cursor-pointer ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : step === 1 ? (
                  <>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                ) : (
                  <span>Complete Registration</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>

        {/* Features List */}
        <div className="text-center space-y-3">
          <p className="text-xs text-ink-soft">
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-ink-soft">
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              14-day free trial
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              No credit card required
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              Cancel anytime
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TenantRegistration;