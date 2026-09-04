import React, { useState, useEffect } from "react";
import { Settings, Plus, Trash2, Save, Layers, Clock, CalendarRange } from "lucide-react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import DashboardHeader from "../common/ui/DashboardHeader";
import Card from "../common/ui/Card";
import Button from "../common/ui/Button";
import Input from "../common/ui/Input";
import PlanGate from "../common/PlanGate";

const ExamStructureContent = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [examTypes, setExamTypes] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [periods, setPeriods] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [structRes, periodsRes] = await Promise.all([
        api.get("/exams/structure"),
        api.get("/exams/periods").catch(() => ({ data: { data: [] } })),
      ]);
      const struct = structRes.data?.data || {};
      setExamTypes(struct.examTypes || []);
      setShifts(struct.shifts || []);
      setPeriods(periodsRes.data?.data || []);
    } catch (err) {
      logError("Fetch Exam Structure", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExamTypes = async () => {
    try {
      setSaving(true);
      await api.put("/exams/structure", { examTypes });
    } catch (err) {
      logError("Save Exam Types", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveShifts = async () => {
    try {
      setSaving(true);
      await api.put("/exams/structure", { shifts });
    } catch (err) {
      logError("Save Shifts", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSavePeriods = async () => {
    try {
      setSaving(true);
      await api.put("/exams/periods", { examPeriods: periods });
    } catch (err) {
      logError("Save Periods", err);
    } finally {
      setSaving(false);
    }
  };

  const addExamType = () => {
    setExamTypes((p) => [...p, { name: "", code: "", defaultDuration: 75, defaultMaxMarks: 100, isActive: true }]);
  };

  const removeExamType = (idx) => {
    setExamTypes((p) => p.filter((_, i) => i !== idx));
  };

  const updateExamType = (idx, field, value) => {
    setExamTypes((p) => p.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const addShift = () => {
    setShifts((p) => [...p, { name: "", startTime: "09:00", endTime: "10:15", isActive: true }]);
  };

  const removeShift = (idx) => {
    setShifts((p) => p.filter((_, i) => i !== idx));
  };

  const updateShift = (idx, field, value) => {
    setShifts((p) => p.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const addPeriod = () => {
    setPeriods((p) => [...p, { name: "", startDate: "", endDate: "", examTypeCode: "" }]);
  };

  const removePeriod = (idx) => {
    setPeriods((p) => p.filter((_, i) => i !== idx));
  };

  const updatePeriod = (idx, field, value) => {
    setPeriods((p) => p.map((pt, i) => (i === idx ? { ...pt, [field]: value } : pt)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Examination Structure & Period Architecture"
        meta="Configure standard exam types, multi-shift timings, and active evaluation period windows"
      />

      {/* Exam Types */}
      <Card padding="lg" bordered className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-ink uppercase tracking-wider">Exam Evaluation Types</h3>
              <p className="text-xs text-ink-soft">Standard evaluation categories (e.g. Midterms, End-Semesters, Quizzes)</p>
            </div>
          </div>
          <Button variant="subtle" size="sm" leftIcon={Plus} onClick={addExamType}>Add Type</Button>
        </div>
        <div className="space-y-2.5">
          {examTypes.map((type, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-line/50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                <Input label="Name" value={type.name} onChange={(e) => updateExamType(idx, "name", e.target.value)} placeholder="e.g. In-Term 1" />
                <Input label="Code" value={type.code} onChange={(e) => updateExamType(idx, "code", e.target.value)} placeholder="e.g. inTerm1" />
                <Input label="Default Duration (min)" type="number" value={type.defaultDuration} onChange={(e) => updateExamType(idx, "defaultDuration", parseInt(e.target.value) || 0)} />
                <Input label="Default Max Marks" type="number" value={type.defaultMaxMarks || ""} onChange={(e) => updateExamType(idx, "defaultMaxMarks", parseInt(e.target.value) || null)} />
              </div>
              <button onClick={() => removeExamType(idx)} className="p-2 text-ink-faint hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="primary" size="sm" onClick={handleSaveExamTypes} leftIcon={Save} loading={saving}>Save Exam Types</Button>
        </div>
      </Card>

      {/* Shifts */}
      <Card padding="lg" bordered className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-ink uppercase tracking-wider">Exam Shifts & Timings</h3>
              <p className="text-xs text-ink-soft">Session time windows (e.g. Shift I: 09:00 - 10:15, Shift II: 11:00 - 12:15)</p>
            </div>
          </div>
          <Button variant="subtle" size="sm" leftIcon={Plus} onClick={addShift}>Add Shift</Button>
        </div>
        <div className="space-y-2.5">
          {shifts.map((shift, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-line/50">
              <div className="grid grid-cols-3 gap-3 flex-1">
                <Input label="Shift Name" value={shift.name} onChange={(e) => updateShift(idx, "name", e.target.value)} placeholder="e.g. I, II, III" />
                <Input label="Start Time" type="time" value={shift.startTime} onChange={(e) => updateShift(idx, "startTime", e.target.value)} />
                <Input label="End Time" type="time" value={shift.endTime} onChange={(e) => updateShift(idx, "endTime", e.target.value)} />
              </div>
              <button onClick={() => removeShift(idx)} className="p-2 text-ink-faint hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="primary" size="sm" onClick={handleSaveShifts} leftIcon={Save} loading={saving}>Save Shifts</Button>
        </div>
      </Card>

      {/* Exam Periods */}
      <Card padding="lg" bordered className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <CalendarRange className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-xs text-ink uppercase tracking-wider">Evaluation Period Windows</h3>
              <p className="text-xs text-ink-soft">Calendar date ranges for exam schedules (e.g. Mid-Sem 1, Term End Dec 2026)</p>
            </div>
          </div>
          <Button variant="subtle" size="sm" leftIcon={Plus} onClick={addPeriod}>Add Period</Button>
        </div>
        <div className="space-y-2.5">
          {periods.map((period, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-line/50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                <Input label="Period Name" value={period.name} onChange={(e) => updatePeriod(idx, "name", e.target.value)} placeholder="e.g. Mid-Sem 1" />
                <Input label="Start Date" type="date" value={period.startDate?.split("T")[0] || ""} onChange={(e) => updatePeriod(idx, "startDate", e.target.value)} />
                <Input label="End Date" type="date" value={period.endDate?.split("T")[0] || ""} onChange={(e) => updatePeriod(idx, "endDate", e.target.value)} />
                <Input label="Exam Type Code" value={period.examTypeCode || ""} onChange={(e) => updatePeriod(idx, "examTypeCode", e.target.value)} placeholder="e.g. inTerm1" />
              </div>
              <button onClick={() => removePeriod(idx)} className="p-2 text-ink-faint hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="primary" size="sm" onClick={handleSavePeriods} leftIcon={Save} loading={saving}>Save Periods</Button>
        </div>
      </Card>
    </div>
  );
};

const ExamStructureConfig = () => (
  <PlanGate requiredModule="examStructure">
    <ExamStructureContent />
  </PlanGate>
);

export default ExamStructureConfig;
