const mongoose = require("mongoose");
const Timetable = require("../models/Timetable");
const User = require("../models/User");
const Subject = require("../models/Subject");
const Enrollment = require("../models/Enrollment");
const cache = require("../middleware/cache");
const logger = require("../utils/logger");
const { toObjectId } = require("../utils/sanitize");
const { validateSectionsExist } = require("../utils/sectionHelper");

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const timeToMinutes = (t) => {
  const [h, m] = String(t || "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
};

const timeOverlaps = (aStart, aEnd, bStart, bEnd) => {
  const a1 = timeToMinutes(aStart), a2 = timeToMinutes(aEnd);
  const b1 = timeToMinutes(bStart), b2 = timeToMinutes(bEnd);
  if ([a1, a2, b1, b2].some(Number.isNaN)) return false;
  return a1 < b2 && b1 < a2;
};

const normalizeSection = (section) => String(section || "").toUpperCase();

const sameRoom = (a, b) => {
  const ra = String(a || "").trim().toLowerCase();
  const rb = String(b || "").trim().toLowerCase();
  return Boolean(ra && rb && ra === rb);
};

// Structural + teacher-assignment validation. Returns array of error strings.
const validateEntry = async (tenantId, entry) => {
  const errors = [];
  if (!entry.day || !DAYS.includes(entry.day)) errors.push("day must be a valid weekday");
  if (!entry.startTime || !entry.endTime) errors.push("startTime and endTime are required");
  else if (timeToMinutes(entry.startTime) >= timeToMinutes(entry.endTime)) errors.push("startTime must be before endTime");

  if (!entry.isNoClass) {
    if (!entry.subjectId) errors.push("subjectId is required");
    if (!entry.teacherId) errors.push("teacherId is required");
  }
  if (!entry.section) {
    errors.push("section is required");
  } else {
    const secVal = await validateSectionsExist(tenantId, entry.section);
    if (!secVal.valid) {
      errors.push(secVal.message);
    }
  }

  if (errors.length === 0 && !entry.isNoClass) {
    const teacher = await User.findOne({ _id: toObjectId(entry.teacherId), tenantId: toObjectId(tenantId) }).lean();
    if (!teacher) {
      errors.push("Teacher not found");
    } else if (teacher.role !== "teacher") {
      errors.push("Selected user is not a teacher");
    } else {
      const targetSubId = String(entry.subjectId || "");
      const targetSubCode = String(entry.subjectCode || "").trim().toUpperCase();
      const targetSubName = String(entry.subjectName || "").trim().toLowerCase();
      const targetSection = normalizeSection(entry.section);

      const assignedList = (Array.isArray(teacher.assignedSubjects) ? teacher.assignedSubjects : []).filter(a => {
        const aSubId = a.subjectId ? String(a.subjectId._id || a.subjectId) : "";
        const aName = String(a.subjectName || a.subjectId?.subjectName || "").trim().toLowerCase();
        const aCode = String(a.subjectCode || a.subjectId?.subjectCode || "").trim().toUpperCase();

        const matchSubject = (targetSubId && aSubId === targetSubId) ||
          (targetSubCode && aCode && aCode === targetSubCode) ||
          (targetSubName && aName && aName === targetSubName);

        return matchSubject;
      });

      if (assignedList.length === 0) {
        errors.push(`Teacher ${teacher.name} is not assigned to subject "${entry.subjectName || entry.subjectId}"`);
      } else if (targetSection) {
        // The teacher must actually teach this subject in the entry's section.
        const sectionMatch = assignedList.some(a => normalizeSection(a.section) === targetSection);
        if (!sectionMatch) {
          const validSections = [...new Set(assignedList.map(a => normalizeSection(a.section)).filter(Boolean))].join(", ") || "none";
          errors.push(`Teacher ${teacher.name} is not assigned to subject "${entry.subjectName || entry.subjectId}" in Section ${targetSection} (assigned in: ${validSections})`);
        }
      }
    }
  }
  return errors;
};

// Derive the section for a timetable entry from the teacher's assignment of the
// subject. A section explicitly provided by the client is kept; otherwise it is
// resolved to the unique section where the teacher teaches that subject.
const resolveSection = async (tenantId, entry) => {
  if (entry.isNoClass) {
    return { section: normalizeSection(entry.section), errors: [] };
  }
  if (entry.section) {
    return { section: normalizeSection(entry.section), errors: [] };
  }
  if (!entry.teacherId || !entry.subjectId) {
    return { section: "", errors: ["section is required"] };
  }

  const teacher = await User.findOne({ _id: toObjectId(entry.teacherId), tenantId: toObjectId(tenantId) }).lean();
  if (!teacher) {
    return { section: "", errors: ["Teacher not found"] };
  }

  const targetSubId = String(entry.subjectId || "");
  const targetSubCode = String(entry.subjectCode || "").trim().toUpperCase();
  const targetSubName = String(entry.subjectName || "").trim().toLowerCase();

  const matches = (Array.isArray(teacher.assignedSubjects) ? teacher.assignedSubjects : []).filter(a => {
    const aSubId = a.subjectId ? String(a.subjectId._id || a.subjectId) : "";
    const aName = String(a.subjectName || a.subjectId?.subjectName || "").trim().toLowerCase();
    const aCode = String(a.subjectCode || a.subjectId?.subjectCode || "").trim().toUpperCase();
    return (targetSubId && aSubId === targetSubId) ||
      (targetSubCode && aCode && aCode === targetSubCode) ||
      (targetSubName && aName && aName === targetSubName);
  });

  const sections = [...new Set(matches.map(a => normalizeSection(a.section)).filter(Boolean))];
  if (sections.length === 0) {
    return { section: "", errors: [`Teacher is not assigned to subject "${entry.subjectName || entry.subjectId}" in any section`] };
  }
  if (sections.length > 1) {
    return { section: "", errors: [`Subject is taught by this teacher in multiple sections (${sections.join(", ")}). Specify a section.`] };
  }
  return { section: sections[0], errors: [] };
};

// Resolve subjectId/teacherId from names/codes when IDs are absent in bulk rows.
// Returns { subjectId, teacherId, errors }.
const resolveBulkReferences = async (tenantId, raw) => {
  if (raw.isNoClass) {
    return { subjectId: undefined, teacherId: undefined, errors: [] };
  }

  const errors = [];
  let subjectId = raw.subjectId;
  let teacherId = raw.teacherId;
  const cleanTenantId = toObjectId(tenantId);

  const isMongoId = (v) => /^[0-9a-f]{24}$/i.test(v);

  if (subjectId && !isMongoId(String(subjectId))) {
    const searchVal = String(subjectId).trim();
    let sub = await Subject.findOne({
      tenantId: cleanTenantId,
      isActive: true,
      $or: [
        { subjectCode: { $regex: new RegExp(`^${escapeRegExp(searchVal)}$`, "i") } },
        { subjectName: { $regex: new RegExp(`^${escapeRegExp(searchVal)}$`, "i") } },
      ],
    }).lean();

    if (!sub && raw.courseCode) {
      sub = await Subject.findOne({
        tenantId: cleanTenantId,
        isActive: true,
        courseCode: { $regex: new RegExp(`^${escapeRegExp(String(raw.courseCode))}$`, "i") },
        subjectCode: { $regex: new RegExp(`${escapeRegExp(searchVal)}$`, "i") }
      }).lean();
    }

    if (!sub) {
      sub = await Subject.findOne({
        tenantId: cleanTenantId,
        isActive: true,
        subjectCode: { $regex: new RegExp(`${escapeRegExp(searchVal)}$`, "i") }
      }).lean();
    }

    if (sub) subjectId = sub._id;
    else { errors.push(`Subject "${subjectId}" not found in your institution`); subjectId = null; }
  }

  if (teacherId && !isMongoId(String(teacherId))) {
    const teacher = await User.findOne({
      tenantId: cleanTenantId,
      role: "teacher",
      $or: [
        { rollNo: { $regex: new RegExp(`^${escapeRegExp(String(teacherId))}$`, "i") } },
        { teacherCode: { $regex: new RegExp(`^${escapeRegExp(String(teacherId))}$`, "i") } },
        { name: { $regex: new RegExp(`^${escapeRegExp(String(teacherId))}$`, "i") } },
      ],
    }).select("_id").lean();
    if (teacher) teacherId = teacher._id;
    else { errors.push(`Teacher "${teacherId}" not found in your institution`); teacherId = null; }
  }

  if (!raw.isNoClass && !subjectId) {
    const name = String(raw.subjectName || "").trim();
    const code = String(raw.subjectCode || "").trim();
    if (name || code) {
      let subject = await Subject.findOne({
        tenantId: cleanTenantId,
        isActive: true,
        $or: [
          ...(name ? [{ subjectName: { $regex: new RegExp(`^${escapeRegExp(name)}$`, "i") } }] : []),
          ...(code ? [{ subjectCode: { $regex: new RegExp(`^${escapeRegExp(code)}$`, "i") } }] : []),
        ],
      }).lean();

      if (!subject && code) {
        if (raw.courseCode) {
          subject = await Subject.findOne({
            tenantId: cleanTenantId,
            isActive: true,
            courseCode: { $regex: new RegExp(`^${escapeRegExp(String(raw.courseCode))}$`, "i") },
            subjectCode: { $regex: new RegExp(`${escapeRegExp(code)}$`, "i") }
          }).lean();
        }
        if (!subject) {
          subject = await Subject.findOne({
            tenantId: cleanTenantId,
            isActive: true,
            subjectCode: { $regex: new RegExp(`${escapeRegExp(code)}$`, "i") }
          }).lean();
        }
      }

      if (subject) {
        subjectId = subject._id;
      } else {
        errors.push(`Subject "${name || code}" not found in your institution`);
      }
    }
  }

  if (!raw.isNoClass && !teacherId) {
    const name = String(raw.teacherName || "").trim();
    if (name && name.toLowerCase() !== "n/a") {
      const teacher = await User.findOne({
        tenantId: cleanTenantId,
        role: "teacher",
        name: { $regex: new RegExp(`^${escapeRegExp(name)}$`, "i") }
      }).select("_id").lean();
      if (teacher) {
        teacherId = teacher._id;
      } else {
        errors.push(`Teacher "${name}" not found in your institution`);
      }
    }
  }

  return { subjectId, teacherId, errors };
};

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


// Find existing timetable conflicts for a single entry against the database.
const findConflicts = async (tenantId, entry, excludeId = null) => {
  const section = normalizeSection(entry.section);
  const entryCourseCode = String(entry.courseCode || "").toUpperCase();
  const entryCourseId = entry.courseId ? String(entry.courseId) : "";
  const entrySem = entry.semester ? String(entry.semester) : "";

  const conflicts = [];
  const query = { tenantId, day: entry.day, isActive: true };
  if (excludeId) query._id = { $ne: excludeId };

  const sameDay = await Timetable.find(query).lean();
  for (const ex of sameDay) {
    if (!timeOverlaps(entry.startTime, entry.endTime, ex.startTime, ex.endTime)) continue;

    const exSection = normalizeSection(ex.section);
    const exCourseCode = String(ex.courseCode || "").toUpperCase();
    const exCourseId = ex.courseId ? String(ex.courseId) : "";
    const exSem = ex.semester ? String(ex.semester) : "";

    // A section clash ONLY occurs if it's the SAME section AND the SAME course (and semester if set)
    const isSameCourse = (entryCourseId && exCourseId && entryCourseId === exCourseId) ||
      (entryCourseCode && exCourseCode && entryCourseCode === exCourseCode) ||
      (!entryCourseCode && !exCourseCode);

    const isSameSem = !entrySem || !exSem || entrySem === exSem;

    const sectionClash = exSection === section && isSameCourse && isSameSem;

    const teacherClash = !entry.isNoClass && !ex.isNoClass &&
      entry.teacherId && ex.teacherId &&
      String(ex.teacherId) === String(entry.teacherId) &&
      (!sectionClash);

    const roomClash = sameRoom(entry.room, ex.room);

    if (sectionClash) {
      const cLabel = exCourseCode ? ` (${exCourseCode}${exSem ? ` Sem ${exSem}` : ""})` : "";
      conflicts.push(`Section ${section}${cLabel} already has ${ex.isNoClass ? "No Class" : ex.subjectName} at ${ex.startTime}-${ex.endTime}`);
    } else if (teacherClash) {
      conflicts.push(`Teacher ${ex.teacherName || ""} is already teaching in ${exCourseCode || ""} Section ${exSection} (${ex.startTime}-${ex.endTime})`);
    }

    if (roomClash) {
      conflicts.push(`Room ${entry.room} is already booked at ${ex.startTime}-${ex.endTime}`);
    }
  }
  return [...new Set(conflicts)];
};

const createEntry = async (req, res) => {
  try {
    const { day, startTime, endTime, subjectId, subjectName, subjectCode, teacherId, teacherName, section, room, semester, isNoClass } = req.body;
    const noClass = Boolean(isNoClass || String(subjectName).toLowerCase() === "no class");

    let finalSubjectName = subjectName;
    let finalSubjectCode = subjectCode;
    let finalTeacherName = teacherName;
    let finalCourseId = req.body.courseId;
    let finalCourseCode = req.body.courseCode;
    let finalBranch = req.body.branch;
    let finalSemester = semester;

    if (!noClass) {
      if (!subjectId || !teacherId) {
        return res.status(400).json({ success: false, message: "Subject and teacher are required for regular classes" });
      }

      if (subjectId && (!finalSubjectName || !finalSubjectCode || !finalCourseId || !finalCourseCode || !finalSemester || !finalBranch)) {
        const sub = await Subject.findOne({ _id: subjectId, tenantId: req.user.tenantId }).lean();
        if (sub) {
          if (!finalSubjectName) finalSubjectName = sub.subjectName;
          if (!finalSubjectCode) finalSubjectCode = sub.subjectCode;
          if (!finalCourseId) finalCourseId = sub.courseId;
          if (!finalCourseCode) finalCourseCode = sub.courseCode;
          if (!finalBranch && sub.branch) finalBranch = sub.branch;
          if (!finalSemester && sub.semester) finalSemester = String(sub.semester);
        }
      }

      if (teacherId && (!finalTeacherName || finalTeacherName === "N/A")) {
        const t = await User.findOne({ _id: teacherId, tenantId: req.user.tenantId }).lean();
        if (t) finalTeacherName = t.name;
      }

      if (!finalSubjectName || !finalTeacherName) {
        return res.status(400).json({ success: false, message: "Subject and teacher are required for regular classes" });
      }
    }

    const entry = {
      day, startTime, endTime,
      isNoClass: noClass,
      subjectId: noClass ? undefined : subjectId,
      subjectName: noClass ? "No Class" : finalSubjectName,
      subjectCode: noClass ? "" : (finalSubjectCode || ""),
      teacherId: noClass ? undefined : teacherId,
      teacherName: noClass ? "N/A" : (finalTeacherName || "N/A"),
      section: normalizeSection(section), room: room || "", semester: finalSemester || "",
      courseId: noClass ? undefined : finalCourseId,
      courseCode: noClass ? "" : (finalCourseCode || ""),
      branch: noClass ? "" : (finalBranch || ""),
    };

    const resolved = await resolveSection(req.user.tenantId, entry);
    if (resolved.errors.length > 0) {
      return res.status(400).json({ success: false, message: resolved.errors.join("; "), errors: resolved.errors });
    }
    entry.section = resolved.section;

    const validationErrors = await validateEntry(req.user.tenantId, entry);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: validationErrors.join("; "), errors: validationErrors });
    }

    const existingQuery = {
      tenantId: req.user.tenantId, section: entry.section, day, startTime,
    };
    if (!noClass) existingQuery.subjectId = entry.subjectId;
    const existing = await Timetable.findOne(existingQuery);
    if (existing) {
      return res.status(409).json({ success: false, message: "A timetable entry already exists for this time slot" });
    }

    const conflicts = await findConflicts(req.user.tenantId, entry);
    if (conflicts.length > 0) {
      return res.status(409).json({ success: false, message: "Timetable conflict detected: " + conflicts[0], conflicts });
    }

    const created = await Timetable.create({
      tenantId: req.user.tenantId,
      ...entry,
      createdBy: req.user._id,
    });
    await cache.delPattern(`timetable:${req.user.tenantId}:*`).catch(() => {});

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    logger.error("Error creating timetable entry", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to create entry" });
  }
};

