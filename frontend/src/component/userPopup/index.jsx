import React from 'react';

const NewUserPopup = ({ onYesClick, onNoClick }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md"></div>
      <div className="relative bg-gray-800 p-6 rounded-lg shadow-md z-10">
        <h2 className="text-xl font-semibold mb-4 text-white">Welcome to Attend Ease</h2>
        <p className="text-gray-300 mb-4">Are you a new user?</p>
        <div className="flex justify-center">
          <button
            onClick={onYesClick}
            className="bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition-colors duration-300 mr-2"
          >
            Yes
          </button>
          <button
            onClick={onNoClick}
            className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors duration-300"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewUserPopup;
