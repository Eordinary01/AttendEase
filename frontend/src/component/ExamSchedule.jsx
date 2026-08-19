import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, Calendar, Clock, MapPin, Timer, GraduationCap, Layers } from "lucide-react";
import api from "../utils/api";
import Card from "./common/ui/Card";
import Badge from "./common/ui/Badge";
import PageHeader from "./common/ui/PageHeader";
import EmptyState from "./common/ui/EmptyState";
import { Select } from "./common/ui/Input";

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
    return "info";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title="Exam Schedule"
        subtitle="Upcoming exams and assessments"
        icon={FileText}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {role !== "student" && courseOptions.length > 0 && (
              <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-44">
                <option value="">All Courses</option>
                {courseOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.code}</option>
                ))}
              </Select>
            )}
            {role !== "student" && semesterOptions.length > 0 && (
              <Select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className="w-36">
                <option value="all">All Semesters</option>
                {semesterOptions.map((s) => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </Select>
            )}
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-44">
              <option value="all">All Types</option>
              {examTypes.map((t) => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </Select>
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title="No Upcoming Exams"
          description="No upcoming exams match your filters"
          icon={FileText}
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((exam) => {
            const courseCode = exam.courseId?.code || exam.courseCode || "";
            const typeCode = exam.examTypeCode || exam.type;
            const typeName = getTypeName(exam);

            return (
              <Card key={exam._id} padding="lg" hoverable>
                <div className="flex items-start justify-between mb-3">
                  <Badge tone={getTypeTone(typeCode)} className="capitalize">
                    {typeName}
                  </Badge>
                  <span className="text-xs text-ink-faint">{exam.subjectCode}</span>
                </div>
                <h3 className="font-semibold text-ink mb-1">{exam.title}</h3>
                <p className="text-sm text-primary font-medium mb-1">{exam.subjectName}</p>

                <div className="flex items-center gap-3 mb-3 text-xs text-ink-soft">
                  {courseCode && (
                    <div className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span className="font-semibold">{courseCode}</span>
                    </div>
                  )}
                  {exam.semester && (
                    <div className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Sem {exam.semester}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 text-sm text-ink-soft">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(exam.date).toLocaleDateString("en-US", {
                      weekday: "long", year: "numeric", month: "long", day: "numeric",
                    })}
                  </div>
                  {exam.shift && (
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4" />Shift {exam.shift}
                    </div>
                  )}
                  {exam.startTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {exam.startTime}{exam.endTime ? ` - ${exam.endTime}` : ""}
                    </div>
                  )}
                  {exam.room && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />{exam.room}
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-line flex justify-between text-sm">
                  <span className="text-ink-soft">Section {exam.section}</span>
                  <span className="font-semibold text-ink">Max: {exam.maxMarks}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

export default ExamSchedule;
