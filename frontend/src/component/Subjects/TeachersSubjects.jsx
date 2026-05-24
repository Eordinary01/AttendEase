// src/components/Subject/TeacherSubjects.jsx
import React from 'react';
import SubjectList from './SubjectsList';

const TeachersSubjects = ({ userId, userName, userEmail }) => {
  return (
    <SubjectList 
      role="teacher"
      userId={userId}
      userName={userName}
      userEmail={userEmail}
    />
  );
};

export default TeachersSubjects;