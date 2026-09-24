import React, { useState, useEffect } from "react";
import { Calendar, Clock, Building2, User, BookOpen } from "lucide-react";
import api from "../utils/api";
import DashboardHeader from "./common/ui/DashboardHeader";
import Card from "./common/ui/Card";
import EmptyState from "./common/ui/EmptyState";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const parseGrouped = (resData) => {
  if (!resData) return {};
  if (resData.grouped && typeof resData.grouped === "object" && Object.keys(resData.grouped).length > 0) {
    return resData.grouped;
  }
  // Teacher endpoint returns { success, data: { Monday: [...], ... } }
  if (resData.data && typeof resData.data === "object" && !Array.isArray(resData.data)) {
    const hasDayKeys = Object.keys(resData.data).some(d => ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].includes(d));
    if (hasDayKeys) return resData.data;
  }
  const rawList = Array.isArray(resData.data)
    ? resData.data
    : Array.isArray(resData)
      ? resData
      : [];

  const grouped = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [], Sunday: [] };
  rawList.forEach((item) => {
    if (item.day) {
      if (!grouped[item.day]) grouped[item.day] = [];
      grouped[item.day].push(item);
    }
  });
  return grouped;
};

const TimetableView = ({ role: roleProp, userId }) => {
  const currentRole = roleProp || localStorage.getItem("role") || "student";
  const [timetable, setTimetable] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");

  useEffect(() => {
    if (currentRole === "admin" || currentRole === "super_admin") {
      fetchSections();
    } else if (currentRole === "teacher") {
      fetchTeacherTimetable();
    } else {
      fetchStudentTimetable();
    }
  }, [currentRole]);

  useEffect(() => {
    if (selectedSection && (currentRole === "admin" || currentRole === "super_admin")) {
      fetchSectionTimetable(selectedSection);
    }
  }, [selectedSection, currentRole]);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const res = await api.get('/subjects/all');
      const subData = res.data;
      const subList = Array.isArray(subData)
        ? subData
        : Array.isArray(subData?.data)
          ? subData.data
          : Array.isArray(subData?.subjects)
            ? subData.subjects
            : Array.isArray(subData?.allActiveSubjects)
              ? subData.allActiveSubjects
              : [];

      const allSections = [...new Set(subList.map(s => s.section).filter(Boolean))];
      const finalSections = allSections.length > 0 ? allSections.sort() : ["A", "B"];
      setSections(finalSections);
      setSelectedSection(finalSections[0]);
    } catch (err) {
      console.error("Failed to load sections for timetable view", err);
      setSections(["A", "B"]);
      setSelectedSection("A");
    }
  };

  const fetchSectionTimetable = async (section) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/timetable/section/${encodeURIComponent(section)}`);
      setTimetable(parseGrouped(res.data));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load timetable");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeacherTimetable = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/timetable/teacher');
      setTimetable(parseGrouped(res.data));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load timetable");
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentTimetable = async () => {
    try {
      setLoading(true);
      setError(null);
      let section = "A";
      try {
        if (currentRole === "parent") {
          const pRes = await api.get('/parent/dashboard');
          section = pRes.data?.data?.student?.section || localStorage.getItem("section") || "A";
        } else {
          const res = await api.get('/subjects/all');
          section = res.data?.studentInfo?.section || localStorage.getItem("section") || "A";
        }
      } catch (e) {
        section = localStorage.getItem("section") || "A";
      }

      const tRes = await api.get(`/timetable/section/${encodeURIComponent(section)}`);
      setTimetable(parseGrouped(tRes.data));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load timetable");
    } finally {
      setLoading(false);
    }
  };

  const getTimeSlots = () => {
    const slots = new Set();
    Object.values(timetable).forEach((entries) => {
      (entries || []).forEach((e) => {
        if (e.startTime) slots.add(e.startTime);
      });
    });
    return [...slots].sort();
  };

  const getEntry = (day, time) => {
    return (timetable[day] || []).find((e) => e.startTime === time);
  };

  const timeSlots = getTimeSlots();

  if (loading && Object.keys(timetable).length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-12 h-12 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Weekly Class Schedule"
        meta={
          currentRole === "teacher"
            ? "Your weekly class routine, faculty schedule, and classroom venues"
            : currentRole === "parent"
              ? "Your child's active weekly class routine and subject lecture timings"
              : "Institutional class schedule, assigned rooms, and subject faculty"
        }
        actions={
          (currentRole === "admin" || currentRole === "super_admin") && sections.length > 0 ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-ink-soft hidden sm:inline">Section:</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="text-xs px-3 py-1.5 border border-line/60 bg-surface text-ink rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {sections.map((sec) => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
              </select>
            </div>
          ) : null
        }
      />

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-medium">
          {error}
        </div>
      )}

      {timeSlots.length === 0 ? (
        <Card padding="lg" bordered>
          <EmptyState
            icon={Calendar}
            title="No Timetable Entries Found"
            description={
              selectedSection
                ? `No timetable classes have been scheduled for Section ${selectedSection} yet.`
                : "No weekly class schedule has been published for your account."
            }
          />
        </Card>
      ) : (
        <Card padding="none" bordered className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-background/80 border-b border-line/60 text-[11px] font-bold text-ink uppercase tracking-wider">
                  <th className="py-3 px-4 w-32 border-r border-line/60">Time Slot</th>
                  {DAYS.map((day) => (
                    <th key={day} className="py-3 px-4 border-r border-line/60 last:border-r-0">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 text-xs">
                {timeSlots.map((time) => (
                  <tr key={time} className="hover:bg-background/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-primary text-xs bg-background/50 border-r border-line/60">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        {time}
                      </div>
                    </td>
                    {DAYS.map((day) => {
                      const entry = getEntry(day, time);
                      return (
                        <td key={day} className="py-2.5 px-3 border-r border-line/60 last:border-r-0 align-top">
                          {entry ? (
                            entry.isNoClass ? (
                              <div className="p-2 rounded-lg bg-surface text-ink-faint text-[11px] font-semibold italic text-center border border-line/40">
                                Free Period / Recess
                              </div>
                            ) : (
                              <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1 hover:border-primary/40 transition">
                                <div className="font-bold text-ink flex items-center gap-1.5 text-xs">
                                  <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                                  <span className="truncate">{entry.subjectName || entry.subjectCode}</span>
                                </div>
                                <div className="text-[11px] font-mono text-primary font-bold">
                                  {entry.subjectCode} {entry.section ? `• Sec ${entry.section}` : ""}
                                </div>
                                {entry.teacherName && (
                                  <div className="text-[11px] text-ink-soft flex items-center gap-1">
                                    <User className="w-3 h-3 text-ink-faint shrink-0" />
                                    <span className="truncate">{entry.teacherName}</span>
                                  </div>
                                )}
                                {entry.room && (
                                  <div className="text-[11px] text-ink-faint flex items-center gap-1 font-semibold">
                                    <Building2 className="w-3 h-3 text-ink-faint shrink-0" />
                                    <span>{entry.room}</span>
                                  </div>
                                )}
                              </div>
                            )
                          ) : (
                            <div className="text-xs text-ink-faint text-center py-2">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default TimetableView;
