import React from "react";
import { Clock, MapPin, User, CheckCircle, AlertCircle } from "lucide-react";
import ERPCard from "./ERPCard";

export default function ERPTodayTimetable({
  schedule = [],
  loading = false,
  onRefresh,
  currentDayName = "",
}) {
  const day = currentDayName || new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <ERPCard
      title="Today's Time Table"
      badge={day}
      onRefresh={onRefresh}
      isRefreshing={loading}
      bodyClassName="p-0"
    >
      {/* Table Header Bar */}
      <div className="grid grid-cols-12 px-4 py-2 bg-surface-raised/60 border-b border-line text-[11px] font-bold text-ink-faint uppercase tracking-wider">
        <div className="col-span-4 flex items-center gap-1">
          <Clock className="w-3 h-3 text-primary" />
          <span>Slot</span>
        </div>
        <div className="col-span-8 flex items-center gap-1">
          <span>Course / Faculty</span>
        </div>
      </div>

      {/* Table Content */}
      <div className="divide-y divide-line/60 overflow-y-auto max-h-56">
        {loading ? (
          <div className="p-8 text-center text-xs text-ink-faint">
            Loading today's schedule...
          </div>
        ) : schedule.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-faint">
            No scheduled classes for today ({day}).
          </div>
        ) : (
          schedule.map((item, idx) => {
            const subjectCode = item.subject?.subjectCode || item.subjectCode || "SUB";
            const subjectName = item.subject?.subjectName || item.subjectName || "Subject";
            const teacherName = item.teacher?.name || item.teacherName || "Faculty Assigned";
            const room = item.roomNumber || item.room || "Room 101";
            const timeSlot = item.timeSlot || item.time || `0${idx + 9}:00 - 0${idx + 10}:00`;

            return (
              <div
                key={item._id || idx}
                className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-background/80 transition-colors text-xs"
              >
                {/* Slot info */}
                <div className="col-span-4 pr-2">
                  <span className="font-semibold text-ink text-[11px] block truncate">
                    {timeSlot}
                  </span>
                  <span className="text-[10px] text-ink-faint flex items-center gap-1 mt-0.5">
                    <MapPin className="w-2.5 h-2.5 text-primary" />
                    {room}
                  </span>
                </div>

                {/* Course & Faculty info */}
                <div className="col-span-8 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-primary text-xs truncate">
                      [{subjectCode}]
                    </span>
                    <span className="font-medium text-ink truncate text-xs">
                      {subjectName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-ink-soft mt-0.5 truncate">
                    <User className="w-2.5 h-2.5 text-ink-faint" />
                    <span>{teacherName}</span>
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
