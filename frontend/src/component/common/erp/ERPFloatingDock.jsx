import React from "react";
import { Calendar, Settings, Info, Link2, Ticket, HelpCircle } from "lucide-react";

export default function ERPFloatingDock({ onActionClick }) {
  const dockItems = [
    { id: "calendar", icon: Calendar, label: "Academic Calendar & Timetable", color: "bg-indigo-600 hover:bg-indigo-700" },
    { id: "tickets", icon: Ticket, label: "Absence Proofs & Tickets", color: "bg-purple-600 hover:bg-purple-700" },
    { id: "info", icon: Info, label: "Institute & Policy Details", color: "bg-sky-600 hover:bg-sky-700" },
    { id: "links", icon: Link2, label: "Quick ERP Portals & Links", color: "bg-emerald-600 hover:bg-emerald-700" },
  ];

  return (
    <div className="fixed right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2 p-1.5 bg-surface/90 backdrop-blur-md border border-line rounded-2xl shadow-xl">
      {dockItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onActionClick && onActionClick(item.id)}
            title={item.label}
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 group relative ${item.color}`}
          >
            <Icon className="w-4 h-4" />
            <span className="absolute right-full mr-2 px-2.5 py-1 rounded-lg bg-gray-900 text-white text-[11px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-lg">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
