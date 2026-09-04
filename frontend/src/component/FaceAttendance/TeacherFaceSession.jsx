import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertCircle,
  Loader,
  Users,
  BookOpen,
  Calendar,
  Sparkles,
  Info,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Zap,
  Check,
  X,
  Search,
  RefreshCw,
  Layers,
  ArrowRight,
  UserX,
  RotateCcw,
} from "lucide-react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import {
  getCachedSectionDescriptors,
  saveDescriptorsToIDB,
} from "../../utils/idbStorage";
import { saveToOfflineQueue } from "../../utils/offlineSync";
import useFaceModels from "../../hooks/useFaceModels";
import useCamera from "../../hooks/useCamera";
import useLiveness from "../../hooks/useLiveness";
import useFaceDetection from "../../hooks/useFaceDetection";
import FaceOverlay from "./FaceOverlay";
import DetectedPanel from "./DetectedPanel";
import AcademicEvalDock from "./AcademicEvalDock";
import "./faceAttendance.css";

const TeacherFaceSession = () => {
  const [assignedSubjects, setAssignedSubjects] = useState([]);
  const [allTeacherSlots, setAllTeacherSlots] = useState([]);
  const [activeTenantSections, setActiveTenantSections] = useState(["A", "B"]);

  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedSection, setSelectedSection] = useState("all");
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [knownDescriptors, setKnownDescriptors] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingDescriptors, setLoadingDescriptors] = useState(false);
  const [markedIds, setMarkedIds] = useState(new Set());
  const [marking, setMarking] = useState(false);
  const [autoMark, setAutoMark] = useState(true); // 5-Second Continuous multi-face auto-mark
  const [countdowns, setCountdowns] = useState({}); // Per-student auto-mark countdowns: { [studentId]: { remainingSec, totalSec } }
  const [unauthorizedCooldowns, setUnauthorizedCooldowns] = useState({}); // Unauthorized face throttle: { [trackKey]: remainingSec }
  const [isRosterDrawerOpen, setIsRosterDrawerOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [showQuickEnrollModal, setShowQuickEnrollModal] = useState(false);
  const [markResult, setMarkResult] = useState(null);
  const [showFlash, setShowFlash] = useState(false);
  const [rosterSearch, setRosterSearch] = useState("");
  const [challengeMode, setChallengeMode] = useState(false);

  const canvasRef = useRef(null);
  const autoMarkingRef = useRef(new Set()); // In-flight auto-marking lock to prevent duplicate calls
  const countdownStateRef = useRef({});
  const unauthorizedCooldownRef = useRef({});
  const countdownIntervalRef = useRef(null);

  const { ready: modelsReady, progress: modelProgress, error: modelError } = useFaceModels();
  const { videoRef, active: cameraActive, error: cameraError, start: startCamera, stop: stopCamera } = useCamera({ facingMode: "user" });
  const {
    isLive,
    livenessScore,
    challengeStep,
    challengeInstruction,
    processLiveness,
    tick: tickLiveness,
    reset: resetLiveness,
  } = useLiveness({ challengeMode });

  // Real-time detection callback — only compute challenge liveness when active
  const onDetection = useCallback(
    (results) => {
      if (challengeMode) {
        if (Array.isArray(results) && results.length > 0) {
          for (const det of results) {
            if (det.landmarks) {
              processLiveness(det.landmarks);
            }
          }
        } else {
          tickLiveness();
        }
      }
    },
    [challengeMode, processLiveness, tickLiveness]
  );

  const { detected, fps, startLoop, stopLoop } = useFaceDetection({
    knownDescriptors,
    markedIds,
    videoRef,
    canvasRef,
    onDetection,
    threshold: 0.42,
    debugEval: false,
  });

  const todayDayName = useMemo(() => {
    return new Date().toLocaleDateString("en-US", { weekday: "long" });
  }, []);

  // 1. Initial Load: Teacher Timetable, Assigned Subjects, and Active Sections
  useEffect(() => {
    const fetchTeacherData = async () => {
      setLoadingInitial(true);
      const teacherId = localStorage.getItem("userId") || "";
      const subjectMap = new Map();
      let teacherSlots = [];

      try {
        const ttUrl = "/timetable/teacher";
        const subUrl = teacherId ? `/subjects/teacher/${teacherId}/assignments` : "/subjects/all";

        const [secRes, ttRes, subRes] = await Promise.allSettled([
          api.get("/admin/active-sections"),
          api.get(ttUrl),
          api.get(subUrl),
        ]);

        if (secRes.status === "fulfilled") {
          const secList = secRes.value.data?.data || secRes.value.data?.sections || [];
          if (Array.isArray(secList) && secList.length > 0) {
            setActiveTenantSections(secList.sort());
          }
        }

        if (ttRes.status === "fulfilled") {
          const dataObj = ttRes.value.data;
          let rawSlots = [];
          if (Array.isArray(dataObj?.data)) {
            rawSlots = dataObj.data;
          } else if (dataObj?.data && typeof dataObj.data === "object") {
            rawSlots = Object.values(dataObj.data).flat();
          } else if (Array.isArray(dataObj?.entries)) {
            rawSlots = dataObj.entries;
          }

          if (Array.isArray(rawSlots) && rawSlots.length > 0) {
            teacherSlots = rawSlots.filter((s) => !s.isNoClass);
            setAllTeacherSlots(teacherSlots);

            for (const slot of teacherSlots) {
              const sId = String(slot.subjectId?._id || slot.subjectId || "");
              const sCode = String(slot.subjectCode || slot.subjectId?.subjectCode || "").trim().toUpperCase();
              const sName = slot.subjectName || slot.subjectId?.subjectName || "Subject";
              const key = sId || sCode || sName;

              if (key) {
                if (!subjectMap.has(key)) {
                  subjectMap.set(key, {
                    _id: sId || key,
                    subjectId: sId || key,
                    subjectName: sName,
                    subjectCode: sCode,
                    courseId: slot.courseId || slot.subjectId?.courseId,
                    branch: slot.branch || slot.subjectId?.branch,
                    semester: slot.semester || slot.subjectId?.semester,
                    sections: slot.section ? [slot.section] : [],
                  });
                } else if (slot.section) {
                  const existing = subjectMap.get(key);
                  if (!existing.sections.includes(slot.section)) {
                    existing.sections.push(slot.section);
                  }
                }
              }
            }
          }
        }

        if (subRes.status === "fulfilled") {
          const subData = subRes.value.data;
          const subItems = subData?.data?.assignedSubjects?.subjects || subData?.subjects || subData?.data || [];
          if (Array.isArray(subItems)) {
            for (const item of subItems) {
              const sub = item.subject || item;
              const sId = String(sub?.id || sub?._id || "");
              const sCode = String(sub?.subjectCode || sub?.code || "").trim().toUpperCase();
              const sName = sub?.subjectName || sub?.name || "Subject";
              const key = sId || sCode || sName;

              if (key) {
                if (!subjectMap.has(key)) {
                  subjectMap.set(key, {
                    _id: sId || key,
                    subjectId: sId || key,
                    subjectName: sName,
                    subjectCode: sCode,
                    semester: sub?.semester,
                    courseId: sub?.courseId,
                    branch: sub?.branch,
                    sections: item.section ? [item.section] : (sub?.sections || ["A", "B"]),
                  });
                } else if (item.section) {
                  const existing = subjectMap.get(key);
                  if (!existing.sections.includes(item.section)) {
                    existing.sections.push(item.section);
                  }
                }
              }
            }
          }
        }

        // Fallback: if no subjects mapped yet, fetch all available subjects
        if (subjectMap.size === 0) {
          try {
            const allSubRes = await api.get("/subjects/all");
            const allSubList = allSubRes.data?.data || allSubRes.data?.subjects || allSubRes.data || [];
            if (Array.isArray(allSubList)) {
              for (const sub of allSubList) {
                const sId = String(sub._id || sub.id || "");
                const sCode = String(sub.subjectCode || sub.code || "").trim().toUpperCase();
                const sName = sub.subjectName || sub.name || "Subject";
                const key = sId || sCode || sName;

                if (key && !subjectMap.has(key)) {
                  subjectMap.set(key, {
                    _id: sId || key,
                    subjectId: sId || key,
                    subjectName: sName,
                    subjectCode: sCode,
                    semester: sub.semester,
                    courseId: sub.courseId,
                    branch: sub.branch,
                    sections: sub.sections || ["A", "B"],
                  });
                }
              }
            }
          } catch (fallbackErr) {
            logError("Fetch fallback subjects", fallbackErr);
          }
        }

        const subjectsArray = Array.from(subjectMap.values());
        setAssignedSubjects(subjectsArray);

        if (subjectsArray.length > 0) {
          const firstSub = subjectsArray[0];
          setSelectedSubject(firstSub._id);
          const initialSec = firstSub.sections?.[0] || "A";
          setSelectedSection(initialSec);

          const matchingSlots = teacherSlots.filter((s) => {
            const slotSubId = String(s.subjectId?._id || s.subjectId || "");
            const slotCode = String(s.subjectCode || "").trim().toUpperCase();
            return (
              (firstSub._id && slotSubId === String(firstSub._id)) ||
              (firstSub.subjectCode && slotCode === firstSub.subjectCode.toUpperCase())
            );
          });

          if (matchingSlots.length > 0) {
            setSelectedSlot(String(matchingSlots[0]._id));
            if (matchingSlots[0].section) setSelectedSection(matchingSlots[0].section);
          }
        } else if (teacherSlots.length > 0) {
          const firstSlot = teacherSlots[0];
          setSelectedSlot(String(firstSlot._id));
          setSelectedSubject(String(firstSlot.subjectId?._id || firstSlot.subjectId || ""));
          if (firstSlot.section) setSelectedSection(firstSlot.section);
        }
      } catch (err) {
        logError("Init face attendance session", err);
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchTeacherData();
  }, []);

  const currentSubjectObj = useMemo(() => {
    return assignedSubjects.find((s) => String(s._id) === String(selectedSubject));
  }, [assignedSubjects, selectedSubject]);

  // Available sections list strictly scoped to teacher's assignment for this subject
  const availableSections = useMemo(() => {
    const secSet = new Set();
    if (currentSubjectObj?.sections?.length) {
      currentSubjectObj.sections.forEach((s) => {
        if (s) secSet.add(String(s).trim().toUpperCase());
      });
    }
    allTeacherSlots.forEach((slot) => {
      const slotSubId = String(slot.subjectId?._id || slot.subjectId || "");
      const slotCode = String(slot.subjectCode || "").trim().toUpperCase();
      const matchesSub =
        (currentSubjectObj?._id && slotSubId === String(currentSubjectObj._id)) ||
        (currentSubjectObj?.subjectCode && slotCode === currentSubjectObj.subjectCode.toUpperCase());
      if (matchesSub && slot.section) {
        secSet.add(String(slot.section).trim().toUpperCase());
      }
    });
    if (secSet.size === 0) {
      activeTenantSections.forEach((s) => {
        if (s) secSet.add(String(s).trim().toUpperCase());
      });
    }
    return Array.from(secSet).sort();
  }, [currentSubjectObj, allTeacherSlots, activeTenantSections]);

  // Auto-sync selectedSection when availableSections or selectedSubject updates
  useEffect(() => {
    if (availableSections.length > 0) {
      if (selectedSection && selectedSection !== "all" && !availableSections.includes(selectedSection.toUpperCase())) {
        setSelectedSection("all");
      }
    }
  }, [availableSections, selectedSubject]);

  // Timetable slots matching the selected subject & section
  const filteredSlots = useMemo(() => {
    let baseSlots = allTeacherSlots;

    if (selectedSubject) {
      const sub = currentSubjectObj;
      const subIdStr = String(selectedSubject);
      const subCodeStr = String(sub?.subjectCode || "").trim().toUpperCase();
      const subNameStr = String(sub?.subjectName || "").trim().toLowerCase();

      baseSlots = baseSlots.filter((s) => {
        const slotSubId = String(s.subjectId?._id || s.subjectId || "");
        const slotCode = String(s.subjectCode || "").trim().toUpperCase();
        const slotName = String(s.subjectName || "").trim().toLowerCase();
        return (
          (subIdStr && slotSubId === subIdStr) ||
          (subCodeStr && slotCode === subCodeStr) ||
          (subNameStr && slotName === subNameStr)
        );
      });
    }

    if (selectedSection && selectedSection !== "all") {
      const secUpper = selectedSection.trim().toUpperCase();
      const secMatches = baseSlots.filter((s) => (s.section || "").trim().toUpperCase() === secUpper);
      if (secMatches.length > 0) {
        baseSlots = secMatches;
      }
    }

    return baseSlots.map((s) => ({
      ...s,
      isToday: String(s.day || "").trim().toLowerCase() === todayDayName.toLowerCase(),
    }));
  }, [allTeacherSlots, selectedSubject, currentSubjectObj, selectedSection, todayDayName]);

  const todaySlots = useMemo(() => filteredSlots.filter((s) => s.isToday), [filteredSlots]);
  const otherSlots = useMemo(() => filteredSlots.filter((s) => !s.isToday), [filteredSlots]);

  const currentSlot = useMemo(() => {
    return allTeacherSlots.find((s) => String(s._id) === String(selectedSlot));
  }, [allTeacherSlots, selectedSlot]);

  const isCurrentSlotToday = useMemo(() => {
    if (!currentSlot) return false;
    return String(currentSlot.day || "").trim().toLowerCase() === todayDayName.toLowerCase();
  }, [currentSlot, todayDayName]);

  const handleResetFilters = () => {
    setSelectedSubject("");
    setSelectedSlot("");
    setSelectedSection("all");
    setRosterSearch("");
    setMarkResult(null);
    setMarkedIds(new Set());
    setKnownDescriptors([]);
    setEnrolledStudents([]);
  };

  // Handlers for subject / slot / section changes
  const handleSubjectChange = (newSubjectId) => {
    setSelectedSubject(newSubjectId);
    setMarkResult(null);
    setMarkedIds(new Set());
    setKnownDescriptors([]); // IMMEDIATELY CLEAR DESCRIPTORS ON SUBJECT SWITCH
    setEnrolledStudents([]);

    if (!newSubjectId) {
      setSelectedSlot("");
      setSelectedSection("all");
      return;
    }

    const sub = assignedSubjects.find((s) => String(s._id) === String(newSubjectId));
    const secSet = new Set();
    if (sub?.sections?.length) {
      sub.sections.forEach((s) => s && secSet.add(String(s).trim().toUpperCase()));
    }
    allTeacherSlots.forEach((slot) => {
      const slotSubId = String(slot.subjectId?._id || slot.subjectId || "");
      const slotCode = String(slot.subjectCode || "").trim().toUpperCase();
      const matchesSub =
        (sub?._id && slotSubId === String(sub._id)) ||
        (sub?.subjectCode && slotCode === sub.subjectCode.toUpperCase());
      if (matchesSub && slot.section) {
        secSet.add(String(slot.section).trim().toUpperCase());
      }
    });

    setSelectedSection("all");

    const subCode = String(sub?.subjectCode || "").trim().toUpperCase();

    // Pick matching slot if available
    const matchingSlots = allTeacherSlots.filter((s) => {
      const slotSubId = String(s.subjectId?._id || s.subjectId || "");
      const slotCode = String(s.subjectCode || "").trim().toUpperCase();
      return (
        (newSubjectId && slotSubId === String(newSubjectId)) ||
        (subCode && slotCode === subCode)
      );
    });

    const todayMatch = matchingSlots.find(
      (s) => String(s.day || "").trim().toLowerCase() === todayDayName.toLowerCase()
    );

    if (todayMatch) {
      setSelectedSlot(String(todayMatch._id));
      if (todayMatch.section) setSelectedSection(todayMatch.section);
    } else if (matchingSlots.length > 0) {
      setSelectedSlot(String(matchingSlots[0]._id));
      if (matchingSlots[0].section) setSelectedSection(matchingSlots[0].section);
    } else {
      setSelectedSlot("");
    }
  };

  const handleSectionChange = (newSection) => {
    setSelectedSection(newSection);
    setMarkResult(null);
    setMarkedIds(new Set());
    setKnownDescriptors([]); // IMMEDIATELY CLEAR OLD DESCRIPTORS TO PREVENT CROSS-SECTION MATCHING

    if (newSection && newSection !== "all") {
      // Try finding slot for this section
      const matchingSlot = filteredSlots.find((s) => (s.section || "").toUpperCase() === newSection.toUpperCase());
      if (matchingSlot) {
        setSelectedSlot(String(matchingSlot._id));
      }
    }
  };

  const handleSlotChange = (newSlotId) => {
    setSelectedSlot(newSlotId);
    setMarkResult(null);
    setMarkedIds(new Set());
    setKnownDescriptors([]);

    if (!newSlotId) return;

    const matchedSlot = allTeacherSlots.find((s) => String(s._id) === String(newSlotId));
    if (matchedSlot) {
      if (matchedSlot.section) {
        setSelectedSection(matchedSlot.section);
      }
      const slotSubId = String(matchedSlot.subjectId?._id || matchedSlot.subjectId || "");
      const slotCode = String(matchedSlot.subjectCode || "").trim().toUpperCase();

      const matchingSub = assignedSubjects.find(
        (s) =>
          String(s._id) === slotSubId ||
          (slotCode && String(s.subjectCode || "").trim().toUpperCase() === slotCode)
      );

      if (matchingSub && String(matchingSub._id) !== String(selectedSubject)) {
        setSelectedSubject(String(matchingSub._id));
      }
    }
  };

  // 2. Strict Section-Scoped Roster & Descriptors Loading
  useEffect(() => {
    const isAll = !selectedSection || selectedSection === "all";
    const activeSection = isAll ? "all" : selectedSection;
    const activeSubjectId = currentSlot?.subjectId?._id || currentSlot?.subjectId || selectedSubject;
    const activeSlotId = currentSlot?._id || selectedSlot;

    // CRITICAL: Always reset descriptors and markedIds when section changes
    setKnownDescriptors([]);
    setMarkedIds(new Set());
    autoMarkingRef.current.clear();

    const fetchRosterAndDescriptors = async () => {
      setLoadingDescriptors(true);
      try {
        const currentTenantId = localStorage.getItem("tenantId") || "default";

        // Step 1: IndexedDB Cache Check for THIS specific section
        const cached = await getCachedSectionDescriptors(currentTenantId, activeSection);
        if (cached && cached.count > 0) {
          const sectionFiltered = isAll
            ? cached.data
            : cached.data.filter((d) => !d.section || d.section.toUpperCase() === activeSection.toUpperCase());
          setKnownDescriptors(sectionFiltered);
          setLoadingDescriptors(false);
        } else {
          setKnownDescriptors([]);
        }

        // Step 2: API Section Descriptors Fetch (Authoritative)
        api.get(`/faces/section/${encodeURIComponent(activeSection)}`)
          .then(async (secRes) => {
            if (secRes.data?.success && Array.isArray(secRes.data?.data)) {
              const incoming = secRes.data.data;
              if (incoming.length > 0) {
                await saveDescriptorsToIDB(currentTenantId, activeSection, incoming);
                const refreshed = await getCachedSectionDescriptors(currentTenantId, activeSection);
                if (refreshed?.data?.length > 0) {
                  const filtered = isAll
                    ? refreshed.data
                    : refreshed.data.filter((d) => !d.section || d.section.toUpperCase() === activeSection.toUpperCase());
                  setKnownDescriptors(filtered);
                } else {
                  setKnownDescriptors(incoming);
                }
              } else {
                setKnownDescriptors([]);
              }
            } else {
              setKnownDescriptors([]);
            }
          })
          .catch((syncErr) => {
            logError("Section face sync error", syncErr);
          })
          .finally(() => {
            setLoadingDescriptors(false);
          });

        // Step 3: Fetch Enrolled Students for active section
        let studentsList = [];
        try {
          const studentParams = new URLSearchParams();
          studentParams.append("limit", "2000");
          if (!isAll) studentParams.append("section", activeSection);
          if (activeSubjectId && activeSubjectId !== "all") {
            studentParams.append("subjectId", activeSubjectId);
          }

          const res = await api.get(`/users/students?${studentParams.toString()}`);
          studentsList = res.data?.data?.students || res.data?.data || res.data?.students || [];
        } catch (studentErr) {
          logError("Fetch students in face session", studentErr);
          studentsList = [];
        }

        const validStudents = Array.isArray(studentsList) ? studentsList : [];
        setEnrolledStudents(validStudents);

        if (validStudents.length > 0 && !enrollStudentId) {
          setEnrollStudentId(String(validStudents[0]._id || validStudents[0].id));
        }

        // Step 4: Pre-fetch today's already-marked attendance
        try {
          const todayIso = new Date().toISOString().split("T")[0];
          const queryParams = new URLSearchParams();
          if (!isAll) queryParams.append("section", activeSection);
          if (activeSubjectId) queryParams.append("subjectId", activeSubjectId);
          if (activeSlotId) queryParams.append("timetableId", activeSlotId);
          queryParams.append("date", todayIso);

          const attRes = await api.get(`/attendance?${queryParams.toString()}`);
          const records = attRes.data?.data || attRes.data || [];
          if (Array.isArray(records)) {
            const preMarked = new Set();
            records.forEach((r) => {
              const sid = r.student?.id || r.studentId?._id || r.studentId || r.userId;
              if (sid && (r.status === "present" || !r.status)) {
                preMarked.add(String(sid));
              }
            });
            setMarkedIds(preMarked);
          }
        } catch {
          // non-fatal
        }
      } catch (err) {
        logError("Fetch section roster & descriptors", err);
      } finally {
        setLoadingDescriptors(false);
      }
    };

    fetchRosterAndDescriptors();
  }, [selectedSection, selectedSubject, selectedSlot, currentSlot, currentSubjectObj]);

  // Automatically start / stop detection loop with camera
  useEffect(() => {
    if (cameraActive) {
      startLoop();
    } else {
      stopLoop();
    }
  }, [cameraActive, startLoop, stopLoop]);

  const [showSessionSummaryModal, setShowSessionSummaryModal] = useState(false);

  const handleStartCamera = async () => {
    setMarkResult(null);
    await startCamera();
    startLoop();
  };

  const handleStopCamera = () => {
    stopLoop();
    stopCamera();
    resetLiveness();
    setMarkResult(null);
    autoMarkingRef.current.clear();
    if (markedIds.size > 0 || enrolledStudents.length > 0) {
      setShowSessionSummaryModal(true);
    }
  };

  // 3. Mark Attendance Submission Handler (Single / Batch / Continuous)
  const submitAttendanceBatch = useCallback(
    async (studentsToMark) => {
      if (!studentsToMark || studentsToMark.length === 0) return;

      const timetableId = currentSlot?._id || filteredSlots[0]?._id;
      const subjectId = currentSlot?.subjectId?._id || currentSlot?.subjectId || selectedSubject;
      const targetSection = selectedSection || currentSlot?.section || "A";

      if (!timetableId) {
        setMarkResult({
          type: "error",
          message: "No timetable slot selected. Please select a valid timetable slot.",
        });
        return;
      }

      // Mark IDs as in-flight
      studentsToMark.forEach((s) => autoMarkingRef.current.add(String(s.studentId)));
      setMarking(true);

      try {
        // Offline Resilient Marking
        if (!navigator.onLine) {
          const offlinePayload = {
            timetableId,
            subjectId,
            section: targetSection,
            verifiedStudents: studentsToMark.map((v) => ({
              studentId: v.studentId,
              confidence: v.confidence || 0.95,
            })),
            timestamp: new Date().toISOString(),
            remarks: "Face attendance via AI Multi-Face Web Scanner (offline)",
            _faceDetectionOffline: true,
          };

          await saveToOfflineQueue(offlinePayload);
          setMarkedIds((prev) => {
            const next = new Set(prev);
            studentsToMark.forEach((v) => next.add(String(v.studentId)));
            return next;
          });

          setMarkResult({
            type: "success",
            marked: studentsToMark.length,
            isOffline: true,
            names: studentsToMark.map((s) => s.name).join(", "),
          });

          setShowFlash(true);
          setTimeout(() => setShowFlash(false), 400);
          return;
        }

        // Online API Submission
        const res = await api.post("/attendance/mark-face-detection", {
          timetableId,
          subjectId,
          section: targetSection,
          verifiedStudents: studentsToMark.map((v) => ({
            studentId: v.studentId,
            confidence: v.confidence || 0.95,
          })),
          timestamp: new Date().toISOString(),
          remarks: "Face attendance via AI Multi-Face Web Scanner",
        });

        const data = res.data;
        const newlyMarked = data.marked || studentsToMark.map((s) => s.studentId);

        setMarkedIds((prev) => {
          const next = new Set(prev);
          newlyMarked.forEach((id) => next.add(String(id)));
          return next;
        });

        setMarkResult({
          type: "success",
          marked: newlyMarked.length,
          skipped: data.skipped?.length || 0,
          names: studentsToMark.map((s) => s.name).join(", "),
        });

        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 400);
      } catch (err) {
        logError("Mark face attendance", err);
        // If network error, fallback to offline queue
        if (!err.response || err.code === "ERR_NETWORK") {
          try {
            const formattedAttendance = {};
            studentsToMark.forEach((v) => {
              if (v.studentId) formattedAttendance[v.studentId] = "present";
            });

            const offlinePayload = {
              subjectId,
              section: targetSection,
              date: new Date().toISOString().split("T")[0],
              timetableId,
              attendanceData: formattedAttendance,
            };

            await saveToOfflineQueue(offlinePayload);
            setMarkedIds((prev) => {
              const next = new Set(prev);
              studentsToMark.forEach((v) => next.add(String(v.studentId)));
              return next;
            });

            setMarkResult({
              type: "success",
              marked: studentsToMark.length,
              isOffline: true,
              names: studentsToMark.map((s) => s.name).join(", "),
            });
            setShowFlash(true);
            setTimeout(() => setShowFlash(false), 400);
            return;
          } catch (qErr) {
            logError("Queue offline fallback", qErr);
          }
        }

        setMarkResult({
          type: "error",
          message: err.response?.data?.message || "Failed to mark attendance for detected faces.",
        });
      } finally {
        setMarking(false);
      }
    },
    [currentSlot, filteredSlots, selectedSubject, selectedSection]
  );

  // 4. Countdown & Cooldown Timer Engine (Ticks every 1s when active)
  const hasActiveCountdowns = Object.keys(countdowns).length > 0;
  const hasActiveCooldowns = Object.keys(unauthorizedCooldowns).length > 0;

  useEffect(() => {
    if (!cameraActive || (!hasActiveCountdowns && !hasActiveCooldowns)) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      let countdownChanged = false;
      let cooldownChanged = false;

      // Decrement active countdowns
      const currentCountdowns = { ...countdownStateRef.current };
      const toMarkIds = [];

      for (const [sId, val] of Object.entries(currentCountdowns)) {
        const count = typeof val === "object" ? val.remainingSec : val;
        if (count > 1) {
          currentCountdowns[sId] = { remainingSec: count - 1 };
          countdownChanged = true;
        } else if (count === 1) {
          toMarkIds.push(sId);
          delete currentCountdowns[sId];
          countdownChanged = true;
        }
      }

      if (countdownChanged) {
        countdownStateRef.current = currentCountdowns;
        setCountdowns({ ...currentCountdowns });
      }

      // Execute auto-marks for students whose countdown reached 0s
      if (toMarkIds.length > 0) {
        const studentsToSubmit = toMarkIds
          .map((id) => {
            const det = detected.find((d) => String(d.studentId) === id);
            return {
              studentId: id,
              name: det?.name || "Verified Student",
              confidence: det?.confidence || 0.95,
            };
          })
          .filter((s) => !markedIds.has(String(s.studentId)) && !autoMarkingRef.current.has(String(s.studentId)));

        if (studentsToSubmit.length > 0) {
          submitAttendanceBatch(studentsToSubmit);
        }
      }

      // Decrement unauthorized cooldowns
      const currentCooldowns = { ...unauthorizedCooldownRef.current };
      for (const [trackKey, sec] of Object.entries(currentCooldowns)) {
        if (sec > 1) {
          currentCooldowns[trackKey] = sec - 1;
          cooldownChanged = true;
        } else {
          delete currentCooldowns[trackKey];
          cooldownChanged = true;
        }
      }

      if (cooldownChanged) {
        unauthorizedCooldownRef.current = currentCooldowns;
        setUnauthorizedCooldowns({ ...currentCooldowns });
      }
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [cameraActive, hasActiveCountdowns, hasActiveCooldowns, detected, markedIds, submitAttendanceBatch]);

  // Sync Detected Faces with 5-Second Countdown & Unauthorized Cooldown Manager
  useEffect(() => {
    if (!cameraActive) {
      countdownStateRef.current = {};
      setCountdowns({});
      return;
    }

    // 1. Sync Verified Faces to Countdowns
    const currentCountdowns = { ...countdownStateRef.current };
    let hasCountdownsChange = false;

    // Get current verified student IDs
    const currentVerifiedIds = new Set();

    detected.forEach((d, i) => {
      const sId = String(d.studentId || "");
      if (
        d.status === "verified" &&
        d.livenessPassed !== false &&
        sId &&
        !markedIds.has(sId) &&
        !autoMarkingRef.current.has(sId) &&
        (d.confidence || 0.9) >= 0.60
      ) {
        currentVerifiedIds.add(sId);
        if (autoMark && currentCountdowns[sId] === undefined) {
          currentCountdowns[sId] = { remainingSec: 5 };
          hasCountdownsChange = true;
        }
      } else if (d.status === "unrecognized" && !d.displayName?.includes("Scanning") && !d.displayName?.includes("Hold")) {
        const uKey = d.trackKey || d.name || `unrec-${i}`;
        if (unauthorizedCooldownRef.current[uKey] === undefined) {
          unauthorizedCooldownRef.current[uKey] = 5; // 5-second quiet cooldown
          setUnauthorizedCooldowns({ ...unauthorizedCooldownRef.current });
        }
      }
    });

    // Remove countdowns for students who left frame or dropped verification
    for (const sId of Object.keys(currentCountdowns)) {
      if (!currentVerifiedIds.has(sId)) {
        delete currentCountdowns[sId];
        hasCountdownsChange = true;
      }
    }

    if (hasCountdownsChange) {
      countdownStateRef.current = currentCountdowns;
      setCountdowns({ ...currentCountdowns });
    }
  }, [detected, autoMark, cameraActive, markedIds]);

  // Manual Batch Mark Trigger
  const handleManualMarkAll = () => {
    const unMarkedVerified = detected.filter(
      (d) => d.status === "verified" && d.livenessPassed !== false && d.studentId && !markedIds.has(String(d.studentId))
    );
    if (unMarkedVerified.length > 0) {
      submitAttendanceBatch(unMarkedVerified);
    }
  };

  // 5. Quick Face Enrollment from live stream
  const handleEnrollLiveFace = async () => {
    const liveTarget = detected.find((d) => d.rawDescriptor && d.rawDescriptor.length > 0);
    if (!liveTarget || !liveTarget.rawDescriptor) {
      setMarkResult({
        type: "error",
        message: "No live face detected to enroll. Look directly at the camera frame.",
      });
      return;
    }

    if (!enrollStudentId) {
      setMarkResult({
        type: "error",
        message: "Please select a student from the active section to enroll.",
      });
      return;
    }

    const liveVector = liveTarget.rawDescriptor;
    setEnrolling(true);
    try {
      const res = await api.post("/faces/register", {
        studentId: enrollStudentId,
        faceDescriptor: Array.from(liveVector),
      });

      if (res.data?.success) {
        const student = enrolledStudents.find((s) => String(s._id || s.id) === String(enrollStudentId));
        const updated = knownDescriptors.filter((k) => String(k.studentId) !== String(enrollStudentId));
        const newRecord = {
          studentId: enrollStudentId,
          name: student?.name || "Enrolled Student",
          rollNo: student?.rollNo || "",
          section: selectedSection,
          descriptor: liveVector,
          updatedAt: res.data?.faceUpdatedAt || new Date().toISOString(),
        };
        updated.push(newRecord);
        setKnownDescriptors(updated);

        // Save into IndexedDB cache for active section
        const currentTenantId = localStorage.getItem("tenantId") || "default";
        saveDescriptorsToIDB(currentTenantId, selectedSection, [newRecord]).catch(() => {});

        setMarkResult({
          type: "success",
          marked: 1,
          names: student?.name || "Student",
        });
        setShowQuickEnrollModal(false);
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 400);
      }
    } catch (err) {
      setMarkResult({
        type: "error",
        message: err.response?.data?.message || "Failed to register face biometrics",
      });
    } finally {
      setEnrolling(false);
    }
  };

  // Filtered Roster for the section with category tabs
  const [rosterTab, setRosterTab] = useState("all"); // "all" | "present" | "ready" | "missing"

  const filteredRoster = useMemo(() => {
    return enrolledStudents.filter((s) => {
      const studentId = String(s._id || s.id);
      const isMarked = markedIds.has(studentId);
      const hasFace = knownDescriptors.some((k) => String(k.studentId) === studentId);

      // Category tab filtering
      if (rosterTab === "present" && !isMarked) return false;
      if (rosterTab === "ready" && (!hasFace || isMarked)) return false;
      if (rosterTab === "missing" && hasFace) return false;

      // Text search
      const query = rosterSearch.toLowerCase().trim();
      if (!query) return true;
      const name = (s.name || `${s.firstName || ""} ${s.lastName || ""}`).toLowerCase();
      const roll = (s.rollNo || "").toLowerCase();
      return name.includes(query) || roll.includes(query);
    });
  }, [enrolledStudents, rosterSearch, rosterTab, markedIds, knownDescriptors]);

  const verifiedCount = detected.filter(
    (d) => d.status === "verified" && d.studentId && !markedIds.has(String(d.studentId))
  ).length;

  const totalMarkedCount = markedIds.size;
  const totalRosterCount = enrolledStudents.length;
  const missingBiometricsCount = Math.max(0, totalRosterCount - knownDescriptors.length);
  const attendancePercentage = totalRosterCount > 0 ? Math.round((totalMarkedCount / totalRosterCount) * 100) : 0;
  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Modern Hero & Metric Header Bar */}
        <div className="relative overflow-hidden bg-surface border border-line rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="relative">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20 shadow-sm">
                  <Camera className="w-7 h-7" />
                </div>
                {cameraActive && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-surface rounded-full animate-ping" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center flex-wrap gap-2">
                  <h1 className="text-2xl font-extrabold text-ink tracking-tight">AI Face Attendance</h1>
                  <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-full flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Multi-Face Scanner
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-ink-soft">
                  5-Second continuous auto-mark verification & real-time biometric matching
                </p>
              </div>
            </div>

            {/* Header Actions & Live Metrics Strip */}
            <div className="flex items-center flex-wrap gap-3">
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <div className="bg-surface border border-line rounded-2xl px-3.5 py-2 text-center min-w-[75px]">
                  <p className="text-[10px] font-bold text-ink-soft uppercase">Roster</p>
                  <p className="text-base font-extrabold text-ink">{totalRosterCount}</p>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-2xl px-3.5 py-2 text-center min-w-[75px]">
                  <p className="text-[10px] font-bold text-primary uppercase">Face Vectors</p>
                  <p className="text-base font-extrabold text-primary">{knownDescriptors.length}</p>
                </div>
                <div className="bg-surface border border-line rounded-2xl px-3.5 py-2 text-center min-w-[75px]">
                  <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Present</p>
                  <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{totalMarkedCount}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsRosterDrawerOpen(true)}
                className="px-4 py-2.5 bg-surface-alt hover:bg-surface border border-line hover:border-primary/40 text-ink rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
              >
                <Users className="w-4 h-4 text-primary" />
                <span>Class Roster</span>
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-extrabold">
                  {totalMarkedCount}/{totalRosterCount}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Model Loading Progress Banner */}
        {!modelsReady && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 shadow-sm">
            <Loader className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                {modelError ? "Face Model Initialization Error" : `Loading Face-API Neural Nets (${modelProgress}%)`}
              </p>
              {modelError ? (
                <p className="text-xs text-amber-600 mt-0.5">{modelError}</p>
              ) : (
                <div className="mt-2 w-full bg-amber-500/20 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${modelProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Class & Session Configuration Card */}
        <div className="bg-surface border border-line rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Target Class & Timetable Schedule</h3>
                <p className="text-xs text-ink-soft">Select your assigned subject, section, and live timetable session</p>
              </div>
            </div>

            {((selectedSection && selectedSection !== "all") || selectedSubject) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 rounded-xl border border-line bg-surface-alt hover:bg-surface hover:border-primary/40 text-ink-soft hover:text-ink text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5 text-primary" />
                <span>Reset Selection</span>
              </button>
            )}
          </div>

          {/* Subject & Timetable Schedule Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* 1. Subject Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink-soft">
                  My Assigned Subject
                </label>
                <span className="text-[11px] font-semibold text-ink-soft">
                  {assignedSubjects.length} available
                </span>
              </div>
              <select
                value={selectedSubject}
                onChange={(e) => handleSubjectChange(e.target.value)}
                disabled={loadingInitial || assignedSubjects.length === 0}
                className="w-full rounded-2xl border border-line bg-surface-alt px-3.5 py-2.5 text-sm text-ink font-bold focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50"
              >
                <option value="">-- Select Subject --</option>
                {assignedSubjects.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.subjectName} ({s.subjectCode}){s.branch ? ` · ${s.branch}` : ""}{s.sections?.length ? ` · Sec ${s.sections.join(", ")}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Strictly Scoped Class Section Tabs */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink-soft">
                  Class Section
                </label>
                {selectedSection && selectedSection !== "all" ? (
                  <button
                    type="button"
                    onClick={() => handleSectionChange("all")}
                    className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
                  >
                    ✕ Show All Sections
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-primary">
                    All Sections Active
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSectionChange("all")}
                  className={`flex-1 min-w-[70px] py-2 px-3 rounded-2xl text-xs font-extrabold transition-all border shadow-sm ${
                    !selectedSection || selectedSection === "all"
                      ? "bg-primary text-white border-primary shadow-primary/20"
                      : "bg-surface-alt border-line text-ink-soft hover:bg-surface hover:text-ink"
                  }`}
                >
                  All
                </button>
                {availableSections.map((sec) => {
                  const isSelected = selectedSection?.toUpperCase() === sec.toUpperCase();
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleSectionChange(sec)}
                      className={`min-w-[60px] py-2 px-3 rounded-2xl text-xs font-extrabold transition-all border shadow-sm ${
                        isSelected
                          ? "bg-primary text-white border-primary shadow-primary/20"
                          : "bg-surface-alt border-line text-ink-soft hover:bg-surface hover:text-ink"
                      }`}
                    >
                      Sec {sec}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Timetable Slot Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink-soft">Timetable Slot</label>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Today: {todayDayName}
                </span>
              </div>
              <select
                value={selectedSlot}
                onChange={(e) => handleSlotChange(e.target.value)}
                disabled={loadingInitial || filteredSlots.length === 0}
                className="w-full rounded-2xl border border-line bg-surface-alt px-3.5 py-2.5 text-sm text-ink font-bold focus:ring-2 focus:ring-primary/20 focus:outline-none disabled:opacity-50"
              >
                <option value="">
                  {filteredSlots.length === 0 ? "No timetable slots scheduled" : "-- Select Timetable Slot --"}
                </option>
                {todaySlots.length > 0 && (
                  <optgroup label={`Today's Scheduled Sessions (${todayDayName})`}>
                    {todaySlots.map((slot) => (
                      <option key={slot._id} value={slot._id}>
                        {slot.subjectName ? `${slot.subjectName} · ` : ""}
                        {slot.day} {slot.startTime}–{slot.endTime} | Sec {slot.section || slot.class}
                        {slot.room ? ` (${slot.room})` : ""} [Today]
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherSlots.length > 0 && (
                  <optgroup label="Other Days (Restricted to Live Day)">
                    {otherSlots.map((slot) => (
                      <option key={slot._id} value={slot._id} disabled>
                        {slot.subjectName ? `${slot.subjectName} · ` : ""}
                        {slot.day} {slot.startTime}–{slot.endTime} | Sec {slot.section || slot.class} (Not Today)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Unified Main Workstation: Camera & Single Live Tracking Box */}
        <div className="space-y-5">
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-4 shadow-sm">
            {/* Scanner Top Controls & Auto-Mark Mode Switch */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoMark(!autoMark)}
                  className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    autoMark
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-surface-alt text-ink-soft border border-line hover:text-ink"
                  }`}
                  title="5-Second Auto-Mark automatically records attendance after countdown"
                >
                  <Zap className={`w-3.5 h-3.5 ${autoMark ? "text-emerald-500 fill-emerald-500" : ""}`} />
                  <span>{autoMark ? "5s Auto-Mark: Active" : "Manual Click Mode"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setChallengeMode(!challengeMode);
                    resetLiveness();
                  }}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition border cursor-pointer ${
                    challengeMode
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "bg-surface-alt border-line text-ink-soft hover:text-ink"
                  }`}
                >
                  {challengeMode ? "Strict 3D Liveness" : "Fast Passive Scan"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowQuickEnrollModal(true)}
                  className="px-3.5 py-2 bg-surface-alt hover:bg-surface border border-line hover:border-primary/40 rounded-2xl text-xs font-bold text-ink transition flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-primary" />
                  <span>Quick Face Enrollment</span>
                </button>
              </div>
            </div>

            {/* Camera Video Viewfinder with Multi-Face Canvas HUD */}
            <div className="cam-container">
              <video
                ref={videoRef}
                className="cam-video"
                playsInline
                muted
                onPlay={startLoop}
                onLoadedMetadata={startLoop}
              />
              <canvas ref={canvasRef} className="cam-canvas" />
              {cameraActive && (
                <FaceOverlay
                  detected={detected}
                  fps={fps}
                  isLive={isLive}
                  livenessScore={livenessScore}
                  challengeInstruction={challengeInstruction}
                  challengeStep={challengeStep}
                  showFlash={showFlash}
                  activeSection={selectedSection}
                  autoMark={autoMark}
                  countdowns={countdowns}
                  unauthorizedCooldowns={unauthorizedCooldowns}
                />
              )}
              {!cameraActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 bg-neutral-950/90 rounded-2xl p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 shadow-inner">
                    <Camera className="w-8 h-8 text-white/60" />
                  </div>
                  <p className="text-base font-bold text-white">Camera Scanner Offline</p>
                  <p className="text-xs text-white/50 max-w-xs mt-1">
                    {!selectedSubject
                      ? "Select an assigned subject above to start"
                      : !selectedSection
                      ? "Select a class section above to start"
                      : currentSlot && !isCurrentSlotToday
                      ? `Scheduled for ${currentSlot.day}, but today is ${todayDayName}`
                      : "Click 'Start Scanner' below to begin live biometric attendance"}
                  </p>
                </div>
              )}
            </div>

            {cameraError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {cameraError}
              </div>
            )}

            {/* Primary Action Buttons: Start, Stop, Batch Mark */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={handleStartCamera}
                  disabled={!modelsReady}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary/90 text-white rounded-2xl font-extrabold text-sm disabled:opacity-50 transition shadow-lg shadow-primary/25 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Start Camera Scanner (Sec {selectedSection || "A"})
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleStopCamera}
                    className="px-5 py-3.5 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-extrabold text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CameraOff className="w-4 h-4" /> Stop Scanner
                  </button>

                  <button
                    type="button"
                    onClick={handleManualMarkAll}
                    disabled={marking || verifiedCount === 0}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-extrabold text-sm text-white transition shadow-sm ${
                      verifiedCount > 0
                        ? "bg-emerald-600 hover:bg-emerald-500 glow-badge cursor-pointer"
                        : "bg-emerald-800/40 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    {marking ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Mark {verifiedCount > 0 ? `${verifiedCount} Detected Face${verifiedCount > 1 ? "s" : ""}` : "Verified Faces Now"}
                  </button>
                </>
              )}
            </div>

            {/* Result Flash Notification Banner */}
            {markResult && (
              <div
                className={`p-3.5 rounded-2xl flex items-center gap-3 text-xs font-semibold border transition-all ${
                  markResult.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                }`}
              >
                {markResult.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                )}
                <span className="flex-1">
                  {markResult.type === "success"
                    ? markResult.isOffline
                      ? `📶 Offline Queued: ${markResult.names || `${markResult.marked} student(s)`} saved locally.`
                      : `✓ Attendance marked for ${markResult.names || `${markResult.marked} student(s)`}.`
                    : markResult.message}
                </span>
                <button
                  type="button"
                  onClick={() => setMarkResult(null)}
                  className="p-1 hover:bg-black/10 rounded-lg cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* SINGLE DEDICATED LIVE TRACKING BOX */}
          <div className="bg-surface border border-line rounded-2xl p-5 space-y-3 shadow-sm">
            <DetectedPanel
              detected={detected}
              markedIds={markedIds}
              autoMark={autoMark}
              countdowns={countdowns}
              unauthorizedCooldowns={unauthorizedCooldowns}
              roster={enrolledStudents}
              onQuickMark={(sId) => submitAttendanceBatch([{ studentId: sId }])}
              onOpenQuickEnroll={() => setShowQuickEnrollModal(true)}
            />
          </div>
        </div>

        {/* Slide-Over Class Roster Drawer */}
        {isRosterDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div
              className="drawer-backdrop"
              onClick={() => setIsRosterDrawerOpen(false)}
            />
            <div className="drawer-panel p-5 space-y-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-ink">Section {selectedSection || "—"} Roster</h3>
                    <p className="text-[11px] text-ink-soft font-semibold">
                      {totalMarkedCount} of {totalRosterCount} Present ({attendancePercentage}%)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRosterDrawerOpen(false)}
                  className="p-1.5 hover:bg-surface-alt rounded-xl text-ink-soft hover:text-ink transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Roster Filter Tabs */}
              <div className="flex gap-1 bg-surface-alt p-1 rounded-2xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setRosterTab("all")}
                  className={`flex-1 py-1.5 px-2 rounded-xl transition cursor-pointer ${
                    rosterTab === "all" ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  All ({totalRosterCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterTab("present")}
                  className={`flex-1 py-1.5 px-2 rounded-xl transition cursor-pointer ${
                    rosterTab === "present" ? "bg-surface text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  Present ({totalMarkedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterTab("ready")}
                  className={`flex-1 py-1.5 px-2 rounded-xl transition cursor-pointer ${
                    rosterTab === "ready" ? "bg-surface text-primary shadow-sm" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  Ready ({knownDescriptors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterTab("missing")}
                  className={`flex-1 py-1.5 px-2 rounded-xl transition cursor-pointer ${
                    rosterTab === "missing" ? "bg-surface text-amber-600 dark:text-amber-400 shadow-sm" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  Missing ({missingBiometricsCount})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-ink-soft absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-surface-alt border border-line rounded-2xl text-xs text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Roster Student List */}
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {filteredRoster.map((student) => {
                  const studentId = String(student._id || student.id);
                  const isMarked = markedIds.has(studentId);
                  const hasFace = knownDescriptors.some(
                    (k) => String(k.studentId) === studentId
                  );

                  return (
                    <div
                      key={studentId}
                      className={`roster-card ${isMarked ? "marked" : hasFace ? "registered" : ""}`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 shadow-sm ${
                            isMarked
                              ? "bg-emerald-500 text-white"
                              : hasFace
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-surface-alt text-ink-soft border border-line"
                          }`}
                        >
                          {isMarked ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            (student.name || "S")[0].toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-ink truncate">
                            {student.name || `${student.firstName || ""} ${student.lastName || ""}`}
                          </p>
                          <p className="text-[11px] text-ink-soft truncate font-medium">
                            {student.rollNo || "No Roll"} · Sec {student.section || selectedSection}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {isMarked ? (
                          <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Present
                          </span>
                        ) : hasFace ? (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Face Ready
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEnrollStudentId(studentId);
                              setShowQuickEnrollModal(true);
                            }}
                            className="px-2 py-0.5 bg-surface-alt hover:bg-primary/10 text-ink-soft hover:text-primary border border-line hover:border-primary/30 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3" /> Enroll
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredRoster.length === 0 && (
                  <div className="text-center py-10 text-ink-soft">
                    <p className="text-xs font-bold">No students found</p>
                    <p className="text-[11px] opacity-70 mt-1">
                      {enrolledStudents.length === 0
                        ? `No students enrolled in Section ${selectedSection || "selected"}`
                        : "Try a different search query or filter tab"}
                    </p>
                  </div>
                )}
              </div>

              {/* Roster Footer Action */}
              <div className="pt-3 border-t border-line flex items-center justify-between text-xs font-semibold">
                <span className="text-ink-soft">
                  Biometrics: <strong className="text-ink">{knownDescriptors.length} / {totalRosterCount}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShowQuickEnrollModal(true)}
                  className="text-primary hover:text-primary/80 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Quick Enroll
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Face Enrollment Modal */}
        {showQuickEnrollModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-line rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <UserPlus className="w-4 h-4 text-primary" />
                  <span>Quick Live Face Enrollment (Sec {selectedSection})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickEnrollModal(false)}
                  className="p-1 hover:bg-surface-alt rounded-lg text-ink-soft hover:text-ink cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-ink-soft">Target Student in Section {selectedSection}</label>
                  <select
                    value={enrollStudentId}
                    onChange={(e) => setEnrollStudentId(e.target.value)}
                    className="w-full bg-surface-alt border border-line rounded-2xl px-3.5 py-2.5 text-xs text-ink font-bold focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  >
                    {enrolledStudents.map((s) => (
                      <option key={s._id || s.id} value={s._id || s.id}>
                        {s.name} ({s.rollNo || "No Roll"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-2xl text-xs text-ink-soft space-y-1.5">
                  <p className="font-bold text-ink">Instructions:</p>
                  <p>1. Start the camera and ask the student to look directly into the frame.</p>
                  <p>2. Click <strong>"Capture & Register"</strong> below to generate their 128-dimensional biometric embedding.</p>
                  <p className="text-[11px] opacity-75 font-medium">100% Vector-Only Privacy: Zero raw facial photos stored.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowQuickEnrollModal(false)}
                  className="px-4 py-2.5 bg-surface-alt hover:bg-surface border border-line rounded-2xl text-xs font-bold text-ink transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEnrollLiveFace}
                  disabled={enrolling || !cameraActive || detected.length === 0}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-2xl text-xs font-extrabold transition flex items-center gap-1.5 disabled:opacity-50 shadow-md shadow-primary/25 cursor-pointer"
                >
                  {enrolling ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Capture & Register Live Face
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Post-Session Review & Summary Modal (Fix J) */}
        {showSessionSummaryModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-line rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-ink">Session Attendance Summary</h3>
                    <p className="text-[11px] text-ink-soft">
                      Section {selectedSection || "—"} · {totalMarkedCount} of {totalRosterCount} Present ({attendancePercentage}%)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSessionSummaryModal(false)}
                  className="p-1 hover:bg-surface-alt rounded-lg text-ink-soft hover:text-ink cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 bg-surface-alt rounded-2xl border border-line">
                  <span className="text-[10px] text-ink-soft block font-semibold">Total Roster</span>
                  <span className="text-base font-extrabold text-ink">{totalRosterCount}</span>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-semibold">Present</span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">{totalMarkedCount}</span>
                </div>
                <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 block font-semibold">Absent / Unmarked</span>
                  <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">{Math.max(0, totalRosterCount - totalMarkedCount)}</span>
                </div>
              </div>

              {/* Unmarked Student Review Checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-ink">
                  <span>Unmarked / Absent Students Review:</span>
                  <span className="text-[11px] text-ink-soft font-normal">Tap to override if present</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 bg-surface-alt/50 border border-line rounded-2xl">
                  {enrolledStudents.filter((s) => !markedIds.has(String(s._id || s.id))).length === 0 ? (
                    <div className="text-center py-4 text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>100% Attendance! All students in section marked present.</span>
                    </div>
                  ) : (
                    enrolledStudents
                      .filter((s) => !markedIds.has(String(s._id || s.id)))
                      .map((student) => {
                        const sId = String(student._id || student.id);
                        return (
                          <div
                            key={sId}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-surface border border-line text-xs"
                          >
                            <div className="truncate">
                              <span className="font-bold text-ink">{student.name}</span>
                              {student.rollNo && (
                                <span className="text-ink-soft text-[10px] ml-1">({student.rollNo})</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => submitAttendanceBatch([{ studentId: sId }])}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-lg shadow-sm transition flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> Mark Present
                            </button>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => {
                    setShowSessionSummaryModal(false);
                    handleStartCamera();
                  }}
                  className="px-4 py-2.5 bg-surface-alt hover:bg-surface border border-line rounded-2xl text-xs font-bold text-ink transition cursor-pointer flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5 text-primary" />
                  <span>Resume Scanner</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSessionSummaryModal(false)}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-2xl text-xs font-extrabold transition shadow-md shadow-primary/25 cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Finalize & Close Session</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Academic Empirical Research Evaluation Floating Dock */}
        <AcademicEvalDock
          detected={detected}
          activeSection={selectedSection || "A"}
          knownDescriptors={knownDescriptors}
          cameraActive={cameraActive}
          onStartCamera={handleStartCamera}
          onStopCamera={handleStopCamera}
        />
      </div>
    </div>
  );
};

export default TeacherFaceSession;
