import React, { useState, useEffect, useMemo } from "react";
import { FileText, Calendar, Clock, MapPin, Timer, GraduationCap, Layers } from "lucide-react";
import api from "../utils/api";
import Card from "./common/ui/Card";
import Badge from "./common/ui/Badge";
import DashboardHeader from "./common/ui/DashboardHeader";
import EmptyState from "./common/ui/EmptyState";
import { Select } from "./common/ui/Input";
import { formatDateReadable, formatDateDMY } from "../utils/dateUtils";

const ExamSchedule = ({ role }) => {
  const [exams, setExams] = useState([]);
  const [examTypes, setExamTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("all");

  useEffect(() => {
    fetchInitial();
  }, []);

  const fetchInitial = async () => {
    try {
      setLoading(true);
      const [examsRes, structRes] = await Promise.all([
        api.get("/exams/upcoming").catch(() => ({ data: { data: [] } })),
        api.get("/exams/structure").catch(() => ({ data: {} })),
      ]);

      setExams(examsRes.data.data || []);
      const struct = structRes.data?.data || {};
      setExamTypes((struct.examTypes || []).filter((t) => t.isActive !== false));
    } catch (err) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const courseOptions = useMemo(() => {
    const map = new Map();
    exams.forEach((e) => {
      const id = e.courseId?._id || e.courseId || "";
      const code = e.courseId?.code || e.courseCode || "";
      if (id && code && !map.has(String(id))) map.set(String(id), code);
    });
    return Array.from(map.entries()).map(([id, code]) => ({ id, code }));
  }, [exams]);

  const semesterOptions = useMemo(() => {
    const set = new Set();
    exams.forEach((e) => {
      if (e.semester) set.add(String(e.semester));
    });
    return [...set].sort((a, b) => parseInt(a) - parseInt(b));
  }, [exams]);

  const filtered = useMemo(() => {
    let result = exams;
    if (typeFilter !== "all") {
      result = result.filter((e) => e.examTypeCode === typeFilter || e.type === typeFilter);
    }
    if (courseFilter) {
      result = result.filter((e) => String(e.courseId?._id || e.courseId) === courseFilter);
    }
    if (semesterFilter !== "all") {
      result = result.filter((e) => String(e.semester) === String(semesterFilter));
    }
    return result;
  }, [exams, typeFilter, courseFilter, semesterFilter]);

  const getTypeName = (exam) => {
    const code = exam.examTypeCode || exam.type;
    const typeDef = examTypes.find((t) => t.code === code);
    return typeDef ? typeDef.name : (exam.type || code || "Exam");
  };

  const getTypeTone = (typeCode) => {
    if (typeCode === "endTerm" || typeCode === "final") return "danger";
    if (typeCode === "midterm" || typeCode?.startsWith("inTerm")) return "warning";
    return "primary";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-12 h-12 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting="Examination Timetable & Venues"
        meta={`Upcoming academic assessments, shift timings, and hall allocations (${filtered.length} exams registered)`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {role !== "student" && courseOptions.length > 0 && (
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-line/60 bg-surface text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer font-medium"
              >
                <option value="">All Courses</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </select>
            )}
            {role !== "student" && semesterOptions.length > 0 && (
              <select
                value={semesterFilter}
                onChange={(e) => setSemesterFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-line/60 bg-surface text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer font-medium"
              >
                <option value="all">All Semesters</option>
                {semesterOptions.map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            )}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-line/60 bg-surface text-ink outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer font-medium"
            >
              <option value="all">All Exam Types</option>
              {examTypes.map((t) => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <Card padding="lg" bordered>
          <EmptyState
            title="No Upcoming Exams"
            description="No upcoming exams match your selected filters"
            icon={FileText}
          />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.map((exam) => {
            const courseCode = exam.courseId?.code || exam.courseCode || "";
            const typeCode = exam.examTypeCode || exam.type;
            const typeName = getTypeName(exam);

            return (
              <Card key={exam._id} padding="md" bordered className="transition hover:border-primary/40 space-y-3">
                <div className="flex items-start justify-between">
                  <Badge tone={getTypeTone(typeCode)} size="sm" className="capitalize">
                    {typeName}
                  </Badge>
                  <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">{exam.subjectCode}</span>
                </div>
                <div>
                  <h3 className="font-bold text-ink text-sm truncate">{exam.title}</h3>
                  <p className="text-xs text-ink-soft font-medium mt-0.5 truncate">{exam.subjectName}</p>
                </div>

                <div className="flex items-center gap-3 text-xs text-ink-faint">
                  {courseCode && (
                    <div className="flex items-center gap-1 font-semibold text-ink">
                      <GraduationCap className="w-3.5 h-3.5 text-primary" />
                      <span>{courseCode}</span>
                    </div>
                  )}
                  {exam.semester && (
                    <div className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      <span>Sem {exam.semester}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-ink-soft py-2 border-y border-line/50">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>{formatDateReadable(exam.date, true)} ({formatDateDMY(exam.date)})</span>
                  </div>
                  {exam.shift && (
                    <div className="flex items-center gap-2">
                      <Timer className="w-3.5 h-3.5 text-primary" />
                      <span>Shift {exam.shift}</span>
                    </div>
                  )}
                  {exam.startTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>{exam.startTime}{exam.endTime ? ` - ${exam.endTime}` : ""}</span>
                    </div>
                  )}
                  {exam.room && (
                    <div className="flex items-center gap-2 font-semibold text-ink">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <span>Hall {exam.room}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-ink-soft font-medium">Section {exam.section}</span>
                  <span className="font-bold text-ink">Max: {exam.maxMarks} Marks</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExamSchedule;
