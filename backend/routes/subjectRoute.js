const express = require("express");
const { createSubject, getSubjects, getSubjectsBySection } = require("../controllers/subjectController");

const router = express.Router();

router.post("/subjects", createSubject);
router.get("/subjects", getSubjects);
router.get("/subjects/:section", getSubjectsBySection); 

module.exports = router;
