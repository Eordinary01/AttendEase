const Ticket = require("../models/Ticket");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Timetable = require("../models/Timetable");
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require("../utils/logger");
require('dotenv').config();

/**
 * Helper to get normalized branch variants for academic matching
 */
const getBranchVariants = (branch) => {
  if (!branch) return [];
  const b = branch.trim().toLowerCase();
  const variants = new Set([branch.trim(), branch.trim().toUpperCase(), branch.trim().toLowerCase()]);
  
  if (b.includes('computer') || b === 'cse' || b === 'cs') {
    ['CSE', 'CS', 'Computer Science', 'Computer Science & Engineering', 'Computer Science and Engineering'].forEach(v => variants.add(v));
  } else if (b.includes('information') || b === 'it') {
    ['IT', 'Information Technology'].forEach(v => variants.add(v));
  } else if (b.includes('electronic') || b === 'ece') {
    ['ECE', 'Electronics & Communication', 'Electronics and Communication'].forEach(v => variants.add(v));
  } else if (b.includes('mechanical') || b === 'me') {
    ['ME', 'Mechanical', 'Mechanical Engineering'].forEach(v => variants.add(v));
  } else if (b.includes('civil') || b === 'ce') {
    ['CE', 'Civil', 'Civil Engineering'].forEach(v => variants.add(v));
  } else if (b.includes('electrical') || b === 'ee') {
    ['EE', 'Electrical', 'Electrical Engineering'].forEach(v => variants.add(v));
  } else if (b.includes('ai') || b.includes('artificial') || b === 'aiml') {
    ['AIML', 'AI', 'Artificial Intelligence & Machine Learning'].forEach(v => variants.add(v));
  } else if (b.includes('data') || b === 'ds') {
    ['DS', 'Data Science'].forEach(v => variants.add(v));
  } else if (b.includes('cyber') || b === 'cy') {
    ['CY', 'Cybersecurity', 'Cyber Security'].forEach(v => variants.add(v));
  } else if (b.includes('robot') || b === 'ra') {
    ['RA', 'Robotics & Automation', 'Robotics'].forEach(v => variants.add(v));
  } else if (b.includes('chem')) {
    ['CHEM', 'Chemistry', 'Chemical'].forEach(v => variants.add(v));
  } else if (b.includes('arch')) {
    ['ARCH', 'Architecture'].forEach(v => variants.add(v));
  } else if (b.includes('market') || b === 'mkt') {
    ['MKT', 'Marketing'].forEach(v => variants.add(v));
  } else if (b.includes('fin')) {
    ['FIN', 'Finance'].forEach(v => variants.add(v));
  } else if (b.includes('hr') || b.includes('human')) {
    ['HR', 'Human Resources'].forEach(v => variants.add(v));
  } else if (b.includes('gm') || b.includes('general')) {
    ['GM', 'General Management'].forEach(v => variants.add(v));
  }
  return Array.from(variants);
};

/**
 * GET STUDENT SUBJECTS AND ASSIGNED TEACHERS
 * Scopes subjects strictly to the student's Course, Branch, and Semester.
 * Automatically resolves the teacher assigned with that subject for the student's section.
 */
