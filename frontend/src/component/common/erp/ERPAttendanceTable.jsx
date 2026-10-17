import React from "react";
import ERPCard from "./ERPCard";
import UniversalSpinner from "../ui/UniversalSpinner";

export default function ERPAttendanceTable({
  bySubject = [],
  overallPercentage = "0",
  loading = false,
  onRefresh,
}) {
  return (
    <ERPCard
      title="Attendance"
      badge={`${overallPercentage}% Aggregate`}
      onRefresh={onRefresh}
      isRefreshing={loading}
      bodyClassName="p-0"
    >
      {/* Table Header Bar */}
      <div className="grid grid-cols-12 px-4 py-2 bg-surface-subtle border-b border-line text-[11px] font-bold text-ink-muted uppercase tracking-wider">
        <div className="col-span-6">Subject</div>
        <div className="col-span-3 text-center">Lectures</div>
        <div className="col-span-3 text-right">%</div>
      </div>

      {/* Table Content */}
      <div className="divide-y divide-line overflow-y-auto max-h-56">
        {loading ? (
          <UniversalSpinner size="sm" label="Loading attendance records..." className="py-6" />
        ) : bySubject.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-muted">
            No subject attendance records found.
          </div>
        ) : (
          bySubject.map((item, idx) => {
            const pct = parseFloat(item.attendancePercentage || 0);
            const isSafe = pct >= 75;
            const isWarn = pct >= 60 && pct < 75;
            const barBg = isSafe ? "bg-primary" : isWarn ? "bg-status-warning-bg text-status-warning-text" : "bg-status-error-bg text-status-error-text";
            const textTone = isSafe ? "text-primary" : isWarn ? "text-status-warning-text" : "text-status-error-text";

            return (
              <div
                key={item.subjectCode || item.subjectId || idx}
                className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-primary-soft/15 transition-colors text-xs"
              >
                <div className="col-span-6 pr-2">
                  <span className="font-bold text-ink text-xs block truncate">
                    {item.subjectName}
                  </span>
                  <span className="text-[10px] text-ink-muted font-mono">
                    {item.subjectCode}
                  </span>
                </div>

                <div className="col-span-3 text-center text-[11px] font-medium text-ink-muted">
                  <span className="text-ink font-semibold font-mono tnum">{item.present || 0}</span>
                  <span className="text-ink-muted"> / {item.total || 0}</span>
                </div>

                <div className="col-span-3 text-right">
                  <span className={`font-bold font-mono tnum text-xs ${textTone}`}>
                    {item.attendancePercentage}%
                  </span>
                  <div className="w-full bg-surface-subtle border border-line/60 rounded-full h-1.5 mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barBg} transition-all duration-300`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ERPCard>
  );
}
