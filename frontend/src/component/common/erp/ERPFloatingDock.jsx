import React from "react";
import { Calendar, Ticket, Info, Link2 } from "lucide-react";

export default function ERPFloatingDock({ onActionClick }) {
  const dockItems = [
    { id: "calendar", icon: Calendar, label: "Academic Calendar & Timetable", color: "bg-primary hover:bg-primary-hover text-on-primary" },
    { id: "tickets", icon: Ticket, label: "Absence Proofs & Tickets", color: "bg-secondary hover:opacity-90 text-on-secondary" },
    { id: "info", icon: Info, label: "Institute & Policy Details", color: "bg-primary-soft hover:bg-primary-surface text-primary-ink border border-primary/25" },
    { id: "links", icon: Link2, label: "Quick ERP Portals & Links", color: "bg-surface hover:bg-surface-subtle text-ink border border-line" },
  ];

  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 p-1.5 bg-surface/95 backdrop-blur-lg border border-line rounded-xl shadow-lg">
      {dockItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onActionClick && onActionClick(item.id)}
            title={item.label}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 group relative ${item.color}`}
          >
            <Icon className="w-4 h-4" />
            <span className="absolute right-full mr-2 px-2.5 py-1 rounded-lg bg-ink text-surface text-[11px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-level3 border border-line-strong">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