const getStudentSubjectsAndTeachers = async (req, res) => {
  const studentId = req.user._id;
  const tenantId = req.user.tenantId;

  try {
    const student = await User.findOne({
      _id: studentId,
      tenantId: tenantId,
      role: 'student',
      isActive: true,
    })
      .select('_id name email rollNo section tenantId courseId courseName branch semester assignedSubjects subjectAttendance')
      .lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found',
      });
    }

    const studentSection = (student.section || '').trim().toUpperCase();
    const branchVariants = getBranchVariants(student.branch);
    const semValues = student.semester
      ? [student.semester.toString(), Number(student.semester), `Semester ${student.semester}`, `Sem ${student.semester}`]
      : [];

    // 1. Build Academic Query: Filter by Course, Branch, Semester within Tenant
    const subjectQuery = {
      tenantId: tenantId,
      isActive: true,
      isDeleted: { $ne: true },
    };

    if (semValues.length > 0) {
      subjectQuery.semester = { $in: semValues };
    }

    if (student.courseId) {
      subjectQuery.courseId = student.courseId;
    }

    if (branchVariants.length > 0) {
      subjectQuery.$or = [
        { branch: { $in: branchVariants } },
        { branch: '' },
        { branch: null },
        { branch: { $exists: false } },
      ];
    }

    // Fetch matching academic subjects
    let subjects = await Subject.find(subjectQuery)
      .select('_id subjectCode subjectName semester branch courseId credits')
      .lean();

    // Fallback: If no subjects found via academic filter, fallback to timetable or assigned subjects
    if (subjects.length === 0) {
      const timetableSubjectIds = await Timetable.find({
        tenantId: tenantId,
        section: studentSection,
        isActive: true,
        isDeleted: { $ne: true },
        subjectId: { $ne: null },
      }).distinct('subjectId');

      if (timetableSubjectIds.length > 0) {
        subjects = await Subject.find({
          _id: { $in: timetableSubjectIds },
          tenantId: tenantId,
          isActive: true,
          isDeleted: { $ne: true },
        })
          .select('_id subjectCode subjectName semester branch courseId credits')
          .lean();
      }
    }

    // 2. Fetch section timetable slots to map teachers
    const timetableSlots = await Timetable.find({
      tenantId: tenantId,
      section: studentSection,
      isActive: true,
      isDeleted: { $ne: true },
      subjectId: { $ne: null },
      teacherId: { $ne: null },
    })
      .populate('teacherId', 'name email avatar')
      .lean();

    const timetableTeacherMap = new Map();
    for (const slot of timetableSlots) {
      if (slot.subjectId && slot.teacherId) {
        const sId = slot.subjectId.toString();
        timetableTeacherMap.set(sId, {
          id: slot.teacherId._id?.toString() || slot.teacherId.toString(),
          _id: slot.teacherId._id?.toString() || slot.teacherId.toString(),
          name: slot.teacherId.name || slot.teacherName,
          email: slot.teacherId.email || '',
        });
      }
    }

    // 3. Fetch teachers assigned via User.assignedSubjects
    const teachersAssigned = await User.find({
      tenantId: tenantId,
      role: 'teacher',
      isActive: true,
      $or: [
        { 'assignedSubjects.section': studentSection },
        { 'assignedSubjects.section': 'all' },
        { 'assignedSubjects.section': '' },
        { 'assignedSubjects.section': { $exists: false } },
      ],
    })
      .select('_id name email assignedSubjects')
      .lean();

    const userTeacherMap = new Map();
    for (const t of teachersAssigned) {
      for (const as of t.assignedSubjects || []) {
        if (as.subjectId) {
          const asSec = (as.section || '').trim().toUpperCase();
          if (!asSec || asSec === 'ALL' || asSec === studentSection) {
            userTeacherMap.set(as.subjectId.toString(), {
              id: t._id.toString(),
              _id: t._id.toString(),
              name: t.name,
              email: t.email,
            });
          }
        }
      }
    }

    // 4. Map each subject with its designated assigned teacher (User assignments take primary priority)
    const mappedSubjects = subjects.map((sub) => {
      const sId = sub._id.toString();
      const assignedTeacher = userTeacherMap.get(sId) || timetableTeacherMap.get(sId) || null;

      return {
        id: sId,
        _id: sId,
        subjectCode: sub.subjectCode || '',
        subjectName: sub.subjectName || '',
        semester: sub.semester || '',
        branch: sub.branch || '',
        assignedTeacher: assignedTeacher,
        teachers: assignedTeacher ? [assignedTeacher] : [],
      };
    });

    // Sort alphabetically by subject code / name
    mappedSubjects.sort((a, b) =>
      (a.subjectCode || a.subjectName).localeCompare(b.subjectCode || b.subjectName)
    );

    return res.status(200).json({
      success: true,
      studentInfo: {
        name: student.name,
        rollNo: student.rollNo,
        section: studentSection,
        branch: student.branch,
        semester: student.semester,
        courseName: student.courseName,
      },
      count: mappedSubjects.length,
      subjects: mappedSubjects,
    });
  } catch (error) {
    logger.error('Error fetching student subjects and teachers', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error fetching subjects and teachers',
      error: error.message,
    });
  }
};

