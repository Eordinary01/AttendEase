const Calendar = require('../models/Calendar');

const getCalendar = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const query = tenantId ? { tenantId } : {};
    const { fromDate, toDate, startDate, endDate, type, year } = req.query;
    
    if (type) query.type = type;
    
    if (year) {
      const yr = parseInt(year, 10);
      const startOfYear = new Date(`${yr}-01-01T00:00:00.000Z`);
      const endOfYear = new Date(`${yr}-12-31T23:59:59.999Z`);
      query.date = { $gte: startOfYear, $lte: endOfYear };
    } else {
      const start = fromDate || startDate;
      const end = toDate || endDate;
      if (start || end) {
        query.$or = [
          {
            date: {
              ...(start ? { $gte: new Date(start) } : {}),
              ...(end ? { $lte: new Date(end) } : {})
            }
          },
          {
            startDate: {
              ...(start ? { $gte: new Date(start) } : {}),
              ...(end ? { $lte: new Date(end) } : {})
            }
          }
        ];
      }
    }
    const events = await Calendar.find(query).sort({ date: 1, startDate: 1 }).lean();
    res.status(200).json({ success: true, count: events.length, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching calendar events", error: error.message });
  }
};

const createCalendar = async (req, res) => {
  const { title, date, startDate, endDate, description, type } = req.body;
  try {
    const eventDate = date || startDate || new Date();
    const newEvent = await Calendar.create({
      title,
      date: eventDate,
      startDate: startDate || eventDate,
      endDate: endDate || eventDate,
      description,
      type: type || 'holiday',
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    });
    res.status(201).json({ success: true, message: "Calendar event created successfully", data: newEvent });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating calendar event", error: error.message });
  }
};

const bulkCreateCalendar = async (req, res) => {
  const { events } = req.body;
  try {
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ success: false, message: "Events array is required" });
    }

    const docs = events.map(e => ({
      title: e.title,
      date: e.date || e.startDate || new Date(),
      startDate: e.startDate || e.date || new Date(),
      endDate: e.endDate || e.date || new Date(),
      description: e.description || '',
      type: e.type || 'holiday',
      tenantId: req.user.tenantId,
      createdBy: req.user._id
    }));

    const inserted = await Calendar.insertMany(docs);
    res.status(201).json({
      success: true,
      message: `Successfully created ${inserted.length} calendar events`,
      count: inserted.length,
      data: inserted
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error bulk creating calendar events", error: error.message });
  }
};

const updateCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, startDate, endDate, description, type } = req.body;
    
    const event = await Calendar.findOne({ _id: id, tenantId: req.user.tenantId });
    if (!event) {
      return res.status(404).json({ success: false, message: "Calendar event not found" });
    }

    if (title) event.title = title;
    if (date) event.date = date;
    if (startDate) event.startDate = startDate;
    if (endDate) event.endDate = endDate;
    if (description !== undefined) event.description = description;
    if (type) event.type = type;

    await event.save();
    res.status(200).json({ success: true, message: "Calendar event updated successfully", data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating calendar event", error: error.message });
  }
};

const deleteCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Calendar.findOneAndDelete({ _id: id, tenantId: req.user.tenantId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Calendar event not found" });
    }
    res.status(200).json({ success: true, message: "Calendar event deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting calendar event", error: error.message });
  }
};

module.exports = {
  getCalendar,
  createCalendar,
  bulkCreateCalendar,
  updateCalendar,
  deleteCalendar
};