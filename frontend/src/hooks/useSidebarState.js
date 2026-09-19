import { useState, useCallback } from 'react';

const SIDEBAR_COLLAPSED_KEY = 'attendease:sidebar-collapsed';
const GROUPS_COLLAPSED_KEY = 'attendease:nav-groups-collapsed';

/**
 * useSidebarState
 * Manages and persists desktop sidebar collapse state and group collapse states.
 */
export function useSidebarState(role = '') {
  const [collapsed, setCollapsedState] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const [collapsedGroups, setCollapsedGroupsState] = useState(() => {
    try {
      const stored = localStorage.getItem(GROUPS_COLLAPSED_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const setCollapsed = useCallback((valOrFn) => {
    setCollapsedState((prev) => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupName) => {
    const key = `${role}:${groupName}`;
    setCollapsedGroupsState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(GROUPS_COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [role]);

  const isGroupCollapsed = useCallback((groupName) => {
    const key = `${role}:${groupName}`;
    return Boolean(collapsedGroups[key]);
  }, [role, collapsedGroups]);

  return {
    collapsed,
    setCollapsed,
    toggleGroup,
    isGroupCollapsed,
  };
}

export default useSidebarState;
