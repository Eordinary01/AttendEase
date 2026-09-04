// src/component/profile/index.jsx
import React, { useEffect, useState, useRef } from 'react';
import api from '../../utils/api';
import { logError } from '../../utils/logger';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  User,
  IdCard,
  Calendar,
  Edit,
  Save,
  X,
  AlertTriangle,
  UserCircle,
  Phone,
  MapPin,
  CheckCircle,
  Shield,
  Send,
  ShieldCheck,
  UserCheck,
  Camera,
  Trash2,
  Loader2,
  GraduationCap,
  Award,
  BookOpen,
  Clock,
} from 'lucide-react';
import Card from '../common/ui/Card';
import Badge from '../common/ui/Badge';
import Modal from '../common/ui/Modal';
import Input, { Textarea } from '../common/ui/Input';
import Button from '../common/ui/Button';
import DashboardHeader from '../common/ui/DashboardHeader';
import { formatDateDMY } from '../../utils/dateUtils';

const Profile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [editedFormData, setEditedFormData] = useState({});
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Photo upload states
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [photoSuccess, setPhotoSuccess] = useState(null);
  const fileInputRef = useRef(null);

  // Email verification modal states
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifySending, setVerifySending] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(null);
  const [verifyError, setVerifyError] = useState(null);

  const token = localStorage.getItem('token');
  const DEFAULT_IMAGE = 'https://ui-avatars.com/api/?background=6366f1&color=fff&bold=true';

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!token) {
          logError("Fetch User", 'No authentication token found');
          setError('Please login again');
          setIsLoading(false);
          return;
        }

        const response = await api.get('/users/profile');
        const userData = response.data?.data || response.data;
        setUser(userData);
        initFormData(userData);
      } catch (error) {
        logError("Fetch User Info", error);

        if (error.response?.status === 401) {
          setError('Session expired. Please login again.');
          setTimeout(() => {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }, 2000);
        } else {
          setError(error.response?.data?.message || 'Failed to load user information');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId, token]);

  const initFormData = (userData) => {
    setEditedFormData({
      name: userData.name || '',
      phone: userData.phone || '',
      address: userData.address || '',
      // Student specific
      parentName: userData.parentName || '',
      parentPhone: userData.parentPhone || '',
      parentEmail: userData.parentEmail || '',
      // Teacher specific
      qualification: userData.qualification || '',
      specialization: userData.specialization || '',
    });
  };

  const handleEdit = () => {
    if (user) initFormData(user);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (user) initFormData(user);
    setError(null);
  };

  const handleSave = async () => {
    try {
      setError(null);
      const response = await api.put('/users/profile', editedFormData);
      const updatedUser = response.data?.data || response.data;
      setUser(prev => ({ ...prev, ...updatedUser, profileComplete: true, updatedAt: new Date().toISOString() }));
      setUpdateSuccess(true);
      setIsEditing(false);
      setTimeout(() => setUpdateSuccess(false), 4000);
    } catch (err) {
      logError("Update User Info", err);
      setError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleChange = (e) => {
    setEditedFormData({ ...editedFormData, [e.target.name]: e.target.value });
  };

  // Trigger Brevo verification email
  const handleSendVerificationCode = async () => {
    setVerifySending(true);
    setVerifyError(null);
    setVerifyMsg(null);
    try {
      const res = await api.post('/auth/send-verification-email');
      setOtpSent(true);
      setVerifyMsg(res.data?.message || 'Verification code sent to your email.');
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Failed to send verification code. Check email configuration.');
    } finally {
      setVerifySending(false);
    }
  };

  // Verify code
  const handleVerifyOTP = async () => {
    if (!otp || otp.trim().length !== 6) {
      setVerifyError('Please enter a valid 6-digit verification code.');
      return;
    }
    setVerifyLoading(true);
    setVerifyError(null);
    setVerifyMsg(null);
    try {
      const res = await api.post('/auth/verify-email', { otp: otp.trim() });
      setUser(prev => ({ ...prev, emailVerified: true }));
      setVerifyMsg(res.data?.message || 'Email verified successfully!');
      setTimeout(() => {
        setIsVerifyModalOpen(false);
        setOtp('');
        setOtpSent(false);
        setVerifyMsg(null);
      }, 1500);
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setVerifyLoading(false);
    }
  };

  // Profile photo upload handler (Cloudinary)
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please select a valid image file (PNG, JPG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image size must be less than 5 MB');
      return;
    }

    setIsUploadingPhoto(true);
    setPhotoError(null);
    setPhotoSuccess(null);

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await api.post('/users/profile/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const updatedAvatar = response.data?.data?.avatar;
      setUser(prev => ({ ...prev, avatar: updatedAvatar, profileComplete: true }));
      if (updatedAvatar) {
        localStorage.setItem('userAvatar', updatedAvatar);
        window.dispatchEvent(new Event('userAvatarUpdated'));
      }
      setPhotoSuccess('Profile photo updated successfully!');
      setTimeout(() => setPhotoSuccess(null), 4000);
    } catch (err) {
      logError("Upload Profile Photo", err);
      setPhotoError(err.response?.data?.message || 'Failed to upload photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remove profile photo
  const handleRemovePhoto = async () => {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;

    setIsUploadingPhoto(true);
    setPhotoError(null);
    setPhotoSuccess(null);

    try {
      await api.delete('/users/profile/photo');
      setUser(prev => ({ ...prev, avatar: null }));
      localStorage.removeItem('userAvatar');
      window.dispatchEvent(new Event('userAvatarUpdated'));
      setPhotoSuccess('Profile photo removed.');
      setTimeout(() => setPhotoSuccess(null), 3000);
    } catch (err) {
      logError("Remove Profile Photo", err);
      setPhotoError(err.response?.data?.message || 'Failed to remove photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center py-24 text-ink-soft text-sm">
        User account not found
      </div>
    );
  }

  const isProfileIncomplete = user?.profileComplete !== undefined
    ? !user.profileComplete
    : user?.role === 'teacher'
      ? !(user.qualification || user.phone || user.address || user.specialization)
      : user?.role === 'student'
        ? !(user.parentName || user.parentPhone || user.phone || user.address)
        : false;
  const isEmailUnverified = !user.emailVerified;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      <DashboardHeader
        greeting={user.name || "User Profile"}
        meta={`${(user.role || 'USER').toUpperCase()} • Account identity, institution records, and verified contacts`}
        actions={!isEditing && (
          <Button variant="primary" size="sm" leftIcon={Edit} onClick={handleEdit}>
            Edit Profile
          </Button>
        )}
      />

      {/* Success Notification */}
      <AnimatePresence>
        {updateSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm flex items-center gap-3 shadow-sm"
          >
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">Profile updated successfully! Your account details are up to date.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Incomplete Banner */}
      {isProfileIncomplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-amber-50/90 border border-amber-300/80 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">Your profile is incomplete</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Please complete your profile details to ensure accurate institutional records and emergency updates.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={Edit}
            onClick={handleEdit}
            className="bg-amber-600 hover:bg-amber-700 border-none text-white whitespace-nowrap text-xs shadow-sm"
          >
            Complete Profile Now
          </Button>
        </motion.div>
      )}

      {/* Email Verification Banner */}
      {isEmailUnverified && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-5 bg-indigo-50/90 border border-indigo-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-start gap-3.5">
            <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-indigo-900 text-sm">Verify your institutional email address</h4>
              <p className="text-xs text-indigo-700 mt-0.5">
                Verify <strong>{user.email}</strong> to receive critical attendance alerts and automated notifications.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Send}
            onClick={() => setIsVerifyModalOpen(true)}
            className="whitespace-nowrap text-xs shadow-sm"
          >
            Verify Email
          </Button>
        </motion.div>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Identity & Photo */}
        <div className="lg:col-span-4">
          <ProfileCard
            user={user}
            defaultImage={DEFAULT_IMAGE}
            onOpenVerify={() => setIsVerifyModalOpen(true)}
            onPhotoSelect={handlePhotoSelect}
            onRemovePhoto={handleRemovePhoto}
            isUploadingPhoto={isUploadingPhoto}
            photoError={photoError}
            photoSuccess={photoSuccess}
            fileInputRef={fileInputRef}
          />
        </div>

        {/* Right Column: Detailed Info Hierarchy */}
        <div className="lg:col-span-8">
          <InfoCard user={user} onEdit={handleEdit} />
        </div>
      </main>

      {/* Role-Aware Edit Modal */}
      {isEditing && (
        <EditModal
          role={user.role}
          formData={editedFormData}
          onSave={handleSave}
          onCancel={handleCancel}
          onChange={handleChange}
          error={error}
        />
      )}

      {/* Email Verification Modal */}
      {isVerifyModalOpen && (
        <Modal
          isOpen
          onClose={() => {
            setIsVerifyModalOpen(false);
            setVerifyError(null);
            setVerifyMsg(null);
          }}
          title="Email Verification"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-xs text-ink-soft leading-relaxed">
              We will send a 6-digit verification code to <strong>{user.email}</strong> to confirm your email address.
            </p>

            {verifyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {verifyError}
              </div>
            )}

            {verifyMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs">
                {verifyMsg}
              </div>
            )}

            {!otpSent ? (
              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full justify-center text-sm"
                  leftIcon={Send}
                  isLoading={verifySending}
                  onClick={handleSendVerificationCode}
                >
                  Send Verification Code
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <Input
                  label="Enter 6-Digit Verification Code"
                  placeholder="e.g. 123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 justify-center text-xs"
                    onClick={handleSendVerificationCode}
                    isLoading={verifySending}
                  >
                    Resend Code
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 justify-center text-xs"
                    isLoading={verifyLoading}
                    onClick={handleVerifyOTP}
                  >
                    Verify Code
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

const LoadingSpinner = () => (
  <div className="flex flex-col justify-center items-center py-24 gap-3">
    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    <span className="text-xs font-semibold text-ink-soft">Loading account details...</span>
  </div>
);

const ErrorDisplay = ({ error }) => (
  <div className="flex flex-col justify-center items-center py-24 px-4">
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 max-w-md text-center shadow-sm">
      <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
      <h2 className="text-lg font-bold text-rose-800 mb-1">Error Loading Profile</h2>
      <p className="text-xs text-rose-600 mb-5 leading-relaxed">{error}</p>
      <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
        Try Again
      </Button>
    </div>
  </div>
);

const ProfileCard = ({
  user,
  defaultImage,
  onOpenVerify,
  onPhotoSelect,
  onRemovePhoto,
  isUploadingPhoto,
  photoError,
  photoSuccess,
  fileInputRef,
}) => {
  const avatarSrc = user?.avatar || `${defaultImage}&name=${encodeURIComponent(user?.name || 'User')}`;

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return ShieldCheck;
      case 'teacher':
        return UserCheck;
      case 'student':
        return GraduationCap;
      default:
        return User;
    }
  };

  const RoleIcon = getRoleIcon(user?.role);

  return (
    <Card padding="none" className="overflow-hidden border border-line/70 shadow-sm bg-surface">
      {/* Hidden file input for Cloudinary upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={onPhotoSelect}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
        aria-label="Upload profile photo"
      />

      <div className="p-6 text-center">
        {/* Avatar Presentation with Photo Upload Actions */}
        <div className="relative inline-block mx-auto mb-4">
          <div
            className="group relative rounded-full overflow-hidden w-28 h-28 border-4 border-surface bg-slate-100 shadow-md cursor-pointer transition-transform hover:scale-105"
            onClick={() => !isUploadingPhoto && fileInputRef?.current?.click()}
            title="Click to update profile photo"
          >
            <img
              src={avatarSrc}
              alt={user?.name || "Avatar"}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = `${defaultImage}&name=${encodeURIComponent(user?.name || 'User')}`;
              }}
            />

            {/* Hover overlay / Loading spinner */}
            <div className={`absolute inset-0 bg-black/60 flex flex-col items-center justify-center transition-opacity duration-200 ${
              isUploadingPhoto ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}>
              {isUploadingPhoto ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5 text-white drop-shadow" />
                  <span className="text-[10px] text-white font-semibold mt-1">Change</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef?.current?.click()}
            disabled={isUploadingPhoto}
            aria-label="Upload photo"
            className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary-dark transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Photo feedback messages */}
        {photoSuccess && (
          <p className="text-xs text-emerald-600 font-semibold mb-2 animate-pulse">{photoSuccess}</p>
        )}
        {photoError && (
          <p className="text-xs text-rose-600 font-semibold mb-2">{photoError}</p>
        )}

        {/* Photo Action Links */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => fileInputRef?.current?.click()}
            disabled={isUploadingPhoto}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-dark transition-colors"
          >
            {user?.avatar ? 'Change Photo' : 'Upload Photo'}
          </button>

          {user?.avatar && (
            <>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={onRemovePhoto}
                disabled={isUploadingPhoto}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors"
                title="Remove uploaded profile photo"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            </>
          )}
        </div>

        <h2 className="text-xl font-extrabold text-ink mb-1 tracking-tight">{user.name}</h2>
        <p className="text-primary font-bold text-xs mb-4 flex items-center justify-center gap-1.5 uppercase tracking-wider">
          <RoleIcon className="w-4 h-4 text-primary" />
          {user.role}
        </p>

        <div className="flex flex-wrap justify-center items-center gap-2 mb-4">
          {user.profileComplete ? (
            <Badge tone="emerald">Profile Complete</Badge>
          ) : (
            <Badge tone="amber">Profile Incomplete</Badge>
          )}

          {user.emailVerified ? (
            <Badge tone="emerald" className="cursor-default flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Verified Email
            </Badge>
          ) : (
            <button onClick={onOpenVerify}>
              <Badge tone="amber" className="hover:opacity-80 transition cursor-pointer">
                Unverified Email
              </Badge>
            </button>
          )}
        </div>

        <div className="text-[11px] text-ink-faint border-t border-line/60 pt-3 flex items-center justify-between">
          <span>UID: {user._id?.slice(-8) || 'N/A'}</span>
          <span className="font-mono">{user.status || 'Active'}</span>
        </div>
      </div>
    </Card>
  );
};

const InfoCard = ({ user, onEdit }) => (
  <Card className="space-y-6 border border-line/70 shadow-sm bg-surface">
    <div className="flex items-center justify-between pb-4 border-b border-line/60">
      <h3 className="text-base font-bold text-ink flex items-center gap-2">
        <User className="w-5 h-5 text-primary" />
        Institutional Profile & Records
      </h3>
      <span className="text-xs text-ink-soft">
        Last updated: {user.updatedAt ? formatDateDMY(user.updatedAt) : 'Recently'}
      </span>
    </div>

    {/* Tier 1: Primary Quick-Access Contact Row */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 rounded-xl bg-slate-50/80 border border-slate-200/80">
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-primary" /> Official Email
        </span>
        <p className="text-xs font-bold text-ink truncate" title={user.email}>
          {user.email}
        </p>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-primary" /> Primary Contact
        </span>
        <p className="text-xs font-bold text-ink">
          {user.phone || 'Not provided'}
        </p>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-primary" /> Member Since
        </span>
        <p className="text-xs font-bold text-ink">
          {user.createdAt ? formatDateDMY(user.createdAt) : 'N/A'}
        </p>
      </div>
    </div>

    {/* Tier 2: Secondary Categorized Info */}
    <div>
      <h4 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">General Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <InfoItem icon={MapPin} label="Residential Address" value={user.address || 'Not provided'} />
        <InfoItem
          icon={IdCard}
          label={user.role === 'student' ? 'Roll / Enrollment Number' : 'Employee Code'}
          value={user.rollNo || user.employeeId || 'Not Assigned'}
        />
      </div>
    </div>

    {/* Student Academic & Parent Info */}
    {user.role === 'student' && (
      <>
        <div className="pt-4 border-t border-line/60">
          <h4 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">Academic Classification</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            <InfoItem icon={BookOpen} label="Course / Degree" value={user.courseName || user.courseId?.name || user.courseCode || user.courseId?.code || 'Not Assigned'} />
            <InfoItem icon={GraduationCap} label="Branch / Discipline" value={user.branch || 'General'} />
            <InfoItem icon={User} label="Assigned Section" value={user.section ? `Section ${user.section}` : 'Not Assigned'} />
            <InfoItem icon={Calendar} label="Current Semester" value={user.semester ? `Semester ${user.semester}` : 'Semester 1'} />
            <InfoItem icon={Calendar} label="Admission Batch" value={user.admissionYear ? String(user.admissionYear) : '2025'} />
          </div>
        </div>

        <div className="pt-4 border-t border-line/60">
          <h4 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">Parent / Guardian Contact</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <InfoItem icon={UserCircle} label="Parent Name" value={user.parentName || 'Not provided'} />
            <InfoItem icon={Phone} label="Parent Contact" value={user.parentPhone || 'Not provided'} />
            <InfoItem icon={Mail} label="Parent Email" value={user.parentEmail || 'Not provided'} />
          </div>
        </div>

        {user.attendance && (
          <div className="pt-4 border-t border-line/60">
            <h4 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">Attendance Summary</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xl font-extrabold text-primary">{user.attendance.totalClasses || 0}</p>
                <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider mt-0.5">Total Classes</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xl font-extrabold text-emerald-600">{user.attendance.presentCount || 0}</p>
                <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider mt-0.5">Present</p>
              </div>
              <div className="text-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-xl font-extrabold text-primary">{user.attendance.overallPercentage || 0}%</p>
                <p className="text-[10px] font-bold text-ink-faint uppercase tracking-wider mt-0.5">Percentage</p>
              </div>
            </div>
          </div>
        )}
      </>
    )}

    {/* Teacher Info */}
    {user.role === 'teacher' && (
      <div className="pt-4 border-t border-line/60">
        <h4 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">Professional Credentials</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <InfoItem icon={Award} label="Highest Qualification" value={user.qualification || 'Not provided'} />
          <InfoItem icon={BookOpen} label="Academic Specialization" value={user.specialization || 'Not provided'} />
        </div>
      </div>
    )}

    {/* Tier 3: Meta & Verification footer */}
    <div className="pt-4 border-t border-line/60 flex items-center justify-between text-xs text-ink-faint">
      <span className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> Registered Account
      </span>
      <span>Institutional records managed via AttendEase ERP</span>
    </div>
  </Card>
);

const InfoItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 p-3 bg-slate-50/70 border border-slate-200/60 rounded-xl hover:border-primary/30 transition-colors">
    <Icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-ink-faint text-[11px] font-semibold">{label}</p>
      <p className="text-ink font-bold break-words text-xs mt-0.5">{value}</p>
    </div>
  </div>
);

/**
 * Role-Aware Edit Modal - ONLY renders fields applicable to user's role
 */
const EditModal = ({ role, formData, onSave, onCancel, onChange, error }) => {
  return (
    <Modal isOpen onClose={onCancel} title="Edit Profile Details" size="lg">
      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <div className="space-y-4">
          {/* General Fields for all roles */}
          <div>
            <h4 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">General Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                name="name"
                value={formData.name || ''}
                onChange={onChange}
                required
              />
              <Input
                label="Phone Number"
                type="tel"
                name="phone"
                placeholder="e.g. +91 9876543210"
                value={formData.phone || ''}
                onChange={onChange}
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Address"
                  name="address"
                  rows="2"
                  placeholder="Enter full address"
                  value={formData.address || ''}
                  onChange={onChange}
                />
              </div>
            </div>
          </div>

          {/* Student Specific Fields */}
          {role === 'student' && (
            <div className="pt-4 border-t border-line/60">
              <h4 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">Parent / Guardian Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Parent / Guardian Name"
                  name="parentName"
                  value={formData.parentName || ''}
                  onChange={onChange}
                />
                <Input
                  label="Parent Phone"
                  type="tel"
                  name="parentPhone"
                  value={formData.parentPhone || ''}
                  onChange={onChange}
                />
                <div className="md:col-span-2">
                  <Input
                    label="Parent Email"
                    type="email"
                    name="parentEmail"
                    value={formData.parentEmail || ''}
                    onChange={onChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Teacher Specific Fields */}
          {role === 'teacher' && (
            <div className="pt-4 border-t border-line/60">
              <h4 className="text-xs font-bold text-ink-faint uppercase tracking-wider mb-3">Qualifications & Specialization</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Qualification"
                  name="qualification"
                  placeholder="e.g. M.Tech, Ph.D"
                  value={formData.qualification || ''}
                  onChange={onChange}
                />
                <Input
                  label="Specialization"
                  name="specialization"
                  placeholder="e.g. Computer Networks, Machine Learning"
                  value={formData.specialization || ''}
                  onChange={onChange}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 gap-3">
          <Button variant="outline" type="button" onClick={onCancel} leftIcon={X}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" leftIcon={Save}>
            Save Profile
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Profile;
