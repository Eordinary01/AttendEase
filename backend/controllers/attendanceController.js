const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");
const User = require("../models/User");

const updateAttendance = async (req, res) => {
  console.log('Entire req.body:', JSON.stringify(req.body, null, 2));
  
  const { date, subject: subjectCode, data } = req.body;
  const teacherId = req.user._id.toString();

  console.log('teacherId from token:', teacherId);
  console.log('subjectCode:', subjectCode);
  console.log('date:', date);

  if (!data || Object.keys(data).length === 0) {
    console.log('No data provided in the request body');
    return res.status(400).send({ message: "No data provided in the request body" });
  }

  try {
    const subjectDoc = await Subject.findOne({ code: subjectCode });
    if (!subjectDoc) {
      console.log('Subject not found');
      return res.status(404).send({ message: "Subject not found" });
    }

    // Process attendance for all students
    const updatePromises = Object.entries(data).map(async ([studentId, subjects]) => {
      if (!subjects[subjectCode] && subjects[subjectCode] !== false) {
        console.log(`No data found for student ${studentId} in subject ${subjectCode}`);
        return;
      }

      const attended = subjects[subjectCode];
      console.log(`Processing attendance for student ${studentId}: ${attended}`);

      // Find or create attendance record
      let attendanceRecord = await Attendance.findOne({
        studentId: studentId,
        "subject.code": subjectCode,
        date: date,
      });

      if (attendanceRecord) {
        // Update existing record
        attendanceRecord.attendedClasses += attended ? 1 : 0;
        attendanceRecord.totalClasses += 1;
        attendanceRecord.individualPercentage =
          (attendanceRecord.attendedClasses / attendanceRecord.totalClasses) * 100;
        attendanceRecord.status = attended ? "present" : "absent";
        await attendanceRecord.save();
        console.log(`Updated existing attendance record for student ${studentId}`);
      } else {
        // Create new record
        attendanceRecord = await Attendance.create({
          studentId: studentId,
          subject: { name: subjectDoc.name, code: subjectDoc.code },
          date: date,
          attendedClasses: attended ? 1 : 0,
          totalClasses: 1,
          individualPercentage: attended ? 100 : 0,
          status: attended ? "present" : "absent",
        });
        console.log(`Created new attendance record for student ${studentId}`);
      }

      // Update user's overall attendance
      const user = await User.findById(studentId);
      if (attended) {
        user.attendance.totalAttended += 1;
      } else {
        user.attendance.absentClasses += 1;
      }
      user.attendance.totalClasses += 1;
      user.attendance.overallPercentage =
        (user.attendance.totalAttended / user.attendance.totalClasses) * 100;
      await user.save();
      console.log(`Updated overall attendance for student ${studentId}`);
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    res.status(200).send({ 
      message: "Attendance updated successfully for all students" 
    });
  } catch (error) {
    console.error("Error in updateAttendance:", error);
    res.status(500).send({ 
      message: "Error updating attendance", 
      error: error.toString() 
    });
  }
};

const getAttendanceRecords = async (req, res) => {
  const userId = req.user._id; // Get the userId from the request
  try {
    // Fetch attendance records for the current user only
    const attendanceRecords = await Attendance.find({ studentId: userId }).populate(
      "studentId",
      "name section rollNo"
    );
    res.status(200).send(attendanceRecords);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    res
      .status(500)
      .send({ message: "Error fetching attendance", error: error.toString() });
  }
};

const getAttendanceOverview = async (req, res) => {
  try {
    const attendanceOverview = await Attendance.aggregate([
      {
        $group: {
          _id: "$studentId",
          totalClasses: { $sum: 1 },
          classesAttended: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          attendanceDetails: {
            $push: {
              subject: "$subject",
              date: "$date",
              attendedClasses: "$attendedClasses",
              totalClasses: "$totalClasses",
              individualPercentage: "$individualPercentage",
              status: "$status"
            }
          }
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      {
        $unwind: "$studentInfo",
      },
      {
        $project: {
          _id: 1,
          name: "$studentInfo.name",
          rollNo: "$studentInfo.rollNo",
          section: "$studentInfo.section",
          totalClasses: 1,
          classesAttended: 1,
          attendancePercentage: {
            $multiply: [{ $divide: ["$classesAttended", "$totalClasses"] }, 100],
          },
          attendanceDetails: 1,
          overallPercentage: { $avg: "$attendanceDetails.individualPercentage" }
        },
      },
    ]);

    res.json(attendanceOverview);
  } catch (error) {
    console.error("Error fetching attendance overview:", error);
    res.status(500).json({ message: "Error fetching attendance overview" });
  }
};

const getDetailedAttendance = async (req, res) => {
  const studentId = req.user._id;
  const { subjectCode } = req.query;

  if (!subjectCode) {
    return res.status(400).json({ message: 'Subject code is required' });
  }

  try {
    const attendanceRecords = await Attendance.find({
      studentId: studentId,
      'subject.code': subjectCode,
    }).select('date status -_id').sort({ date: -1 });

    res.status(200).json(attendanceRecords);
  } catch (error) {
    console.error('Error fetching detailed attendance:', error);
    res.status(500).json({ message: 'Error fetching detailed attendance', error: error.toString() });
  }
};

module.exports = {
  updateAttendance,
  getAttendanceRecords,
  getAttendanceOverview,
  getDetailedAttendance

};
