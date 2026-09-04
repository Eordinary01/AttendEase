import React, { useState, useEffect } from "react";
import { FileText, Check, Save, Send, FileUp } from "lucide-react";
import api from "../utils/api";
import Card from "./common/ui/Card";
import Badge from "./common/ui/Badge";
import DashboardHeader from "./common/ui/DashboardHeader";
import EmptyState from "./common/ui/EmptyState";
import Table from "./common/ui/Table";
import Button from "./common/ui/Button";
import { Select } from "./common/ui/Input";
import { usePermissions } from "../contexts/PermissionsContext";
import BulkImportModal from "./common/ui/BulkImportModal";

const BULK_RESULTS_COLUMNS = [
  { key: "subjectCode", label: "Subject Code", required: true, description: "Subject code of the exam. Must match the selected exam", example: "CSE101" },
  { key: "semester", label: "Semester", required: true, description: "Semester number of the exam", example: 3 },
  { key: "rollNo", label: "Roll No", required: true, description: "Student roll number as shown in the institution records", example: "STU001" },
  { key: "marksObtained", label: "Marks Obtained", required: true, description: "Marks scored by the student", example: 85 },
  { key: "maxMarks", label: "Max Marks", required: false, description: "Defaults to the exam's max marks", example: 100 },
  { key: "remarks", label: "Remarks", required: false, description: "Optional note", example: "Good" },
];

