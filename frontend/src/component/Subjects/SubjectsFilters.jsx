// src/components/Subject/SubjectFilters.jsx
import React from 'react';
import { Search, Filter, X, Calendar, Users } from 'lucide-react';

const SubjectFilters = ({ 
  filters, 
  onFilterChange, 
  onClear, 
  semesters, 
  sections,
  showSectionFilter,
  showStatusFilter 
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-purple-900">Filters</h3>
        </div>
        {(filters.search || filters.semester || filters.section || filters.status !== 'all') && (
          <button
            onClick={onClear}
            className="text-sm text-red-600 hover:text-red-700 flex items-center"
          >
            <X className="w-4 h-4 mr-1" />
            Clear Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search subjects..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Semester Filter */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={filters.semester}
            onChange={(e) => onFilterChange({ semester: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white"
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
            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filters.section}
              onChange={(e) => onFilterChange({ section: e.target.value })}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none bg-white"
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
          <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
            Search: {filters.search}
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="ml-2 hover:text-purple-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {filters.semester && (
          <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
            Semester: {filters.semester}
            <button
              onClick={() => onFilterChange({ semester: '' })}
              className="ml-2 hover:text-purple-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {filters.section && (
          <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
            Section: {filters.section}
            <button
              onClick={() => onFilterChange({ section: '' })}
              className="ml-2 hover:text-purple-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
        {filters.status !== 'all' && (
          <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
            Status: {filters.status}
            <button
              onClick={() => onFilterChange({ status: 'all' })}
              className="ml-2 hover:text-purple-900"
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