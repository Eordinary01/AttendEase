import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  CameraOff,
  CheckCircle,
  AlertCircle,
  Loader,
  Users,
  Sparkles,
  Upload,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  Search,
  ArrowRight,
  BookOpen,
  Layers,
  Check,
  GraduationCap,
  GitBranch,
  Calendar,
  RotateCcw,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Hash,
} from "lucide-react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import { saveDescriptorsToIDB } from "../../utils/idbStorage";
import useFaceModels from "../../hooks/useFaceModels";
import useCamera from "../../hooks/useCamera";
import { estimatePoseAngles, computeLaplacianVariance } from "../../utils/biometricEvalLogger";
import "./faceAttendance.css";

// Module-level static branch aliases
const BRANCH_ALIASES = {
  "CSE": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "CS": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE & ENGINEERING": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "COMPUTER SCIENCE AND ENGINEERING": ["CSE", "CS", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING", "COMPUTER SCIENCE AND ENGINEERING"],
  "IT": ["IT", "INFORMATION TECHNOLOGY"],
  "INFORMATION TECHNOLOGY": ["IT", "INFORMATION TECHNOLOGY"],
  "ECE": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION", "ELECTRONICS & COMMUNICATION ENGINEERING", "ELECTRONICS AND COMMUNICATION ENGINEERING"],
  "ELECTRONICS": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION", "ELECTRONICS & COMMUNICATION ENGINEERING", "ELECTRONICS AND COMMUNICATION ENGINEERING"],
  "ELECTRONICS & COMMUNICATION": ["ECE", "ELECTRONICS", "ELECTRONICS & COMMUNICATION", "ELECTRONICS & COMMUNICATION ENGINEERING", "ELECTRONICS AND COMMUNICATION ENGINEERING"],
  "EE": ["EE", "EEE", "ELECTRICAL", "ELECTRICAL & ELECTRONICS", "ELECTRICAL & ELECTRONICS ENGINEERING", "ELECTRICAL ENGINEERING"],
  "EEE": ["EE", "EEE", "ELECTRICAL", "ELECTRICAL & ELECTRONICS", "ELECTRICAL & ELECTRONICS ENGINEERING", "ELECTRICAL ENGINEERING"],
  "ELECTRICAL": ["EE", "EEE", "ELECTRICAL", "ELECTRICAL & ELECTRONICS", "ELECTRICAL & ELECTRONICS ENGINEERING", "ELECTRICAL ENGINEERING"],
  "ME": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "MECHANICAL": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "MECHANICAL ENGINEERING": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
  "CE": ["CE", "CIVIL", "CIVIL ENGINEERING"],
  "CIVIL": ["CE", "CIVIL", "CIVIL ENGINEERING"],
  "CIVIL ENGINEERING": ["CE", "CIVIL", "CIVIL ENGINEERING"],
  "CHEM": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "CHEMISTRY": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "CHEMICAL": ["CHEM", "CHEMISTRY", "CHEMICAL", "CHEMICAL ENGINEERING"],
  "AIML": ["AIML", "AI & ML", "AI/ML", "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING", "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING"],
  "AI & ML": ["AIML", "AI & ML", "AI/ML", "ARTIFICIAL INTELLIGENCE & MACHINE LEARNING", "ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING"],
  "AIDS": ["AIDS", "AI & DS", "AI/DS", "ARTIFICIAL INTELLIGENCE & DATA SCIENCE", "ARTIFICIAL INTELLIGENCE AND DATA SCIENCE"],
  "DS": ["DS", "DATA SCIENCE"],
  "DATA SCIENCE": ["DS", "DATA SCIENCE"],
  "CY": ["CY", "CYBER", "CYBER SECURITY", "CYBERSECURITY"],
  "CYBER SECURITY": ["CY", "CYBER", "CYBER SECURITY", "CYBERSECURITY"],
  "RA": ["RA", "ROBOTICS", "ROBOTICS & AUTOMATION", "ROBOTICS AND AUTOMATION"],
  "ROBOTICS": ["RA", "ROBOTICS", "ROBOTICS & AUTOMATION", "ROBOTICS AND AUTOMATION"],
  "MKT": ["MKT", "MARKETING"],
  "MARKETING": ["MKT", "MARKETING"],
  "FIN": ["FIN", "FINANCE"],
  "FINANCE": ["FIN", "FINANCE"],
  "HR": ["HR", "HUMAN RESOURCES", "HUMAN RESOURCE MANAGEMENT"],
  "IB": ["IB", "INTERNATIONAL BUSINESS"],
  "GM": ["GM", "GENERAL MANAGEMENT"],
  "VLSI": ["VLSI", "VLSI DESIGN"],
};

