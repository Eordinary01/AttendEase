import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { User, LogOut, ChevronDown } from 'lucide-react';

/**
 * UserMenu — Academic Registrar user profile dropdown.
 * Surface: bg-surface with hairline border and shadow-level3.
 */
export const UserMenu = ({
  displayName = 'Account',
  userAvatar = null,
  role = 'student',
  roleLabel = 'Student',
  onLogout,
  className = '',
}) => {
  const initial = (displayName || 'A').charAt(0).toUpperCase();

  return (
    <Menu as="div" className={`relative inline-block text-left ${className}`}>
      <Menu.Button
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-subtle transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary select-none cursor-pointer"
        aria-label="User profile menu"
      >
        {userAvatar ? (
          <img
            src={userAvatar}
            alt={displayName}
            className="w-7 h-7 rounded-full object-cover border border-primary/20 ring-2 ring-primary/10 shrink-0"
          />
        ) : (
          <span className="w-7 h-7 rounded-full bg-primary text-on-primary ring-2 ring-primary/20 flex items-center justify-center text-xs font-semibold font-mono shrink-0">
            {initial}
          </span>
        )}
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-semibold text-ink max-w-[130px] truncate leading-tight">
            {displayName}
          </span>
          <span className="text-[10px] text-ink-muted font-medium capitalize truncate">
            {roleLabel}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-ink-faint hidden md:block shrink-0" />
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-1.5 w-52 origin-top-right rounded-lg bg-surface border border-line p-1 shadow-level3 focus:outline-none z-50 overflow-hidden">
          {/* Institutional Roofline Strip */}
          <div className="h-[2px] w-full bg-gradient-to-r from-primary via-primary-light to-secondary -mx-1 -mt-1 mb-1 shrink-0" />

          <div className="px-3 py-2 border-b border-line mb-1">
            <p className="text-xs font-semibold text-ink truncate">{displayName}</p>
            <p className="text-[11px] text-ink-muted capitalize mt-0.5">{roleLabel}</p>
          </div>

          <Menu.Item>
            {({ active }) => (
              <Link
                to="/profile"
                className={`
                  flex items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium transition-colors
                  ${active ? 'bg-primary-soft/40 text-primary-ink' : 'text-ink-muted'}
                `}
              >
                <User className="w-3.5 h-3.5 text-ink-muted" />
                <span>My Profile</span>
              </Link>
            )}
          </Menu.Item>

          <Menu.Item>
            {({ active }) => (
              <button
                type="button"
                onClick={onLogout}
                className={`
                  flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium transition-colors
                  ${active ? 'bg-status-error-bg text-status-error-text' : 'text-status-error-text'}
                `}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            )}
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default UserMenu;