/**
 * STUDENT CREATES ABSENCE PROOF TICKET
 * Student submits proof of absence routed to the specific teacher who teaches that subject
 */
const createAbsenceProofTicket = async (req, res) => {
  const studentId = req.user._id;
  const { subjectId, teacherId, absentDate, reason, reasonDescription } = req.body;
  const tenantId = req.user.tenantId;

  // Validation
  if (!subjectId || !teacherId || !absentDate || !reason || !reasonDescription) {
    return res.status(400).json({
      success: false,
      message: 'subjectId, teacherId, absentDate, reason, and reasonDescription are required'
    });
  }

  if (reasonDescription.length < 10 || reasonDescription.length > 500) {
    return res.status(400).json({
      success: false,
      message: 'Reason description must be between 10 and 500 characters'
    });
  }

  const validReasons = ['medical', 'family-emergency', 'family', 'institutional-work', 'academic', 'personal', 'other'];
  if (!validReasons.includes(reason)) {
    return res.status(400).json({
      success: false,
      message: `Reason must be one of: ${validReasons.join(', ')}`
    });
  }

  try {
    // 1. Verify student with tenant
    const student = await User.findOne({ 
      _id: studentId, 
      tenantId: tenantId,
      role: 'student',
      isActive: true 
    }).lean();
    
    if (!student) {
      return res.status(403).json({
        success: false,
        message: 'Invalid student account'
      });
    }

    // 2. Verify subject exists within tenant
    const subject = await Subject.findOne({ 
      _id: subjectId, 
      tenantId: tenantId,
      isActive: true 
    }).lean();
    
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // 3. Verify teacher exists and is active within tenant
    const teacher = await User.findOne({
      _id: teacherId,
      tenantId: tenantId,
      role: 'teacher',
      isActive: true,
    }).lean();

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Selected teacher not found or inactive'
      });
    }

    // 4. Verify teacher teaches this subject to the student's section
    const studentSection = (student.section || '').trim().toUpperCase();
    const isAssignedViaUser = teacher.assignedSubjects?.some(as => {
      const sec = (as.section || '').trim().toUpperCase();
      return as.subjectId?.toString() === subjectId.toString() && (!sec || sec === 'ALL' || sec === studentSection);
    });

    let isAssignedViaTimetable = false;
    if (!isAssignedViaUser) {
      isAssignedViaTimetable = await Timetable.exists({
        tenantId: tenantId,
        section: studentSection,
        subjectId: subjectId,
        teacherId: teacherId,
        isActive: true,
        isDeleted: { $ne: true }
      });
    }

    if (!isAssignedViaUser && !isAssignedViaTimetable) {
      return res.status(400).json({
        success: false,
        message: `Selected teacher (${teacher.name}) is not assigned to teach ${subject.subjectName} to Section ${studentSection}.`
      });
    }

    // 5. Verify date is not in future
    const dateObj = new Date(absentDate);
    if (dateObj > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create proof ticket for future dates'
      });
    }

    // 6. Handle uploaded proof documents
    const proofDocuments = [];
    if (req.files && req.files.length > 0) {
      if (req.files.length > 5) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 5 documents allowed'
        });
      }

      req.files.forEach(file => {
        const fileId = new mongoose.Types.ObjectId();
        proofDocuments.push({
          _id: fileId,
          filename: file.filename,
          originalName: file.originalname,
          fileType: req.body.fileType || 'other',
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedAt: Date.now()
        });
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'At least one proof document is required'
      });
    }

    // 7. Create ticket with tenantId, subjectId, and assignedTeacherId
    const newTicket = new Ticket({
      tenantId: tenantId,
      studentId: studentId,
      student: {
        name: student.name,
        rollNo: student.rollNo,
        section: student.section,
        email: student.email
      },
      subjectId: subjectId,
      subjectInfo: {
        subjectCode: subject.subjectCode,
        subjectName: subject.subjectName
      },
      assignedTeacherId: teacherId,
      assignedTeacher: {
        name: teacher.name,
        email: teacher.email
      },
      absentDate: dateObj,
      reason: reason,
      reasonDescription: reasonDescription.trim(),
      proofDocuments: proofDocuments,
      status: 'open',
      verificationStatus: 'pending'
    });

    await newTicket.save();

    return res.status(201).json({
      success: true,
      message: `Absence proof ticket created successfully and assigned to ${teacher.name}`,
      ticket: {
        id: newTicket._id,
        student: newTicket.student,
        subject: newTicket.subjectInfo,
        assignedTeacher: newTicket.assignedTeacher,
        absentDate: newTicket.absentDate,
        reason: newTicket.reason,
        status: newTicket.status,
        verificationStatus: newTicket.verificationStatus,
        documentsCount: newTicket.proofDocuments.length,
        createdAt: newTicket.createdAt
      }
    });

  } catch (error) {
    logger.error('Error creating absence proof ticket', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error creating ticket',
      error: error.message
    });
  }
};

