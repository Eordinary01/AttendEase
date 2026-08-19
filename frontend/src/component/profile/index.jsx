import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import { logError } from '../../utils/logger';
import { motion } from 'framer-motion';
import {
  FaEnvelope,
  FaUserGraduate,
  FaIdCard,
  FaCalendarAlt,
  FaEdit,
  FaSave,
  FaTimes,
  FaExclamationTriangle,
  FaUserCircle,
  FaPhone,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaShieldAlt,
  FaPaperPlane,
  FaUserShield,
  FaUserTie,
} from 'react-icons/fa';
import Card from '../common/ui/Card';
import Badge from '../common/ui/Badge';
import Modal from '../common/ui/Modal';
import Input, { Textarea } from '../common/ui/Input';
import Button from '../common/ui/Button';
import PageHeader from '../common/ui/PageHeader';

const Profile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [editedFormData, setEditedFormData] = useState({});
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Email verification modal states
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifySending, setVerifySending] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(null);
  const [verifyError, setVerifyError] = useState(null);

  const token = localStorage.getItem('token');
  const DEFAULT_IMAGE = 'https://ui-avatars.com/api/?background=8b5cf6&color=fff&bold=true';

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
      setUser(prev => ({ ...prev, ...updatedUser, profileComplete: true }));
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

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!user) {
    return <div className="flex justify-center items-center py-24 text-ink-soft">User not found</div>;
  }

  const isProfileIncomplete = !user.profileComplete;
  const isEmailUnverified = !user.emailVerified;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6"
    >
      <PageHeader
        icon={FaUserCircle}
        title={`${user.name}'s Profile`}
        subtitle={user.role?.toUpperCase()}
        actions={!isEditing && (
          <Button variant="primary" leftIcon={FaEdit} onClick={handleEdit}>
            Edit Profile
          </Button>
        )}
      />

      {/* Success Notification */}
      {updateSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 flex items-center gap-3"
        >
          <FaCheckCircle className="text-emerald-500 text-lg flex-shrink-0" />
          <span>Profile updated successfully! Your details are up to date.</span>
        </motion.div>
      )}

      {/* Profile Incomplete Banner */}
      {isProfileIncomplete && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-amber-50/90 border border-amber-300 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-amber-600 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-900 text-base">Your profile is incomplete</h4>
              <p className="text-sm text-amber-700 mt-0.5">
                Please complete your profile details to ensure accurate records and institutional updates.
              </p>
            </div>
          </div>
          <Button variant="primary" leftIcon={FaEdit} onClick={handleEdit} className="bg-amber-600 hover:bg-amber-700 border-none text-white whitespace-nowrap">
            Complete Profile Now
          </Button>
        </motion.div>
      )}

      {/* Email Verification Banner */}
      {isEmailUnverified && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-indigo-50/90 border border-indigo-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <FaShieldAlt className="text-indigo-600 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-indigo-900 text-base">Verify your email address</h4>
              <p className="text-sm text-indigo-700 mt-0.5">
                Verify <strong>{user.email}</strong> via Brevo to receive critical security and attendance notifications.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            leftIcon={FaPaperPlane}
            onClick={() => setIsVerifyModalOpen(true)}
            className="whitespace-nowrap"
          >
            Verify Email
          </Button>
        </motion.div>
      )}

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ProfileCard
            user={user}
            defaultImage={DEFAULT_IMAGE}
            onOpenVerify={() => setIsVerifyModalOpen(true)}
          />
        </div>
        <div className="lg:col-span-2">
          <InfoCard user={user} />
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
            <p className="text-sm text-ink-soft">
              We send a 6-digit verification code to <strong>{user.email}</strong> via Brevo email service.
            </p>

            {verifyError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {verifyError}
              </div>
            )}

            {verifyMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
                {verifyMsg}
              </div>
            )}

            {!otpSent ? (
              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  leftIcon={FaPaperPlane}
                  isLoading={verifySending}
                  onClick={handleSendVerificationCode}
                >
                  Send Verification Code
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <Input
                  label="Enter 6-Digit Code"
                  placeholder="e.g. 123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 justify-center"
                    onClick={handleSendVerificationCode}
                    isLoading={verifySending}
                  >
                    Resend Code
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 justify-center"
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
    </motion.div>
  );
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-24">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full"
    />
  </div>
);

const ErrorDisplay = ({ error }) => (
  <div className="flex flex-col justify-center items-center py-24">
    <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center shadow-card">
      <FaExclamationTriangle className="text-red-500 text-5xl mx-auto mb-4" />
      <h2 className="text-xl font-bold text-red-700 mb-2">Error Loading Profile</h2>
      <p className="text-red-600 mb-4">{error}</p>
      <Button variant="primary" onClick={() => window.location.reload()}>
        Try Again
      </Button>
    </div>
  </div>
);

