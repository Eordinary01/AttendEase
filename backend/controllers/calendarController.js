const Calendar = require('../models/Calendar');


 const getCalendar = async (req, res) => {
    try {
      const events = await Calendar.find();
      res.status(200).send(events);
    } catch (error) {
      res.status(500).send({ message: "Error fetching calendar events", error });
    }
  };



  const createCalendar = async (req, res) => {
    const { title, date, description } = req.body;
    try {
      const newEvent = new Calendar({ title, date, description });
      await newEvent.save();
      res.status(200).send(newEvent);
    } catch (error) {
      res.status(500).send({ message: "Error creating calendar event", error });
    }
  };

  module.exports = {
    getCalendar,
    createCalendar
  }