/**
 * TEACHER VIEWS PENDING ABSENCE PROOF TICKETS
 * Teacher sees tickets assigned directly to them (or for their subject) that need verification
 */
const getPendingAbsenceTickets = async (req, res) => {
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;
  const { status, subjectId } = req.query;

  try {
    // Verify user is teacher
    const teacher = await User.findOne({ 
      _id: teacherId, 
      tenantId: tenantId,
      role: 'teacher',
      isActive: true 
    }).lean();
    
    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view absence proof tickets'
      });
    }

    // Get subjects taught by this teacher for fallback
    const teacherSubjects = teacher.assignedSubjects?.map(s => s.subjectId) || [];

    let query = {
      tenantId: tenantId,
      verificationStatus: { $in: ['pending', 'needs-more-info'] },
      $or: [
        { assignedTeacherId: teacherId },
        { assignedTeacherId: { $exists: false }, subjectId: { $in: teacherSubjects } },
        { assignedTeacherId: null, subjectId: { $in: teacherSubjects } }
      ]
    };

    // Filter by specific subject if provided
    if (subjectId) {
      query.subjectId = subjectId;
    }

    // Filter by status if provided
    if (status && ['pending', 'needs-more-info'].includes(status)) {
      query.verificationStatus = status;
    }

    // Fetch tickets with optimized lean projection
    const tickets = await Ticket.find(query)
      .select('student subjectInfo assignedTeacher absentDate reason reasonDescription proofDocuments status verificationStatus createdAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Pending absence proof tickets retrieved',
      count: tickets.length,
      tickets: tickets.map(ticket => ({
        id: ticket._id,
        _id: ticket._id,
        student: ticket.student,
        subject: ticket.subjectInfo,
        assignedTeacher: ticket.assignedTeacher,
        absentDate: ticket.absentDate,
        reason: ticket.reason,
        reasonDescription: ticket.reasonDescription,
        documentsCount: ticket.proofDocuments?.length || 0,
        documents: (ticket.proofDocuments || []).map(doc => ({
          id: doc._id,
          _id: doc._id,
          filename: doc.filename,
          originalName: doc.originalName,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          uploadedAt: doc.uploadedAt
        })),
        proofDocuments: ticket.proofDocuments,
        status: ticket.status,
        verificationStatus: ticket.verificationStatus,
        createdAt: ticket.createdAt
      }))
    });

  } catch (error) {
    logger.error('Error fetching tickets', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error fetching tickets',
      error: error.message
    });
  }
};

/**
 * TEACHER VERIFIES ABSENCE PROOF
 * Teacher verifies the document and approves/rejects the absence
 */
