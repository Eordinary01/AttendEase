const mongoose = require("mongoose");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    section: {
      type: String,
      required: function() {
        // Section required for students, optional for teachers, not for admin
        return this.role === 'student';
      },
      trim: true
    },
    role: {
      type: String,
      enum: ["student", "teacher", "admin"],
      default: "student"
    },
    rollNo: {
      type: String,
      required: function() {
        // rollNo required for student and teacher, optional for admin
        return this.role !== 'admin';
      },
      trim: true,
      unique: true,
      sparse: true // Allows multiple nulls for admins
    },
    // For teachers - list of assigned subjects and sections
    assignedSubjects: [
      {
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Subject'
        },
        subjectName: String,
        section: String,
        assignedDate: {
          type: Date,
          default: Date.now
        }
      }
    ],
    // 📊 NEW: Subject-wise attendance summary for students
    subjectAttendance: [
      {
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Subject',
          required: true
        },
        subjectName: String,
        subjectCode: String,
        totalClasses: { type: Number, default: 0 },
        presentCount: { type: Number, default: 0 },
        absentCount: { type: Number, default: 0 },
        leaveCount: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        lastAttended: { type: Date, default: null }
      }
    ],
    
    // 📊 NEW: Overall attendance summary
    attendance: {
      totalClasses: { type: Number, default: 0 },
      presentCount: { type: Number, default: 0 },
      absentCount: { type: Number, default: 0 },
      leaveCount: { type: Number, default: 0 },
      overallPercentage: { type: Number, default: 0 }
    },
    
    // Teacher account management
    createdByAdmin: {
      type: Boolean,
      default: false
    },
    isFirstLogin: {
      type: Boolean,
      default: true
    },
    tempPasswordSent: {
      type: Boolean,
      default: false
    },
    tempPasswordSentAt: {
      type: Date,
      default: null
    },
    
    // Account status
    isActive: {
      type: Boolean,
      default: true
    },
    
    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Indexes for faster queries
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ section: 1 });
userSchema.index({ rollNo: 1 });
userSchema.index({ 'subjectAttendance.subjectId': 1 });

// 📊 METHOD: Update student attendance summary
userSchema.methods.updateAttendanceSummary = async function() {
  const Attendance = mongoose.model('Attendance');
  
  // Get all attendance records for this student
  const attendanceRecords = await Attendance.find({ studentId: this._id });
  
  if (attendanceRecords.length === 0) return;
  
  // Calculate overall stats
  const overall = attendanceRecords.reduce((acc, record) => {
    acc.totalClasses++;
    acc[record.status + 'Count']++;
    return acc;
  }, { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0 });
  
  // Calculate subject-wise stats
  const subjectMap = new Map();
  
  attendanceRecords.forEach(record => {
    const subjectId = record.subjectId.toString();
    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, {
        subjectId: record.subjectId,
        subjectName: record.subject.subjectName,
        subjectCode: record.subject.subjectCode,
        totalClasses: 0,
        presentCount: 0,
        absentCount: 0,
        leaveCount: 0,
        lastAttended: record.date
      });
    }
    
    const subject = subjectMap.get(subjectId);
    subject.totalClasses++;
    subject[record.status + 'Count']++;
    
    if (record.date > subject.lastAttended) {
      subject.lastAttended = record.date;
    }
  });
  
  // Calculate percentages
  const subjectAttendance = Array.from(subjectMap.values()).map(subject => ({
    ...subject,
    percentage: subject.totalClasses > 0 
      ? (subject.presentCount / subject.totalClasses) * 100 
      : 0
  }));
  
  // Update user document
  this.attendance = {
    totalClasses: overall.totalClasses,
    presentCount: overall.presentCount || 0,
    absentCount: overall.absentCount || 0,
    leaveCount: overall.leaveCount || 0,
    overallPercentage: overall.totalClasses > 0 
      ? ((overall.presentCount || 0) / overall.totalClasses) * 100 
      : 0
  };
  
  this.subjectAttendance = subjectAttendance;
  await this.save();
};

// 📊 STATIC METHOD: Bulk update student attendance summaries
userSchema.statics.bulkUpdateAttendance = async function(studentIds) {
  const Attendance = mongoose.model('Attendance');
  const User = this;
  
  for (const studentId of studentIds) {
    const user = await User.findById(studentId);
    if (user && user.role === 'student') {
      await user.updateAttendanceSummary();
    }
  }
};

// 📊 METHOD: Get teacher's class statistics
userSchema.methods.getClassStatistics = async function(subjectId, section) {
  if (this.role !== 'teacher') return null;
  
  const Attendance = mongoose.model('Attendance');
  
  const stats = await Attendance.aggregate([
    {
      $match: {
        subjectId: new mongoose.Types.ObjectId(subjectId),
        section: section,
        teacherId: this._id
      }
    },
    {
      $group: {
        _id: null,
        totalClasses: { $sum: 1 },
        totalStudents: { $addToSet: '$studentId' },
        presentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
        },
        absentCount: {
          $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
        },
        leaveCount: {
          $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        totalClasses: 1,
        totalStudents: { $size: '$totalStudents' },
        presentCount: 1,
        absentCount: 1,
        leaveCount: 1,
        averageAttendance: {
          $multiply: [
            { $divide: ['$presentCount', { $multiply: ['$totalClasses', { $size: '$totalStudents' }] }] },
            100
          ]
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalClasses: 0,
    totalStudents: 0,
    presentCount: 0,
    absentCount: 0,
    leaveCount: 0,
    averageAttendance: 0
  };
};

// Pre-save middleware
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Ensure rollNo is unique for non-admin users
  if (this.role !== 'admin' && this.rollNo) {
    this.rollNo = this.rollNo.trim().toUpperCase();
  }
  
  // Clean up section for students
  if (this.role === 'student' && this.section) {
    this.section = this.section.trim().toUpperCase();
  }
  
  next();
});

// Pre-update middleware
userSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('User', userSchema);