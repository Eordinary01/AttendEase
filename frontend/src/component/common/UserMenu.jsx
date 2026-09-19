import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Transition } from '@headlessui/react';
import { User, LogOut, ChevronDown } from 'lucide-react';

/**
 * UserMenu
 * Accessible user profile dropdown menu with avatar fallback and sign out handler.
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
        className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-background transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 select-none"
        aria-label="User profile menu"
      >
        {userAvatar ? (
          <img
            src={userAvatar}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover border border-line shadow-xs shrink-0"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shadow-xs shrink-0">
            {initial}
          </span>
        )}
        <div className="hidden md:flex flex-col text-left">
          <span className="text-xs font-bold text-ink max-w-[130px] truncate leading-tight">
            {displayName}
          </span>
          <span className="text-[10px] text-ink-faint font-medium capitalize truncate">
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
        <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl bg-surface border border-line p-1.5 shadow-pop focus:outline-none z-50">
          <div className="px-3 py-2.5 border-b border-line mb-1">
            <p className="text-xs font-bold text-ink truncate">{displayName}</p>
            <p className="text-[11px] text-ink-faint capitalize mt-0.5">{roleLabel}</p>
          </div>

          <Menu.Item>
            {({ active }) => (
              <Link
                to="/profile"
                className={`
                  flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors
                  ${active ? 'bg-background text-ink' : 'text-ink-soft'}
                `}
              >
                <User className="w-4 h-4 text-ink-faint" />
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
                  flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors
                  ${active ? 'bg-red-500/10 text-red-600' : 'text-red-500'}
                `}
              >
                <LogOut className="w-4 h-4" />
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
