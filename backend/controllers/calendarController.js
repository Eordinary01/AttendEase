const Calendar = require('../models/Calendar');

const getCalendar = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const query = tenantId ? { tenantId } : {};
    const { fromDate, toDate } = req.query;
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }
    const events = await Calendar.find(query).sort({ date: -1 }).lean();
    res.status(200).json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching calendar events", error: error.message });
  }
};

const createCalendar = async (req, res) => {
  const { title, date, description } = req.body;
  try {
    const newEvent = await Calendar.create({
      title, date, description,
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating calendar event", error: error.message });
  }
};

module.exports = { getCalendar, createCalendar }