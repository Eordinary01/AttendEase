const Ticket = require("../models/Ticket");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Subject = require("../models/Subject");
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const logger = require("../utils/logger");
require('dotenv').config();

/**
 * STUDENT CREATES ABSENCE PROOF TICKET
 * Student submits proof of absence (medical cert, permission letter, etc.)
 */
const createAbsenceProofTicket = async (req, res) => {
  const studentId = req.user._id;
  const { subjectId, absentDate, reason, reasonDescription } = req.body;
  const tenantId = req.user.tenantId;

  // Validation
  if (!subjectId || !absentDate || !reason || !reasonDescription) {
    return res.status(400).json({
      success: false,
      message: 'subjectId, absentDate, reason, and reasonDescription are required'
    });
  }

  if (reasonDescription.length < 10 || reasonDescription.length > 500) {
    return res.status(400).json({
      success: false,
      message: 'Reason description must be between 10 and 500 characters'
    });
  }

  const validReasons = ['medical', 'family-emergency', 'institutional-work', 'other'];
  if (!validReasons.includes(reason)) {
    return res.status(400).json({
      success: false,
      message: `Reason must be one of: ${validReasons.join(', ')}`
    });
  }

  try {
    // Verify student with tenant
    const student = await User.findOne({ 
      _id: studentId, 
      tenantId: tenantId,
      role: 'student',
      isActive: true 
    });
    
    if (!student) {
      return res.status(403).json({
        success: false,
        message: 'Invalid student account'
      });
    }

    // Verify subject exists within tenant
    const subject = await Subject.findOne({ 
      _id: subjectId, 
      tenantId: tenantId,
      isActive: true 
    });
    
    if (!subject) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found'
      });
    }

    // Verify date is not in future
    const dateObj = new Date(absentDate);
    if (dateObj > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create proof ticket for future dates'
      });
    }

    // Handle uploaded proof documents
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

    // Create ticket with tenantId
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
      message: 'Absence proof ticket created successfully',
      ticket: {
        id: newTicket._id,
        student: newTicket.student,
        subject: newTicket.subjectInfo,
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
 * Teacher sees tickets for their subject that need verification
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
    });
    
    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view absence proof tickets'
      });
    }

    // Get subjects taught by this teacher
    const teacherSubjects = teacher.assignedSubjects?.map(s => s.subjectId) || [];

    let query = {
      tenantId: tenantId,
      subjectId: { $in: teacherSubjects },
      verificationStatus: { $in: ['pending', 'needs-more-info'] }
    };

    // Filter by specific subject if provided
    if (subjectId) {
      if (!teacherSubjects.includes(subjectId)) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to teach this subject'
        });
      }
      query.subjectId = subjectId;
    }

    // Filter by status if provided
    if (status && ['pending', 'needs-more-info'].includes(status)) {
      query.verificationStatus = status;
    }

    // Fetch tickets
    const tickets = await Ticket.find(query)
      .populate('studentId', 'name rollNo section email')
      .populate('subjectId', 'subjectCode subjectName')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Pending absence proof tickets retrieved',
      count: tickets.length,
      tickets: tickets.map(ticket => ({
        id: ticket._id,
        student: ticket.student,
        subject: ticket.subjectInfo,
        absentDate: ticket.absentDate,
        reason: ticket.reason,
        reasonDescription: ticket.reasonDescription,
        documentsCount: ticket.proofDocuments.length,
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

    // Check if teacher is assigned to this subject
    const isAssigned = teacher.assignedSubjects?.some(
      assigned => assigned.subjectId.toString() === ticket.subjectId.toString()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to teach this subject'
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

    // Check if teacher is assigned to this subject
    const isAssigned = teacher.assignedSubjects?.some(
      assigned => assigned.subjectId.toString() === ticket.subjectId.toString()
    );

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to teach this subject'
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
    });
    
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
      .populate('subjectId', 'subjectCode subjectName')
      .populate('verifiedByTeacherId', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: 'Student absence proof tickets retrieved',
      count: tickets.length,
      tickets: tickets.map(ticket => ({
        id: ticket._id,
        subject: ticket.subjectInfo,
        absentDate: ticket.absentDate,
        reason: ticket.reason,
        status: ticket.status,
        verificationStatus: ticket.verificationStatus,
        verificationRemarks: ticket.verificationRemarks,
        attendanceMarked: ticket.attendanceMarked,
        documents: ticket.proofDocuments.map(doc => ({
          id: doc._id,
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
    });
    
    if (!teacher) {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view statistics'
      });
    }

    // Get teacher's assigned subjects
    const teacherSubjects = teacher.assignedSubjects?.map(s => s.subjectId) || [];

    // Get statistics for teacher's subjects within tenant
    const stats = await Ticket.aggregate([
      { 
        $match: { 
          tenantId: new mongoose.Types.ObjectId(tenantId),
          subjectId: { $in: teacherSubjects },
          verifiedByTeacherId: new mongoose.Types.ObjectId(teacherId)
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
    if (user.role === 'student' && ticket.studentId.toString() === userId) {
      hasPermission = true;
    }
    
    // Teacher can access if assigned to subject
    if (user.role === 'teacher') {
      const isAssigned = user.assignedSubjects?.some(
        assigned => assigned.subjectId.toString() === ticket.subjectId.toString()
      );
      if (isAssigned) {
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

  try {
    // Find ticket within tenant
    const ticket = await Ticket.findOne({ 
      _id: ticketId, 
      tenantId: tenantId 
    })
      .populate('subjectId', 'subjectCode subjectName')
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
    if (user.role === 'student' && ticket.studentId._id.toString() === userId) {
      hasPermission = true;
    }
    
    // Teacher can view tickets for subjects they teach
    if (user.role === 'teacher') {
      const isAssigned = user.assignedSubjects?.some(
        assigned => assigned.subjectId.toString() === ticket.subjectId._id.toString()
      );
      if (isAssigned) {
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
        student: {
          name: ticket.studentId.name,
          rollNo: ticket.studentId.rollNo,
          section: ticket.studentId.section,
          email: ticket.studentId.email
        },
        subject: {
          subjectCode: ticket.subjectId.subjectCode,
          subjectName: ticket.subjectId.subjectName
        },
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