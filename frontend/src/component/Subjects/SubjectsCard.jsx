// src/components/Subject/SubjectCard.jsx
import React, { useState } from 'react';
import { BookOpen, Users, Calendar, ChevronRight, Award, Clock, User } from 'lucide-react';
import SubjectDetails from './SubjectsDetails';

const SubjectCard = ({ subject, role, viewMode }) => {
  const [showDetails, setShowDetails] = useState(false);

  // Handle different data structures based on role
  const getSubjectData = () => {
    if (role === 'student') {
      return {
        id: subject.subject?.id || subject._id,
        code: subject.subject?.subjectCode || subject.subjectCode,
        name: subject.subject?.subjectName || subject.subjectName,
        semester: subject.subject?.semester || subject.semester,
        credits: subject.subject?.credits || subject.credits,
        description: subject.subject?.description || subject.description,
        teacher: subject.teacher,
        section: subject.section
      };
    } else if (role === 'teacher') {
      return {
        id: subject.subject?.id || subject._id,
        code: subject.subject?.subjectCode || subject.subjectCode,
        name: subject.subject?.subjectName || subject.subjectName,
        semester: subject.subject?.semester || subject.semester,
        credits: subject.subject?.credits || subject.credits,
        description: subject.subject?.description || subject.description,
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

  if (viewMode === 'list') {
    return (
      <>
        <div 
          onClick={() => setShowDetails(true)}
          className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer border border-purple-100 hover:border-purple-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="p-3 bg-purple-100 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h3 className="font-semibold text-purple-900">{data.name}</h3>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                    {data.code}
                  </span>
                </div>
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Semester {data.semester}
                  </span>
                  {data.credits > 0 && (
                    <span className="flex items-center">
                      <Award className="w-4 h-4 mr-1" />
                      {data.credits} Credits
                    </span>
                  )}
                  {role === 'teacher' && data.section && (
                    <span className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      Section {data.section}
                      {data.studentsCount && ` (${data.studentsCount} students)`}
                    </span>
                  )}
                  {role === 'student' && data.teacher && (
                    <span className="flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      {data.teacher.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
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
        className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer border border-purple-100 hover:border-purple-300 group"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
              <BookOpen className="w-8 h-8 text-purple-600" />
            </div>
            {role === 'admin' && (
              <span className={`px-2 py-1 text-xs rounded-full ${
                data.isActive 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {data.isActive ? 'Active' : 'Inactive'}
              </span>
            )}
          </div>

          <h3 className="font-semibold text-lg text-purple-900 mb-1">{data.name}</h3>
          <p className="text-sm text-purple-600 mb-3">{data.code}</p>
          
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-2 text-purple-400" />
              Semester {data.semester}
            </div>
            
            {data.credits > 0 && (
              <div className="flex items-center">
                <Award className="w-4 h-4 mr-2 text-purple-400" />
                {data.credits} Credits
              </div>
            )}

            {role === 'teacher' && data.section && (
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-purple-400" />
                Section {data.section}
                {data.studentsCount && ` (${data.studentsCount} students)`}
              </div>
            )}

            {role === 'student' && data.teacher && (
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2 text-purple-400" />
                {data.teacher.name}
              </div>
            )}

            {role === 'admin' && data.totalAssignments > 0 && (
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2 text-purple-400" />
                {data.totalAssignments} Teacher{data.totalAssignments > 1 ? 's' : ''} Assigned
              </div>
            )}
          </div>

          {data.description && (
            <p className="mt-4 text-sm text-gray-500 line-clamp-2">
              {data.description}
            </p>
          )}
        </div>

        <div className="px-6 py-3 bg-purple-50 border-t border-purple-100 flex justify-between items-center">
          <span className="text-xs text-purple-600">
            {role === 'teacher' && 'Click to view details'}
            {role === 'student' && 'View subject details'}
            {role === 'admin' && 'Manage subject'}
          </span>
          <ChevronRight className="w-4 h-4 text-purple-400" />
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