import React from "react";
import ERPCard from "./ERPCard";

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
      <div className="grid grid-cols-12 px-4 py-2 bg-surface-raised/60 border-b border-line text-[11px] font-bold text-ink-faint uppercase tracking-wider">
        <div className="col-span-6">Subject</div>
        <div className="col-span-3 text-center">Lectures</div>
        <div className="col-span-3 text-right">%</div>
      </div>

      {/* Table Content */}
      <div className="divide-y divide-line/60 overflow-y-auto max-h-56">
        {loading ? (
          <div className="p-8 text-center text-xs text-ink-faint">
            Loading attendance records...
          </div>
        ) : bySubject.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-faint">
            No subject attendance records found.
          </div>
        ) : (
          bySubject.map((item, idx) => {
            const pct = parseFloat(item.attendancePercentage || 0);
            const isSafe = pct >= 75;
            const isWarn = pct >= 60 && pct < 75;
            const barBg = isSafe
              ? "bg-emerald-500"
              : isWarn
              ? "bg-amber-500"
              : "bg-red-500";
            const textTone = isSafe
              ? "text-emerald-600"
              : isWarn
              ? "text-amber-600"
              : "text-red-600";

            return (
              <div
                key={item.subjectCode || item.subjectId || idx}
                className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-background/80 transition text-xs"
              >
                {/* Subject */}
                <div className="col-span-6 pr-2">
                  <span className="font-bold text-ink text-xs block truncate">
                    {item.subjectName}
                  </span>
                  <span className="text-[10px] text-ink-faint font-mono">
                    {item.subjectCode}
                  </span>
                </div>

                {/* Lectures count */}
                <div className="col-span-3 text-center text-[11px] font-medium text-ink-soft">
                  <span className="text-ink font-semibold">{item.present || 0}</span>
                  <span className="text-ink-faint"> / {item.total || 0}</span>
                </div>

                {/* Percentage & Bar */}
                <div className="col-span-3 text-right">
                  <span className={`font-bold text-xs ${textTone}`}>
                    {item.attendancePercentage}%
                  </span>
                  <div className="w-full bg-line rounded-full h-1.5 mt-1 overflow-hidden">
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