const bulkCreate = async (req, res) => {
  try {
    const rawTenantId = req.tenantId || req.user?.tenantId || req.tenant?._id;
    const tenantId = toObjectId(rawTenantId);

    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ success: false, message: "Entries array is required" });
    }

    const rowErrors = [];
    const valid = [];
    const validOriginalIndex = [];

    for (let i = 0; i < entries.length; i++) {
      const raw = entries[i] || {};
      const noClass = Boolean(
        raw.isNoClass === true ||
        raw.isNoClass === "true" ||
        raw.isNoClass === "TRUE" ||
        raw.isNoClass === 1 ||
        raw.isNoClass === "1" ||
        ["no class", "free slot", "free period", "break", "lunch"].includes(String(raw.subjectName || "").trim().toLowerCase())
      );

      // Resolve teacher/subject by name when IDs are missing (bulk files are name-driven)
      const { subjectId, teacherId, errors: refErrors } = await resolveBulkReferences(tenantId, {
        ...raw,
        isNoClass: noClass,
      });

      // Mirror the manual create flow: when the file doesn't carry course
      // context, backfill it from the resolved subject so bulk and manual
      // entries store identical courseCode/branch/semester fields.
      let courseId = noClass ? undefined : raw.courseId;
      let courseCode = noClass ? "" : (raw.courseCode || "");
      let branch = noClass ? "" : (raw.branch || "");
      let semester = noClass ? "" : (raw.semester || "");
      if (!noClass && subjectId) {
        const sub = await Subject.findOne({ _id: subjectId, tenantId }).lean();
        if (sub) {
          if (!courseId) courseId = sub.courseId;
          if (!courseCode) courseCode = sub.courseCode || "";
          if (!branch && sub.branch) branch = sub.branch;
          if (!semester && sub.semester) semester = String(sub.semester);
        }
      }

      let roomVal = raw.room || "";
      if (noClass && (!roomVal || roomVal === "true" || roomVal === "TRUE") && raw.subjectId && !/^[0-9a-f]{24}$/i.test(String(raw.subjectId))) {
        roomVal = String(raw.subjectId);
      }

      const entry = {
        ...raw,
        day: raw.day,
        startTime: raw.startTime,
        endTime: raw.endTime,
        isNoClass: noClass,
        isActive: raw.isActive !== undefined && raw.isActive !== "" ? (raw.isActive === true || raw.isActive === "true" || raw.isActive === "TRUE") : true,
        subjectId: noClass ? undefined : (subjectId || raw.subjectId),
        subjectName: noClass ? "No Class" : (raw.subjectName || ""),
        subjectCode: noClass ? "" : (raw.subjectCode || ""),
        teacherId: noClass ? undefined : (teacherId || raw.teacherId),
        teacherName: noClass ? "N/A" : (raw.teacherName || ""),
        section: normalizeSection(raw.section),
        room: roomVal,
        semester,
        courseCode: String(raw.courseCode || courseCode || "").toUpperCase(),
        branch: raw.branch || branch || "",
        tenantId,
      };

      const resolved = await resolveSection(tenantId, entry);
      if (resolved.errors.length > 0) {
        rowErrors.push({ index: i, error: [...refErrors, ...resolved.errors].join("; ") });
        continue;
      }
      entry.section = resolved.section;

      const validationErrors = await validateEntry(tenantId, entry);
      const allErrors = [...refErrors, ...validationErrors];
      if (allErrors.length > 0) {
        rowErrors.push({ index: i, error: allErrors.join("; ") });
        continue;
      }

      const conflicts = await findConflicts(tenantId, entry);
      if (conflicts.length > 0) {
        rowErrors.push({ index: i, error: conflicts.join("; ") });
        continue;
      }

      valid.push(entry);
      validOriginalIndex.push(i);
    }

    // Intra-batch conflict detection
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        const a = valid[i];
        const b = valid[j];
        if (!a || !b) continue;
        if (a.day !== b.day) continue;
        if (!timeOverlaps(a.startTime, a.endTime, b.startTime, b.endTime)) continue;

        const isSameCourse = (a.courseId && b.courseId && String(a.courseId) === String(b.courseId)) ||
          (a.courseCode && b.courseCode && String(a.courseCode).toUpperCase() === String(b.courseCode).toUpperCase()) ||
          (!a.courseCode && !b.courseCode);
        const sectionClash = a.section === b.section && isSameCourse;
        const teacherClash = !sectionClash && !a.isNoClass && !b.isNoClass && a.teacherId && b.teacherId && String(a.teacherId) === String(b.teacherId);
        const roomClash = !sectionClash && !teacherClash && sameRoom(a.room, b.room);
        let msg = null;
        if (sectionClash) {
          msg = `Section ${a.section} would have both ${a.isNoClass ? "No Class" : a.subjectName} and ${b.isNoClass ? "No Class" : b.subjectName} at ${a.startTime}-${a.endTime}`;
        } else if (teacherClash) {
          msg = `Teacher would clash between Sections ${a.section} and ${b.section} at ${a.startTime}-${a.endTime}`;
        } else if (roomClash) {
          msg = `Room ${a.room} would be double-booked at ${a.startTime}-${a.endTime}`;
        }
        if (msg) {
          rowErrors.push({ index: validOriginalIndex[j], error: msg });
          valid[j] = null;
        }
      }
    }

    if (rowErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bulk import rejected — ${rowErrors.length} row(s) have errors`,
        errors: rowErrors,
      });
    }



    const enriched = valid
      .filter(Boolean)
      .map(({ tenantId: tId, subjectId, teacherId, courseId, ...rest }) => ({
        ...rest,
        tenantId,
        subjectId: toObjectId(subjectId),
        teacherId: toObjectId(teacherId),
        courseId: toObjectId(courseId),
        createdBy: toObjectId(req.user._id)
      }));

    const created = await Timetable.insertMany(enriched, { ordered: false });
    await cache.delPattern(`timetable:${req.user.tenantId}:*`).catch(() => {});
    return res.status(201).json({ success: true, message: `${created.length} entries created`, data: created });
  } catch (error) {
    logger.error("Error bulk creating timetable", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to bulk create entries" });
  }
};

const getAll = async (req, res) => {
  try {
    const { section, day, courseId, courseCode, branch, semester } = req.query;
    const filter = { tenantId: req.user.tenantId, isActive: true };

    if (section) filter.section = normalizeSection(section);
    if (day) filter.day = day;

    let targetCourseId = courseId || null;
    let targetCourseCode = courseCode ? String(courseCode).toUpperCase() : null;
    let targetBranch = branch ? String(branch).trim() : null;
    let targetSemester = semester ? String(semester).trim() : null;

    if (req.user.role === "student" || req.user.role === "parent" || req.user.accessMode === "parent") {
      let userCourseId = req.user.courseId || null;
      let userBranch = req.user.branch || null;
      let userSemester = req.user.semester || null;

      if (!userCourseId || !userBranch || !userSemester) {
        const enrollment = await Enrollment.findOne({
          userId: req.user._id,
          tenantId: req.user.tenantId,
        }).lean();
        if (enrollment) {
          userCourseId = userCourseId || enrollment.courseId || null;
          userBranch = userBranch || enrollment.branch || null;
          userSemester = userSemester || enrollment.semester || null;
        }
      }

      targetCourseId = targetCourseId || userCourseId;
      targetBranch = targetBranch || userBranch;
      targetSemester = targetSemester || userSemester;
    }

    const andConditions = [];

    if (targetCourseId || targetCourseCode) {
      const courseOrs = [];
      if (targetCourseId) courseOrs.push({ courseId: targetCourseId });
      if (targetCourseCode) courseOrs.push({ courseCode: new RegExp(`^${targetCourseCode}$`, "i") });
      courseOrs.push({ courseId: null }, { courseId: { $exists: false } }, { isNoClass: true });
      andConditions.push({ $or: courseOrs });
    }

    if (targetBranch) {
      const branchCodeMap = {
        "CSE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING"],
        "COMPUTER SCIENCE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING"],
        "CHEM": ["CHEM", "CHEMISTRY"],
        "CHEMISTRY": ["CHEM", "CHEMISTRY"],
        "ME": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
        "ECE": ["ECE", "ELECTRONICS"],
        "CIVIL": ["CIVIL", "CIVIL ENGINEERING"]
      };

      const bUpper = targetBranch.trim().toUpperCase();
      const validBranches = branchCodeMap[bUpper] || [bUpper];
      const branchRegexes = validBranches.map((b) => new RegExp(`^${b}$`, "i"));

      andConditions.push({
        $or: [
          { branch: { $in: branchRegexes } },
          { branch: "" },
          { branch: null },
          { branch: { $exists: false } },
          { isNoClass: true }
        ]
      });
    }

    if (targetSemester) {
      const semNum = parseInt(String(targetSemester).replace(/\D/g, ""), 10);
      if (!isNaN(semNum) && semNum > 0) {
        andConditions.push({
          $or: [
            { semester: semNum },
            { semester: String(semNum) },
            { semester: "" },
            { semester: null },
            { semester: { $exists: false } },
            { isNoClass: true }
          ]
        });
      }
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    let entries = await Timetable.find(filter)
      .populate("subjectId", "subjectName subjectCode courseCode branch semester")
      .populate("teacherId", "name email")
      .sort({ day: 1, startTime: 1 })
      .lean();

    entries = entries.map((e) => {
      const sub = e.subjectId;
      const t = e.teacherId;
      return {
        ...e,
        subjectId: sub?._id || e.subjectId,
        subjectCode: e.subjectCode || sub?.subjectCode || "",
        subjectName: e.subjectName || sub?.subjectName || (e.isNoClass ? "No Class" : "Subject"),
        teacherId: t?._id || e.teacherId,
        teacherName: e.teacherName || t?.name || (e.isNoClass ? "N/A" : ""),
      };
    });

    return res.status(200).json({ success: true, data: entries });
  } catch (error) {
    logger.error("Error fetching timetable", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch timetable" });
  }
};

const getBySection = async (req, res) => {
  try {
    const { section } = req.params;
    const { courseId, courseCode, branch, semester } = req.query;
    const secUpper = normalizeSection(section);

    const filter = {
      tenantId: req.user.tenantId,
      section: secUpper,
      isActive: true,
    };

    let targetCourseId = courseId || null;
    let targetCourseCode = courseCode ? String(courseCode).toUpperCase() : null;
    let targetBranch = branch ? String(branch).trim() : null;
    let targetSemester = semester ? String(semester).trim() : null;

    if (req.user.role === "student" || req.user.role === "parent" || req.user.accessMode === "parent") {
      let userCourseId = req.user.courseId || null;
      let userBranch = req.user.branch || null;
      let userSemester = req.user.semester || null;

      if (!userCourseId || !userBranch || !userSemester) {
        const enrollment = await Enrollment.findOne({
          userId: req.user._id,
          tenantId: req.user.tenantId,
        }).lean();
        if (enrollment) {
          userCourseId = userCourseId || enrollment.courseId || null;
          userBranch = userBranch || enrollment.branch || null;
          userSemester = userSemester || enrollment.semester || null;
        }
      }

      targetCourseId = targetCourseId || userCourseId;
      targetBranch = targetBranch || userBranch;
      targetSemester = targetSemester || userSemester;
    }

    const andConditions = [];

    if (targetCourseId || targetCourseCode) {
      const courseOrs = [];
      if (targetCourseId) courseOrs.push({ courseId: targetCourseId });
      if (targetCourseCode) courseOrs.push({ courseCode: new RegExp(`^${targetCourseCode}$`, "i") });
      courseOrs.push({ courseId: null }, { courseId: { $exists: false } }, { isNoClass: true });
      andConditions.push({ $or: courseOrs });
    }

    if (targetBranch) {
      const branchCodeMap = {
        "CSE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING"],
        "COMPUTER SCIENCE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING"],
        "CHEM": ["CHEM", "CHEMISTRY"],
        "CHEMISTRY": ["CHEM", "CHEMISTRY"],
        "ME": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
        "ECE": ["ECE", "ELECTRONICS"],
        "CIVIL": ["CIVIL", "CIVIL ENGINEERING"]
      };

      const bUpper = targetBranch.trim().toUpperCase();
      const validBranches = branchCodeMap[bUpper] || [bUpper];
      const branchRegexes = validBranches.map((b) => new RegExp(`^${b}$`, "i"));

      andConditions.push({
        $or: [
          { branch: { $in: branchRegexes } },
          { branch: "" },
          { branch: null },
          { branch: { $exists: false } },
          { isNoClass: true }
        ]
      });
    }

    if (targetSemester) {
      const semNum = parseInt(String(targetSemester).replace(/\D/g, ""), 10);
      if (!isNaN(semNum) && semNum > 0) {
        andConditions.push({
          $or: [
            { semester: semNum },
            { semester: String(semNum) },
            { semester: "" },
            { semester: null },
            { semester: { $exists: false } },
            { isNoClass: true }
          ]
        });
      }
    }

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    let entries = await Timetable.find(filter)
      .populate("subjectId", "subjectName subjectCode courseCode branch semester")
      .populate("teacherId", "name email")
      .sort({ day: 1, startTime: 1 })
      .lean();

    entries = entries.map((e) => {
      const sub = e.subjectId;
      const t = e.teacherId;
      return {
        ...e,
        subjectId: sub?._id || e.subjectId,
        subjectCode: e.subjectCode || sub?.subjectCode || "",
        subjectName: e.subjectName || sub?.subjectName || (e.isNoClass ? "No Class" : "Subject"),
        teacherId: t?._id || e.teacherId,
        teacherName: e.teacherName || t?.name || (e.isNoClass ? "N/A" : ""),
      };
    });

    const dayIndex = {};
    DAYS.forEach((d, i) => { dayIndex[d] = i; });
    entries.sort((a, b) => {
      const da = dayIndex[a.day] ?? 0;
      const db = dayIndex[b.day] ?? 0;
      if (da !== db) return da - db;
      return String(a.startTime).localeCompare(String(b.startTime));
    });

    const grouped = {};
    DAYS.forEach((d) => { grouped[d] = []; });
    entries.forEach((e) => {
      if (grouped[e.day]) grouped[e.day].push(e);
    });

    return res.status(200).json({ success: true, data: entries, grouped });
  } catch (error) {
    logger.error("Error fetching section timetable", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch section timetable" });
  }
};

const getByTeacher = async (req, res) => {
  try {
    const rawTeacherId = req.params.teacherId || req.user?._id || req.user?.id;
    const teacherId = toObjectId(rawTeacherId);
    const tenantId = toObjectId(req.user?.tenantId || req.tenantId || req.tenant?._id);

    if (!teacherId || !tenantId) {
      return res.status(200).json({ success: true, data: [], grouped: {} });
    }

    // Retrieve teacher's assigned subjects list for fallback matching
    const teacher = await User.findById(teacherId).select("assignedSubjects").lean();

    const assignedPairs = (teacher?.assignedSubjects || [])
      .filter((a) => a.subjectId && a.section)
      .map((a) => ({
        subjectId: toObjectId(a.subjectId?._id || a.subjectId),
        section: a.section,
      }));

    const orConditions = [{ teacherId: teacherId }];
    assignedPairs.forEach((p) => {
      if (p.subjectId) {
        orConditions.push({ subjectId: p.subjectId, section: p.section });
      }
    });

    const query = {
      tenantId: tenantId,
      isActive: true,
      $or: orConditions,
    };

    const entries = await Timetable.find(query)
      .populate("subjectId", "subjectName subjectCode courseCode branch semester")
      .sort({ day: 1, startTime: 1 })
      .lean();

    // Enrich entries with subject fallback metadata if missing on Timetable document
    const enrichedEntries = entries.map((e) => {
      const sub = e.subjectId && typeof e.subjectId === "object" ? e.subjectId : null;
      return {
        ...e,
        subjectId: sub ? sub._id : e.subjectId,
        subjectName: (e.subjectName && e.subjectName !== "No Class") ? e.subjectName : (sub?.subjectName || e.subjectName || "Subject"),
        subjectCode: e.subjectCode || sub?.subjectCode || "",
        courseCode: e.courseCode || sub?.courseCode || "",
        branch: e.branch || sub?.branch || "",
        semester: e.semester || sub?.semester || "",
      };
    });

    const grouped = {};
    DAYS.forEach((d) => { grouped[d] = []; });
    enrichedEntries.forEach((e) => {
      if (grouped[e.day]) grouped[e.day].push(e);
    });

    return res.status(200).json({ success: true, data: enrichedEntries, grouped });
  } catch (error) {
    logger.error("Error fetching teacher timetable", { error: error.message });
    return res.status(200).json({ success: true, data: [], grouped: {}, error: error.message });
  }
};

const updateEntry = async (req, res) => {
  try {
    const entry = await Timetable.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }

    const { day, startTime, endTime, subjectId, subjectName, subjectCode, teacherId, teacherName, section, room, semester, courseId, courseCode, branch, isNoClass } = req.body;
    const noClass = isNoClass !== undefined ? Boolean(isNoClass) : entry.isNoClass;

    const targetSubjectId = noClass ? undefined : (subjectId !== undefined ? subjectId : entry.subjectId);
    const targetTeacherId = noClass ? undefined : (teacherId !== undefined ? teacherId : entry.teacherId);

    let finalSubjectName = noClass ? "No Class" : (subjectName !== undefined ? subjectName : entry.subjectName);
    let finalSubjectCode = noClass ? "" : (subjectCode !== undefined ? subjectCode : entry.subjectCode);
    let finalTeacherName = noClass ? "N/A" : (teacherName !== undefined ? teacherName : entry.teacherName);
    let finalCourseId = courseId !== undefined ? courseId : entry.courseId;
    let finalCourseCode = courseCode !== undefined ? courseCode : entry.courseCode;
    let finalBranch = branch !== undefined ? branch : entry.branch;

    if (!noClass && targetSubjectId) {
      const sub = await Subject.findOne({ _id: targetSubjectId, tenantId: req.user.tenantId }).lean();
      if (sub) {
        if (!finalSubjectName || finalSubjectName === "No Class") finalSubjectName = sub.subjectName;
        if (!finalSubjectCode) finalSubjectCode = sub.subjectCode;
        if (!finalCourseId) finalCourseId = sub.courseId;
        if (!finalCourseCode) finalCourseCode = sub.courseCode;
        if (!finalBranch && sub.branch) finalBranch = sub.branch;
      }
    }

    if (!noClass && targetTeacherId && (!finalTeacherName || finalTeacherName === "N/A")) {
      const t = await User.findOne({ _id: targetTeacherId, tenantId: req.user.tenantId }).lean();
      if (t) finalTeacherName = t.name;
    }

    const next = {
      day: day !== undefined ? day : entry.day,
      startTime: startTime !== undefined ? startTime : entry.startTime,
      endTime: endTime !== undefined ? endTime : entry.endTime,
      isNoClass: noClass,
      subjectId: targetSubjectId,
      subjectName: finalSubjectName,
      subjectCode: finalSubjectCode,
      teacherId: targetTeacherId,
      teacherName: finalTeacherName,
      section: normalizeSection(section !== undefined ? section : entry.section),
      room: room !== undefined ? room : entry.room,
      semester: semester !== undefined ? semester : entry.semester,
      courseId: noClass ? undefined : finalCourseId,
      courseCode: noClass ? "" : finalCourseCode,
      branch: noClass ? "" : finalBranch,
    };

    const resolved = await resolveSection(req.user.tenantId, next);
    if (resolved.errors.length > 0) {
      return res.status(400).json({ success: false, message: resolved.errors.join("; "), errors: resolved.errors });
    }
    next.section = resolved.section;

    const validationErrors = await validateEntry(req.user.tenantId, next);
    if (validationErrors.length > 0) {
      return res.status(400).json({ success: false, message: validationErrors.join("; "), errors: validationErrors });
    }

    const conflicts = await findConflicts(req.user.tenantId, next, entry._id);
    if (conflicts.length > 0) {
      return res.status(409).json({ success: false, message: "Timetable conflict detected: " + conflicts[0], conflicts });
    }

    Object.assign(entry, next);
    await entry.save();
    await cache.delPattern(`timetable:${req.user.tenantId}:*`).catch(() => {});
    return res.status(200).json({ success: true, data: entry });
  } catch (error) {
    logger.error("Error updating timetable entry", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update entry" });
  }
};

const deleteEntry = async (req, res) => {
  try {
    const entry = await Timetable.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
    if (!entry) {
      return res.status(404).json({ success: false, message: "Entry not found" });
    }
    entry.isActive = false;
    await entry.save();
    await cache.delPattern(`timetable:${req.user.tenantId}:*`).catch(() => {});
    return res.status(200).json({ success: true, message: "Entry deleted" });
  } catch (error) {
    logger.error("Error deleting timetable entry", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to delete entry" });
  }
};

module.exports = {
  createEntry, bulkCreate, getAll, getBySection, getByTeacher, updateEntry, deleteEntry,
};
