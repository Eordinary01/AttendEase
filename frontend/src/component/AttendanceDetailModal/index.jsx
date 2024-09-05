import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { FaTimes } from 'react-icons/fa';


const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; 
`;

const ModalContainer = styled(motion.div)`
  background-color: #1F2937;
  padding: 2rem;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  color: #9CA3AF;
  cursor: pointer;
  font-size: 1.5rem;
`;

const SubjectTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #E5E7EB;
`;

const AttendanceTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const TableHeader = styled.th`
  background-color: #374151;
  padding: 0.75rem;
  text-align: left;
  color: #9CA3AF;
  font-weight: 500;
  font-size: 0.9rem;
`;

const TableRow = styled.tr`
  &:nth-child(even) {
    background-color: #2D3748;
  }
  &:hover {
    background-color: #4B5563;
  }
`;

const TableData = styled.td`
  padding: 0.75rem;
  color: #D1D5DB;
  font-size: 0.9rem;
`;

const StatusBadge = styled.span`
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 500;
  color: ${({ status }) => (status === 'Present' ? '#10B981' : '#EF4444')};
  background-color: ${({ status }) => (status === 'Present' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)')};
`;

const LoadingMessage = styled.p`
  text-align: center;
  color: #9CA3AF;
  font-size: 1rem;
`;

const ErrorMessage = styled.p`
  text-align: center;
  color: #EF4444;
  font-size: 1rem;
`;

const NoDataMessage = styled.p`
  text-align: center;
  color: #9CA3AF;
  font-size: 1rem;
`;

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-top: 1rem;
`;

const PaginationButton = styled.button`
  background-color: #374151;
  color: #9CA3AF;
  padding: 0.5rem 1rem;
  margin: 0 0.25rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;

  &:disabled {
    background-color: #1F2937;
    color: #4B5563;
    cursor: not-allowed;
  }

  &:hover:not(:disabled) {
    background-color: #4B5563;
  }
`;

const ITEMS_PER_PAGE = 10;
const API_URL = process.env.REACT_APP_API_URL;

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

        setAttendanceDetails(response.data);
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
        <Overlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ModalContainer
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
          >
            <CloseButton onClick={onClose}>
              <FaTimes />
            </CloseButton>
            <SubjectTitle>Attendance Details - {subject.name} ({subject.code})</SubjectTitle>

            {loading ? (
              <LoadingMessage>Loading attendance details...</LoadingMessage>
            ) : error ? (
              <ErrorMessage>{error}</ErrorMessage>
            ) : attendanceDetails.length === 0 ? (
              <NoDataMessage>No attendance records found for this subject.</NoDataMessage>
            ) : (
              <>
                <AttendanceTable>
                  <thead>
                    <tr>
                      <TableHeader>Date</TableHeader>
                      <TableHeader>Status</TableHeader>
                    </tr>
                  </thead>
                  <tbody>
                    {currentData.map((record) => (
                      <TableRow key={record.date}>
                        <TableData>{new Date(record.date).toLocaleDateString()}</TableData>
                        <TableData>
                          <StatusBadge status={record.status === 'present' ? 'Present' : 'Absent'}>
                            {record.status === 'present' ? 'Present' : 'Absent'}
                          </StatusBadge>
                        </TableData>
                      </TableRow>
                    ))}
                  </tbody>
                </AttendanceTable>

                {totalPages > 1 && (
                  <PaginationContainer>
                    <PaginationButton
                      onClick={() => setCurrentPage((prev) => prev - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </PaginationButton>
                    <PaginationButton
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </PaginationButton>
                  </PaginationContainer>
                )}
              </>
            )}
          </ModalContainer>
        </Overlay>
      )}
    </AnimatePresence>
  );
};

export default AttendanceDetailModal;
