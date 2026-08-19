// src/components/Subject/SubjectDetails.jsx
import React from 'react';
import { Calendar, Award, User, Users, Mail, CheckCircle, XCircle, GraduationCap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContexts';
import Modal from '../common/ui/Modal';
import Button from '../common/ui/Button';

const SubjectDetails = ({ subject, role, onClose }) => {
  const { colors } = useTheme();

  // Get theme colors with fallbacks
  const themeColors = {
    primary: colors?.primary || '#7c3aed',
    secondary: colors?.secondary || '#6d28d9',
    light: colors?.primary ? `${colors.primary}20` : '#ede9fe',
    lighter: colors?.primary ? `${colors.primary}10` : '#f5f3ff',
    text: colors?.primary || '#7c3aed',
  };

  const semNum = parseInt(subject.semester, 10);
  const calculatedYear = !isNaN(semNum) && semNum > 0 ? Math.ceil(semNum / 2) : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={subject.name}
      subtitle={subject.code}
      size="lg"
      footer={
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {/* Basic Info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div
          className="rounded-lg p-4"
          style={{
            backgroundColor: themeColors.lighter,
            border: `1px solid ${themeColors.light}`
          }}
        >
          <div className="flex items-center mb-2" style={{ color: themeColors.primary }}>
            <Calendar className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Semester / Year</span>
          </div>
          <p className="text-lg font-semibold" style={{ color: themeColors.primary }}>
            Sem {subject.semester}{calculatedYear ? ` (Yr ${calculatedYear})` : ""}
          </p>
        </div>

        {subject.courseCode && (
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: themeColors.lighter,
              border: `1px solid ${themeColors.light}`
            }}
          >
            <div className="flex items-center mb-2" style={{ color: themeColors.primary }}>
              <GraduationCap className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Course</span>
            </div>
            <p className="text-lg font-semibold" style={{ color: themeColors.primary }}>
              {subject.courseCode}{subject.branch ? ` (${subject.branch})` : ""}
            </p>
          </div>
        )}

        {subject.credits > 0 && (
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: themeColors.lighter,
              border: `1px solid ${themeColors.light}`
            }}
          >
            <div className="flex items-center mb-2" style={{ color: themeColors.primary }}>
              <Award className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Credits</span>
            </div>
            <p className="text-lg font-semibold" style={{ color: themeColors.primary }}>
              {subject.credits}
            </p>
          </div>
        )}
      </div>

      {/* Description */}
      {subject.description && (
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-2" style={{ color: themeColors.primary }}>
            Description
          </h3>
          <p
            className="text-ink-soft rounded-lg p-4"
            style={{
              backgroundColor: themeColors.lighter,
              border: `1px solid ${themeColors.light}`
            }}
          >
            {subject.description}
          </p>
        </div>
      )}

      {/* Role-specific details */}
      {role === 'student' && subject.teacher && (
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3" style={{ color: themeColors.primary }}>
            Teacher Information
          </h3>
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: themeColors.lighter,
              border: `1px solid ${themeColors.light}`
            }}
          >
            <div className="flex items-center mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center mr-3"
                style={{
                  backgroundColor: themeColors.light,
                  color: themeColors.primary
                }}
              >
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium" style={{ color: themeColors.primary }}>
                  {subject.teacher.name}
                </p>
                <p className="text-sm" style={{ color: themeColors.secondary }}>
                  Your Teacher
                </p>
              </div>
            </div>
            {subject.teacher.email && (
              <div className="flex items-center text-sm text-ink-soft">
                <Mail className="w-4 h-4 mr-2" style={{ color: themeColors.primary }} />
                {subject.teacher.email}
              </div>
            )}
          </div>
        </div>
      )}

      {role === 'teacher' && subject.section && (
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3" style={{ color: themeColors.primary }}>
            Assignment Details
          </h3>
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: themeColors.lighter,
              border: `1px solid ${themeColors.light}`
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm mb-1" style={{ color: themeColors.secondary }}>
                  Section
                </p>
                <p className="text-lg font-semibold" style={{ color: themeColors.primary }}>
                  {subject.section}
                </p>
              </div>
              {subject.studentsCount !== undefined && (
                <div>
                  <p className="text-sm mb-1" style={{ color: themeColors.secondary }}>
                    Students
                  </p>
                  <p className="text-lg font-semibold" style={{ color: themeColors.primary }}>
                    {subject.studentsCount}
                  </p>
                </div>
              )}
            </div>
            {subject.stats && (
              <div
                className="mt-4 pt-4"
                style={{ borderTop: `1px solid ${themeColors.light}` }}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs" style={{ color: themeColors.secondary }}>
                      Registered
                    </p>
                    <p className="text-lg font-semibold text-green-600">
                      {subject.stats.registeredStudents || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: themeColors.secondary }}>
                      Pending
                    </p>
                    <p className="text-lg font-semibold text-yellow-600">
                      {subject.stats.pendingRegistration || 0}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {role === 'admin' && (
        <>
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3" style={{ color: themeColors.primary }}>
              Status
            </h3>
            <div className="flex items-center space-x-4">
              <span className={`flex items-center px-3 py-1 rounded-full ${
                subject.isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {subject.isActive ? (
                  <CheckCircle className="w-4 h-4 mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                {subject.isActive ? 'Active' : 'Inactive'}
              </span>
              {subject.createdBy && (
                <span className="text-sm text-ink-soft">
                  Created by: {subject.createdBy.name || 'Unknown'}
                </span>
              )}
            </div>
          </div>

          {subject.assignments && subject.assignments.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3" style={{ color: themeColors.primary }}>
                Teacher Assignments ({subject.assignments.length})
              </h3>
              <div className="space-y-3">
                {subject.assignments.map((assignment, index) => (
                  <div
                    key={index}
                    className="rounded-lg p-4"
                    style={{
                      backgroundColor: themeColors.lighter,
                      border: `1px solid ${themeColors.light}`
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-2" style={{ color: themeColors.primary }} />
                        <span className="font-medium" style={{ color: themeColors.primary }}>
                          {assignment.teacher?.name || assignment.teacherName}
                        </span>
                      </div>
                      <span
                        className="text-sm px-2 py-1 rounded-full"
                        style={{
                          backgroundColor: themeColors.light,
                          color: themeColors.primary
                        }}
                      >
                        Section {assignment.section}
                      </span>
                    </div>
                    {assignment.studentsCount > 0 && (
                      <div className="flex items-center text-sm text-ink-soft">
                        <Users className="w-4 h-4 mr-2" style={{ color: themeColors.primary }} />
                        {assignment.studentsCount} Students
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default SubjectDetails;