export default function FaceRegistration() {
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | needs_enrollment | enrolled

  // Role and Teacher Scoping State
  const userRole = localStorage.getItem("role") || "teacher";
  const userId = localStorage.getItem("userId");
  const isAdmin = userRole === "admin" || userRole === "super_admin";

  // Academic Structure Filters for Admin
  const [coursesList, setCoursesList] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedSemester, setSelectedSemester] = useState("all");

  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");

  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState(null);
  const [autoLockCountdown, setAutoLockCountdown] = useState(0); // 0-100 progress for auto-lock ring
  const [shutterFlash, setShutterFlash] = useState(false); // Visual feedback flash on snap

  const [liveQuality, setLiveQuality] = useState({
    faceDetected: false,
    score: 0,
    message: "Point your face directly at the camera",
    isGoodPose: false,
  });

  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const autoLockStartRef = useRef(null); // timestamp when alignment started
  const autoCapturePendingRef = useRef(false); // prevent double-fire
  const capturePhotoRef = useRef(null); // always points to latest handleCapturePhoto

  const { ready: modelsReady, progress: modelProgress, error: modelError } = useFaceModels();
  const { videoRef, active: cameraActive, start: startCamera, stop: stopCamera } = useCamera({ facingMode: "user" });

  // 1. Fetch Teacher Subject & Section Assignments
  useEffect(() => {
    if (isAdmin || userRole === "student") return;

    const fetchTeacherAssignments = async () => {
      try {
        const [subRes, slotRes] = await Promise.allSettled([
          api.get(`/subjects/teacher/${userId}/assignments`),
          api.get("/timetable/teacher"),
        ]);

        const rawAssignments =
          subRes.status === "fulfilled"
            ? subRes.value.data?.data?.assignedSubjects?.subjects ||
              subRes.value.data?.data?.subjects ||
              subRes.value.data?.subjects ||
              subRes.value.data?.data ||
              []
            : [];

        const slots =
          slotRes.status === "fulfilled"
            ? slotRes.value.data?.data?.slots || slotRes.value.data?.data || slotRes.value.data?.entries || []
            : [];

        // Group subjects and sections
        const subjectMap = new Map();
        rawAssignments.forEach((item) => {
          const sub = item.subject || item;
          const subId = String(sub._id || sub.id || "");
          if (!subId) return;

          if (!subjectMap.has(subId)) {
            subjectMap.set(subId, {
              _id: subId,
              subjectName: sub.subjectName || sub.name || "Subject",
              subjectCode: sub.subjectCode || sub.code || "",
              courseId: sub.courseId,
              branch: sub.branch,
              semester: sub.semester,
              sections: new Set(),
            });
          }
          if (item.section) subjectMap.get(subId).sections.add(item.section.trim().toUpperCase());
        });

        // Add subjects from timetable slots
        if (Array.isArray(slots)) {
          slots.forEach((slot) => {
            const subId = String(slot.subjectId?._id || slot.subjectId || "");
            if (!subId) return;

            if (!subjectMap.has(subId)) {
              subjectMap.set(subId, {
                _id: subId,
                subjectName: slot.subjectName || slot.subjectId?.subjectName || "Subject",
                subjectCode: slot.subjectCode || slot.subjectId?.subjectCode || "",
                courseId: slot.courseId,
                branch: slot.branch,
                semester: slot.semester,
                sections: new Set(),
              });
            }
            if (slot.section) subjectMap.get(subId).sections.add(slot.section.trim().toUpperCase());
          });
        }

        const subjectList = Array.from(subjectMap.values()).map((s) => ({
          ...s,
          sections: Array.from(s.sections),
        }));

        if (subjectList.length === 0) {
          try {
            const allSubRes = await api.get("/subjects/all");
            const allSubList = allSubRes.data?.data || allSubRes.data?.subjects || allSubRes.data || [];
            if (Array.isArray(allSubList) && allSubList.length > 0) {
              const mapped = allSubList.map((s) => ({
                _id: String(s._id || s.id),
                subjectName: s.subjectName || s.name || "Subject",
                subjectCode: s.subjectCode || s.code || "",
                courseId: s.courseId,
                branch: s.branch,
                semester: s.semester,
                sections: s.sections || ["A", "B"],
              }));
              setTeacherSubjects(mapped);
            }
          } catch {
            // fallback
          }
        } else {
          setTeacherSubjects(subjectList);
        }

        setSelectedSubject("all");
        setSelectedSection("all");
      } catch (err) {
        logError("Fetch teacher assignments for registration", err);
      }
    };

    fetchTeacherAssignments();
  }, [isAdmin, userRole, userId]);

  // Fetch Academic Courses for Admin
  useEffect(() => {
    if (!isAdmin) return;
    const fetchCourses = async () => {
      try {
        const res = await api.get("/academic/courses");
        const list = res.data?.data || res.data || [];
        if (Array.isArray(list)) {
          setCoursesList(list);
        }
      } catch (err) {
        logError("Fetch courses for registration", err);
      }
    };
    fetchCourses();
  }, [isAdmin]);

  const matchBranch = useCallback((filterBranch, itemBranch) => {
    if (!filterBranch || filterBranch === "all") return true;
    if (!itemBranch) return true;
    const fUpper = String(filterBranch).trim().toUpperCase();
    const iUpper = String(itemBranch).trim().toUpperCase();
    if (fUpper === iUpper) return true;
    const fAliases = BRANCH_ALIASES[fUpper] || [fUpper];
    const iAliases = BRANCH_ALIASES[iUpper] || [iUpper];
    return (
      fAliases.includes(iUpper) ||
      iAliases.includes(fUpper) ||
      fAliases.some((a) => iAliases.includes(a)) ||
      fUpper.includes(iUpper) ||
      iUpper.includes(fUpper)
    );
  }, []);

  const matchCourse = useCallback((filterCourse, item) => {
    if (!filterCourse || filterCourse === "all") return true;
    const fStr = String(filterCourse).trim().toLowerCase();

    const foundCourse = coursesList.find(
      (c) => String(c._id).toLowerCase() === fStr || String(c.code).toLowerCase() === fStr || String(c.name).toLowerCase() === fStr
    );

    const targetIds = [fStr];
    const targetCodes = [fStr];
    const targetNames = [fStr];
    if (foundCourse) {
      targetIds.push(String(foundCourse._id).toLowerCase());
      if (foundCourse.code) targetCodes.push(String(foundCourse.code).toLowerCase());
      if (foundCourse.name) targetNames.push(String(foundCourse.name).toLowerCase());
    }

    const iCourseId = String(item?.courseId?._id || item?.courseId || "").trim().toLowerCase();
    const iCourseCode = String(item?.courseCode || item?.courseId?.code || "").trim().toLowerCase();
    const iCourseName = String(item?.courseName || item?.courseId?.name || "").trim().toLowerCase();

    return (
      (iCourseId && targetIds.includes(iCourseId)) ||
      (iCourseCode && targetCodes.includes(iCourseCode)) ||
      (iCourseName && targetNames.includes(iCourseName)) ||
      (!iCourseId && !iCourseCode && !iCourseName)
    );
  }, [coursesList]);

  // Current Subject Object
  const currentSubjectObj = useMemo(() => {
    if (selectedSubject === "all") return null;
    return teacherSubjects.find((s) => String(s._id) === String(selectedSubject)) || null;
  }, [teacherSubjects, selectedSubject]);

  // Available Branches dynamically derived from selected course or coursesList
  const availableBranches = useMemo(() => {
    if (!isAdmin) return [];
    if (selectedCourse === "all") {
      const allBranches = new Set();
      coursesList.forEach((c) => {
        if (Array.isArray(c.branches)) {
          c.branches.forEach((b) => {
            const bName = typeof b === "string" ? b : (b.name || b.code);
            if (bName) allBranches.add(bName.trim());
          });
        }
      });
      students.forEach((s) => {
        if (s.branch) allBranches.add(s.branch.trim());
      });
      return Array.from(allBranches).sort();
    }

    const foundCourse = coursesList.find(
      (c) => String(c._id) === String(selectedCourse) || c.code === selectedCourse || c.name === selectedCourse
    );
    if (foundCourse && Array.isArray(foundCourse.branches) && foundCourse.branches.length > 0) {
      return foundCourse.branches.map((b) => (typeof b === "string" ? b : (b.name || b.code))).filter(Boolean);
    }
    const stuBranches = new Set();
    students.forEach((s) => {
      if (s.branch) stuBranches.add(s.branch.trim());
    });
    return Array.from(stuBranches).sort();
  }, [isAdmin, selectedCourse, coursesList, students]);

  // Available Sections strictly scoped to the teacher's selected subject or student roster
  const availableSections = useMemo(() => {
    if (isAdmin) {
      const secs = new Set(["A", "B", "C", "D"]);
      students.forEach((s) => {
        if (s.section) secs.add(s.section.trim().toUpperCase());
      });
      return Array.from(secs).sort();
    }

    if (currentSubjectObj && currentSubjectObj.sections.length > 0) {
      return currentSubjectObj.sections.sort();
    }

    const allSecs = new Set();
    teacherSubjects.forEach((s) => {
      if (Array.isArray(s.sections)) {
        s.sections.forEach((sec) => sec && allSecs.add(String(sec).trim().toUpperCase()));
      }
    });
    return Array.from(allSecs).sort();
  }, [isAdmin, currentSubjectObj, teacherSubjects, students]);

  // 2. Fetch Students (Teacher Scope vs Admin vs Student)
  useEffect(() => {
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        if (userRole === "student") {
          setSelectedStudentId(userId);
          const res = await api.get(`/users/${userId}`);
          if (res.data?.data) {
            setStudents([res.data.data]);
          }
        } else {
          const params = new URLSearchParams();
          params.append("limit", "2000");

          if (selectedSection && selectedSection !== "all") {
            params.append("section", selectedSection);
          }
          if (selectedSubject && selectedSubject !== "all") {
            params.append("subjectId", selectedSubject);
          }
          if (isAdmin) {
            if (selectedCourse && selectedCourse !== "all") {
              params.append("courseId", selectedCourse);
            }
            if (selectedBranch && selectedBranch !== "all") {
              params.append("branch", selectedBranch);
            }
            if (selectedSemester && selectedSemester !== "all") {
              params.append("semester", selectedSemester);
            }
          }

          const res = await api.get(`/users/students?${params.toString()}`);
          const list = res.data?.data?.students || res.data?.data || [];
          const studentArr = Array.isArray(list) ? list : [];
          setStudents(studentArr);

          if (studentArr.length > 0) {
            setSelectedStudentId((prev) => {
              const exists = studentArr.find((s) => String(s._id || s.id) === String(prev));
              return exists ? prev : String(studentArr[0]._id || studentArr[0].id);
            });
          } else {
            setSelectedStudentId("");
          }
        }
      } catch (err) {
        logError("Fetch students for registration", err);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [userRole, userId, selectedSection, selectedSubject, selectedCourse, selectedBranch, selectedSemester, isAdmin]);

  // Admin filter handlers
  const handleCourseChange = (courseVal) => {
    setSelectedCourse(courseVal);
    setSelectedBranch("all");
    setSelectedSection("all");
  };

  const handleBranchChange = (branchVal) => {
    setSelectedBranch(branchVal);
    setSelectedSection("all");
  };

  const handleResetFilters = () => {
    setSelectedCourse("all");
    setSelectedBranch("all");
    setSelectedSemester("all");
    setSelectedSection("all");
    setSelectedSubject("all");
    setSearchQuery("");
    setStatusFilter("all");
  };

  // Subject Switch Handler
  const handleSubjectChange = (newSubId) => {
    setSelectedSubject(newSubId);
    if (newSubId !== "all") {
      const found = teacherSubjects.find((s) => String(s._id) === String(newSubId));
      if (found && Array.isArray(found.sections) && found.sections.length > 0) {
        setSelectedSection(found.sections[0]);
      } else {
        setSelectedSection("all");
      }
    } else {
      setSelectedSection("all");
    }
  };

  // Filtered student list (Search + Status Filter)
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const isEnrolled = Boolean(
        s.faceRegistered ||
        s.isFaceRegistered ||
        (s.faceDescriptor && s.faceDescriptor.length > 0) ||
        s.faceImageUrl
      );
      if (statusFilter === "enrolled" && !isEnrolled) return false;
      if (statusFilter === "needs_enrollment" && isEnrolled) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (s.name || `${s.firstName || ""} ${s.lastName || ""}`).toLowerCase().includes(q);
      const rollMatch = (s.rollNo || s.enrollmentNumber || "").toLowerCase().includes(q);
      const secMatch = (s.section || "").toLowerCase().includes(q);
      const branchMatch = (s.branch || "").toLowerCase().includes(q);
      const courseMatch = (s.courseName || s.courseId?.name || s.courseId?.code || "").toLowerCase().includes(q);
      return nameMatch || rollMatch || secMatch || branchMatch || courseMatch;
    });
  }, [students, statusFilter, searchQuery]);

  const enrolledCount = useMemo(() => {
    return students.filter(
      (s) => Boolean(s.faceRegistered || s.isFaceRegistered || (s.faceDescriptor && s.faceDescriptor.length > 0) || s.faceImageUrl)
    ).length;
  }, [students]);

  const pendingCount = useMemo(() => {
    return Math.max(0, students.length - enrolledCount);
  }, [students, enrolledCount]);

  const selectedStudent = students.find((s) => String(s._id || s.id) === String(selectedStudentId));

  // Reset captured image, descriptor, and status whenever a different student is selected
  const prevSelectedStudentIdRef = useRef(selectedStudentId);
  useEffect(() => {
    if (prevSelectedStudentIdRef.current !== selectedStudentId) {
      prevSelectedStudentIdRef.current = selectedStudentId;
      setCapturedImage(null);
      setCapturedDescriptor(null);
      setRegistrationStatus(null);
    }
  }, [selectedStudentId]);

  // Sequential Student Navigation
  const currentStudentIndex = useMemo(() => {
    if (!selectedStudentId || filteredStudents.length === 0) return -1;
    return filteredStudents.findIndex((s) => String(s._id || s.id) === String(selectedStudentId));
  }, [filteredStudents, selectedStudentId]);

  const hasNextStudent = currentStudentIndex >= 0 && currentStudentIndex < filteredStudents.length - 1;
  const hasPrevStudent = currentStudentIndex > 0;

  const handleNextStudent = useCallback(() => {
    if (filteredStudents.length === 0) return;
    if (currentStudentIndex >= 0 && currentStudentIndex < filteredStudents.length - 1) {
      const nextStudent = filteredStudents[currentStudentIndex + 1];
      setSelectedStudentId(String(nextStudent._id || nextStudent.id));
    } else if (currentStudentIndex === -1 && filteredStudents.length > 0) {
      setSelectedStudentId(String(filteredStudents[0]._id || filteredStudents[0].id));
    }
  }, [filteredStudents, currentStudentIndex]);

  const handlePrevStudent = useCallback(() => {
    if (currentStudentIndex > 0) {
      const prevStudent = filteredStudents[currentStudentIndex - 1];
      setSelectedStudentId(String(prevStudent._id || prevStudent.id));
    }
  }, [filteredStudents, currentStudentIndex]);

  const handleSelectStudent = useCallback((studentId) => {
    setSelectedStudentId(String(studentId));
    setCapturedImage(null);
    setCapturedDescriptor(null);
    setRegistrationStatus(null);
    autoLockStartRef.current = null;
    autoCapturePendingRef.current = false;
    setAutoLockCountdown(0);
  }, []);

  // Reusable Face Detector Options to prevent per-frame allocations
  const qualityOptions = useMemo(() => {
    if (window.faceapi?.TinyFaceDetectorOptions) {
      return new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
    }
    return null;
  }, [modelsReady]);

  const captureOptions = useMemo(() => {
    if (window.faceapi?.TinyFaceDetectorOptions) {
      return new window.faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });
    }
    return null;
  }, [modelsReady]);

  // 3. Real-Time Face Alignment & Quality Loop (Calm, Zero Spam)
  const checkFaceQuality = useCallback(async () => {
    if (!videoRef?.current || !cameraActive || !modelsReady || capturedImage) return;
    const video = videoRef.current;

    if (video.paused || video.ended || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(checkFaceQuality);
      return;
    }

    try {
      if (window.faceapi && window.faceapi.nets?.tinyFaceDetector?.params) {
        const detectorOpt = qualityOptions || new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
        const detection = await window.faceapi
          .detectSingleFace(video, detectorOpt)
          .withFaceLandmarks();

        if (detection) {
          const box = detection.detection.box;
          const vWidth = video.videoWidth || 640;
          const vHeight = video.videoHeight || 480;

          // Check centering and reasonable sizing
          const centerX = box.x + box.width / 2;
          const centerY = box.y + box.height / 2;
          const isCentered =
            centerX > vWidth * 0.20 &&
            centerX < vWidth * 0.80 &&
            centerY > vHeight * 0.15 &&
            centerY < vHeight * 0.85;
          const isGoodSize = box.width > vWidth * 0.18 && box.width < vWidth * 0.75;

          // Natural yaw angle tolerance (no strict pitch gating - handles laptop tilts)
          const pose = estimatePoseAngles(detection.landmarks);
          const yaw = pose.yawDeg || 0;
          const isFrontal = Math.abs(yaw) <= 18;

          let guidanceMessage = "";
          let isFaceReady = false;

          if (!isGoodSize) {
            guidanceMessage = box.width <= vWidth * 0.18 ? "Move slightly closer" : "Move slightly back";
          } else if (!isCentered) {
            guidanceMessage = "Center face in frame";
          } else if (!isFrontal) {
            guidanceMessage = "Look directly at camera";
          } else {
            isFaceReady = true;
            guidanceMessage = "Hold steady — scanning face...";
          }

          // Smooth 1.0s Smart Burst Hold
          const SCAN_HOLD_MS = 1000;
          if (isFaceReady) {
            if (!autoLockStartRef.current) {
              autoLockStartRef.current = Date.now();
            }
            const elapsed = Date.now() - autoLockStartRef.current;
            const progress = Math.min(100, (elapsed / SCAN_HOLD_MS) * 100);
            setAutoLockCountdown(progress);

            if (elapsed >= SCAN_HOLD_MS && !autoCapturePendingRef.current && !isProcessing) {
              autoCapturePendingRef.current = true;
              if (capturePhotoRef.current) capturePhotoRef.current();
            }
          } else {
            autoLockStartRef.current = null;
            autoCapturePendingRef.current = false;
            setAutoLockCountdown(0);
          }

          setLiveQuality({
            faceDetected: true,
            score: Math.round(detection.detection.score * 100),
            message: guidanceMessage,
            isGoodPose: isFaceReady,
          });
        } else {
          autoLockStartRef.current = null;
          autoCapturePendingRef.current = false;
          setAutoLockCountdown(0);
          setLiveQuality({
            faceDetected: false,
            score: 0,
            message: "Position face in camera frame",
            isGoodPose: false,
          });
        }
      }
    } catch {
      // ignore
    }

    animFrameRef.current = requestAnimationFrame(checkFaceQuality);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, cameraActive, modelsReady, qualityOptions, capturedImage, isProcessing]);

  useEffect(() => {
    if (cameraActive && modelsReady && !capturedImage) {
      animFrameRef.current = requestAnimationFrame(checkFaceQuality);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [cameraActive, modelsReady, capturedImage, checkFaceQuality]);

  // 4. Smart Burst Multi-Sample Biometric Centroid Extraction Handler
  const handleCapturePhoto = async () => {
    if (!videoRef.current || !window.faceapi) return;
    setIsProcessing(true);
    setRegistrationStatus({ type: "info", message: "Extracting multi-sample biometric centroid..." });

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const detectorOpt = captureOptions || new window.faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });
      const primaryDetection = await window.faceapi
        .detectSingleFace(canvas, detectorOpt)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!primaryDetection || !primaryDetection.descriptor) {
        setRegistrationStatus({
          type: "error",
          message: "Failed to detect clear facial landmarks. Please ensure good lighting and retry.",
        });
        setIsProcessing(false);
        autoCapturePendingRef.current = false;
        return;
      }

      // Visual feedback: Trigger shutter flash
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 250);

      const mainImgData = canvas.toDataURL("image/jpeg", 0.9);
      const descriptors = [Array.from(primaryDetection.descriptor)];

      // Multi-scale extraction for noise-free centroid embedding
      try {
        const altDetector = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });
        const altDetection = await window.faceapi
          .detectSingleFace(canvas, altDetector)
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (altDetection?.descriptor) {
          descriptors.push(Array.from(altDetection.descriptor));
        }
      } catch (_) {}

      // L2-Normalized Centroid vector calculation
      const sumVec = new Array(128).fill(0);
      for (const desc of descriptors) {
        for (let i = 0; i < 128; i++) {
          sumVec[i] += desc[i];
        }
      }
      const norm = Math.sqrt(sumVec.reduce((sum, v) => sum + v * v, 0)) || 1;
      const centroidDescriptor = sumVec.map((v) => v / norm);

      setCapturedImage(mainImgData);
      setCapturedDescriptor(centroidDescriptor);
      setAutoLockCountdown(0);
      setRegistrationStatus({
        type: "success",
        message: "Biometric profile generated! Click 'Save & Register Face Biometrics' below.",
      });
    } catch (err) {
      logError("Compute captured descriptor", err);
      setRegistrationStatus({
        type: "error",
        message: "Error processing face biometrics: " + err.message,
      });
    } finally {
      setIsProcessing(false);
      autoCapturePendingRef.current = false;
    }
  };

  // Sync ref to current handleCapturePhoto instance
  capturePhotoRef.current = handleCapturePhoto;

  // 5. Handle File Upload (Alternative photo registration)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !window.faceapi) return;

    setIsProcessing(true);
    setRegistrationStatus({ type: "info", message: "Analyzing photo for facial landmarks..." });

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const detectorOpt = captureOptions || new window.faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 });
        const detection = await window.faceapi
          .detectSingleFace(img, detectorOpt)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection || !detection.descriptor) {
          setRegistrationStatus({
            type: "error",
            message: "No clear face found in uploaded photo. Please upload a clear, front-facing portrait.",
          });
          setIsProcessing(false);
          return;
        }

        setCapturedImage(img.src);
        setCapturedDescriptor(Array.from(detection.descriptor));
        setRegistrationStatus({
          type: "success",
          message: "Photo processed successfully! Ready to register face vector.",
        });
      } catch (err) {
        setRegistrationStatus({
          type: "error",
          message: "Failed to process photo: " + err.message,
        });
      } finally {
        setIsProcessing(false);
      }
    };
  };

  // 6. Submit Face Registration to Backend
  const handleSubmitRegistration = async () => {
    if (!selectedStudentId) {
      setRegistrationStatus({ type: "error", message: "Please select a student to register" });
      return;
    }
    if (!capturedDescriptor || capturedDescriptor.length === 0) {
      setRegistrationStatus({ type: "error", message: "Please capture or upload a face first" });
      return;
    }

    setUploading(true);
    setRegistrationStatus(null);

    try {
      // 100% Vector-Only Privacy Mode: Only send numerical mathematical embedding
      const response = await api.post("/faces/register", {
        studentId: selectedStudentId,
        faceDescriptor: Array.from(capturedDescriptor),
      });

      if (response.data?.success) {
        setRegistrationStatus({
          type: "success",
          message: `Face biometrics successfully registered for ${selectedStudent?.name || "Student"}! (Vector-only privacy preserved)`,
        });

        // Update local student roster state immediately
        setStudents((prev) =>
          prev.map((s) =>
            String(s._id || s.id) === String(selectedStudentId)
              ? { ...s, faceRegistered: true, isFaceRegistered: true }
              : s
          )
        );

        // Save to IndexedDB cache for instant recognition
        const currentTenantId = localStorage.getItem("tenantId") || "default";
        const studentSection = selectedStudent?.section || "A";
        saveDescriptorsToIDB(currentTenantId, studentSection, [{
          studentId: selectedStudentId,
          name: selectedStudent?.name || "",
          rollNo: selectedStudent?.rollNo || "",
          section: studentSection,
          descriptor: Array.from(capturedDescriptor),
          updatedAt: response.data?.faceUpdatedAt || new Date().toISOString(),
        }]).catch(() => {});

        // Stop camera once enrolled
        stopCamera();
      }
    } catch (err) {
      logError("Face registration submit", err);
      setRegistrationStatus({
        type: "error",
        message: err.response?.data?.message || "Failed to register face biometrics",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setCapturedDescriptor(null);
    autoLockStartRef.current = null;
    autoCapturePendingRef.current = false;
    setAutoLockCountdown(0);
    setRegistrationStatus(null);
    if (!cameraActive) startCamera();
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-ink">Student Face Registration</h1>
                {!isAdmin && (
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
                    Teacher Assigned Scope
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-soft">
                Enroll 128-dimensional biometric facial embeddings for AI face recognition attendance
              </p>
            </div>
          </div>

          <Link
            to="/face-attendance"
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-line rounded-xl text-sm font-medium text-ink hover:bg-surface-alt transition shadow-sm"
          >
            Go to Face Scanner <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Model Loader Banner */}
        {!modelsReady && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-3">
            <Loader className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {modelError ? "Face Model Error" : `Loading Neural Net Models (${modelProgress}%)`}
              </p>
              <p className="text-xs text-amber-600/80 mt-0.5">
                Initializing TinyFaceDetector & 68-point FaceLandmarkNet weights
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Student Selection (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2 shrink-0">
                  <Users className="w-4 h-4 text-primary" /> 1. Select Student
                </h3>
                {filteredStudents.length > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {currentStudentIndex >= 0 && (
                      <span className="text-[11px] font-semibold text-ink-soft bg-surface-alt px-2 py-0.5 rounded-lg border border-line">
                        {currentStudentIndex + 1} / {filteredStudents.length}
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePrevStudent}
                        disabled={!hasPrevStudent}
                        title="Previous Student"
                        className="p-1 rounded-lg border border-line bg-surface-alt text-ink hover:bg-surface disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextStudent}
                        disabled={!hasNextStudent}
                        title="Next Student"
                        className="p-1 rounded-lg border border-line bg-surface-alt text-ink hover:bg-surface disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ADMIN ACADEMIC STRUCTURE FILTERS (Course -> Branch -> Semester -> Section) */}
              {isAdmin && (
                <div className="p-3.5 bg-surface-alt/50 border border-line/80 rounded-2xl space-y-3 shadow-inner">
                  <div className="flex items-center justify-between pb-1 border-b border-line/60">
                    <span className="text-[11px] font-extrabold text-ink flex items-center gap-1.5 uppercase tracking-wider">
                      <Filter className="w-3.5 h-3.5 text-primary" /> Academic Structure Filters
                    </span>
                    {(selectedCourse !== "all" || selectedBranch !== "all" || selectedSemester !== "all" || selectedSection !== "all" || searchQuery) && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="text-[11px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 transition"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset Filters
                      </button>
                    )}
                  </div>

                  {/* Row 1: Course & Branch */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Course Filter */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1">
                        <GraduationCap className="w-3 h-3 text-primary" /> Course / Program
                      </label>
                      <select
                        value={selectedCourse}
                        onChange={(e) => handleCourseChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-surface border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        <option value="all">All Courses</option>
                        {coursesList.map((c) => (
                          <option key={c._id} value={c._id}>
                            {c.name} {c.code ? `(${c.code})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Branch Filter */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-primary" /> Branch / Specialization
                      </label>
                      <select
                        value={selectedBranch}
                        onChange={(e) => handleBranchChange(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-surface border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                      >
                        <option value="all">All Branches</option>
                        {availableBranches.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Semester Segmented Pills */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-primary" /> Semester
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {["all", "1", "2", "3", "4", "5", "6", "7", "8"].map((sem) => (
                        <button
                          key={sem}
                          type="button"
                          onClick={() => setSelectedSemester(sem)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition border ${
                            selectedSemester === sem
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-surface border-line text-ink-soft hover:bg-surface-alt hover:text-ink"
                          }`}
                        >
                          {sem === "all" ? "All Sem" : `Sem ${sem}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Teacher Subject Filter */}
              {!isAdmin && teacherSubjects.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-primary" /> Assigned Subject
                  </label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-alt border border-line rounded-xl text-xs font-bold text-ink focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="all">All Assigned Subjects</option>
                    {teacherSubjects.map((sub) => (
                      <option key={sub._id} value={sub._id}>
                        {sub.subjectName} ({sub.subjectCode || "SUB"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Section Segmented Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-ink-soft uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-primary" /> {isAdmin ? "Filter by Section" : "Assigned Section"}
                  </label>
                  {selectedSection && selectedSection !== "all" && (
                    <button
                      type="button"
                      onClick={() => setSelectedSection("all")}
                      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-0.5"
                    >
                      Show All Sections
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedSection("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                      !selectedSection || selectedSection === "all"
                        ? "bg-primary text-white border-primary shadow-sm"
                        : "bg-surface-alt border-line text-ink-soft hover:bg-surface hover:text-ink"
                    }`}
                  >
                    All Sections
                    {(!selectedSection || selectedSection === "all") && <Check className="w-3 h-3" />}
                  </button>
                  {availableSections.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setSelectedSection(sec)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                        selectedSection?.toUpperCase() === sec.toUpperCase()
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "bg-surface-alt border-line text-ink-soft hover:bg-surface hover:text-ink"
                      }`}
                    >
                      Section {sec}
                      {selectedSection?.toUpperCase() === sec.toUpperCase() && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex gap-1 bg-surface-alt p-1 rounded-xl border border-line shadow-inner">
                {[
                  { id: "all", label: `All (${students.length})` },
                  { id: "needs_enrollment", label: `Needs Face (${pendingCount})` },
                  { id: "enrolled", label: `Enrolled (${enrolledCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition ${
                      statusFilter === tab.id
                        ? "bg-primary text-white shadow-sm"
                        : "text-ink-soft hover:bg-surface hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  type="text"
                  placeholder="Search by student name, roll, or branch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-line bg-surface-alt text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Student Radio/List */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {loadingStudents ? (
                  <div className="text-center py-8 text-xs text-ink-soft flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 animate-spin text-primary" /> Loading student roster...
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-ink-soft bg-surface-alt/40 border border-line rounded-xl p-4 space-y-1">
                    <p className="font-semibold text-ink">No students match your filter criteria</p>
                    <p className="text-[11px] text-ink-faint">Try adjusting your Course, Branch, Section, or Search filter</p>
                    {(selectedCourse !== "all" || selectedBranch !== "all" || selectedSection !== "all" || searchQuery) && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className="mt-2 text-xs font-bold text-primary underline inline-block"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                ) : (
                  filteredStudents.map((s) => {
                    const isSelected = String(s._id || s.id) === String(selectedStudentId);
                    const isFaceEnrolled = Boolean(
                      s.faceRegistered ||
                      s.isFaceRegistered ||
                      (s.faceDescriptor && s.faceDescriptor.length > 0) ||
                      s.faceImageUrl
                    );

                    return (
                      <div
                        key={s._id || s.id}
                        onClick={() => handleSelectStudent(s._id || s.id)}
                        className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-primary/10 border-primary shadow-sm ring-1 ring-primary/30"
                            : "bg-surface-alt border-line hover:bg-surface"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-xs ${
                              isFaceEnrolled
                                ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                                : "bg-primary/10 text-primary border border-primary/20"
                            }`}
                          >
                            {s.name?.[0] || s.firstName?.[0] || "S"}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-bold text-ink truncate flex items-center gap-1.5">
                              {s.name}
                              {s.semester && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-surface-alt text-ink-soft border border-line rounded">
                                  Sem {s.semester}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-ink-soft truncate font-medium mt-0.5">
                              Roll: {s.rollNo || s.enrollmentNumber || "N/A"} · Sec {s.section || "A"} {s.branch ? `· ${s.branch}` : (s.courseName ? `· ${s.courseName}` : "")}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isFaceEnrolled ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full flex items-center gap-1 shadow-2xs">
                              <ShieldCheck className="w-3 h-3" /> Enrolled
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-full flex items-center gap-1 shadow-2xs">
                              <Camera className="w-3 h-3" /> Needs Face
                            </span>
                          )}
                          {isSelected && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedStudent && (
                <div className="p-3.5 bg-surface-alt border border-line rounded-2xl text-xs space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-ink-soft uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-primary" /> Target Student Profile:
                    </p>
                    {selectedStudent.faceRegistered || selectedStudent.isFaceRegistered || (selectedStudent.faceDescriptor && selectedStudent.faceDescriptor.length > 0) || selectedStudent.faceImageUrl ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Biometrics Registered
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-full flex items-center gap-1">
                        <Camera className="w-3 h-3" /> Pending Capture
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-primary font-bold text-sm truncate">{selectedStudent.name}</p>
                      <p className="text-ink-soft font-medium truncate">
                        Roll: {selectedStudent.rollNo || selectedStudent.enrollmentNumber || "N/A"} · Section {selectedStudent.section || "A"} {selectedStudent.branch ? `· ${selectedStudent.branch}` : ""} {selectedStudent.courseName ? `(${selectedStudent.courseName})` : ""}
                      </p>
                    </div>
                    {hasNextStudent && (
                      <button
                        type="button"
                        onClick={handleNextStudent}
                        className="shrink-0 px-2.5 py-1 bg-surface border border-line hover:bg-surface-alt text-ink text-xs font-semibold rounded-xl flex items-center gap-1 transition shadow-xs cursor-pointer"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live Camera & Photo Capture (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-surface border border-line rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-bold text-ink flex items-center gap-2 shrink-0">
                    <Camera className="w-4 h-4 text-primary" /> 2. Capture & Extract Biometrics
                  </h3>
                  {selectedStudent && (
                    <span className="text-xs font-bold text-primary truncate hidden sm:inline-block">
                      · {selectedStudent.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {filteredStudents.length > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePrevStudent}
                        disabled={!hasPrevStudent}
                        title="Previous Student"
                        className="px-2 py-1 rounded-xl border border-line bg-surface-alt text-ink text-xs font-semibold hover:bg-surface disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Prev</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNextStudent}
                        disabled={!hasNextStudent}
                        title="Next Student"
                        className="px-2.5 py-1 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-1 cursor-pointer"
                      >
                        <span className="hidden sm:inline">Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {cameraActive && (
                    <span className="text-[11px] px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 font-semibold rounded-full border border-emerald-500/20 hidden md:inline-block">
                      Live Feed
                    </span>
                  )}
                </div>
              </div>

              {/* Focused Biometric Scan Header */}
              {!capturedImage && (
                <div className="p-3.5 bg-primary/5 border-2 border-primary/25 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary text-lg">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-ink flex items-center gap-1.5">
                          <span>Smart Biometric Scan</span>
                          <span className="text-[10px] font-mono px-2 py-0.2 bg-primary/15 text-primary rounded-full font-bold">1-Hold</span>
                        </div>
                        <div className="text-[11px] text-ink-soft font-medium mt-0.5">
                          Look at camera — auto-scans multi-sample centroid in 1 second
                        </div>
                      </div>
                    </div>
                    {autoLockCountdown > 0 && (
                      <div className="relative w-10 h-10 shrink-0">
                        <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2" className="text-line/30" />
                          <circle
                            cx="18" cy="18" r="15" fill="none"
                            stroke="#10b981" strokeWidth="2.5"
                            strokeDasharray={`${autoLockCountdown * 0.9425} 94.25`}
                            strokeLinecap="round"
                            className="transition-all duration-100"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-emerald-500">
                          {Math.round(autoLockCountdown)}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Camera & Viewfinder Frame OR Captured Preview */}
              {!capturedImage ? (
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-950 border border-line shadow-inner flex items-center justify-center">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Visual Shutter Snap Flash */}
                  {shutterFlash && (
                    <div className="absolute inset-0 bg-white/80 z-30 pointer-events-none transition-opacity duration-200" />
                  )}

                  {/* Alignment HUD Overlay */}
                  {cameraActive && (
                    <>
                      {/* Floating Center Reticle */}
                      <div className={`face-viewfinder ${liveQuality.isGoodPose ? "verified" : liveQuality.faceDetected ? "challenge" : "neutral"} relative`}>
                        <div className={`absolute -top-px -left-px w-5 h-5 border-t-[3px] border-l-[3px] rounded-tl-xl pointer-events-none ${liveQuality.isGoodPose ? "border-emerald-400 shadow-[0_0_12px_#10b981]" : "border-white/50"}`} />
                        <div className={`absolute -top-px -right-px w-5 h-5 border-t-[3px] border-r-[3px] rounded-tr-xl pointer-events-none ${liveQuality.isGoodPose ? "border-emerald-400 shadow-[0_0_12px_#10b981]" : "border-white/50"}`} />
                        <div className={`absolute -bottom-px -left-px w-5 h-5 border-b-[3px] border-l-[3px] rounded-bl-xl pointer-events-none ${liveQuality.isGoodPose ? "border-emerald-400 shadow-[0_0_12px_#10b981]" : "border-white/50"}`} />
                        <div className={`absolute -bottom-px -right-px w-5 h-5 border-b-[3px] border-r-[3px] rounded-br-xl pointer-events-none ${liveQuality.isGoodPose ? "border-emerald-400 shadow-[0_0_12px_#10b981]" : "border-white/50"}`} />
                      </div>

                      {/* Auto-lock progress ring overlaid on reticle */}
                      {autoLockCountdown > 0 && liveQuality.isGoodPose && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
                          <svg className="w-[190px] h-[190px] -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="3" />
                            <circle
                              cx="50" cy="50" r="46" fill="none"
                              stroke="#10b981" strokeWidth="3.5"
                              strokeDasharray={`${autoLockCountdown * 2.89} 289`}
                              strokeLinecap="round"
                              className="transition-all duration-100"
                              style={{ filter: "drop-shadow(0 0 6px #10b981)" }}
                            />
                          </svg>
                        </div>
                      )}

                      {/* Dynamic Guidance Message Banner */}
                      <div className={`viewfinder-guide-text ${liveQuality.isGoodPose ? "verified" : liveQuality.faceDetected ? "challenge" : "neutral"}`}>
                        {liveQuality.isGoodPose ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span>{liveQuality.message}</span>
                      </div>
                    </>
                  )}

                  {!cameraActive && (
                    <div className="text-center p-6 space-y-3">
                      <Camera className="w-12 h-12 mx-auto text-white/30" />
                      <p className="text-xs text-white/70 font-medium">Camera is offline</p>
                      <button
                        onClick={() => startCamera()}
                        disabled={!modelsReady}
                        className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition shadow-sm cursor-pointer"
                      >
                        Turn on Camera
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* Captured High-Res Preview Card */
                <div className="space-y-3">
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-neutral-950 border-2 border-emerald-500/50 shadow-md">
                    <img
                      src={capturedImage}
                      alt="Enrolled Face Portrait"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-3 py-1 rounded-xl border border-white/20 text-white text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ready to Register</span>
                    </div>
                  </div>
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <div>High-Precision Centroid Vector Extracted (128-D)</div>
                      <div className="text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                        Multi-sample embedding generated. Click below to save to secure student roster.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {!capturedImage ? (
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    {cameraActive ? (
                      <>
                        <button
                          type="button"
                          onClick={handleCapturePhoto}
                          disabled={isProcessing}
                          className="flex-1 py-2.5 px-4 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                          {isProcessing ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Camera className="w-4 h-4" />
                          )}
                          <span>Manual Snap</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="py-2.5 px-4 bg-surface-alt border border-line text-ink rounded-xl text-xs font-semibold hover:bg-surface transition cursor-pointer"
                        >
                          <CameraOff className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startCamera()}
                        disabled={!modelsReady}
                        className="flex-1 py-3 px-4 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                      >
                        <Camera className="w-4 h-4" /> Start Camera
                      </button>
                    )}

                    {/* Upload Alternative */}
                    <label className="py-2.5 px-4 bg-surface-alt border border-line hover:bg-surface text-ink rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-2 transition">
                      <Upload className="w-4 h-4 text-ink-soft" />
                      Upload Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={handleSubmitRegistration}
                      disabled={uploading || !selectedStudentId}
                      className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-xl text-xs font-extrabold hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/25 disabled:opacity-50 cursor-pointer"
                    >
                      {uploading ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Save & Register Face Biometrics
                    </button>
                    <button
                      type="button"
                      onClick={handleRetake}
                      disabled={uploading}
                      className="py-3 px-4 bg-surface-alt border border-line text-ink rounded-xl text-xs font-bold hover:bg-surface transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" /> Retake Scan
                    </button>
                  </div>
                )}

                {/* Status Notice & Quick Next Action */}
                {registrationStatus && (
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-medium ${
                      registrationStatus.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : registrationStatus.type === "info"
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {registrationStatus.type === "success" ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : registrationStatus.type === "info" ? (
                        <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      <span className="break-words">{registrationStatus.message}</span>
                    </div>
                    {registrationStatus.type === "success" && hasNextStudent && (
                      <button
                        type="button"
                        onClick={handleNextStudent}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer self-end sm:self-auto"
                      >
                        Next Student <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
