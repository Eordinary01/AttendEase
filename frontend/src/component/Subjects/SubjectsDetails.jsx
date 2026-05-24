// src/components/Subject/SubjectDetails.jsx
import React from 'react';
import { X, BookOpen, Calendar, Award, User, Users, Mail, Clock, CheckCircle, XCircle } from 'lucide-react';

const SubjectDetails = ({ subject, role, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-purple-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-purple-900">{subject.name}</h2>
              <p className="text-sm text-purple-600">{subject.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-purple-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-purple-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="flex items-center text-purple-700 mb-2">
                <Calendar className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Semester</span>
              </div>
              <p className="text-lg font-semibold text-purple-900">{subject.semester}</p>
            </div>
            
            {subject.credits > 0 && (
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center text-purple-700 mb-2">
                  <Award className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">Credits</span>
                </div>
                <p className="text-lg font-semibold text-purple-900">{subject.credits}</p>
              </div>
            )}
          </div>

          {/* Description */}
          {subject.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-purple-700 mb-2">Description</h3>
              <p className="text-gray-600 bg-purple-50 rounded-lg p-4">{subject.description}</p>
            </div>
          )}

          {/* Role-specific details */}
          {role === 'student' && subject.teacher && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-purple-700 mb-3">Teacher Information</h3>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center mb-3">
                  <User className="w-5 h-5 text-purple-600 mr-3" />
                  <div>
                    <p className="font-medium text-purple-900">{subject.teacher.name}</p>
                    <p className="text-sm text-purple-600">Your Teacher</p>
                  </div>
                </div>
                {subject.teacher.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2 text-purple-400" />
                    {subject.teacher.email}
                  </div>
                )}
              </div>
            </div>
          )}

          {role === 'teacher' && subject.section && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-purple-700 mb-3">Assignment Details</h3>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-purple-600 mb-1">Section</p>
                    <p className="text-lg font-semibold text-purple-900">{subject.section}</p>
                  </div>
                  {subject.studentsCount !== undefined && (
                    <div>
                      <p className="text-sm text-purple-600 mb-1">Students</p>
                      <p className="text-lg font-semibold text-purple-900">{subject.studentsCount}</p>
                    </div>
                  )}
                </div>
                {subject.stats && (
                  <div className="mt-4 pt-4 border-t border-purple-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-purple-600">Registered</p>
                        <p className="text-lg font-semibold text-green-600">{subject.stats.registeredStudents || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-600">Pending</p>
                        <p className="text-lg font-semibold text-yellow-600">{subject.stats.pendingRegistration || 0}</p>
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
                <h3 className="text-sm font-medium text-purple-700 mb-3">Status</h3>
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
                    <span className="text-sm text-gray-600">
                      Created by: {subject.createdBy.name || 'Unknown'}
                    </span>
                  )}
                </div>
              </div>

              {subject.assignments && subject.assignments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-purple-700 mb-3">
                    Teacher Assignments ({subject.assignments.length})
                  </h3>
                  <div className="space-y-3">
                    {subject.assignments.map((assignment, index) => (
                      <div key={index} className="bg-purple-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <User className="w-4 h-4 text-purple-600 mr-2" />
                            <span className="font-medium text-purple-900">
                              {assignment.teacher?.name || assignment.teacherName}
                            </span>
                          </div>
                          <span className="text-sm text-purple-600">
                            Section {assignment.section}
                          </span>
                        </div>
                        {assignment.studentsCount > 0 && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Users className="w-4 h-4 mr-2 text-purple-400" />
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
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-purple-50 border-t border-purple-100 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubjectDetails;