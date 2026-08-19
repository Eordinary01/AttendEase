import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Check, Save, Send, FileUp } from "lucide-react";
import api from "../utils/api";
import Card from "./common/ui/Card";
import Badge from "./common/ui/Badge";
import PageHeader from "./common/ui/PageHeader";
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
    return <div className="flex items-center justify-center py-24"><div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  const gradeColumns = [
    { header: "Student", cell: (r) => <span className="font-medium">{r.studentId?.name || "Unknown"}</span> },
    { header: "Roll No", cell: (r) => <span className="text-ink-soft">{r.studentId?.rollNo || "—"}</span> },
    {
      header: "Marks / Max",
      cell: (r) => (
        <div className="flex items-center justify-center gap-1">
          <input type="number" value={r.marksObtained || ""} onChange={e => updateResult(r.studentId?._id, "marksObtained", e.target.value)} className="w-16 px-2 py-1.5 border border-line rounded text-sm text-center bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" min="0" max={selectedExam.maxMarks} />
          <span className="text-ink-faint">/</span>
          <input type="number" value={r.maxMarks || selectedExam.maxMarks} onChange={e => updateResult(r.studentId?._id, "maxMarks", e.target.value)} className="w-16 px-2 py-1.5 border border-line rounded text-sm text-center bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" min="1" />
        </div>
      ),
    },
    { header: "Grade", cell: (r) => <span className="text-center block font-semibold">{r.grade || "—"}</span> },
    {
      header: "Remarks",
      cell: (r) => (
        <input value={r.remarks || ""} onChange={e => updateResult(r.studentId?._id, "remarks", e.target.value)} className="w-full px-2 py-1.5 border border-line rounded text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" placeholder="Optional" />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <PageHeader
        title={isTeacher ? "Grade Manager" : "My Results"}
        subtitle={isTeacher ? "Enter and manage exam grades" : "View your exam results and grades"}
        icon={FileText}
        actions={
          isTeacher && (
            <div className="flex gap-1 bg-surface rounded-xl p-1 border border-line">
              <Button onClick={() => setViewMode("grade")} variant={viewMode === "grade" ? "primary" : "ghost"}>Grade</Button>
              <Button onClick={() => { setViewMode("results"); fetchExams(); }} variant={viewMode === "results" ? "primary" : "ghost"}>Results</Button>
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
    </motion.div>
  );
};

export default GradeManager;
