import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaEnvelope, 
  FaUserGraduate, 
  FaIdCard, 
  FaCalendarAlt, 
  FaEdit, 
  FaSave, 
  FaTimes,
  FaSpinner,
  FaExclamationTriangle,
  FaUserCircle,
  FaPhone,
  FaMapMarkerAlt
} from 'react-icons/fa';

const Profile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);
  const [editedUser, setEditedUser] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  
  const API_URL = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem('token');
  const DEFAULT_IMAGE = 'https://ui-avatars.com/api/?background=8b5cf6&color=fff&bold=true';

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        if (!userId) {
          console.error('User ID is undefined');
          setError('User ID not found');
          setIsLoading(false);
          return;
        }

        if (!token) {
          console.error('No authentication token found');
          setError('Please login again');
          setIsLoading(false);
          return;
        }

        console.log('Fetching user with ID:', userId);
        
        const response = await axios.get(`${API_URL}/users/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        setUser(response.data);
        setEditedUser(response.data);
        console.log('Fetched user data:', response.data);
      } catch (error) {
        console.error('Error fetching user information:', error.response ? error.response.data : error.message);
        
        if (error.response?.status === 401) {
          setError('Session expired. Please login again.');
          // Optionally redirect to login
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
  }, [userId, API_URL, token]);

  const handleEdit = () => setIsEditing(true);
  
  const handleCancel = () => {
    setIsEditing(false);
    setEditedUser(user);
    setUpdateSuccess(false);
  };

  const handleSave = async () => {
    try {
      setError(null);
      
      const response = await axios.put(`${API_URL}/users/${userId}`, editedUser, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      setUser(response.data);
      setUpdateSuccess(true);
      setIsEditing(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating user information:', error.response ? error.response.data : error.message);
      setError(error.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleChange = (e) => {
    setEditedUser({ ...editedUser, [e.target.name]: e.target.value });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorDisplay error={error} />;
  }

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen text-white">User not found</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 p-4"
    >
      <div className="max-w-6xl mx-auto">
        <Header user={user} onEdit={handleEdit} isEditing={isEditing} />
        
        {updateSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400"
          >
            Profile updated successfully!
          </motion.div>
        )}
        
        <main className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <ProfileCard user={user} defaultImage={DEFAULT_IMAGE} />
          </div>
          <div className="lg:col-span-2">
            <InfoCard user={user} />
          </div>
        </main>
      </div>

      <AnimatePresence>
        {isEditing && (
          <EditModal
            user={editedUser}
            onSave={handleSave}
            onCancel={handleCancel}
            onChange={handleChange}
            error={error}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full"
    />
  </div>
);

const ErrorDisplay = ({ error }) => (
  <div className="flex flex-col justify-center items-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-purple-900 p-4">
    <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-8 max-w-md text-center">
      <FaExclamationTriangle className="text-red-500 text-5xl mx-auto mb-4" />
      <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Profile</h2>
      <p className="text-gray-300 mb-4">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
      >
        Try Again
      </button>
    </div>
  </div>
);

const Header = ({ user, onEdit, isEditing }) => (
  <motion.header
    initial={{ y: -50 }}
    animate={{ y: 0 }}
    className="bg-white/10 backdrop-blur-md rounded-xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4"
  >
    <div className="flex items-center gap-4">
      <FaUserCircle className="text-5xl text-purple-400" />
      <div>
        <h1 className="text-2xl font-bold text-white">{user.name}'s Profile</h1>
        <p className="text-purple-300 text-sm">{user.role?.toUpperCase()}</p>
      </div>
    </div>
    {!isEditing && (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onEdit}
        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
      >
        <FaEdit /> Edit Profile
      </motion.button>
    )}
  </motion.header>
);

const ProfileCard = ({ user, defaultImage }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    whileHover={{ y: -5 }}
    className="bg-white/10 backdrop-blur-md rounded-xl overflow-hidden"
  >
    <div className="relative h-32 bg-gradient-to-r from-purple-600 to-indigo-600">
      <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2">
        <div className="rounded-full overflow-hidden w-24 h-24 border-4 border-white bg-gray-700">
          <img
            src={defaultImage}
            alt="Avatar"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
    <div className="pt-16 pb-6 px-6 text-center">
      <h2 className="text-2xl font-bold text-white mb-1">{user.name}</h2>
      <p className="text-purple-300 text-sm mb-3">{user.role}</p>
      <div className="flex justify-center gap-2">
        {/* <span className={`px-2 py-1 rounded-full text-xs ${
          user.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {user.isActive ? 'Active' : 'Inactive'}
        </span> */}
        <span className="px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-400">
          ID: {user._id?.slice(-8)}
        </span>
      </div>
    </div>
  </motion.div>
);

