import React from "react";
import ERPCard from "./ERPCard";

const TYPE_TONES = {
  holiday: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  exam: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  event: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  deadline: "bg-red-500/10 text-red-600 border-red-500/20",
  meeting: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

export default function ERPHolidayList({
  holidays = [],
  loading = false,
  onRefresh,
}) {
  const sortedItems = [...holidays].sort((a, b) => {
    const da = new Date(a.date || a.startDate || 0);
    const db = new Date(b.date || b.startDate || 0);
    return da - db;
  });

  return (
    <ERPCard
      title="Holiday List"
      badge={`${sortedItems.length} Events`}
      onRefresh={onRefresh}
      isRefreshing={loading}
      bodyClassName="p-0"
    >
      <div className="divide-y divide-line/60 overflow-y-auto max-h-56">
        {loading ? (
          <div className="p-8 text-center text-xs text-ink-faint">
            Loading holiday schedule...
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-faint">
            No holiday records found
          </div>
        ) : (
          sortedItems.map((h, idx) => {
            const dateObj = new Date(h.date || h.startDate);
            const monthStr = isNaN(dateObj.getTime())
              ? "Aug"
              : dateObj.toLocaleDateString("en-US", { month: "short" });
            const dayNum = isNaN(dateObj.getTime())
              ? "27"
              : dateObj.toLocaleDateString("en-US", { day: "2-digit" });
            const dayName = h.day || (isNaN(dateObj.getTime()) ? "Monday" : dateObj.toLocaleDateString("en-US", { weekday: "long" }));
            const typeKey = (h.type || "holiday").toLowerCase();
            const toneStyle = TYPE_TONES[typeKey] || TYPE_TONES.holiday;

            return (
              <div
                key={h.id || h._id || idx}
                className="flex items-center gap-3 p-3 hover:bg-background/80 transition text-xs"
              >
                {/* Date Chip matching reference */}
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary shrink-0">
                  <span className="text-[10px] font-bold uppercase leading-none">
                    {monthStr}
                  </span>
                  <span className="text-sm font-extrabold leading-tight">
                    {dayNum}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-ink truncate text-xs">
                    {h.title || h.name}
                  </h4>
                  <div className="flex items-center gap-2 text-[10px] text-ink-faint mt-0.5">
                    <span>{dayName}</span>
                    <span>•</span>
                    <span className={`px-1.5 py-0.2 rounded border font-medium capitalize ${toneStyle}`}>
                      {h.type || "Holiday"}
                    </span>
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
