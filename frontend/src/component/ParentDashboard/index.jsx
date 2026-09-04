import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { GraduationCap, TrendingUp, BookOpen, Award, AlertCircle, CheckCircle, XCircle, Mail, Phone, User, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import api from "../../utils/api";
import StatCard from "../common/ui/StatCard";
import Card from "../common/ui/Card";
import Badge from "../common/ui/Badge";
import EmptyState from "../common/ui/EmptyState";
import DashboardHeader from "../common/ui/DashboardHeader";
import AttendanceHistory from "../AttendanceHistory";

const COLORS = { present: "#22c55e", absent: "#ef4444", leave: "#f59e0b" };

const gradeTone = (percentage) => {
  if (percentage >= 75) return "success";
  if (percentage >= 40) return "warning";
  return "danger";
};

const gradeColor = (percentage) => {
  if (percentage >= 75) return "text-emerald-600";
  if (percentage >= 40) return "text-amber-600";
  return "text-rose-600";
};

export default function ParentDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const studentName = localStorage.getItem("studentName") || "Student";

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashboardRes, statsRes, teachersRes, resultsRes] = await Promise.all([
        api.get('/parent/dashboard'),
        api.get('/parent/attendance/stats'),
        api.get('/parent/teachers'),
        api.get('/exams/my-results').catch(() => ({ data: { data: [] } })),
      ]);
      setData({
        dashboard: dashboardRes.data.data,
        subjectStats: statsRes.data.data || [],
        teachers: teachersRes.data.data || [],
        results: resultsRes.data.data || [],
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-3 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-primary font-semibold text-xs">Loading parent dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="bg-surface p-8 rounded-2xl shadow-card border border-red-200 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { dashboard, subjectStats, teachers, results } = data;
  const att = dashboard.attendance || {};
  const pieData = [
    { name: "Present", value: att.presentCount || 0, color: COLORS.present },
    { name: "Absent", value: att.absentCount || 0, color: COLORS.absent },
    { name: "Leave", value: att.leaveCount || 0, color: COLORS.leave },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <DashboardHeader
        greeting={`${studentName}'s Academic Portal`}
        meta="Parent monitoring overview — verified attendance, examination progress, subject roster, and faculty directory"
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <StatCard label="Overall Attendance" value={`${att.percentage || 0}%`} icon={TrendingUp} tone="success" />
        <StatCard label="Total Classes" value={att.totalClasses || 0} icon={BookOpen} tone="primary" />
        <StatCard label="Present Logged" value={att.presentCount || 0} icon={CheckCircle} tone="success" />
        <StatCard label="Absent Logged" value={att.absentCount || 0} icon={XCircle} tone="danger" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Subject-wise Attendance</h2>
            {subjectStats.length === 0 ? (
              <EmptyState title="No attendance data" description="No attendance data available yet" />
            ) : (
              <div className="space-y-4">
                {subjectStats.map(subj => (
                  <div key={subj.subjectId || subj.subjectName} className="p-4 bg-background rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-ink">{subj.subjectName}</p>
                        <p className="text-xs text-ink-soft">{subj.subjectCode}</p>
                      </div>
                      <span className={`text-lg font-bold ${subj.percentage >= 75 ? 'text-emerald-600' : subj.percentage >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {subj.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-line rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${subj.percentage >= 75 ? 'bg-emerald-500' : subj.percentage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.min(subj.percentage, 100)}%` }} />
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-ink-soft">
                      <span>P: {subj.presentCount}</span>
                      <span>A: {subj.absentCount}</span>
                      <span>L: {subj.leaveCount}</span>
                      <span>Total: {subj.totalClasses}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-ink mb-4">Attendance Distribution</h2>
          {pieData.length === 0 ? (
            <EmptyState title="No data" description="No attendance data available yet" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
                    {pieData.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-ink-soft">{d.name}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Recent Results</h2>
          <Link to="/exams/results" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-dark transition-colors">
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        {results.length === 0 ? (
          <EmptyState title="No results published" description="Published exam results will appear here" icon={Award} />
        ) : (
          <div className="space-y-3">
            {results.slice(0, 5).map(r => (
              <div key={r._id} className="p-4 bg-background rounded-xl border border-line">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-ink">
                      {r.examId?.subjectName || "Exam"}
                      {r.examId?.subjectCode && <span className="ml-2 text-xs font-bold text-primary-dark bg-primary-soft px-1.5 py-0.5 rounded">{r.examId.subjectCode}</span>}
                      {r.examId?.isBacklog && <Badge tone="danger" className="ml-2">Supplementary</Badge>}
                    </p>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {r.examId?.title} | {r.examId?.type}
                      {r.examId?.semester ? ` | Sem ${r.examId.semester}` : ""} | {r.examId?.date ? new Date(r.examId.date).toLocaleDateString() : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${gradeColor(r.percentage)}`}>{r.marksObtained}/{r.maxMarks}</p>
                    <p className="text-xs text-ink-soft">{r.percentage}%</p>
                    <Badge tone={gradeTone(r.percentage)} className="mt-1">{r.grade || "Pending"}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-ink mb-4">Assigned Faculty / Teachers</h2>
          {teachers.length === 0 ? (
            <EmptyState title="No teachers assigned" description="Assigned teachers for this section will appear here" />
          ) : (
            <div className="space-y-3">
              {teachers.map(t => (
                <div key={t.id} className="p-4 bg-background rounded-lg border border-line">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-ink">{t.name}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-ink-soft mt-1">
                        {t.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{t.email}</span>}
                        {t.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{t.phone}</span>}
                      </div>
                    </div>
                  </div>
                  {t.subjects?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.subjects.map(s => (
                        <span key={s.name} className="px-2 py-0.5 bg-primary-soft text-primary-dark rounded text-xs">{s.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-ink mb-4">Student Academic Details</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-background rounded-lg border border-line">
              <span className="text-sm text-ink-soft">Student Name</span>
              <span className="text-sm font-semibold text-ink">{dashboard.student?.name || studentName}</span>
            </div>
            {dashboard.student?.rollNo && (
              <div className="flex justify-between items-center p-3 bg-background rounded-lg border border-line">
                <span className="text-sm text-ink-soft">Roll Number</span>
                <span className="text-sm font-semibold text-ink">{dashboard.student.rollNo}</span>
              </div>
            )}
            {dashboard.student?.section && (
              <div className="flex justify-between items-center p-3 bg-background rounded-lg border border-line">
                <span className="text-sm text-ink-soft">Section</span>
                <span className="text-sm font-semibold text-ink">Section {dashboard.student.section}</span>
              </div>
            )}
            {dashboard.student?.courseName && (
              <div className="flex justify-between items-center p-3 bg-background rounded-lg border border-line">
                <span className="text-sm text-ink-soft">Course / Program</span>
                <span className="text-sm font-semibold text-ink">{dashboard.student.courseName}</span>
              </div>
            )}
            {dashboard.student?.branch && (
              <div className="flex justify-between items-center p-3 bg-background rounded-lg border border-line">
                <span className="text-sm text-ink-soft">Branch</span>
                <span className="text-sm font-semibold text-ink">{dashboard.student.branch}</span>
              </div>
            )}
            {dashboard.student?.semester && (
              <div className="flex justify-between items-center p-3 bg-background rounded-lg border border-line">
                <span className="text-sm text-ink-soft">Semester</span>
                <span className="text-sm font-semibold text-ink">Semester {dashboard.student.semester}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <AttendanceHistory role="parent" />
      </div>
    </div>
  );
}