const GradeManager = ({ role }) => {
  const { can } = usePermissions();
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [viewMode, setViewMode] = useState("grade");
  const [showBulk, setShowBulk] = useState(false);

  const isTeacher = role === "teacher" || role === "admin";
  const isStudent = role === "student" || role === "parent";
  const canPublish = can("exam:publish");

  useEffect(() => {
    if (isTeacher) fetchExams();
    if (isStudent) fetchMyResults();
  }, [role]);

  useEffect(() => {
    if (error || success) {
      const t = setTimeout(() => { setError(null); setSuccess(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [error, success]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const res = await api.get('/exams');
      setExams(res.data.data || []);
    } catch (err) { setError("Failed to load exams"); } finally { setLoading(false); }
  };

  const fetchExamResults = async (examId) => {
    try {
      setLoading(true);
      const res = await api.get(`/exams/${examId}`);
      setSelectedExam(res.data.data.exam);
      const existing = res.data.data.results || [];
      setResults(existing.length > 0 ? existing : []);
    } catch (err) { setError("Failed to load results"); } finally { setLoading(false); }
  };

  const fetchMyResults = async () => {
    try {
      setLoading(true);
      const res = await api.get('/exams/my-results');
      setResults(res.data.data || []);
    } catch (err) { setError("Failed to load results"); } finally { setLoading(false); }
  };

  const updateResult = (studentId, field, value) => {
    setResults(prev => prev.map(r =>
      r.studentId?._id === studentId || r.studentId === studentId
        ? { ...r, [field]: value }
        : r
    ));
  };

  const handleSubmitGrades = async () => {
    try {
      setSubmitting(true);
      const payload = {
        results: results.map(r => ({
          studentId: r.studentId?._id || r.studentId,
          subjectCode: selectedExam.subjectCode || "",
          semester: selectedExam.semester || "",
          marksObtained: parseFloat(r.marksObtained) || 0,
          maxMarks: parseInt(r.maxMarks) || selectedExam?.maxMarks,
          remarks: r.remarks || "",
        })),
      };
      await api.post(`/exams/${selectedExam._id}/grade`, payload);
      setSuccess("Grades submitted successfully. Publish the results to make them visible to students.");
      await fetchExamResults(selectedExam._id);
    } catch (err) { setError(err.response?.data?.message || "Failed to submit grades"); } finally { setSubmitting(false); }
  };

  const handlePublish = async () => {
    if (!window.confirm("Publish results for this exam? Students and parents will be able to see them.")) return;
    try {
      setPublishing(true);
      await api.post(`/exams/${selectedExam._id}/publish`);
      setSuccess("Results published");
      await fetchExamResults(selectedExam._id);
    } catch (err) { setError(err.response?.data?.message || "Failed to publish results"); } finally { setPublishing(false); }
  };

  const handleUnpublish = async () => {
    if (!window.confirm("Unpublish results for this exam? Students and parents will no longer see them.")) return;
    try {
      setPublishing(true);
      await api.post(`/exams/${selectedExam._id}/unpublish`);
      setSuccess("Results unpublished");
      await fetchExamResults(selectedExam._id);
    } catch (err) { setError(err.response?.data?.message || "Failed to unpublish results"); } finally { setPublishing(false); }
  };

  if (loading && results.length === 0) {
    return <div className="flex items-center justify-center py-24"><div className="w-12 h-12 border-3 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  const gradeColumns = [
    { header: "Student", cell: (r) => <span className="font-medium">{r.studentId?.name || "Unknown"}</span> },
    { header: "Roll No", cell: (r) => <span className="text-ink-soft">{r.studentId?.rollNo || "—"}</span> },
    {
      header: "Marks / Max",
      cell: (r) => (
        <div className="flex items-center justify-center gap-1">
          <input type="number" value={r.marksObtained || ""} onChange={e => updateResult(r.studentId?._id, "marksObtained", e.target.value)} className="w-16 px-2 py-1.5 border border-line/60 rounded-lg text-xs text-center bg-background text-ink font-bold focus:ring-2 focus:ring-primary/20" min="0" max={selectedExam?.maxMarks || 100} />
          <span className="text-ink-faint">/</span>
          <input type="number" value={r.maxMarks || selectedExam?.maxMarks} onChange={e => updateResult(r.studentId?._id, "maxMarks", e.target.value)} className="w-16 px-2 py-1.5 border border-line/60 rounded-lg text-xs text-center bg-background text-ink font-bold focus:ring-2 focus:ring-primary/20" min="1" />
        </div>
      ),
    },
    { header: "Grade", cell: (r) => <span className="text-center block font-bold text-xs">{r.grade || "—"}</span> },
    {
      header: "Remarks",
      cell: (r) => (
        <input value={r.remarks || ""} onChange={e => updateResult(r.studentId?._id, "remarks", e.target.value)} className="w-full px-2 py-1.5 border border-line/60 rounded-lg text-xs bg-background text-ink focus:ring-2 focus:ring-primary/20" placeholder="Optional" />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting={isTeacher ? "Assessment Grading & Marks Manager" : "My Results & Transcripts"}
        meta={isTeacher ? "Record marks, compute grades, perform bulk spreadsheet uploads, and publish official class rosters" : "View published exam marks and transcripts"}
        actions={
          isTeacher && (
            <div className="flex gap-1 bg-surface rounded-xl p-1 border border-line/60 shadow-sm">
              <Button size="sm" onClick={() => setViewMode("grade")} variant={viewMode === "grade" ? "primary" : "subtle"}>Grade Exam</Button>
              <Button size="sm" onClick={() => { setViewMode("results"); fetchExams(); }} variant={viewMode === "results" ? "primary" : "subtle"}>View Roster</Button>
            </div>
          )
        }
      />



      {isTeacher && viewMode === "grade" && (
        <div className="space-y-6">
          <div className="w-full sm:w-96">
            <Select onChange={e => fetchExamResults(e.target.value)} value={selectedExam?._id || ""}>
              <option value="">Select an exam to grade</option>
              {exams.filter(e => e.status !== "cancelled").map(e => (
                <option key={e._id} value={e._id}>{e.title} - {e.subjectName} ({e.section})</option>
              ))}
            </Select>
          </div>

          {selectedExam && (
            <Card padding="lg">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{selectedExam.title}</h3>
                  <p className="text-sm text-ink-soft">{selectedExam.subjectName} | Section {selectedExam.section} | Max: {selectedExam.maxMarks}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge tone={selectedExam.resultStatus === "published" ? "success" : "warning"}>
                      {selectedExam.resultStatus === "published" ? "Published" : "Draft"}
                    </Badge>
                    {selectedExam.status === "completed" && <Badge tone="info">Completed</Badge>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" leftIcon={FileUp} onClick={() => setShowBulk(true)}>
                    Bulk Upload Grades
                  </Button>
                  <Button onClick={handleSubmitGrades} loading={submitting} leftIcon={Save}>
                    {submitting ? "Saving..." : "Submit Grades"}
                  </Button>
                  {canPublish && (
                    selectedExam.resultStatus === "published" ? (
                      <Button variant="outline" onClick={handleUnpublish} loading={publishing} leftIcon={Check}>
                        {publishing ? "Working..." : "Unpublish"}
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={handlePublish} loading={publishing} leftIcon={Send}>
                        {publishing ? "Publishing..." : "Publish Results"}
                      </Button>
                    )
                  )}
                </div>
              </div>

              {results.length === 0 ? (
                <div className="p-4 bg-amber-50 rounded-lg text-sm text-amber-700">No results yet. Grade entries will appear when students are linked to this exam.</div>
              ) : (
                <Table
                  columns={gradeColumns}
                  data={results.map(r => ({ ...r, __rowKey: r._id || r.studentId?._id }))}
                  rowKey="__rowKey"
                />
              )}
            </Card>
          )}
        </div>
      )}

      {/* Institutional Results Ledger View for Admin & Teachers */}
      {isTeacher && viewMode === "results" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="w-full sm:w-96">
              <Select onChange={e => fetchExamResults(e.target.value)} value={selectedExam?._id || ""}>
                <option value="">Choose an exam to view results...</option>
                {exams.filter(e => e.status !== "cancelled").map(e => (
                  <option key={e._id} value={e._id}>{e.title} - {e.subjectName} ({e.section}) [{e.resultStatus === "published" ? "Published" : "Draft"}]</option>
                ))}
              </Select>
            </div>
            {selectedExam && (
              <div className="flex items-center gap-2">
                {canPublish && (
                  selectedExam.resultStatus === "published" ? (
                    <Button variant="outline" size="sm" onClick={handleUnpublish} loading={publishing} leftIcon={Check}>
                      Unpublish Results
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={handlePublish} loading={publishing} leftIcon={Send}>
                      Publish Results
                    </Button>
                  )
                )}
              </div>
            )}
          </div>

          {selectedExam ? (
            <div className="space-y-6">
              {/* Stats Summary Strip */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card padding="md">
                  <span className="text-xs text-ink-faint block">Students Graded</span>
                  <span className="text-2xl font-bold text-ink">{results.length}</span>
                </Card>
                <Card padding="md">
                  <span className="text-xs text-ink-faint block">Result Status</span>
                  <Badge tone={selectedExam.resultStatus === "published" ? "success" : "warning"} className="mt-1">
                    {selectedExam.resultStatus === "published" ? "Published" : "Draft"}
                  </Badge>
                </Card>
                <Card padding="md">
                  <span className="text-xs text-ink-faint block">Class Average</span>
                  <span className="text-2xl font-bold text-primary">
                    {results.length > 0 ? (results.reduce((acc, r) => acc + (r.percentage || 0), 0) / results.length).toFixed(1) : 0}%
                  </span>
                </Card>
                <Card padding="md">
                  <span className="text-xs text-ink-faint block">Highest Score</span>
                  <span className="text-2xl font-bold text-emerald-600">
                    {results.length > 0 ? Math.max(...results.map(r => r.marksObtained || 0)) : 0}/{selectedExam.maxMarks}
                  </span>
                </Card>
                <Card padding="md">
                  <span className="text-xs text-ink-faint block">Pass Rate</span>
                  <span className="text-2xl font-bold text-indigo-600">
                    {results.length > 0 ? Math.round((results.filter(r => (r.percentage || 0) >= 40).length / results.length) * 100) : 0}%
                  </span>
                </Card>
              </div>

              {/* Published Results Table */}
              <Card padding="lg">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="font-bold text-ink text-base">{selectedExam.title} — Official Score Ledger</h3>
                    <p className="text-xs text-ink-soft">{selectedExam.subjectName} ({selectedExam.subjectCode}) • Section {selectedExam.section} • Semester {selectedExam.semester || "—"}</p>
                  </div>
                  {results.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const csvContent = "data:text/csv;charset=utf-8," +
                          ["Roll No,Student Name,Marks Obtained,Max Marks,Percentage,Grade,Status,Remarks"].concat(
                            results.map(r => `"${r.studentId?.rollNo || ""}","${r.studentId?.name || ""}","${r.marksObtained || 0}","${r.maxMarks || selectedExam.maxMarks}","${r.percentage || 0}%","${r.grade || ""}","${(r.percentage || 0) >= 40 ? "Pass" : "BACK"}","${r.remarks || ""}"`)
                          ).join("\n");
                        const encodedUri = encodeURI(csvContent);
                        const link = document.createElement("a");
                        link.setAttribute("href", encodedUri);
                        link.setAttribute("download", `${selectedExam.title}_Results.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      Export CSV
                    </Button>
                  )}
                </div>

                {results.length === 0 ? (
                  <EmptyState
                    title="No Results Found"
                    description="No grades have been submitted for this exam yet. Switch to the Grade tab to enter grades."
                    icon={FileText}
                  />
                ) : (
                  <Table
                    columns={[
                      { header: "Roll No", cell: (r) => <span className="font-semibold text-ink">{r.studentId?.rollNo || "—"}</span> },
                      { header: "Student Name", cell: (r) => <span className="font-medium text-ink">{r.studentId?.name || "Unknown"}</span> },
                      {
                        header: "Marks",
                        cell: (r) => (
                          <span className="font-semibold text-ink">
                            {r.marksObtained} <span className="text-ink-faint font-normal">/ {r.maxMarks || selectedExam.maxMarks}</span>
                          </span>
                        ),
                      },
                      {
                        header: "Percentage",
                        cell: (r) => (
                          <span className={`font-bold ${(r.percentage || 0) >= 75 ? "text-emerald-600" : (r.percentage || 0) >= 40 ? "text-amber-600" : "text-rose-600"}`}>
                            {r.percentage}%
                          </span>
                        ),
                      },
                      {
                        header: "Grade",
                        cell: (r) => <Badge tone={(r.percentage || 0) >= 75 ? "success" : (r.percentage || 0) >= 40 ? "warning" : "danger"}>{r.grade || "Pending"}</Badge>,
                      },
                      {
                        header: "Status",
                        cell: (r) => (
                          <Badge tone={(r.percentage || 0) >= 40 ? "success" : "danger"}>
                            {(r.percentage || 0) >= 40 ? "Passed" : "BACK"}
                          </Badge>
                        ),
                      },
                      { header: "Remarks", cell: (r) => <span className="text-xs text-ink-soft">{r.remarks || "—"}</span> },
                    ]}
                    data={results.map(r => ({ ...r, __rowKey: r._id || r.studentId?._id }))}
                    rowKey="__rowKey"
                  />
                )}
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.map((exam) => (
                <Card key={exam._id} padding="md" className="hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-ink text-sm">{exam.title}</h4>
                      <p className="text-xs text-ink-soft mt-0.5">{exam.subjectName} • Sec {exam.section}</p>
                      <p className="text-xs text-ink-faint">{exam.date ? new Date(exam.date).toLocaleDateString() : ""} • Shift {exam.shift || "I"}</p>
                    </div>
                    <Badge tone={exam.resultStatus === "published" ? "success" : "warning"}>
                      {exam.resultStatus === "published" ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line/50 flex justify-end">
                    <Button size="xs" variant="primary" onClick={() => fetchExamResults(exam._id)}>
                      View Score Ledger
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {isStudent && (
        <div className="space-y-4">
          {results.length === 0 ? (
            <EmptyState
              title="No Results Available"
              description="Published exam results will appear here once your institution releases them"
              icon={FileText}
            />
          ) : (
            results.map(r => (
              <Card key={r._id} padding="lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-ink">{r.examId?.title || "Exam"}</h3>
                    <p className="text-sm text-primary">
                      {r.examId?.subjectName} ({r.examId?.subjectCode})
                      {r.examId?.semester ? <span className="ml-2 text-xs text-ink-faint">Sem {r.examId.semester}</span> : null}
                    </p>
                    <p className="text-xs text-ink-faint mt-1">
                      {r.examId?.type} | {r.examId?.date ? new Date(r.examId.date).toLocaleDateString() : ""} | Section {r.examId?.section}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${r.percentage >= 75 ? 'text-emerald-600' : r.percentage >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                      {r.marksObtained}/{r.maxMarks}
                    </p>
                    <p className="text-sm text-ink-soft">{r.percentage}%</p>
                    <Badge tone="primary" className="mt-1">{r.grade || "Pending"}</Badge>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Bulk Upload Grades Modal */}
      {isTeacher && selectedExam && (
        <BulkImportModal
          isOpen={showBulk}
          onClose={() => setShowBulk(false)}
          endpoint={`/exams/${selectedExam._id}/grade`}
          bodyKey="results"
          itemLabel="results"
          example={[
            { subjectCode: selectedExam.subjectCode || "CSE101", semester: selectedExam.semester || 3, rollNo: "STU001", marksObtained: 85, maxMarks: 100, remarks: "Good" },
            { subjectCode: selectedExam.subjectCode || "CSE101", semester: selectedExam.semester || 3, rollNo: "STU002", marksObtained: 72, maxMarks: 100, remarks: "" },
          ]}
          columns={BULK_RESULTS_COLUMNS}
          defaults={{
            subjectCode: selectedExam.subjectCode || "",
            semester: selectedExam.semester || "",
          }}
          exportData={results.map(r => ({
            subjectCode: selectedExam.subjectCode || "",
            semester: selectedExam.semester || "",
            rollNo: r.studentId?.rollNo || "",
            marksObtained: r.marksObtained,
            maxMarks: r.maxMarks,
            remarks: r.remarks || "",
          }))}
          onImported={() => {
            setShowBulk(false);
            fetchExamResults(selectedExam._id);
          }}
        />
      )}
    </div>
  );
};

export default GradeManager;
