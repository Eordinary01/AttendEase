import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, KeyRound } from "lucide-react";
import axios from "axios";
import { validatePassword, PasswordRequirements } from "../../utils/passwordValidation";
import { logError } from "../../utils/logger";

const fadeIn = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 }
};

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token") || "";

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8011";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Reset token is missing. Please check your reset link or request a new one.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      setError(validation.message);
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        token: token.trim(),
        newPassword,
      });

      if (response.data.success) {
        setIsSuccess(true);
      }
    } catch (err) {
      logError("Reset Password", err);
      setError(err.response?.data?.message || "Failed to reset password. The link may have expired.");
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
        <div className="bg-surface rounded-2xl border border-line/50 p-8 shadow-sm overflow-hidden space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-primary bg-primary/10 border border-primary/20">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-ink tracking-tight">Set New Password</h1>
            <p className="text-xs text-ink-soft">
              Choose a strong, secure password for your AttendEase account
            </p>
          </div>

          <div className="space-y-4">
            {isSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4 space-y-4"
              >
                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-ink">Password Reset Successful!</h3>
                  <p className="text-xs text-ink-soft">
                    Your password has been updated. You can now log in with your new credentials.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            ) : (
              <>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-xl flex items-start gap-2.5 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-600 font-medium"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Token input fallback if not in URL */}
                  {!tokenFromUrl && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                        Reset Token
                      </label>
                      <input
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="Paste your reset token"
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl border border-line/50 bg-background text-ink text-xs font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                    </div>
                  )}

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-line/50 bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-faint hover:text-ink transition cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Checklist */}
                  <PasswordRequirements password={newPassword} />

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-ink-soft uppercase tracking-wider">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                        <Lock className="h-4 w-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        required
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-line/50 bg-background text-ink text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-faint hover:text-ink transition cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-2"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Reset Password</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline transition"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Login</span>
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
