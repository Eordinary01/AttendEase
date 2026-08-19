import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Plus, Trash2, Save } from "lucide-react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import PageHeader from "../common/ui/PageHeader";
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
        <div className="w-16 h-16 border-4 border-primary-soft border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Exam Configuration"
        subtitle="Configure exam types, shifts, and periods for your institution"
        icon={Settings}
      />

      {/* Exam Types */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-ink">Exam Types</h3>
            <p className="text-sm text-ink-soft">Define the types of exams your institution administers</p>
          </div>
          <Button variant="outline" size="sm" leftIcon={Plus} onClick={addExamType}>Add Type</Button>
        </div>
        <div className="space-y-3">
          {examTypes.map((type, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-background border border-line">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                <Input label="Name" value={type.name} onChange={(e) => updateExamType(idx, "name", e.target.value)} placeholder="e.g. In-Term 1" />
                <Input label="Code" value={type.code} onChange={(e) => updateExamType(idx, "code", e.target.value)} placeholder="e.g. inTerm1" />
                <Input label="Default Duration (min)" type="number" value={type.defaultDuration} onChange={(e) => updateExamType(idx, "defaultDuration", parseInt(e.target.value) || 0)} />
                <Input label="Default Max Marks" type="number" value={type.defaultMaxMarks || ""} onChange={(e) => updateExamType(idx, "defaultMaxMarks", parseInt(e.target.value) || null)} />
              </div>
              <button onClick={() => removeExamType(idx)} className="mt-6 p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <Button onClick={handleSaveExamTypes} leftIcon={Save} loading={saving}>Save Exam Types</Button>
      </Card>

      {/* Shifts */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-ink">Shifts</h3>
            <p className="text-sm text-ink-soft">Define time shifts for exam scheduling (e.g., morning/afternoon)</p>
          </div>
          <Button variant="outline" size="sm" leftIcon={Plus} onClick={addShift}>Add Shift</Button>
        </div>
        <div className="space-y-3">
          {shifts.map((shift, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-line">
              <div className="grid grid-cols-3 gap-3 flex-1">
                <Input label="Shift Name" value={shift.name} onChange={(e) => updateShift(idx, "name", e.target.value)} placeholder="e.g. I, II, III" />
                <Input label="Start Time" type="time" value={shift.startTime} onChange={(e) => updateShift(idx, "startTime", e.target.value)} />
                <Input label="End Time" type="time" value={shift.endTime} onChange={(e) => updateShift(idx, "endTime", e.target.value)} />
              </div>
              <button onClick={() => removeShift(idx)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <Button onClick={handleSaveShifts} leftIcon={Save} loading={saving}>Save Shifts</Button>
      </Card>

      {/* Exam Periods */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-ink">Exam Periods</h3>
            <p className="text-sm text-ink-soft">Define time windows for exam scheduling (e.g., Mid-Semester, End-Semester)</p>
          </div>
          <Button variant="outline" size="sm" leftIcon={Plus} onClick={addPeriod}>Add Period</Button>
        </div>
        <div className="space-y-3">
          {periods.map((period, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-line">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
                <Input label="Period Name" value={period.name} onChange={(e) => updatePeriod(idx, "name", e.target.value)} placeholder="e.g. Mid-Sem 1" />
                <Input label="Start Date" type="date" value={period.startDate?.split("T")[0] || ""} onChange={(e) => updatePeriod(idx, "startDate", e.target.value)} />
                <Input label="End Date" type="date" value={period.endDate?.split("T")[0] || ""} onChange={(e) => updatePeriod(idx, "endDate", e.target.value)} />
                <Input label="Exam Type Code" value={period.examTypeCode || ""} onChange={(e) => updatePeriod(idx, "examTypeCode", e.target.value)} placeholder="e.g. inTerm1" />
              </div>
              <button onClick={() => removePeriod(idx)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <Button onClick={handleSavePeriods} leftIcon={Save} loading={saving}>Save Periods</Button>
      </Card>
    </motion.div>
  );
};

const ExamStructureConfig = () => (
  <PlanGate requiredModule="examStructure">
    <ExamStructureContent />
  </PlanGate>
);

export default ExamStructureConfig;
