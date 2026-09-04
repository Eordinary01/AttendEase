import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  LayoutGrid,
  Users,
  DoorOpen,
  Layers,
} from "lucide-react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import Button from "../common/ui/Button";
import Card from "../common/ui/Card";
import Modal from "../common/ui/Modal";
import Badge from "../common/ui/Badge";
import DashboardHeader from "../common/ui/DashboardHeader";
import StatCard from "../common/ui/StatCard";

const ExamHallManager = () => {
  const [halls, setHalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHall, setEditingHall] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    hallCode: "",
    name: "",
    building: "Main Academic Block",
    floor: "1st Floor",
    rows: 8,
    cols: 5,
    benchCapacity: 1,
    isActive: true,
  });

  const fetchHalls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/exams/seating/halls");
      if (res.data?.success) {
        setHalls(res.data.data || []);
      }
    } catch (err) {
      logError("Failed to fetch exam halls", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHalls();
  }, [fetchHalls]);

  const handleOpenAdd = () => {
    setEditingHall(null);
    setFormData({
      hallCode: "",
      name: "",
      building: "Main Academic Block",
      floor: "1st Floor",
      rows: 8,
      cols: 5,
      benchCapacity: 1,
      isActive: true,
    });
    setErrorMsg("");
    setModalOpen(true);
  };

  const handleOpenEdit = (hall) => {
    setEditingHall(hall);
    setFormData({
      hallCode: hall.hallCode || "",
      name: hall.name || "",
      building: hall.building || "Main Academic Block",
      floor: hall.floor || "1st Floor",
      rows: hall.rows || 8,
      cols: hall.cols || 5,
      benchCapacity: hall.benchCapacity || 1,
      isActive: hall.isActive !== false,
    });
    setErrorMsg("");
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.hallCode || !formData.name) {
      setErrorMsg("Hall code and name are required.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    try {
      const payload = {
        hallCode: formData.hallCode.trim().toUpperCase(),
        name: formData.name.trim(),
        building: formData.building.trim(),
        floor: formData.floor.trim(),
        rows: parseInt(formData.rows, 10) || 8,
        cols: parseInt(formData.cols, 10) || 5,
        benchCapacity: parseInt(formData.benchCapacity, 10) || 1,
        isActive: formData.isActive,
      };

      if (editingHall) {
        await api.put(`/exams/seating/halls/${editingHall._id}`, payload);
      } else {
        await api.post("/exams/seating/halls", payload);
      }

      setModalOpen(false);
      fetchHalls();
    } catch (err) {
      logError("Save hall error", err);
      setErrorMsg(err.response?.data?.message || "Failed to save exam hall.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (hallId, hallCode) => {
    if (!window.confirm(`Are you sure you want to delete exam hall '${hallCode}'?`)) {
      return;
    }

    try {
      await api.delete(`/exams/seating/halls/${hallId}`);
      fetchHalls();
    } catch (err) {
      logError("Delete hall error", err);
      alert(err.response?.data?.message || "Failed to delete exam hall.");
    }
  };

  const filteredHalls = useMemo(() => {
    return halls.filter((h) => {
      const matchSearch =
        h.hallCode?.toLowerCase().includes(search.toLowerCase()) ||
        h.name?.toLowerCase().includes(search.toLowerCase()) ||
        h.building?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && h.isActive) ||
        (statusFilter === "inactive" && !h.isActive);
      return matchSearch && matchStatus;
    });
  }, [halls, search, statusFilter]);

  const totalCapacity = useMemo(() => {
    return halls.reduce((sum, h) => sum + (h.isActive ? (h.capacity || 0) : 0), 0);
  }, [halls]);

  const calculatedCapacity = (formData.rows || 1) * (formData.cols || 1) * (formData.benchCapacity || 1);

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Exam Venues & Capacity Grid Matrix"
        meta={`Manage physical examination rooms, layout dimensions, and seating capacity (${halls.length} halls registered, ${totalCapacity} total seats)`}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            leftIcon={Plus}
          >
            Add Exam Hall
          </Button>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatCard
          icon={DoorOpen}
          label="Registered Halls"
          value={halls.length}
          tone="primary"
        />
        <StatCard
          icon={Users}
          label="Total Seating Capacity"
          value={`${totalCapacity} seats`}
          tone="success"
        />
        <StatCard
          icon={CheckCircle}
          label="Active Venues"
          value={halls.filter((h) => h.isActive).length}
          tone="info"
        />
      </div>

      {/* Search & Filters */}
      <Card padding="md" bordered className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
          <input
            type="text"
            placeholder="Search by hall code, name, or building..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-line/50 rounded-xl text-ink outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-background border border-line/50 rounded-xl px-3 py-1.5 text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </Card>

      {/* Hall Cards Grid */}
      {loading ? (
        <div className="text-center py-16 text-ink-faint animate-pulse">Loading exam halls...</div>
      ) : filteredHalls.length === 0 ? (
        <Card padding="lg" className="text-center py-12 text-ink-faint space-y-4">
          <Building2 className="w-12 h-12 mx-auto text-primary opacity-60" />
          <div className="space-y-1">
            <h4 className="font-bold text-ink text-base">No examination halls configured yet</h4>
            <p className="text-xs text-ink-faint max-w-sm mx-auto">
              Get started by adding your institution's examination halls with custom rows, columns, and bench capacities.
            </p>
          </div>
          <Button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl shadow-sm hover:bg-primary-dark transition font-semibold text-xs mx-auto"
          >
            <Plus className="w-4 h-4" /> Add First Exam Hall
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredHalls.map((hall) => (
            <Card
              key={hall._id}
              padding="lg"
              className="space-y-4 hover:shadow-md transition-shadow relative border-line"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-ink">{hall.hallCode}</span>
                    <Badge variant={hall.isActive ? "success" : "neutral"}>
                      {hall.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <h4 className="text-sm text-ink-faint mt-0.5">{hall.name}</h4>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(hall)}
                    className="p-1.5 text-ink-faint hover:text-primary hover:bg-surface-alt rounded-lg transition"
                    title="Edit Hall"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(hall._id, hall.hallCode)}
                    className="p-1.5 text-ink-faint hover:text-red-600 hover:bg-red-500/10 rounded-lg transition"
                    title="Delete Hall"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Location & Specs */}
              <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-line/60">
                <div>
                  <span className="text-ink-faint block">Building</span>
                  <span className="font-medium text-ink">{hall.building || "Main Block"}</span>
                </div>
                <div>
                  <span className="text-ink-faint block">Floor</span>
                  <span className="font-medium text-ink">{hall.floor || "Ground Floor"}</span>
                </div>
                <div>
                  <span className="text-ink-faint block">Grid Dimension</span>
                  <span className="font-medium text-ink">
                    {hall.rows} Rows × {hall.cols} Columns
                  </span>
                </div>
                <div>
                  <span className="text-ink-faint block">Total Seats</span>
                  <span className="font-bold text-primary text-sm">{hall.capacity || 0} Seats</span>
                </div>
              </div>

              {/* Mini Interactive Preview Grid */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-ink-faint mb-1.5 font-medium">
                  <span className="flex items-center gap-1">
                    <LayoutGrid className="w-3 h-3 text-primary" /> Room Matrix Preview
                  </span>
                  <span>{hall.benchCapacity || 1} student/bench</span>
                </div>
                <div className="p-2 bg-surface-alt/60 border border-line rounded-lg flex flex-col gap-1 items-center overflow-x-auto max-h-24">
                  {Array.from({ length: Math.min(hall.rows, 5) }).map((_, r) => (
                    <div key={r} className="flex gap-1">
                      {Array.from({ length: Math.min(hall.cols, 8) }).map((_, c) => (
                        <div
                          key={c}
                          className="w-4 h-3 bg-primary/20 border border-primary/40 rounded-[2px]"
                          title={`Row ${r + 1}, Col ${c + 1}`}
                        />
                      ))}
                    </div>
                  ))}
                  {hall.rows > 5 && (
                    <span className="text-[9px] text-ink-faint opacity-70">
                      + {hall.rows - 5} more rows
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Exam Hall Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingHall ? `Edit Exam Hall: ${editingHall.hallCode}` : "Configure New Exam Hall"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Hall Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. HALL-101, AUD-A"
                value={formData.hallCode}
                onChange={(e) => setFormData({ ...formData, hallCode: e.target.value.toUpperCase() })}
                className="w-full text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-primary font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Hall Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Main Examination Hall 1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Building / Block</label>
              <input
                type="text"
                placeholder="e.g. Science Block, Annex"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                className="w-full text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Floor</label>
              <input
                type="text"
                placeholder="e.g. 1st Floor, Room 104"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className="w-full text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Rows</label>
              <input
                type="number"
                min="1"
                max="50"
                required
                value={formData.rows}
                onChange={(e) => setFormData({ ...formData, rows: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-full text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Columns</label>
              <input
                type="number"
                min="1"
                max="30"
                required
                value={formData.cols}
                onChange={(e) => setFormData({ ...formData, cols: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                className="w-full text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">Per Bench</label>
              <select
                value={formData.benchCapacity}
                onChange={(e) => setFormData({ ...formData, benchCapacity: parseInt(e.target.value, 10) })}
                className="w-full text-xs bg-surface border border-line rounded-lg px-3 py-2 text-ink focus:outline-none focus:border-primary"
              >
                <option value={1}>1 Student</option>
                <option value={2}>2 Students</option>
                <option value={3}>3 Students</option>
              </select>
            </div>
          </div>

          {/* Dynamic Grid Layout Preview */}
          <div className="p-3.5 bg-surface-alt/70 border border-line rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-ink flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" /> Seating Capacity Calculation
              </span>
              <span className="font-bold text-primary text-sm">
                Total Capacity: {calculatedCapacity} Seats
              </span>
            </div>
            <div className="py-2 border-t border-line/60 flex flex-col items-center gap-1 overflow-x-auto max-h-32">
              {Array.from({ length: Math.min(formData.rows, 6) }).map((_, r) => (
                <div key={r} className="flex gap-1">
                  {Array.from({ length: Math.min(formData.cols, 10) }).map((_, c) => (
                    <div
                      key={c}
                      className="w-5 h-4 bg-primary/20 border border-primary/50 rounded flex items-center justify-center text-[9px] text-primary font-bold"
                    >
                      {formData.benchCapacity > 1 ? formData.benchCapacity : ""}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="hallActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-line text-primary focus:ring-primary"
            />
            <label htmlFor="hallActive" className="text-xs text-ink font-medium">
              Active Exam Hall (Eligible for automated seating generation)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              className="text-xs px-4 py-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="text-xs px-4 py-2 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary-dark transition"
            >
              {saving ? "Saving..." : editingHall ? "Update Exam Hall" : "Create Exam Hall"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExamHallManager;
