// src/components/SuperAdmin/LeadManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { formatDateDMY, formatDateTime } from '../../utils/dateUtils';
import { logError } from '../../utils/logger';
import {
  MessageSquare,
  Users,
  Calendar,
  AlertCircle,
  RefreshCw,
  Trash2,
  Phone,
  Building2,
  Mail,
  CheckCircle,
  Clock,
  ArrowUpDown,
} from 'lucide-react';
import Button from '../common/ui/Button';
import Badge from '../common/ui/Badge';
import Panel from '../common/ui/Panel';
import Table from '../common/ui/Table';
import StatTile from '../common/ui/StatTile';
import FilterBar from '../common/ui/FilterBar';
import Modal from '../common/ui/Modal';
import ErrorState from '../common/ui/ErrorState';

const LeadManager = () => {
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [leadStats, setLeadStats] = useState({
    total: 0,
    byType: {},
    byStatus: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    pages: 1,
  });

  const [deleteModal, setDeleteModal] = useState({ open: false, lead: null, deleting: false });
  const [updatingId, setUpdatingId] = useState(null);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      });

      const res = await api.get(`/admin/super/leads?${params}`);
      if (res.data?.success) {
        setLeads(res.data.data || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
        } else {
          setPagination({
            page,
            limit,
            total: (res.data.data || []).length,
            pages: 1,
          });
        }
      }
    } catch (err) {
      logError('Fetch Leads', err);
      setError(err.response?.data?.message || 'Failed to retrieve inbound inquiries');
    } finally {
      setLoading(false);
    }
  }, [page, limit, typeFilter, statusFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/super/leads/stats');
      if (res.data?.success) {
        setLeadStats(res.data.data || { total: 0, byType: {}, byStatus: {} });
      }
    } catch (err) {
      logError('Fetch Lead Stats', err);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      setUpdatingId(leadId);
      const res = await api.patch(`/admin/super/leads/${leadId}`, { status: newStatus });
      if (res.data?.success) {
        setLeads((prev) =>
          prev.map((l) => (l._id === leadId ? { ...l, status: newStatus } : l))
        );
        fetchStats();
      }
    } catch (err) {
      logError('Update Lead Status', err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteLead = async () => {
    if (!deleteModal.lead) return;
    try {
      setDeleteModal((prev) => ({ ...prev, deleting: true }));
      const res = await api.delete(`/admin/super/leads/${deleteModal.lead._id}`);
      if (res.data?.success) {
        setLeads((prev) => prev.filter((l) => l._id !== deleteModal.lead._id));
        setDeleteModal({ open: false, lead: null, deleting: false });
        fetchStats();
        fetchLeads();
      }
    } catch (err) {
      logError('Delete Lead', err);
      setDeleteModal((prev) => ({ ...prev, deleting: false }));
    }
  };

  const getStatusTone = (status) => {
    switch (status) {
      case 'new':
        return 'warning';
      case 'contacted':
        return 'primary';
      case 'converted':
        return 'success';
      case 'closed':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  const columns = [
    {
      header: 'Prospect & Contact',
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink">{row.name || 'Anonymous'}</div>
          <div className="text-[11px] text-ink-muted flex items-center gap-1.5 mt-0.5">
            <Mail className="w-3 h-3 text-ink-faint" />
            <span>{row.email || '—'}</span>
          </div>
          {row.phone && (
            <div className="text-[11px] text-ink-muted font-mono tnum flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3 h-3 text-ink-faint" />
              <span>{row.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Inquiry Type',
      align: 'center',
      cell: (row) => (
        <Badge tone={row.type === 'demo' ? 'secondary' : 'primary'}>
          {row.type === 'demo' ? 'Campus Demo' : 'General Contact'}
        </Badge>
      ),
    },
    {
      header: 'Institution & Cohort',
      cell: (row) => (
        <div>
          <div className="font-medium text-ink flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-ink-faint" />
            <span>{row.institutionName || 'Unspecified Campus'}</span>
          </div>
          {row.studentCount && (
            <div className="text-[11px] font-mono tnum text-ink-muted mt-0.5">
              {Number(row.studentCount).toLocaleString()} estimated students
            </div>
          )}
          {row.message && (
            <div className="text-[11px] text-ink-muted line-clamp-1 italic mt-0.5" title={row.message}>
              "{row.message}"
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Lifecycle Status',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge tone={getStatusTone(row.status)}>
            {row.status ? row.status.toUpperCase() : 'NEW'}
          </Badge>
          <select
            value={row.status || 'new'}
            onChange={(e) => handleStatusChange(row._id, e.target.value)}
            disabled={updatingId === row._id}
            aria-label={`Change status for ${row.name || 'lead'}`}
            className="text-[11px] font-sans border border-line rounded px-1.5 py-1 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="new">Mark New</option>
            <option value="contacted">Mark Contacted</option>
            <option value="converted">Mark Converted</option>
            <option value="closed">Mark Closed</option>
          </select>
        </div>
      ),
    },
    {
      header: 'Received',
      align: 'right',
      cell: (row) => (
        <span className="font-mono tnum text-[11px] text-ink-muted whitespace-nowrap">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <Button
          variant="danger"
          size="xs"
          onClick={() => setDeleteModal({ open: true, lead: row, deleting: false })}
          leftIcon={Trash2}
          title="Delete inquiry record"
        >
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">
              Inbound Inquiries & Admissions Ledger
            </h1>
            <Badge tone="primary">Institutional Pipeline</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Review enterprise campus inquiries, pilot requests, and direct sales contacts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchLeads();
              fetchStats();
            }}
            loading={loading}
            leftIcon={RefreshCw}
          >
            Refresh Ledger
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatTile
          label="Total Inbound Leads"
          value={leadStats.total.toLocaleString()}
          subtitle="All recorded prospective inquiries"
          icon={MessageSquare}
        />
        <StatTile
          label="Pending Initial Contact"
          value={(leadStats.byStatus?.new || 0).toLocaleString()}
          subtitle="Awaiting response by registrar"
          icon={Clock}
        />
        <StatTile
          label="Campus Demo Requests"
          value={(leadStats.byType?.demo || 0).toLocaleString()}
          subtitle="Institutional pilot demonstrations"
          icon={Building2}
        />
        <StatTile
          label="Direct Contact Requests"
          value={(leadStats.byType?.contact || 0).toLocaleString()}
          subtitle="General inquiries and questions"
          icon={Mail}
        />
      </div>

      {/* Main Ledger Panel */}
      <Panel
        title="Institutional Prospects Ledger"
        subtitle="Filter and process enterprise inquiries by institutional domain and status"
        tools={
          <FilterBar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="Search by name, email, institution..."
            filters={[
              {
                id: 'type',
                label: 'Inquiry Type',
                value: typeFilter,
                onChange: (v) => {
                  setTypeFilter(v);
                  setPage(1);
                },
                options: [
                  { value: '', label: 'All Types' },
                  { value: 'contact', label: 'Contact Forms' },
                  { value: 'demo', label: 'Campus Demos' },
                ],
              },
              {
                id: 'status',
                label: 'Lifecycle Status',
                value: statusFilter,
                onChange: (v) => {
                  setStatusFilter(v);
                  setPage(1);
                },
                options: [
                  { value: '', label: 'All Statuses' },
                  { value: 'new', label: 'New Inquiries' },
                  { value: 'contacted', label: 'Contacted' },
                  { value: 'converted', label: 'Converted' },
                  { value: 'closed', label: 'Closed' },
                ],
              },
            ]}
            onReset={() => {
              setSearch('');
              setTypeFilter('');
              setStatusFilter('');
              setPage(1);
            }}
          />
        }
      >
        {error ? (
          <ErrorState
            title="Inbound Inquiries Unavailable"
            message={error}
            onRetry={fetchLeads}
          />
        ) : (
          <Table
            columns={columns}
            data={leads}
            keyField="_id"
            loading={loading}
            emptyMessage="No prospective campus inquiries match the selected criteria."
            pagination={{
              page: pagination.page,
              pages: pagination.pages,
              total: pagination.total,
              onPageChange: (newPage) => setPage(newPage),
            }}
          />
        )}
      </Panel>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, lead: null, deleting: false })}
        title="Delete Inbound Inquiry"
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteModal({ open: false, lead: null, deleting: false })}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={deleteModal.deleting}
              onClick={handleDeleteLead}
            >
              Confirm Deletion
            </Button>
          </>
        }
      >
        <p className="text-xs text-ink-muted leading-relaxed">
          Are you sure you want to delete the inquiry from{' '}
          <strong className="text-ink">{deleteModal.lead?.name || 'this prospect'}</strong> (
          {deleteModal.lead?.institutionName || 'Unknown Institution'})? This record will be
          permanently purged from the administrative audit ledger.
        </p>
      </Modal>
    </div>
  );
};

export default LeadManager;
