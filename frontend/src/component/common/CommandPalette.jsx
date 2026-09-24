import React, { useState, useEffect, useMemo, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Search, ArrowRight, Clock, X, CornerDownLeft } from 'lucide-react';

const RECENT_SEARCHES_KEY = 'attendease:recent-nav';

/**
 * CommandPalette
 * Accessible Cmd+K search dialog enabling instant keyboard navigation across all role-accessible pages.
 */
export const CommandPalette = ({
  open = false,
  onClose,
  groups = [],
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Flatten all role-accessible items
  const allItems = useMemo(() => {
    const list = [];
    groups.forEach((section) => {
      (section.items || []).forEach((item) => {
        list.push({
          ...item,
          group: section.group,
        });
      });
    });
    return list;
  }, [groups]);

  // Read recent pages from localStorage
  const recentPages = useMemo(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      const paths = stored ? JSON.parse(stored) : [];
      return paths
        .map((path) => allItems.find((i) => i.to === path))
        .filter(Boolean)
        .slice(0, 5);
    } catch {
      return [];
    }
  }, [allItems]);

  // Filtered items based on search query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.group && item.group.toLowerCase().includes(q))
    );
  }, [allItems, query]);

  const displayedItems = query.trim() ? filteredItems : recentPages;

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Save to recent pages when a route is selected
  const handleSelect = (item) => {
    if (!item) return;
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      const paths = stored ? JSON.parse(stored) : [];
      const updated = [item.to, ...paths.filter((p) => p !== item.to)].slice(0, 5);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    onClose();
    navigate(item.to);
  };

  // Keyboard navigation inside list
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (displayedItems.length > 0 ? (prev + 1) % displayedItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (displayedItems.length > 0 ? (prev - 1 + displayedItems.length) % displayedItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (displayedItems[selectedIndex]) {
        handleSelect(displayedItems[selectedIndex]);
      }
    }
  };

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-20">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="mx-auto max-w-xl transform rounded-2xl bg-surface border border-line shadow-pop transition-all overflow-hidden">
              {/* Search Header Input */}
              <div className="relative flex items-center px-4 border-b border-line">
                <Search className="w-5 h-5 text-ink-faint shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a command or jump to page..."
                  className="w-full h-14 bg-transparent border-0 px-3 text-sm text-ink placeholder:text-ink-faint outline-none"
                  autoFocus
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="p-1 rounded-md text-ink-faint hover:text-ink transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[10px] font-mono text-ink-faint bg-background rounded border border-line">
                    ESC
                  </kbd>
                )}
              </div>

              {/* Results List */}
              <div className="max-h-80 overflow-y-auto p-2 divide-y divide-line/40">
                {displayedItems.length > 0 ? (
                  <div>
                    {!query.trim() && (
                      <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint flex items-center gap-1.5">
                        <Clock className="w-3 h-3" /> Recent Pages
                      </p>
                    )}
                    <ul className="space-y-1">
                      {displayedItems.map((item, idx) => {
                        const Icon = item.icon;
                        const isSelected = idx === selectedIndex;

                        return (
                          <li
                            key={item.to}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`
                              flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-colors
                              ${isSelected ? 'bg-primary-soft text-primary-dark font-semibold' : 'text-ink-soft hover:bg-background hover:text-ink'}
                            `}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              {Icon && <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-primary' : 'text-ink-faint'}`} />}
                              <span className="truncate">{item.label}</span>
                              {item.group && (
                                <span className="text-[10px] text-ink-faint font-normal">
                                  in {item.group}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              {isSelected && (
                                <CornerDownLeft className="w-3.5 h-3.5 text-primary opacity-80" />
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-ink-faint">
                    No results found for &ldquo;<span className="font-semibold text-ink">{query}</span>&rdquo;
                  </div>
                )}
              </div>

              {/* Footer Guidance */}
              <div className="px-4 py-2 bg-background/60 border-t border-line flex items-center justify-between text-[11px] text-ink-faint">
                <span className="flex items-center gap-1">
                  Navigate with <kbd className="px-1 py-0.5 rounded bg-surface border border-line text-[9px]">↑</kbd> <kbd className="px-1 py-0.5 rounded bg-surface border border-line text-[9px]">↓</kbd>
                </span>
                <span className="flex items-center gap-1">
                  Select with <kbd className="px-1.5 py-0.5 rounded bg-surface border border-line text-[9px]">↵</kbd>
                </span>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default CommandPalette;
