const Attendance = require("../models/Attendance");
const Subject = require("../models/Subject");
const User = require("../models/User");

const updateAttendance = async (req, res) => {
  console.log('Entire req.body:', JSON.stringify(req.body, null, 2));
  
  const { date, subject: subjectCode, data } = req.body;
  const userId = req.user._id; // Get the userId from the request

  console.log('userId from token:', userId);
  console.log('subjectCode:', subjectCode);
  console.log('date:', date);

  // Add checks
  if (!data) {
    console.log('No data provided in the request body');
    return res.status(400).send({ message: "No data provided in the request body" });
  }

  console.log('Data object keys:', Object.keys(data));

  // Find the correct user ID in the data object
  const userIdInData = Object.keys(data).find(key => key === userId || key.toString() === userId.toString());

  console.log('userIdInData:', userIdInData);

  if (!userIdInData) {
    console.log('No data found for the current user');
    return res.status(400).send({ message: "No data found for the current user" });
  }

  if (!data[userIdInData][subjectCode]) {
    console.log('No data found for the specified subject');
    return res.status(400).send({ message: "No data found for the specified subject" });
  }

  try {
    const subjectDoc = await Subject.findOne({ code: subjectCode });
    if (!subjectDoc) {
      console.log('Subject not found');
      return res.status(404).send({ message: "Subject not found" });
    }

    // Update attendance for the current user only
    const attended = data[userIdInData][subjectCode];
    console.log('Attendance value:', attended);

    let attendanceRecord = await Attendance.findOne({
      studentId: userId,
      "subject.code": subjectCode,
      date: date,
    });

    console.log('Existing attendance record:', attendanceRecord);

    if (attendanceRecord) {
      attendanceRecord.attendedClasses += attended ? 1 : 0;
      attendanceRecord.totalClasses += 1;
      attendanceRecord.individualPercentage =
        (attendanceRecord.attendedClasses / attendanceRecord.totalClasses) *
        100;
      attendanceRecord.status = attended ? "present" : "absent";
      await attendanceRecord.save();
      console.log('Updated existing attendance record');
    } else {
      attendanceRecord = await Attendance.create({
        studentId: userId,
        subject: { name: subjectDoc.name, code: subjectDoc.code },
        date: date,
        attendedClasses: attended ? 1 : 0,
        totalClasses: 1,
        individualPercentage: attended ? 100 : 0,
        status: attended ? "present" : "absent",
      });
      console.log('Created new attendance record');
    }

    // Update user's attendance
    const user = await User.findById(userId);
    user.attendance.totalAttended += attended ? 1 : 0;
    user.attendance.totalClasses += 1;
    if (!attended) {
      user.attendance.absentClasses += 1;
    }
    const overallPercentage =
      (user.attendance.totalAttended / user.attendance.totalClasses) * 100;
    user.attendance.overallPercentage = overallPercentage;
    await user.save();
    console.log('Updated user attendance');

    res.status(200).send({ message: "Attendance updated successfully" });
  } catch (error) {
    console.error("Error in updateAttendance:", error);
    res
      .status(500)
      .send({ message: "Error updating attendance", error: error.toString() });
  }
};

const getAttendanceRecords = async (req, res) => {
  const userId = req.user._id; // Get the userId from the request
  console.log('Fetching attendance records for userId:', userId);
  try {
    // Fetch attendance records for the current user only
    const attendanceRecords = await Attendance.find({ studentId: userId }).populate(
      "studentId",
      "name section rollNo"
    );
    console.log('Fetched attendance records:', attendanceRecords.length);
    res.status(200).send(attendanceRecords);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    res
      .status(500)
      .send({ message: "Error fetching attendance", error: error.toString() });
  }
};
module.exports = {
  updateAttendance,
  getAttendanceRecords,
};
