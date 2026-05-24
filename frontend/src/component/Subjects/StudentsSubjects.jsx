// src/components/Subject/StudentSubjects.jsx
import React from 'react';
import SubjectList from './SubjectsList';

const StudentsSubjects = ({ userId, userName, userEmail }) => {
  return (
    <SubjectList 
      role="student"
      userId={userId}
      userName={userName}
      userEmail={userEmail}
    />
  );
};

export default StudentsSubjects;