import React, { useEffect, useState } from 'react';
import { Calendar, Loader2, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import { formatDateReadable } from '../../utils/dateUtils';
import { logError } from '../../utils/logger';
import Modal from '../common/ui/Modal';
import Table from '../common/ui/Table';
import Badge from '../common/ui/Badge';
import UniversalSpinner from '../common/ui/UniversalSpinner';

const ITEMS_PER_PAGE = 10;

const AttendanceDetailModal = ({ isOpen, onClose, subject, token }) => {
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
        const response = await api.get('/attendance/details', {
          params: { subjectCode: subject.code },
        });

        setAttendanceDetails(response.data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      } catch (err) {
        logError("Fetch Attendance Details", err);
        setError('Failed to fetch attendance details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceDetails();
  }, [isOpen, subject, token]);

  const totalPages = Math.ceil(attendanceDetails.length / ITEMS_PER_PAGE);
  const currentData = attendanceDetails.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const columns = [
    {
      header: 'Session Date',
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-ink-faint" />
          {formatDateReadable(row.date, false, 'N/A')}
        </span>
      ),
    },
    {
      header: 'Status state',
      cell: (row) => (
        <Badge tone={row.status === 'present' ? 'success' : 'danger'}>
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Attendance Registry Details"
      size="md"
    >
      {subject && (
        <p className="text-xs text-ink-soft font-semibold mb-4">
          {subject.name || "Subject Details"} · <strong className="text-primary font-mono">{subject.code || "Code"}</strong>
        </p>
      )}

      {loading ? (
        <UniversalSpinner label="Retrieving session records..." />
      ) : error ? (
        <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center text-xs text-red-600 flex flex-col items-center justify-center gap-2 py-8">
          <AlertCircle className="w-6 h-6 text-red-500" />
          <strong>Error Loading Logs</strong>
          <span>{error}</span>
        </div>
      ) : (
        <Table
          columns={columns}
          data={currentData}
          emptyTitle="No attendance history"
          emptyMessage="No attendance history matches this subject code."
          pagination={{ page: currentPage, pages: totalPages, limit: ITEMS_PER_PAGE, total: attendanceDetails.length }}
          onPageChange={(page) => setCurrentPage(page)}
        />
      )}
    </Modal>
  );
};

export default AttendanceDetailModal;
