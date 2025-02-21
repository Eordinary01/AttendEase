import React, { useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import axios from 'axios';

const ITEMS_PER_PAGE = 10;

const AttendanceDetailModal = ({ isOpen, onClose, subject, token, API_URL }) => {
  const [attendanceDetails, setAttendanceDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!isOpen || !subject) return;

    const fetchAttendanceDetails = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await axios.get(`${API_URL}/attendance/details`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { subjectCode: subject.code },
        });

        setAttendanceDetails(response.data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (err) {
        console.error('Error fetching attendance details:', err);
        setError('Failed to fetch attendance details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceDetails();
  }, [isOpen, subject, token, API_URL]);

  const totalPages = Math.ceil(attendanceDetails.length / ITEMS_PER_PAGE);
  const currentData = attendanceDetails.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <Transition show={isOpen} as={React.Fragment}>
          <Dialog as="div" className="fixed inset-0 z-50 flex items-center justify-center p-4" onClose={onClose}>
            <div className="fixed inset-0 bg-black bg-opacity-50" aria-hidden="true" />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 p-6 rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto relative"
            >
              <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                <X size={20} />
              </button>
              <h2 className="text-lg font-semibold text-white mb-4">
                Attendance Details - {subject.name} ({subject.code})
              </h2>

              {loading ? (
                <p className="text-center text-gray-400">Loading attendance details...</p>
              ) : error ? (
                <p className="text-center text-red-500">{error}</p>
              ) : attendanceDetails.length === 0 ? (
                <p className="text-center text-gray-400">No attendance records found for this subject.</p>
              ) : (
                <>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-700">
                        <th className="p-2 text-left text-gray-300">Date</th>
                        <th className="p-2 text-left text-gray-300">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentData.map((record) => (
                        <tr key={record.date} className="odd:bg-gray-800 even:bg-gray-700 hover:bg-gray-600">
                          <td className="p-2 text-gray-300">
                            {new Date(record.date).getDate()}/
                            {new Date(record.date).getMonth() + 1}/
                            {new Date(record.date).getFullYear()}
                          </td>
                          <td className="p-2">
                            <span className={`px-2 py-1 rounded-full text-sm font-medium ${record.status === 'present' ? 'bg-green-500 bg-opacity-20 text-green-400' : 'bg-red-500 bg-opacity-20 text-red-400'}`}>
                              {record.status === 'present' ? 'Present' : 'Absent'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {totalPages > 1 && (
                    <div className="flex justify-center mt-4">
                      <button
                        onClick={() => setCurrentPage((prev) => prev - 1)}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-gray-700 text-gray-400 rounded-md hover:bg-gray-600 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage((prev) => prev + 1)}
                        disabled={currentPage === totalPages}
                        className="ml-2 px-4 py-2 bg-gray-700 text-gray-400 rounded-md hover:bg-gray-600 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </Dialog>
        </Transition>
      )}
    </AnimatePresence>
  );
};

export default AttendanceDetailModal;