const InfoCard = ({ user }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    whileHover={{ y: -5 }}
    className="bg-white/10 backdrop-blur-md rounded-xl p-6"
  >
    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
      <FaUserGraduate className="text-purple-400" />
      Profile Information
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <InfoItem icon={FaEnvelope} label="Email" value={user.email} />
      <InfoItem icon={FaUserGraduate} label="Section" value={user.section || 'Not Assigned'} />
      <InfoItem icon={FaIdCard} label="Roll Number" value={user.rollNo || 'Not Assigned'} />
      <InfoItem icon={FaCalendarAlt} label="Joined" value={new Date(user.createdAt).toLocaleDateString()} />
      {user.phone && <InfoItem icon={FaPhone} label="Phone" value={user.phone} />}
      {user.address && <InfoItem icon={FaMapMarkerAlt} label="Address" value={user.address} />}
    </div>
    
    {/* Additional Stats for Students */}
    {user.role === 'student' && user.attendance && (
      <div className="mt-6 pt-6 border-t border-white/10">
        <h4 className="text-lg font-semibold text-white mb-4">Attendance Summary</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-white/5 rounded-lg">
            <p className="text-2xl font-bold text-purple-400">{user.attendance.totalClasses || 0}</p>
            <p className="text-xs text-gray-400">Total Classes</p>
          </div>
          <div className="text-center p-3 bg-white/5 rounded-lg">
            <p className="text-2xl font-bold text-green-400">{user.attendance.presentCount || 0}</p>
            <p className="text-xs text-gray-400">Present</p>
          </div>
          <div className="text-center p-3 bg-white/5 rounded-lg">
            <p className="text-2xl font-bold text-purple-400">{user.attendance.overallPercentage || 0}%</p>
            <p className="text-xs text-gray-400">Overall</p>
          </div>
        </div>
      </div>
    )}
  </motion.div>
);

const InfoItem = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
    <Icon className="text-purple-400 mt-0.5 flex-shrink-0" />
    <div className="flex-1">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-white font-medium break-all">{value || 'Not provided'}</p>
    </div>
  </div>
);

const EditModal = ({ user, onSave, onCancel, onChange, error }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center p-4 z-50"
    onClick={onCancel}
  >
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0.9 }}
      className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-2xl font-bold text-white mb-4">Edit Profile</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      
      <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-400 text-sm mb-1">Full Name</label>
            <input
              type="text"
              name="name"
              value={user.name || ''}
              onChange={onChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Email</label>
            <input
              type="email"
              name="email"
              value={user.email || ''}
              onChange={onChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Section</label>
            <input
              type="text"
              name="section"
              value={user.section || ''}
              onChange={onChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Roll Number</label>
            <input
              type="text"
              name="rollNo"
              value={user.rollNo || ''}
              onChange={onChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-gray-400 text-sm mb-1">Phone</label>
            <input
              type="tel"
              name="phone"
              value={user.phone || ''}
              onChange={onChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-gray-400 text-sm mb-1">Address</label>
            <textarea
              name="address"
              value={user.address || ''}
              onChange={onChange}
              rows="2"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
        
        <div className="flex justify-end mt-6 space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onCancel}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition flex items-center gap-2"
          >
            <FaTimes /> Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
          >
            <FaSave /> Save Changes
          </motion.button>
        </div>
      </form>
    </motion.div>
  </motion.div>
);

export default Profile;