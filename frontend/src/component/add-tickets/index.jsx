import axios from 'axios';
import React, { useState, useEffect } from 'react';

export default function Ticket(section) {
  const [formData, setFormData] = useState({
    section: localStorage.getItem('section') || '',
    rollNo: '',
    document: ''
  });
  useEffect(() => {
    const section = localStorage.getItem('section');
    if (section) {
      setFormData((prevFormData) => ({
        ...prevFormData,
        section
      }));
    }
    // console.log(section);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    try {
      const response = await axios.post('https://attend-ease-eight.vercel.app/api/tickets', formData);
      console.log(response.data);
      // console.log(formData);
      // Handle success, e.g., show a success message
    } catch (error) {
      console.error('Error creating ticket:', error);
      // Handle error, e.g., show an error message
    }
  };
  
  return (
    <div className="bg-gray-900 text-white h-screen flex flex-col justify-center items-center">
      <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4">Create Ticket:</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="section" className="block text-gray-300 font-medium">
              Section:
            </label>
            <input
              id="section"
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
              placeholder="Enter your section"
              value={formData.section}
              onChange={handleChange}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="rollNo" className="block text-gray-300 font-medium">
              Roll No:
            </label>
            <input
              id="rollNo"
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
              placeholder="Enter your roll no"
              value={formData.rollNo}
              onChange={handleChange}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="document" className="block text-gray-300 font-medium">
              Document:
            </label>
            <textarea
              id="document"
              className="mt-1 block w-full px-3 py-2 border border-purple-500 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm bg-gray-800 text-gray-300"
              placeholder="Enter your document details"
              value={formData.document}
              onChange={handleChange}
            ></textarea>
          </div>
          <button
            type="submit"
            className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors duration-300"
          >
            Submit
          </button>
        </form>
        {formData.section !== localStorage.getItem('section') && (
          <div className="text-red-500 mt-4">Section name does not match with the logged-in user's section</div>
        )}
      </div>
    </div>
  );
  
}
