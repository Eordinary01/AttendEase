import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { FaEnvelope, FaUserGraduate, FaIdCard, FaCalendarAlt, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

const Profile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState(null);
  const API_URL = process.env.REACT_APP_API_URL;
  const DEFAULT_IMAGE = 'https://example.com/default-avatar.png';

  useEffect(() => {
    const fetchUser = async () => {
      try {
        if (!userId) {
          console.error('User ID is undefined');
          setIsLoading(false);
          return;
        }
        const response = await axios.get(`${API_URL}/users/${userId}`);
        setUser(response.data);
        setEditedUser(response.data);
      } catch (error) {
        console.error('Error fetching user information:', error.response ? error.response.data : error.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
  }, [userId, API_URL]);

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    setIsEditing(false);
    setEditedUser(user);
  };

  const handleSave = async () => {
    try {
      const response = await axios.put(`${API_URL}/users/${userId}`, editedUser);
      setUser(response.data);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating user information:', error.response ? error.response.data : error.message);
    }
  };

  const handleChange = (e) => {
    setEditedUser({ ...editedUser, [e.target.name]: e.target.value });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen">User not found</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-gray-800 p-4"
    >
      <div className="max-w-4xl mx-auto">
        <Header user={user} onEdit={handleEdit} />
        <main className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <ProfileCard user={user} defaultImage={DEFAULT_IMAGE} />
          <InfoCard user={user} />
        </main>
      </div>
      <AnimatePresence>
        {isEditing && (
          <EditModal
            user={editedUser}
            onSave={handleSave}
            onCancel={handleCancel}
            onChange={handleChange}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const LoadingSpinner = () => (
  <div className="flex justify-center items-center min-h-screen">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full"
    />
  </div>
);

const Header = ({ user, onEdit }) => (
  <motion.header
    initial={{ y: -50 }}
    animate={{ y: 0 }}
    className="bg-white shadow-lg rounded-lg p-6 flex justify-center items-center"
  >
    <h1 className="text-3xl font-bold text-purple-600 ">{user.name}'s Profile</h1>
   
      
   
  </motion.header>
);

const ProfileCard = ({ user, defaultImage }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="bg-white shadow-lg rounded-lg overflow-hidden"
  >
    <div className="relative h-48 bg-purple-600">
      <img
        src={user.coverPhoto || 'https://example.com/default-cover.jpg'}
        alt="Cover"
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
        <div className="rounded-full overflow-hidden w-24 h-24 border-4 border-white">
          <img
            src={user.avatar || defaultImage}
            alt="Avatar"
            onError={(e) => { e.target.onerror = null; e.target.src = defaultImage; }}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </div>
    <div className="pt-16 pb-6 px-6 text-center">
      <h2 className="text-2xl font-bold">{user.name}</h2>
      <p className="text-purple-600">{user.role}</p>
      <p className="text-gray-600 mt-2">{user.bio}</p>
    </div>
  </motion.div>
);

const InfoCard = ({ user }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="bg-white shadow-lg rounded-lg p-6"
  >
    <h3 className="text-xl font-bold mb-4">Profile Dashboard</h3>
    <InfoItem icon={FaEnvelope} label="Email" value={user.email} />
    <InfoItem icon={FaUserGraduate} label="Section" value={user.section} />
    <InfoItem icon={FaIdCard} label="Roll Number" value={user.rollNo} />
    <InfoItem icon={FaCalendarAlt} label="Joined" value={new Date(user.createdAt).toLocaleDateString()} />
  </motion.div>
);

const InfoItem = ({ icon: Icon, label, value }) => (
  <motion.div
    whileHover={{ x: 5 }}
    className="flex items-center mb-3"
  >
    <Icon className="text-purple-600 mr-3" />
    <div>
      <p className="text-gray-600 text-sm">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  </motion.div>
);

const EditModal = ({ user, onSave, onCancel, onChange }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4"
  >
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0.9 }}
      className="bg-white rounded-lg p-6 max-w-2xl w-full"
    >
      <h2 className="text-2xl font-bold mb-4">Edit Profile</h2>
      <form onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            name="name"
            value={user.name}
            onChange={onChange}
            placeholder="Name"
            className="border rounded-md p-2"
          />
          <input
            type="email"
            name="email"
            value={user.email}
            onChange={onChange}
            placeholder="Email"
            className="border rounded-md p-2"
          />
          <input
            type="text"
            name="section"
            value={user.section}
            onChange={onChange}
            placeholder="Section"
            className="border rounded-md p-2"
          />
          <input
            type="text"
            name="rollNo"
            value={user.rollNo}
            onChange={onChange}
            placeholder="Roll Number"
            className="border rounded-md p-2"
          />
          <textarea
            name="bio"
            value={user.bio}
            onChange={onChange}
            placeholder="Bio"
            className="border rounded-md p-2 col-span-2"
            rows="3"
          ></textarea>
        </div>
        <div className="flex justify-end mt-4 space-x-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            className="bg-purple-600 text-white px-4 py-2 rounded-md flex items-center"
          >
            <FaSave className="mr-2" /> Save
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCancel}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md flex items-center"
          >
            <FaTimes className="mr-2" /> Cancel
          </motion.button>
        </div>
      </form>
    </motion.div>
  </motion.div>
);

export default Profile;