const verifyAbsenceProof = async (req, res) => {
  const { ticketId } = req.params;
  const { verificationStatus, verificationRemarks } = req.body;
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;

  // Validation
  const validStatuses = ['verified', 'rejected', 'needs-more-info'];
  if (!validStatuses.includes(verificationStatus)) {
    return res.status(400).json({
      success: false,
      message: `Verification status must be one of: ${validStatuses.join(', ')}`
    });
  }

  try {
    // Verify user is teacher
    const teacher = await User.findOne({ 
      _id: teacherId, 
      tenantId: tenantId,
      role: 'teacher',
      isActive: true 
    });
    
    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can verify absence proofs'
      });
    }

    // Find ticket within tenant
    const ticket = await Ticket.findOne({ 
      _id: ticketId, 
      tenantId: tenantId 
    });
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if teacher is assigned to this ticket directly or via subject
    const isDirectlyAssigned = ticket.assignedTeacherId && ticket.assignedTeacherId.toString() === teacherId.toString();
    const isSubjectAssigned = teacher.assignedSubjects?.some(
      assigned => assigned.subjectId.toString() === ticket.subjectId.toString()
    );

    if (!isDirectlyAssigned && !isSubjectAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this ticket or subject'
      });
    }

    // Update verification
    ticket.verificationStatus = verificationStatus;
    ticket.verificationRemarks = verificationRemarks || null;
    ticket.verifiedByTeacherId = teacherId;
    ticket.verifiedTeacher = {
      name: teacher.name,
      email: teacher.email
    };
    ticket.verifiedAt = Date.now();

    // Update overall status
    if (verificationStatus === 'verified') {
      ticket.status = 'verified';
    } else if (verificationStatus === 'rejected') {
      ticket.status = 'rejected';
    } else if (verificationStatus === 'needs-more-info') {
      ticket.status = 'under-review';
    }

    await ticket.save();

    return res.status(200).json({
      success: true,
      message: 'Absence proof verified successfully',
      ticket: {
        id: ticket._id,
        student: ticket.student,
        verificationStatus: ticket.verificationStatus,
        status: ticket.status,
        verifiedAt: ticket.verifiedAt
      }
    });

  } catch (error) {
    logger.error('Error verifying proof', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error verifying proof',
      error: error.message
    });
  }
};

/**
 * TEACHER MARKS ATTENDANCE AFTER VERIFICATION
 * After verifying proof, teacher marks student as present for that date
 */
const markAttendanceAfterVerification = async (req, res) => {
  const { ticketId } = req.params;
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;

  try {
    // Verify user is teacher
    const teacher = await User.findOne({ 
      _id: teacherId, 
      tenantId: tenantId,
      role: 'teacher',
      isActive: true 
    });
    
    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can mark attendance'
      });
    }

    // Find ticket within tenant
    const ticket = await Ticket.findOne({ 
      _id: ticketId, 
      tenantId: tenantId 
    });
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Can only mark after verification
    if (ticket.verificationStatus !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Can only mark attendance for verified proofs'
      });
    }

    // Check if teacher is assigned directly or to subject
    const isDirectlyAssigned = ticket.assignedTeacherId && ticket.assignedTeacherId.toString() === teacherId.toString();
    const isSubjectAssigned = teacher.assignedSubjects?.some(
      assigned => assigned.subjectId.toString() === ticket.subjectId.toString()
    );

    if (!isDirectlyAssigned && !isSubjectAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this ticket or subject'
      });
    }

    // Find or create attendance record with tenant
    let attendance = await Attendance.findOne({
      studentId: ticket.studentId,
      subjectId: ticket.subjectId,
      date: ticket.absentDate,
      tenantId: tenantId
    });

    if (attendance) {
      // Update existing record
      attendance.status = 'present';
      attendance.remarks = `Marked present based on absence proof verification (Ticket: ${ticket._id})`;
      attendance.updatedAt = Date.now();
    } else {
      // Create new attendance record
      const subject = await Subject.findOne({ 
        _id: ticket.subjectId, 
        tenantId: tenantId 
      });
      
      attendance = new Attendance({
        tenantId: tenantId,
        studentId: ticket.studentId,
        subjectId: ticket.subjectId,
        subject: {
          subjectCode: subject.subjectCode,
          subjectName: subject.subjectName
        },
        teacherId: teacherId,
        section: ticket.student.section,
        date: ticket.absentDate,
        status: 'present',
        remarks: `Marked present based on absence proof verification (Ticket: ${ticket._id})`,
        semester: subject.semester,
        createdBy: teacherId,
        classSessionId: `${ticket.subjectId}_${ticket.student.section}_${ticket.absentDate.toISOString().split('T')[0]}`
      });
    }

    await attendance.save();

    // Update ticket
    ticket.attendanceMarked = true;
    ticket.attendanceMarkedBy = teacherId;
    ticket.attendanceMarkedAt = Date.now();
    ticket.status = 'attendance-updated';
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: 'Attendance marked successfully based on verified proof',
      ticket: {
        id: ticket._id,
        student: ticket.student,
        subject: ticket.subjectInfo,
        absentDate: ticket.absentDate,
        attendanceMarked: true,
        attendanceMarkedAt: ticket.attendanceMarkedAt,
        status: ticket.status
      }
    });

  } catch (error) {
    logger.error('Error marking attendance', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: error.message
    });
  }
};

