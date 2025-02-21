const Subject = require("../models/Subject");

const createSubject = async (req, res) => {
  const { name, code, sections } = req.body;

  if (!sections || !Array.isArray(sections) || sections.length === 0) {
    return res.status(400).send({ message: "Sections field is required and should be an array." });
  }

  try {
    const newSubject = new Subject({ name, code, sections });
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

const getSubjectsBySection = async (req, res) => {
  const { section } = req.params;

  try {
    const subjects = await Subject.find({ sections: section });
    res.status(200).send(subjects);
  } catch (error) {
    res.status(500).send({ message: "Error fetching subjects for section", error });
  }
};

module.exports = {
  createSubject,
  getSubjects,
  getSubjectsBySection,
};
