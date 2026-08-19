// src/components/Subject/SubjectCard.jsx
import React, { useState } from 'react';
import { BookOpen, Users, Calendar, ChevronRight, Award, User, GraduationCap } from 'lucide-react';
import SubjectDetails from './SubjectsDetails';
import Badge from '../common/ui/Badge';
import { useTheme } from '../../contexts/ThemeContexts';

const SubjectCard = ({ subject, role, viewMode }) => {
  const [showDetails, setShowDetails] = useState(false);
  const { colors } = useTheme();

  // Get theme colors with fallbacks
  const themeColors = {
    primary: colors?.primary || '#7c3aed',
    secondary: colors?.secondary || '#6d28d9',
    light: colors?.primary ? `${colors.primary}20` : '#ede9fe',
    lighter: colors?.primary ? `${colors.primary}10` : '#f5f3ff',
  };

  // Handle different data structures based on role
  const getSubjectData = () => {
    const rawSub = subject.subject || subject;
    const semNum = parseInt(String(rawSub.semester || subject.semester || "").replace(/\D/g, ""), 10);
    const calculatedYear = rawSub.year || subject.year || (!isNaN(semNum) && semNum > 0 ? Math.ceil(semNum / 2) : null);

    const baseCourseCode = rawSub.courseCode || subject.courseCode || "";
    const baseBranch = rawSub.branch || subject.branch || "";

    if (role === 'student') {
      return {
        id: rawSub.id || rawSub._id,
        code: rawSub.subjectCode,
        name: rawSub.subjectName,
        semester: rawSub.semester,
        year: calculatedYear,
        courseCode: baseCourseCode,
        branch: baseBranch,
        credits: rawSub.credits,
        description: rawSub.description,
        teacher: subject.teacher,
        section: subject.section
      };
    } else if (role === 'teacher') {
      return {
        id: rawSub.id || rawSub._id,
        code: rawSub.subjectCode,
        name: rawSub.subjectName,
        semester: rawSub.semester,
        year: calculatedYear,
        courseCode: baseCourseCode,
        branch: baseBranch,
        credits: rawSub.credits,
        description: rawSub.description,
        section: subject.section,
        isAssignedToYou: subject.isAssignedToYou,
        yourSection: subject.yourSection,
        studentsCount: subject.studentsCount,
        stats: subject.stats
      };
    } else {
      // Admin view
      return {
        id: subject._id,
        code: subject.subjectCode,
        name: subject.subjectName,
        semester: subject.semester,
        year: calculatedYear,
        courseCode: baseCourseCode,
        courseId: subject.courseId,
        branch: baseBranch,
        credits: subject.credits,
        description: subject.description,
        isActive: subject.isActive,
        createdBy: subject.createdBy,
        assignments: subject.assignments || [],
        totalAssignments: subject.totalAssignments || 0
      };
    }
  };

  const data = getSubjectData();

  // Dynamic styles
  const cardStyles = {
    borderColor: `${themeColors.primary}30`,
    hoverBorderColor: themeColors.primary,
  };

  const iconBgStyles = {
    backgroundColor: themeColors.light,
    color: themeColors.primary,
  };

  const iconBgHoverStyles = {
    backgroundColor: themeColors.primary,
    color: 'white',
  };

  const footerStyles = {
    backgroundColor: themeColors.lighter,
    borderColor: `${themeColors.primary}20`,
    color: themeColors.primary,
  };

  if (viewMode === 'list') {
    return (
      <>
        <div
          onClick={() => setShowDetails(true)}
          className="bg-surface rounded-lg shadow-card hover:shadow-cardhover transition-all duration-200 p-4 cursor-pointer border group"
          style={{
            borderColor: `${themeColors.primary}30`,
            borderWidth: '1px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = themeColors.primary;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `${themeColors.primary}30`;
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div
                className="p-3 rounded-lg transition-colors group-hover:bg-opacity-80 flex-shrink-0"
                style={{
                  backgroundColor: themeColors.light,
                  color: themeColors.primary,
                }}
              >
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                  <h3
                    className="font-semibold text-lg"
                    style={{ color: themeColors.primary }}
                  >
                    {data.name}
                  </h3>
                  <span
                    className="px-2 py-0.5 text-xs rounded-full font-mono font-semibold"
                    style={{
                      backgroundColor: themeColors.light,
                      color: themeColors.primary,
                    }}
                  >
                    {data.code}
                  </span>
                  {data.courseCode && (
                    <Badge tone="primary">{data.courseCode}</Badge>
                  )}
                  {data.branch && (
                    <Badge tone="neutral">{data.branch}</Badge>
                  )}
                </div>
                <div className="flex items-center space-x-4 mt-1 text-sm text-ink-soft flex-wrap gap-y-1">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1 flex-shrink-0" style={{ color: themeColors.primary }} />
                    Sem {data.semester}{data.year ? ` (Yr ${data.year})` : ""}
                  </span>
                  {data.courseCode && (
                    <span className="flex items-center">
                      <GraduationCap className="w-4 h-4 mr-1 flex-shrink-0" style={{ color: themeColors.primary }} />
                      Course: {data.courseCode}
                    </span>
                  )}
                  {data.credits > 0 && (
                    <span className="flex items-center">
                      <Award className="w-4 h-4 mr-1 flex-shrink-0" style={{ color: themeColors.primary }} />
                      {data.credits} Credits
                    </span>
                  )}
                  {role === 'teacher' && data.section && (
                    <span className="flex items-center">
                      <Users className="w-4 h-4 mr-1 flex-shrink-0" style={{ color: themeColors.primary }} />
                      Section {data.section}
                      {data.studentsCount && ` (${data.studentsCount} students)`}
                    </span>
                  )}
                  {role === 'student' && data.teacher && (
                    <span className="flex items-center">
                      <User className="w-4 h-4 mr-1 flex-shrink-0" style={{ color: themeColors.primary }} />
                      {data.teacher.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-ink-faint group-hover:translate-x-1 transition-transform ml-2" style={{ color: themeColors.primary }} />
          </div>
        </div>

        {/* Details Modal */}
        {showDetails && (
          <SubjectDetails
            subject={data}
            role={role}
            onClose={() => setShowDetails(false)}
          />
        )}
      </>
    );
  }

  // Grid view
  return (
    <>
      <div
        onClick={() => setShowDetails(true)}
        className="bg-surface rounded-xl shadow-card hover:shadow-cardhover transition-all duration-200 overflow-hidden cursor-pointer border group flex flex-col justify-between"
        style={{
          borderColor: `${themeColors.primary}30`,
          borderWidth: '1px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = themeColors.primary;
          e.currentTarget.style.boxShadow = `0 10px 15px -3px ${themeColors.primary}20, 0 4px 6px -2px ${themeColors.primary}10`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = `${themeColors.primary}30`;
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-3">
            <div
              className="p-3 rounded-lg transition-colors group-hover:bg-opacity-80"
              style={{
                backgroundColor: themeColors.light,
                color: themeColors.primary,
              }}
            >
              <BookOpen className="w-7 h-7" />
            </div>
            {role === 'admin' && (
              <Badge tone={data.isActive ? 'success' : 'danger'}>
                {data.isActive ? 'Active' : 'Inactive'}
              </Badge>
            )}
          </div>

          <h3
            className="font-semibold text-lg mb-1"
            style={{ color: themeColors.primary }}
          >
            {data.name}
          </h3>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm font-semibold font-mono" style={{ color: themeColors.secondary }}>{data.code}</span>
            {data.courseCode && (
              <Badge tone="primary">{data.courseCode}</Badge>
            )}
            {data.branch && (
              <Badge tone="neutral">{data.branch}</Badge>
            )}
          </div>

          <div className="space-y-2 text-sm text-ink-soft">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 flex-shrink-0" style={{ color: themeColors.primary }} />
              <span>Semester {data.semester}{data.year ? ` (Year ${data.year})` : ""}</span>
            </div>

            {data.courseCode && (
              <div className="flex items-center">
                <GraduationCap className="w-4 h-4 mr-2 flex-shrink-0" style={{ color: themeColors.primary }} />
                <span>Course: <strong className="text-ink font-medium">{data.courseCode}</strong></span>
              </div>
            )}

            {data.credits > 0 && (
              <div className="flex items-center">
                <Award className="w-4 h-4 mr-2 flex-shrink-0" style={{ color: themeColors.primary }} />
                {data.credits} Credits
              </div>
            )}

            {role === 'teacher' && data.section && (
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" style={{ color: themeColors.primary }} />
                Section {data.section}
                {data.studentsCount && ` (${data.studentsCount} students)`}
              </div>
            )}

            {role === 'student' && data.teacher && (
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2" style={{ color: themeColors.primary }} />
                {data.teacher.name}
              </div>
            )}

            {role === 'admin' && data.totalAssignments > 0 && (
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" style={{ color: themeColors.primary }} />
                {data.totalAssignments} Teacher{data.totalAssignments > 1 ? 's' : ''} Assigned
              </div>
            )}
          </div>

          {data.description && (
            <p className="mt-4 text-sm text-ink-soft line-clamp-2">
              {data.description}
            </p>
          )}
        </div>

        <div
          className="px-6 py-3 border-t flex justify-between items-center transition-colors"
          style={{
            backgroundColor: themeColors.lighter,
            borderColor: `${themeColors.primary}20`,
            color: themeColors.primary,
          }}
        >
          <span className="text-xs">
            {role === 'teacher' && 'Click to view details'}
            {role === 'student' && 'View subject details'}
            {role === 'admin' && 'Manage subject'}
          </span>
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && (
        <SubjectDetails
          subject={data}
          role={role}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  );
};

export default SubjectCard;
