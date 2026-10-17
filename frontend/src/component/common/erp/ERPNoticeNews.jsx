import React, { useState } from "react";
import { Megaphone, History, Paperclip, ChevronRight } from "lucide-react";
import ERPCard from "./ERPCard";
import UniversalSpinner from "../ui/UniversalSpinner";
import { getDateBadgeParts } from "../../../utils/dateUtils";

export default function ERPNoticeNews({
  notices = [],
  loading = false,
  onRefresh,
  onSelectNotice,
}) {
  const [activeTab, setActiveTab] = useState("all");

  const defaultNotices = [
    {
      _id: "n1",
      title: "IIT Madras Pravartak - Free Certified Intelligent Data Centre Infrastructure Certification Course for B.E/B.Tech/Diploma",
      message: "Applications are invited from eligible semester students for the specialized online certification course conducted by IIT Madras Pravartak.",
      createdAt: new Date().toISOString(),
      hasAttachment: true,
    },
    {
      _id: "n2",
      title: "Notice - Special Back Examination Schedule September 2026",
      message: "Students registered for odd semester backlog papers must submit examination forms by the announced deadline.",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      hasAttachment: true,
    },
    {
      _id: "n3",
      title: "Academic Attendance Policy Reminder: 75% Minimum Compliance",
      message: "All students are advised to maintain at least 75% aggregate attendance to be eligible for upcoming midterm evaluations.",
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      hasAttachment: false,
    },
  ];

  const items = notices.length > 0 ? notices : defaultNotices;

  return (
    <ERPCard
      title="Notice/News"
      onRefresh={onRefresh}
      isRefreshing={loading}
      bodyClassName="p-0"
      actions={
        <div className="flex items-center gap-1 border border-line rounded p-0.5 bg-surface-subtle">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            title="Current Announcements"
            className={`p-1 rounded transition cursor-pointer ${
              activeTab === "all" ? "bg-primary text-on-primary" : "text-ink-muted hover:text-ink"
            }`}
          >
            <Megaphone className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            title="Notice Archive"
            className={`p-1 rounded transition cursor-pointer ${
              activeTab === "history" ? "bg-primary text-on-primary" : "text-ink-muted hover:text-ink"
            }`}
          >
            <History className="w-3 h-3" />
          </button>
        </div>
      }
    >
      <div className="divide-y divide-line overflow-y-auto max-h-56">
        {loading ? (
          <UniversalSpinner size="sm" label="Loading announcements..." className="py-6" />
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-muted">
            No notices published yet.
          </div>
        ) : (
          items.map((n, idx) => {
            const { month: monthStr, day: dayNum } = getDateBadgeParts(n.createdAt || Date.now());

            return (
              <div
                key={n._id || idx}
                onClick={() => onSelectNotice && onSelectNotice(n)}
                className="flex items-start gap-3 p-3 hover:bg-surface-subtle transition text-xs cursor-pointer group"
              >
                <div className="w-11 h-11 rounded-lg bg-primary-soft border border-primary/20 flex flex-col items-center justify-center text-primary shrink-0">
                  <span className="text-[10px] font-bold uppercase leading-none">
                    {monthStr}
                  </span>
                  <span className="text-sm font-extrabold leading-tight">
                    {dayNum}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <h4 className="font-semibold text-ink group-hover:text-primary transition line-clamp-2 text-xs leading-snug">
                      {n.title || n.message}
                    </h4>
                    {(n.hasAttachment || n.attachment) && (
                      <Paperclip className="w-3 h-3 text-ink-muted shrink-0 ml-1" />
                    )}
                  </div>
                  {n.title && n.message && (
                    <p className="text-[11px] text-ink-muted line-clamp-1 mt-0.5">
                      {n.message}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </ERPCard>
  );
}