/**
 * STUDENT VIEWS THEIR ABSENCE PROOF TICKETS
 * Student can see the status of their submitted proofs
 */
const getStudentAbsenceTickets = async (req, res) => {
  const studentId = req.user._id;
  const tenantId = req.user.tenantId;

  try {
    // Verify user is student
    const student = await User.findOne({ 
      _id: studentId, 
      tenantId: tenantId,
      role: 'student',
      isActive: true 
    }).lean();
    
    if (!student) {
      return res.status(403).json({
        success: false,
        message: 'Only students can view their tickets'
      });
    }

    // Fetch student's tickets within tenant
    const tickets = await Ticket.find({ 
      studentId: studentId, 
      tenantId: tenantId 
    })
      .select('subjectInfo assignedTeacher verifiedTeacher absentDate reason reasonDescription status verificationStatus verificationRemarks attendanceMarked proofDocuments createdAt verifiedAt attendanceMarkedAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Student absence proof tickets retrieved',
      count: tickets.length,
      tickets: tickets.map(ticket => ({
        id: ticket._id,
        _id: ticket._id,
        subject: ticket.subjectInfo,
        assignedTeacher: ticket.assignedTeacher,
        verifiedTeacher: ticket.verifiedTeacher,
        absentDate: ticket.absentDate,
        reason: ticket.reason,
        reasonDescription: ticket.reasonDescription,
        status: ticket.status,
        verificationStatus: ticket.verificationStatus,
        verificationRemarks: ticket.verificationRemarks,
        attendanceMarked: ticket.attendanceMarked,
        documents: (ticket.proofDocuments || []).map(doc => ({
          id: doc._id,
          _id: doc._id,
          originalName: doc.originalName,
          fileType: doc.fileType,
          fileSize: doc.fileSize
        })),
        createdAt: ticket.createdAt,
        verifiedAt: ticket.verifiedAt,
        attendanceMarkedAt: ticket.attendanceMarkedAt
      }))
    });

  } catch (error) {
    logger.error('Error fetching student tickets', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error fetching tickets',
      error: error.message
    });
  }
};

/**
 * TEACHER ADDS INTERNAL NOTES
 * Teacher can add notes about the proof verification
 */
const addVerificationNote = async (req, res) => {
  const { ticketId } = req.params;
  const { content } = req.body;
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Note content cannot be empty'
    });
  }

  try {
    // Verify user is teacher
    const teacher = await User.findOne({ 
      _id: teacherId, 
      tenantId: tenantId,
      role: 'teacher',
      isActive: true 
    });
    
    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can add notes'
      });
    }

    // Find and update ticket within tenant
    const ticket = await Ticket.findOneAndUpdate(
      { _id: ticketId, tenantId: tenantId },
      {
        $push: {
          internalNotes: {
            noteBy: teacherId,
            noteByName: teacher.name,
            content: content.trim(),
            addedAt: Date.now()
          }
        },
        updatedAt: Date.now()
      },
      { new: true }
    );

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Note added successfully',
      note: ticket.internalNotes[ticket.internalNotes.length - 1]
    });

  } catch (error) {
    logger.error('Error adding note', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error adding note',
      error: error.message
    });
  }
};

