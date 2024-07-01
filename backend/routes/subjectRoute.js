// routes/subjectRoutes.js
const express = require("express");
const { createSubject, getSubjects } = require("../controllers/subjectController");

const router = express.Router();

router.post("/subjects", createSubject);
router.get("/subjects", getSubjects);

module.exports = router;