const ProfileCard = ({ user, defaultImage, onOpenVerify }) => (
  <Card padding="none" hoverable>
    <div className="relative h-32 bg-gradient-to-r from-primary to-secondary">
      <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
        <div className="rounded-full overflow-hidden w-24 h-24 border-4 border-surface bg-background shadow-md">
          <img
            src={defaultImage}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
    <div className="pt-16 pb-6 px-6 text-center">
      <h2 className="text-2xl font-bold text-ink mb-1">{user.name}</h2>
      <p className="text-primary font-medium text-sm mb-3 flex items-center justify-center gap-1.5 uppercase tracking-wide">
        {user.role === 'admin' || user.role === 'super_admin' ? (
          <FaUserShield className="text-primary" />
        ) : user.role === 'teacher' ? (
          <FaUserTie className="text-primary" />
        ) : (
          <FaUserGraduate className="text-primary" />
        )}
        {user.role}
      </p>

      <div className="flex flex-wrap justify-center items-center gap-2 mb-4">
        {user.profileComplete ? (
          <Badge tone="emerald">Profile Complete</Badge>
        ) : (
          <Badge tone="amber">Profile Incomplete</Badge>
        )}

        {user.emailVerified ? (
          <Badge tone="emerald" className="cursor-default">
            <FaCheckCircle className="mr-1 inline" /> Verified Email
          </Badge>
        ) : (
          <button onClick={onOpenVerify}>
            <Badge tone="amber" className="hover:opacity-80 transition cursor-pointer">
              Unverified Email
            </Badge>
          </button>
        )}
      </div>

      <div className="text-xs text-ink-faint border-t border-line pt-3">
        ID: {user._id?.slice(-8)}
      </div>
    </div>
  </Card>
);

const InfoCard = ({ user }) => (
  <Card className="space-y-6">
    <h3 className="text-xl font-bold text-ink flex items-center gap-2">
      <FaUserGraduate className="text-primary" />
      Profile Details
    </h3>

    {/* Standard Information */}
    <div>
      <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-3">General Info</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoItem icon={FaEnvelope} label="Email" value={user.email} />
        <InfoItem icon={FaPhone} label="Phone Number" value={user.phone || 'Not provided'} />
        <InfoItem icon={FaMapMarkerAlt} label="Address" value={user.address || 'Not provided'} />
        <InfoItem icon={FaCalendarAlt} label="Joined Date" value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'} />
      </div>
    </div>

    {/* Student Academic & Parent Info */}
    {user.role === 'student' && (
      <>
        <div className="pt-4 border-t border-line">
          <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-3">Academic Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem icon={FaIdCard} label="Roll Number" value={user.rollNo || 'Not Assigned'} />
            <InfoItem icon={FaUserGraduate} label="Section" value={user.section || 'Not Assigned'} />
            {user.courseName && <InfoItem icon={FaUserGraduate} label="Course" value={user.courseName} />}
            {user.branch && <InfoItem icon={FaUserGraduate} label="Branch" value={user.branch} />}
          </div>
        </div>

        <div className="pt-4 border-t border-line">
          <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-3">Parent / Guardian Contact</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem icon={FaUserCircle} label="Parent Name" value={user.parentName || 'Not provided'} />
            <InfoItem icon={FaPhone} label="Parent Phone" value={user.parentPhone || 'Not provided'} />
            <InfoItem icon={FaEnvelope} label="Parent Email" value={user.parentEmail || 'Not provided'} />
          </div>
        </div>

        {user.attendance && (
          <div className="pt-4 border-t border-line">
            <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-3">Attendance Overview</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold text-primary">{user.attendance.totalClasses || 0}</p>
                <p className="text-xs text-ink-faint">Total Classes</p>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold text-emerald-600">{user.attendance.presentCount || 0}</p>
                <p className="text-xs text-ink-faint">Present</p>
              </div>
              <div className="text-center p-3 bg-background rounded-lg">
                <p className="text-2xl font-bold text-primary">{user.attendance.overallPercentage || 0}%</p>
                <p className="text-xs text-ink-faint">Percentage</p>
              </div>
            </div>
          </div>
        )}
      </>
    )}

    {/* Teacher Info */}
    {user.role === 'teacher' && (
      <div className="pt-4 border-t border-line">
        <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-3">Professional Qualifications</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoItem icon={FaIdCard} label="Employee / Roll ID" value={user.rollNo || 'N/A'} />
          <InfoItem icon={FaUserGraduate} label="Qualification" value={user.qualification || 'Not provided'} />
          <InfoItem icon={FaUserGraduate} label="Specialization" value={user.specialization || 'Not provided'} />
        </div>
      </div>
    )}
  </Card>
);

const InfoItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 p-3 bg-background rounded-lg">
    <Icon className="text-primary mt-0.5 flex-shrink-0" />
    <div className="flex-1">
      <p className="text-ink-faint text-xs font-medium">{label}</p>
      <p className="text-ink font-medium break-all text-sm mt-0.5">{value}</p>
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <div className="space-y-4">
          {/* General Fields for all roles */}
          <div>
            <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-3">General Information</h4>
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
            <div className="pt-4 border-t border-line">
              <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-3">Parent / Guardian Contact</h4>
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
            <div className="pt-4 border-t border-line">
              <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wider mb-3">Qualifications & Specialization</h4>
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
          <Button variant="outline" type="button" onClick={onCancel} leftIcon={FaTimes}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" leftIcon={FaSave}>
            Save Profile
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default Profile;
