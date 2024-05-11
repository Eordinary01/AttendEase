import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const NewLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    section: ''
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('http://localhost:8011/api/login', formData);
      console.log(response.data);

      // Store token in local storage
      localStorage.setItem('token', response.data.token);

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Error logging in:', error);
      // Handle error, e.g., show an error message
    }
  };

  return (
    <div>
      <div className="bg-gray-900 text-white h-screen flex flex-col justify-center items-center">
        <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-semibold mb-4">Login</h2>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-gray-300 font-medium">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
                placeholder="Enter your Email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="block text-gray-300 font-medium">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
                placeholder="Enter your Password"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="section" className="block text-gray-300 font-medium">Section</label>
              <input
                id="section"
                name="section"
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
                placeholder="Enter your Section"
                value={formData.section}
                onChange={handleChange}
              />
            </div>
            <button
              type="submit"
              className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors duration-300"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewLogin;
