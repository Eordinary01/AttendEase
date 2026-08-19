import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Award, FileText, TrendingUp, AlertTriangle } from "lucide-react";
import api from "../utils/api";
import Card from "./common/ui/Card";
import Badge from "./common/ui/Badge";
import PageHeader from "./common/ui/PageHeader";
import EmptyState from "./common/ui/EmptyState";
import Table from "./common/ui/Table";
import { Select } from "./common/ui/Input";

const gradeTone = (percentage) => {
  if (percentage >= 75) return "success";
  if (percentage >= 40) return "warning";
  return "danger";
};

const gradeColor = (percentage) => {
  if (percentage >= 75) return "text-emerald-600";
  if (percentage >= 40) return "text-amber-600";
  return "text-red-600";
};

const statusTone = (status) => {
  if (status === "passed") return "success";
  if (status === "cleared") return "success";
  return "danger";
};

const statusLabel = (status) => {
  if (status === "cleared") return "Cleared";
  if (status === "passed") return "Pass";
  return "BACK";
};

const typeNameFor = (exam, examTypeMap) => {
  const code = exam?.examTypeCode || exam?.type;
  return examTypeMap[code] || exam?.type || "Exam";
};

const ResultsView = ({ role }) => {
  const [results, setResults] = useState([]);
  const [gradeReport, setGradeReport] = useState({ subjects: [], semesters: [], cgpa: null, hasBack: false, backlogs: [] });
  const [examTypes, setExamTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("report");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");

  const isParent = role === "parent";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resultsRes, reportRes, structRes] = await Promise.all([
        api.get("/exams/my-results").catch(() => ({ data: { data: [] } })),
        api.get("/exams/grade-report").catch(() => ({ data: { data: { subjects: [], semesters: [], cgpa: null, hasBack: false, backlogs: [] } } })),
        api.get("/exams/structure").catch(() => ({ data: {} })),
      ]);
      setResults(resultsRes.data.data || []);
      const report = reportRes.data.data || {};
      setGradeReport({
        subjects: report.subjects || [],
        semesters: report.semesters || [],
        cgpa: report.cgpa ?? null,
        hasBack: Boolean(report.hasBack),
        backlogs: report.backlogs || [],
      });
      setExamTypes((structRes.data?.data?.examTypes || []).filter(t => t.isActive !== false));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load results");
    } finally {
      setLoading(false);
    }
  };

  // Map of examTypeCode -> display name (used for grid column headers).
  const examTypeMap = useMemo(() => {
    const map = {};
    examTypes.forEach(t => { if (t.code) map[t.code] = t.name; });
    return map;
  }, [examTypes]);

  // Ordered exam-type columns for the grid: prefer tenant's configured order,
  // then any types seen in the data that aren't configured.
  const typeColumns = useMemo(() => {
    const ordered = examTypes.map(t => t.code);
    const seen = new Set();
    gradeReport.subjects.forEach(s => (s.exams || []).forEach(e => {
      const code = e.examTypeCode || e.type;
      if (code) seen.add(code);
    }));
    seen.forEach(c => { if (!ordered.includes(c)) ordered.push(c); });
    return ordered.map(code => ({ code, name: examTypeMap[code] || code }));
  }, [examTypes, examTypeMap, gradeReport.subjects]);

  const semesterOptions = useMemo(() => {
    const set = new Set();
    gradeReport.subjects.forEach(s => { if (s.semester != null) set.add(String(s.semester)); });
    return [...set].sort((a, b) => parseInt(a) - parseInt(b));
  }, [gradeReport.subjects]);

  const subjectOptions = useMemo(() => {
    const set = new Set();
    results.forEach(r => {
      const name = r.examId?.subjectName;
      if (name) set.add(name);
    });
    return [...set].sort();
  }, [results]);

  const filteredSubjects = useMemo(() => {
    let out = gradeReport.subjects;
    if (semesterFilter !== "all") {
      out = out.filter(s => String(s.semester) === semesterFilter);
    }
    return out;
  }, [gradeReport.subjects, semesterFilter]);

  const filteredResults = useMemo(() => {
    let out = results;
    if (subjectFilter !== "all") {
      out = out.filter(r => r.examId?.subjectName === subjectFilter);
    }
    if (semesterFilter !== "all") {
      out = out.filter(r => String(r.examId?.semester) === semesterFilter);
    }
    return out;
  }, [results, subjectFilter, semesterFilter]);

  // Cell lookup: subject + exam-type code -> exam entry.
  const examFor = (subject, typeCode) => {
    return (subject.exams || []).find(e => (e.examTypeCode || e.type) === typeCode);
  };

  const resultColumns = [
    { header: "Subject Code", cell: (r) => <span className="font-semibold">{r.examId?.subjectCode || "—"}</span> },
    { header: "Subject", cell: (r) => r.examId?.subjectName || "—" },
    { header: "Semester", cell: (r) => <Badge tone="neutral">{r.examId?.semester ? `Sem ${r.examId.semester}` : "—"}</Badge> },
    { header: "Exam", cell: (r) => r.examId?.title || "—" },
    { header: "Type", cell: (r) => (
      <Badge tone={r.examId?.isBacklog ? "danger" : "info"}>{r.examId?.isBacklog ? "Supplementary" : typeNameFor(r.examId, examTypeMap)}</Badge>
    ) },
    { header: "Date", cell: (r) => r.examId?.date ? new Date(r.examId.date).toLocaleDateString() : "—" },
    { header: "Marks", cell: (r) => (
      <span className="font-semibold">
        {r.marksObtained}<span className="text-ink-faint">/{r.maxMarks}</span>
      </span>
    ) },
    { header: "Percentage", cell: (r) => (
      <span className={`font-bold ${gradeColor(r.percentage)}`}>{r.percentage}%</span>
    ) },
    { header: "Grade", cell: (r) => (
      <Badge tone={gradeTone(r.percentage)}>{r.grade || "Pending"}</Badge>
    ) },
  ];

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
        icon={Award}
        title={isParent ? "Exam Results" : "My Results"}
        subtitle={isParent ? "SGPA / CGPA and published exam results" : "Your SGPA / CGPA, grade report and published results"}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-line overflow-hidden shadow-sm">
              {[
                { key: "report", label: "Grade Report", icon: TrendingUp },
                { key: "results", label: "All Results", icon: FileText },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setViewMode(tab.key)}
                  className={`px-4 py-2 flex items-center gap-2 text-sm font-semibold transition-colors ${viewMode === tab.key ? "bg-primary text-white" : "bg-surface text-ink-soft hover:text-ink"}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            {semesterOptions.length > 1 && (
              <Select value={semesterFilter} onChange={e => setSemesterFilter(e.target.value)} className="w-44">
                <option value="all">All Semesters</option>
                {semesterOptions.map(s => <option key={s} value={s}>Semester {s}</option>)}
              </Select>
            )}
          </div>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {viewMode === "report" && (
        <>
          {/* SGPA / CGPA summary */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card padding="lg">
              <p className="text-sm text-ink-faint mb-1">CGPA</p>
              {gradeReport.cgpa != null ? (
                <p className={`text-3xl font-bold ${gradeColor(gradeReport.cgpa * 10)}`}>{gradeReport.cgpa.toFixed(2)}</p>
              ) : gradeReport.hasBack ? (
                <p className="text-lg font-semibold text-amber-600">Awaiting back clearance</p>
              ) : (
                <p className="text-2xl font-bold text-ink-faint">N/A</p>
              )}
            </Card>
            {gradeReport.semesters.map(sem => (
              <Card key={String(sem.semester)} padding="lg">
                <p className="text-sm text-ink-faint mb-1">SGPA — Sem {sem.semester}</p>
                {sem.sgpa != null ? (
                  <p className={`text-3xl font-bold ${gradeColor(sem.sgpa * 10)}`}>{sem.sgpa.toFixed(2)}</p>
                ) : sem.hasBack ? (
                  <p className="text-lg font-semibold text-amber-600">Awaiting clearance</p>
                ) : (
                  <p className="text-2xl font-bold text-ink-faint">N/A</p>
                )}
              </Card>
            ))}
          </div>

          {/* Backlog warning */}
          {gradeReport.hasBack && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">You have {gradeReport.backlogs.length} backlog subject(s)</p>
                <p className="text-xs mt-0.5">
                  {isParent ? "The student" : "You"} must clear each BACK via a supplementary (backlog) exam before the semester SGPA and overall CGPA are shown. Once the updated marks are published, they will appear here.
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {gradeReport.backlogs.map(b => (
                    <span key={`${b.subjectCode}-${b.semester}`} className="px-2 py-1 rounded-lg bg-white border border-red-200 text-xs font-semibold">
                      {b.subjectCode} — {b.subjectName} (Sem {b.semester}) <span className="text-red-600">· {b.aggregate}%</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Card padding="none">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-4 border-b border-line">
              <h2 className="text-lg font-semibold text-ink">Grade Report</h2>
              <span className="text-xs text-ink-faint">
                {semesterFilter !== "all" ? `Semester ${semesterFilter}` : "All semesters"} • {filteredSubjects.length} subject(s)
              </span>
            </div>

            {filteredSubjects.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No Results Available"
                  description="Published exam results will appear here once your institution releases them"
                  icon={Award}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-background/80 border-b border-line">
                    <tr>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-ink-faint uppercase tracking-wider whitespace-nowrap">Subject Code</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-ink-faint uppercase tracking-wider whitespace-nowrap">Subject</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-ink-faint uppercase tracking-wider whitespace-nowrap">Credits</th>
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-ink-faint uppercase tracking-wider whitespace-nowrap">Semester</th>
                      {typeColumns.map(col => (
                        <th key={col.code} className="px-4 py-3.5 text-center text-xs font-bold text-ink-faint uppercase tracking-wider whitespace-nowrap">{col.name}</th>
                      ))}
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-ink-faint uppercase tracking-wider whitespace-nowrap">Overall</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-ink-faint uppercase tracking-wider whitespace-nowrap">GP</th>
                      <th className="px-4 py-3.5 text-center text-xs font-bold text-ink-faint uppercase tracking-wider whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredSubjects.map((subject, idx) => (
                      <tr key={subject.subjectCode || subject.subjectName || idx} className="hover:bg-background/70 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-ink">{subject.subjectCode || "—"}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-ink font-medium">{subject.subjectName}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-ink-soft">{subject.credits || 0}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                          <Badge tone="neutral">{subject.semester ? `Sem ${subject.semester}` : "—"}</Badge>
                        </td>
                        {typeColumns.map(col => {
                          const exam = examFor(subject, col.code);
                          if (!exam) {
                            return (
                              <td key={col.code} className="px-4 py-4 text-center">
                                <span className="text-ink-faint">—</span>
                              </td>
                            );
                          }
                          return (
                            <td key={col.code} className="px-4 py-4 text-center whitespace-nowrap">
                              <div className={`text-sm font-bold ${gradeColor(exam.percentage ?? 0)}`}>
                                {exam.marksObtained}/{exam.maxMarks}
                              </div>
                              <Badge tone={gradeTone(exam.percentage ?? 0)} className="mt-0.5">
                                {exam.grade || "—"}
                              </Badge>
                            </td>
                          );
                        })}
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <div className={`text-sm font-bold ${gradeColor(subject.aggregate)}`}>{subject.aggregate}%</div>
                          <Badge tone={gradeTone(subject.aggregate)} className="mt-0.5">{subject.grade}</Badge>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap text-sm font-bold text-ink">{subject.gradePoints}</td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <Badge tone={statusTone(subject.status)}>{statusLabel(subject.status)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {viewMode === "results" && (
        <Card padding="none">
          <div className="flex items-center justify-between px-6 py-4 border-b border-line">
            <h2 className="text-lg font-semibold text-ink">All Published Results</h2>
            {subjectOptions.length > 1 && (
              <Select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="w-48">
                <option value="all">All Subjects</option>
                {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            )}
          </div>
          <Table
            columns={resultColumns}
            data={filteredResults}
            emptyTitle="No Results Available"
            emptyMessage="Published exam results will appear here once your institution releases them"
          />
        </Card>
      )}
    </motion.div>
  );
};

export default ResultsView;