/**
 * GET TICKET STATISTICS
 * View statistics on absence proof verification
 */
const getVerificationStats = async (req, res) => {
  const teacherId = req.user._id;
  const tenantId = req.user.tenantId;

  try {
    // Verify user is teacher
    const teacher = await User.findOne({ 
      _id: teacherId, 
      tenantId: tenantId,
      role: 'teacher',
      isActive: true 
    }).lean();
    
    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view statistics'
      });
    }

    // Get teacher's assigned subjects for fallback
    const teacherSubjects = teacher.assignedSubjects?.map(s => s.subjectId) || [];

    // Get statistics for teacher's assigned tickets within tenant
    const stats = await Ticket.aggregate([
      { 
        $match: { 
          tenantId: new mongoose.Types.ObjectId(tenantId),
          $or: [
            { assignedTeacherId: new mongoose.Types.ObjectId(teacherId) },
            { verifiedByTeacherId: new mongoose.Types.ObjectId(teacherId) },
            { assignedTeacherId: { $exists: false }, subjectId: { $in: teacherSubjects } },
            { assignedTeacherId: null, subjectId: { $in: teacherSubjects } }
          ]
        } 
      },
      {
        $group: {
          _id: null,
          totalTickets: { $sum: 1 },
          pendingTickets: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'pending'] }, 1, 0] }
          },
          verifiedTickets: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'verified'] }, 1, 0] }
          },
          rejectedTickets: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'rejected'] }, 1, 0] }
          },
          needsMoreInfoTickets: {
            $sum: { $cond: [{ $eq: ['$verificationStatus', 'needs-more-info'] }, 1, 0] }
          },
          attendanceMarkedCount: {
            $sum: { $cond: [{ $eq: ['$attendanceMarked', true] }, 1, 0] }
          }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      message: 'Verification statistics retrieved',
      stats: stats.length > 0 ? stats[0] : {
        totalTickets: 0,
        pendingTickets: 0,
        verifiedTickets: 0,
        rejectedTickets: 0,
        needsMoreInfoTickets: 0,
        attendanceMarkedCount: 0
      }
    });

  } catch (error) {
    logger.error('Error fetching stats', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

/**
 * GET UPLOADED FILE - SECURE FILE ACCESS
 * Access uploaded proof documents with authentication
 */
const getUploadedFile = async (req, res) => {
  const { ticketId, fileId } = req.params;
  const userId = req.user._id;
  const tenantId = req.user.tenantId;

  try {
    // Find ticket within tenant
    const ticket = await Ticket.findOne({ 
      _id: ticketId, 
      tenantId: tenantId 
    });
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Find specific file
    const file = ticket.proofDocuments.id(fileId);
    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    // Verify user permissions
    const user = await User.findOne({ 
      _id: userId, 
      tenantId: tenantId 
    });
    
    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'User not found'
      });
    }

    let hasPermission = false;

    // Student can access their own files
    if (user.role === 'student' && ticket.studentId.toString() === userId.toString()) {
      hasPermission = true;
    }
    
    // Teacher can access if assigned directly or to subject
    if (user.role === 'teacher') {
      const isDirectlyAssigned = (ticket.assignedTeacherId && ticket.assignedTeacherId.toString() === userId.toString()) ||
                                 (ticket.verifiedByTeacherId && ticket.verifiedByTeacherId.toString() === userId.toString());
      const isSubjectAssigned = user.assignedSubjects?.some(
        assigned => assigned.subjectId?.toString() === ticket.subjectId?.toString()
      );
      if (isDirectlyAssigned || isSubjectAssigned) {
        hasPermission = true;
      }
    }

    // Admin can access all
    if (user.role === 'admin' || user.role === 'super_admin') {
      hasPermission = true;
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this file'
      });
    }

    // Check if file exists
    const filePath = path.join(__dirname, '../uploads/', file.filename);
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    
    // Determine content type
    const ext = path.extname(file.originalName).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');

    // Stream file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    logger.error('Error accessing file', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error accessing file',
      error: error.message
    });
  }
};

