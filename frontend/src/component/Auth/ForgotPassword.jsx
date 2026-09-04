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
    <div className="min-h-screen bg-background text-ink flex flex-col justify-center items-center p-6">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeIn}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-surface rounded-2xl border border-line/50 p-8 shadow-sm overflow-hidden space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-primary bg-primary/10 border border-primary/20">
              <KeyRound className="w-6 h-6" />
            </div>

            <h1 className="text-xl font-bold text-ink tracking-tight">Forgot Password</h1>
            <p className="text-xs text-ink-soft">
              Enter your registered email to receive reset instructions
            </p>
          </div>

          {/* Form / Content */}
          <div className="space-y-4">
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3.5 rounded-xl flex items-start gap-2.5 text-xs ${
                  message.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-medium"
                    : "bg-rose-500/10 border border-rose-500/20 text-rose-600 font-medium"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <p>{message.text}</p>
                </div>
              </motion.div>
            )}

            {/* Dev Token Helper */}
            {devToken && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs space-y-2"
              >
                <div className="flex items-center gap-1.5 font-bold text-amber-700">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Development Mode — Reset Link</span>
                </div>
                <p className="text-[11px] text-amber-900/80">
                  Click the button below to proceed directly to the reset password screen:
                </p>
                <button
                  onClick={() => navigate(`/reset-password?token=${devToken}`)}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Go to Reset Password</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-line/50 bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Send Reset Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <Link
                to={loginRoute}
                className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
