// controllers/subjectController.js
const Subject = require("../models/Subject");

const createSubject = async (req, res) => {
  const { name, code } = req.body;

  try {
    const newSubject = new Subject({ name, code });
    await newSubject.save();
    res.status(201).send(newSubject);
  } catch (error) {
    res.status(500).send({ message: "Error creating subject", error });
  }
};

const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find();
    res.status(200).send(subjects);
  } catch (error) {
    res.status(500).send({ message: "Error fetching subjects", error });
  }
};

module.exports = {
  createSubject,
  getSubjects,
};
