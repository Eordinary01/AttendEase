import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Mail, ArrowRight, ArrowLeft, KeyRound, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import axios from "axios";
import { logError } from "../../utils/logger";

const fadeIn = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 }
};

export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [devToken, setDevToken] = useState(null);
  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8011";
  const loginRoute = location.state?.returnTo || "/login";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setDevToken(null);

    if (!email) {
      setMessage({ type: "error", text: "Please enter your registered email address" });
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, {
        email: email.trim().toLowerCase(),
      });

      if (response.data.success) {
        setMessage({
          type: "success",
          text: response.data.message || "Password reset instructions have been sent to your email.",
        });
        if (response.data.resetToken) {
          setDevToken(response.data.resetToken);
        }
      }
    } catch (err) {
      logError("Forgot Password", err);
      const errText = err.response?.data?.message || "Failed to process request. Please try again.";
      setMessage({ type: "error", text: errText });
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
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="p-8 pb-4 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg text-white bg-gradient-to-br from-purple-600 to-indigo-600">
              <KeyRound className="w-7 h-7" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Forgot Password</h1>
            <p className="text-sm text-gray-500 mt-1.5">
              Enter your registered email to receive reset instructions
            </p>
          </div>

          {/* Form / Content */}
          <div className="p-8 pt-4">
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-xl mb-5 flex items-start gap-3 text-sm ${
                  message.type === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">{message.text}</p>
                </div>
              </motion.div>
            )}

            {/* Dev Mode Helper */}
            {devToken && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 mb-5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-2"
              >
                <div className="flex items-center gap-1.5 font-semibold text-purple-700">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Development Shortcut</span>
                </div>
                <p className="text-purple-600">A reset token was generated. Click below to proceed to the reset form directly:</p>
                <button
                  type="button"
                  onClick={() => navigate(`/reset-password?token=${devToken}`)}
                  className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors text-xs"
                >
                  Proceed to Reset Password &rarr;
                </button>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="h-5 w-5 text-purple-500" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  required
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 border border-purple-200 rounded-xl bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-sm"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 rounded-xl text-white font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending Instructions...
                  </span>
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <Link
                to={loginRoute}
                className="inline-flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
