import React, { useState } from "react";
import ERPCard from "./ERPCard";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ERPWeeklyTimetable({
  timetable = [],
  loading = false,
  onRefresh,
}) {
  const [activeDay, setActiveDay] = useState(
    DAYS.includes(new Date().toLocaleDateString("en-US", { weekday: "long" }))
      ? new Date().toLocaleDateString("en-US", { weekday: "long" })
      : "Monday"
  );

  // Group timetable slots by day
  const slotsByDay = timetable.reduce((acc, item) => {
    const day = item.day || item.dayOfWeek || "Monday";
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});

  const currentSlots = slotsByDay[activeDay] || [];

  return (
    <ERPCard
      title="Class Time Table"
      onRefresh={onRefresh}
      isRefreshing={loading}
      bodyClassName="p-0"
    >
      {/* Day Selector Ribbon matching reference */}
      <div className="flex border-b border-line overflow-x-auto bg-surface-raised/40 scrollbar-none">
        {DAYS.map((day) => {
          const isSelected = activeDay === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setActiveDay(day)}
              className={`flex-1 min-w-[75px] py-2 px-1 text-center text-xs font-semibold transition-all relative whitespace-nowrap cursor-pointer ${
                isSelected
                  ? "text-primary font-bold bg-surface"
                  : "text-ink-soft hover:text-ink hover:bg-surface/50"
              }`}
            >
              {day}
              {isSelected && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Slots Matrix for Selected Day */}
      <div className="p-3 divide-y divide-line/40 overflow-y-auto max-h-56">
        {loading ? (
          <div className="p-6 text-center text-xs text-ink-faint">
            Loading timetable...
          </div>
        ) : currentSlots.length === 0 ? (
          <div className="p-6 text-center text-xs text-ink-faint">
            No lectures scheduled on {activeDay}.
          </div>
        ) : (
          <div className="space-y-2">
            {currentSlots.map((slot, idx) => {
              const code = slot.subject?.subjectCode || slot.subjectCode || "SUB";
              const name = slot.subject?.subjectName || slot.subjectName || "Subject Name";
              const teacher = slot.teacher?.name || slot.teacherName || "Designated Faculty";
              const room = slot.roomNumber || slot.room || "Room 101";
              const time = slot.timeSlot || slot.time || `0${idx + 9}:00 - 0${idx + 10}:00`;

              return (
                <div
                  key={slot._id || idx}
                  className="p-2.5 rounded-xl bg-background border border-line/60 flex items-center justify-between text-xs hover:border-primary/40 transition"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-primary font-mono text-[11px]">
                        [{code}]
                      </span>
                      <span className="font-semibold text-ink truncate">
                        {name}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-soft mt-0.5">
                      {teacher} · <span className="text-ink-faint">{room}</span>
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-ink-faint bg-surface px-2 py-1 rounded-md border border-line shrink-0">
                    {time}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ERPCard>
  );
}
