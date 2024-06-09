const Attendance = require("../models/Attendance");

const updateAttendance = async (req, res) => {
  const { date, data } = req.body;

  try {
    await Promise.all(
      Object.entries(data).map(async ([studentId, subjects]) => {
        await Promise.all(
          Object.entries(subjects).map(async ([subject, attended]) => {
            await Attendance.updateOne(
              { studentId, date, subject },
              { attended },
              { upsert: true }
            );
          })
        );
      })
    );
    res.status(200).send({ message: "Attendance updated successfully" });
  } catch (error) {
    res.status(500).send({ message: "Error updating attendance", error });
  }
};

const getAttendanceRecords = async (req, res) => {
  try {
    const attendanceRecords = await Attendance.find().populate("studentId", "name section rollNo");
    res.status(200).send(attendanceRecords);
  } catch (error) {
    res.status(500).send({ message: "Error fetching attendance", error });
  }
};

module.exports = {
  updateAttendance,
  getAttendanceRecords,
};
