// src/components/SuperAdmin/TenantList.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { formatDateDMY } from '../../utils/dateUtils';
import { logError } from '../../utils/logger';
import {
  Building2,
  RefreshCw,
  Eye,
  Ban,
  CheckCircle,
  Trash2,
  ShieldAlert,
  Users,
  GraduationCap,
  Clock,
  ChevronRight,
} from 'lucide-react';
import Button from '../common/ui/Button';
import Badge from '../common/ui/Badge';
import Panel from '../common/ui/Panel';
import Table from '../common/ui/Table';
import StatTile from '../common/ui/StatTile';
import FilterBar from '../common/ui/FilterBar';
import Modal from '../common/ui/Modal';
import ErrorState from '../common/ui/ErrorState';

const TenantList = () => {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { type, tenantId, tenantName }

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/admin/super/tenants');
      if (response.data?.success) {
        setTenants(response.data.data || []);
      }
    } catch (err) {
      logError('Fetch Tenants', err);
      setError(err.response?.data?.message || 'Failed to retrieve institution tenants roster');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleSuspendTenant = async (tenantId) => {
    try {
      setActionLoading(tenantId);
      const response = await api.post(`/admin/super/tenants/${tenantId}/suspend`, {});
      if (response.data?.success) {
        setTenants((prev) =>
          prev.map((t) =>
            t._id === tenantId
              ? { ...t, subscription: { ...t.subscription, status: 'suspended' } }
              : t
          )
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to suspend tenant');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleActivateTenant = async (tenantId) => {
    try {
      setActionLoading(tenantId);
      const response = await api.post(`/admin/super/tenants/${tenantId}/activate`, {});
      if (response.data?.success) {
        setTenants((prev) =>
          prev.map((t) =>
            t._id === tenantId
              ? { ...t, subscription: { ...t.subscription, status: 'active' } }
              : t
          )
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to activate tenant');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const handleDeleteTenant = async (tenantId) => {
    try {
      setActionLoading(tenantId);
      const response = await api.delete(`/admin/super/tenants/${tenantId}`);
      if (response.data?.success) {
        setTenants((prev) => prev.filter((t) => t._id !== tenantId));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete tenant');
    } finally {
      setActionLoading(null);
      setConfirmModal(null);
    }
  };

  const getStatusTone = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'trial':
        return 'warning';
      case 'suspended':
      case 'expired':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const getPlanTone = (plan) => {
    switch (plan) {
      case 'free':
        return 'neutral';
      case 'basic':
        return 'primary';
      case 'professional':
        return 'secondary';
      case 'enterprise':
        return 'success';
      default:
        return 'neutral';
    }
  };

  // Filtered tenants list
  const filteredTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        tenant.name?.toLowerCase().includes(q) ||
        tenant.subdomain?.toLowerCase().includes(q) ||
        tenant.contact?.email?.toLowerCase().includes(q);

      const matchesPlan = !filterPlan || tenant.subscription?.plan === filterPlan;
      const matchesStatus = !filterStatus || tenant.subscription?.status === filterStatus;

      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [tenants, searchQuery, filterPlan, filterStatus]);

  // Summary counts
  const stats = useMemo(() => {
    const total = tenants.length;
    const active = tenants.filter((t) => t.subscription?.status === 'active').length;
    const trial = tenants.filter((t) => t.subscription?.status === 'trial').length;
    const suspended = tenants.filter(
      (t) => t.subscription?.status === 'suspended' || t.subscription?.status === 'expired'
    ).length;
    return { total, active, trial, suspended };
  }, [tenants]);

  const columns = [
    {
      header: 'Institution & Domain',
      cell: (row) => (
        <div>
          <div className="font-semibold text-ink flex items-center gap-2">
            <span>{row.name}</span>
          </div>
          <div className="text-[11px] font-mono tnum text-ink-muted flex items-center gap-1.5 mt-0.5">
            <span className="font-medium">{row.subdomain}.attendease.com</span>
            {row.contact?.email && (
              <>
                <span className="text-ink-faint">•</span>
                <span className="text-ink-muted">{row.contact.email}</span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Plan Tier',
      align: 'center',
      cell: (row) => (
        <Badge tone={getPlanTone(row.subscription?.plan || 'free')}>
          {(row.subscription?.plan || 'free').toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: (row) => (
        <Badge tone={getStatusTone(row.subscription?.status)} dot>
          {(row.subscription?.status || 'trial').toUpperCase()}
        </Badge>
      ),
    },
    {
      header: 'Campus Cohort',
      align: 'center',
      cell: (row) => (
        <div className="font-mono tnum text-xs">
          <span className="font-semibold text-ink">
            {row.stats?.totalStudents ? Number(row.stats.totalStudents).toLocaleString() : '0'}
          </span>
          <span className="text-ink-muted text-[10px] ml-1">students</span>
          <span className="text-ink-faint mx-1.5">/</span>
          <span className="font-semibold text-ink">
            {row.stats?.totalTeachers ? Number(row.stats.totalTeachers).toLocaleString() : '0'}
          </span>
          <span className="text-ink-muted text-[10px] ml-1">faculty</span>
        </div>
      ),
    },
    {
      header: 'Provisioned',
      align: 'right',
      cell: (row) => (
        <span className="font-mono tnum text-[11px] text-ink-muted whitespace-nowrap">
          {formatDateDMY(row.createdAt)}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="xs"
            onClick={() => navigate(`/super-admin/tenants/${row._id}`)}
            leftIcon={Eye}
            title="Inspect institution details"
          >
            Details
          </Button>

          {row.subscription?.status === 'active' || row.subscription?.status === 'trial' ? (
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                setConfirmModal({
                  type: 'suspend',
                  tenantId: row._id,
                  tenantName: row.name,
                })
              }
              disabled={actionLoading === row._id}
              leftIcon={Ban}
              title="Suspend institution access"
            >
              Suspend
            </Button>
          ) : (
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                setConfirmModal({
                  type: 'activate',
                  tenantId: row._id,
                  tenantName: row.name,
                })
              }
              disabled={actionLoading === row._id}
              leftIcon={CheckCircle}
              title="Activate institution"
            >
              Activate
            </Button>
          )}

          <Button
            variant="danger"
            size="xs"
            onClick={() =>
              setConfirmModal({
                type: 'delete',
                tenantId: row._id,
                tenantName: row.name,
              })
            }
            disabled={actionLoading === row._id}
            leftIcon={Trash2}
            title="Purge tenant"
          >
            Purge
          </Button>
        </div>
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
              Campus & Institution Tenants Directory
            </h1>
            <Badge tone="primary">Multi-Tenancy Master</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Governing {filteredTenants.length} of {tenants.length} provisioned campus instances and
            domains
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTenants}
            loading={loading}
            leftIcon={RefreshCw}
          >
            Refresh Roster
          </Button>
        </div>
      </div>

      {/* Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatTile
          label="Provisioned Campuses"
          value={stats.total.toLocaleString()}
          subtitle="All tenant accounts created"
          icon={Building2}
        />
        <StatTile
          label="Active Subscriptions"
          value={stats.active.toLocaleString()}
          subtitle="In full operational standing"
          icon={CheckCircle}
        />
        <StatTile
          label="Trial Deployments"
          value={stats.trial.toLocaleString()}
          subtitle="Evaluation pilot periods"
          icon={Clock}
        />
        <StatTile
          label="Suspended / Expired"
          value={stats.suspended.toLocaleString()}
          subtitle="Access blocked by policy"
          icon={ShieldAlert}
        />
      </div>

      {/* Main Ledger Panel */}
      <Panel
        title="Institution Registry Roster"
        subtitle="Manage billing status, subscription entitlements, and institutional access"
        tools={
          <FilterBar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by campus, subdomain, or admin email..."
            filters={[
              {
                id: 'plan',
                label: 'Plan Tier',
                value: filterPlan,
                onChange: setFilterPlan,
                options: [
                  { value: '', label: 'All Plans' },
                  { value: 'free', label: 'Free Tier' },
                  { value: 'basic', label: 'Basic' },
                  { value: 'professional', label: 'Professional' },
                  { value: 'enterprise', label: 'Enterprise' },
                ],
              },
              {
                id: 'status',
                label: 'Lifecycle Status',
                value: filterStatus,
                onChange: setFilterStatus,
                options: [
                  { value: '', label: 'All Statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'trial', label: 'Trial' },
                  { value: 'suspended', label: 'Suspended' },
                  { value: 'expired', label: 'Expired' },
                ],
              },
            ]}
            onReset={() => {
              setSearchQuery('');
              setFilterPlan('');
              setFilterStatus('');
            }}
          />
        }
      >
        {error ? (
          <ErrorState
            title="Institution Ledger Unavailable"
            message={error}
            onRetry={fetchTenants}
          />
        ) : (
          <Table
            columns={columns}
            data={filteredTenants}
            keyField="_id"
            loading={loading}
            emptyMessage="No campus tenant instances match the specified search or filter criteria."
          />
        )}
      </Panel>

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        title={
          confirmModal?.type === 'delete'
            ? 'Purge Tenant Instance'
            : confirmModal?.type === 'suspend'
            ? 'Suspend Tenant Account'
            : 'Activate Tenant Account'
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmModal(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmModal?.type === 'delete' ? 'danger' : 'primary'}
              size="sm"
              loading={!!actionLoading}
              onClick={() => {
                if (!confirmModal) return;
                if (confirmModal.type === 'delete') {
                  handleDeleteTenant(confirmModal.tenantId);
                } else if (confirmModal.type === 'suspend') {
                  handleSuspendTenant(confirmModal.tenantId);
                } else {
                  handleActivateTenant(confirmModal.tenantId);
                }
              }}
            >
              {actionLoading
                ? 'Applying...'
                : confirmModal?.type === 'delete'
                ? 'Permanently Purge'
                : confirmModal?.type === 'suspend'
                ? 'Confirm Suspension'
                : 'Confirm Activation'}
            </Button>
          </>
        }
      >
        <p className="text-xs text-ink-muted leading-relaxed">
          {confirmModal?.type === 'delete'
            ? `Are you sure you want to permanently purge "${confirmModal?.tenantName}"? This action irreversibly removes all student cohorts, attendance logs, and administrative records.`
            : confirmModal?.type === 'suspend'
            ? `Are you sure you want to suspend "${confirmModal?.tenantName}"? All faculty, staff, and students of this institution will immediately lose system access.`
            : `Activate institution "${confirmModal?.tenantName}"? Authorized campus users will immediately regain platform access.`}
        </p>
      </Modal>
    </div>
  );
};

export default TenantList;