/**
 * GET TICKET DETAILS
 * Get detailed information about a specific ticket
 */
const getTicketDetails = async (req, res) => {
  const { ticketId } = req.params;
  const userId = req.user._id;
  const tenantId = req.user.tenantId;

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid ticket ID format'
    });
  }

  try {
    // Find ticket within tenant
    const ticket = await Ticket.findOne({ 
      _id: ticketId, 
      tenantId: tenantId 
    })
      .populate('subjectId', 'subjectCode subjectName')
      .populate('assignedTeacherId', 'name email')
      .populate('verifiedByTeacherId', 'name email')
      .populate('studentId', 'name rollNo section email');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Verify user permissions
    const user = await User.findOne({ 
      _id: userId, 
      tenantId: tenantId 
    });
    
    if (!user) {
      return res.status(403).json({
        success: false,
        message: 'User not found'
      });
    }

    let hasPermission = false;

    // Student can view their own tickets
    if (user.role === 'student' && ticket.studentId?._id?.toString() === userId.toString()) {
      hasPermission = true;
    }
    
    // Teacher can view tickets assigned to them or for subjects they teach
    if (user.role === 'teacher') {
      const isDirectlyAssigned = ticket.assignedTeacherId && ticket.assignedTeacherId._id?.toString() === userId.toString();
      const isSubjectAssigned = ticket.subjectId && user.assignedSubjects?.some(
        assigned => assigned.subjectId?.toString() === ticket.subjectId._id?.toString()
      );
      if (isDirectlyAssigned || isSubjectAssigned) {
        hasPermission = true;
      }
    }

    // Admin can view all tickets
    if (user.role === 'admin' || user.role === 'super_admin') {
      hasPermission = true;
    }

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to view this ticket'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ticket details retrieved',
      ticket: {
        id: ticket._id,
        student: ticket.studentId ? {
          name: ticket.studentId.name,
          rollNo: ticket.studentId.rollNo,
          section: ticket.studentId.section,
          email: ticket.studentId.email
        } : (ticket.student || null),
        subject: ticket.subjectId ? {
          subjectCode: ticket.subjectId.subjectCode,
          subjectName: ticket.subjectId.subjectName
        } : (ticket.subjectInfo || null),
        assignedTeacher: ticket.assignedTeacher || (ticket.assignedTeacherId ? {
          name: ticket.assignedTeacherId.name,
          email: ticket.assignedTeacherId.email
        } : null),
        absentDate: ticket.absentDate,
        reason: ticket.reason,
        reasonDescription: ticket.reasonDescription,
        proofDocuments: ticket.proofDocuments,
        status: ticket.status,
        verificationStatus: ticket.verificationStatus,
        verificationRemarks: ticket.verificationRemarks,
        verifiedBy: ticket.verifiedByTeacherId ? {
          name: ticket.verifiedByTeacherId.name,
          email: ticket.verifiedByTeacherId.email
        } : null,
        verifiedAt: ticket.verifiedAt,
        attendanceMarked: ticket.attendanceMarked,
        attendanceMarkedAt: ticket.attendanceMarkedAt,
        internalNotes: ticket.internalNotes,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        tenantId: ticket.tenantId
      }
    });

  } catch (error) {
    logger.error('Error fetching ticket details', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Error fetching ticket details',
      error: error.message
    });
  }
};

module.exports = {
  getStudentSubjectsAndTeachers,
  createAbsenceProofTicket,
  getPendingAbsenceTickets,
  verifyAbsenceProof,
  markAttendanceAfterVerification,
  getStudentAbsenceTickets,
  addVerificationNote,
  getVerificationStats,
  getUploadedFile,
  getTicketDetails
};