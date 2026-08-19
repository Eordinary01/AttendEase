// src/components/Subject/SubjectFilters.jsx
import React from 'react';
import { Search, Filter, X, Calendar, Users } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContexts';
import Button from '../common/ui/Button';

const fieldClass =
  'w-full px-4 py-2.5 border border-line rounded-lg bg-surface text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors';

const iconFieldClass =
  'w-full pl-10 pr-4 py-2.5 border border-line rounded-lg bg-surface text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors';

const iconBase =
  'absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-ink-faint';

const SubjectFilters = ({
  filters,
  onFilterChange,
  onClear,
  semesters,
  sections,
  showSectionFilter,
  showStatusFilter
}) => {
  const { colors } = useTheme();

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5" style={{ color: colors.primary }} />
          <h3 className="font-semibold" style={{ color: colors.primary }}>
            Filters
          </h3>
        </div>
        {(filters.search || filters.semester || filters.section || filters.status !== 'all') && (
          <Button
            variant="dangerSubtle"
            size="sm"
            leftIcon={X}
            onClick={onClear}
          >
            Clear Filters
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className={iconBase} />
          <input
            type="text"
            placeholder="Search subjects..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className={iconFieldClass}
          />
        </div>

        {/* Semester Filter */}
        <div className="relative">
          <Calendar className={iconBase} />
          <select
            value={filters.semester}
            onChange={(e) => onFilterChange({ semester: e.target.value })}
            className={`${iconFieldClass} appearance-none bg-surface`}
          >
            <option value="">All Semesters</option>
            {semesters.sort().map(sem => (
              <option key={sem} value={sem}>Semester {sem}</option>
            ))}
          </select>
        </div>

        {/* Section Filter (Teacher only) */}
        {showSectionFilter && (
          <div className="relative">
            <Users className={iconBase} />
            <select
              value={filters.section}
              onChange={(e) => onFilterChange({ section: e.target.value })}
              className={`${iconFieldClass} appearance-none bg-surface`}
            >
              <option value="">All Sections</option>
              {sections.sort().map(section => (
                <option key={section} value={section}>Section {section}</option>
              ))}
            </select>
          </div>
        )}

        {/* Status Filter (Admin only) */}
        {showStatusFilter && (
          <select
            value={filters.status}
            onChange={(e) => onFilterChange({ status: e.target.value })}
            className={fieldClass}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        )}
      </div>

      {/* Active Filters */}
      <div className="flex flex-wrap gap-2 mt-4">
        {filters.search && (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors"
            style={{
              backgroundColor: `${colors.primary}20`,
              color: colors.primary
            }}
          >
            Search: {filters.search}
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="ml-2 hover:opacity-70 transition-opacity"
              style={{ color: colors.primary }}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {filters.semester && (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors"
            style={{
              backgroundColor: `${colors.primary}20`,
              color: colors.primary
            }}
          >
            Semester: {filters.semester}
            <button
              onClick={() => onFilterChange({ semester: '' })}
              className="ml-2 hover:opacity-70 transition-opacity"
              style={{ color: colors.primary }}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {filters.section && (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors"
            style={{
              backgroundColor: `${colors.secondary}20`,
              color: colors.secondary
            }}
          >
            Section: {filters.section}
            <button
              onClick={() => onFilterChange({ section: '' })}
              className="ml-2 hover:opacity-70 transition-opacity"
              style={{ color: colors.secondary }}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {filters.status !== 'all' && (
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors"
            style={{
              backgroundColor: `${colors.accent}20`,
              color: colors.accent
            }}
          >
            Status: {filters.status}
            <button
              onClick={() => onFilterChange({ status: 'all' })}
              className="ml-2 hover:opacity-70 transition-opacity"
              style={{ color: colors.accent }}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
};

export default SubjectFilters;
