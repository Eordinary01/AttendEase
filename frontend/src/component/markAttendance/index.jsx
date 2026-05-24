// src/components/MarkAttendance.jsx
import React, { useEffect, useState, Fragment, useRef } from "react";
import { Dialog, Transition, Listbox } from "@headlessui/react";
import {
  Calendar,
  Book,
  Check,
  X,
  ChevronDown,
  Users,
  AlertCircle,
  Search,
  RefreshCw,
  Clock,
  Loader2,
  UserCheck,
  UserX,
} from "lucide-react";
import axios from "axios";
import { format } from "date-fns";

export default function MarkAttendance() {
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [filterRollNo, setFilterRollNo] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [existingAttendance, setExistingAttendance] = useState(false);
  const [classSessionInfo, setClassSessionInfo] = useState(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentCount: 0,
    absentCount: 0,
  });

  const hasFetchedSubjects = useRef(false);
  const abortControllerRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem("token");
  const teacherId = localStorage.getItem("userId");

  // Fetch teacher subjects - only once on mount
  useEffect(() => {
    if (token && !hasFetchedSubjects.current) {
      hasFetchedSubjects.current = true;
      fetchTeacherSubjects();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [token]);

  // Update selected subject and section when assignment changes
  useEffect(() => {
    if (selectedAssignment) {
      setSelectedSubject(selectedAssignment.subjectId);
      setSelectedSection(selectedAssignment.section);
      setResponseMessage("");
      // Reset attendance state when assignment changes
      setExistingAttendance(false);
      setClassSessionInfo(null);
      setAttendanceData({});
    }
  }, [selectedAssignment]);

  // Fetch students when section or subject changes
  useEffect(() => {
    if (selectedSection && selectedSubject) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      fetchStudents(abortControllerRef.current.signal);
      
      // Reset attendance state when section changes
      setExistingAttendance(false);
      setClassSessionInfo(null);
      setAttendanceData({});
    }
  }, [selectedSection, selectedSubject]);

  // Check existing attendance when date, subject, section changes
  useEffect(() => {
    if (students.length > 0 && selectedDate && selectedSubject && selectedSection) {
      checkExistingAttendance();
    }
  }, [selectedDate, selectedSubject, selectedSection]);

  // Calculate stats
  useEffect(() => {
    const filtered = students.filter((student) => {
      const fullName = student.name || "";
      const rollNo = student.rollNo || "";
      const term = filterRollNo.toLowerCase();
      return fullName.toLowerCase().includes(term) || rollNo.toLowerCase().includes(term);
    });

    const total = filtered.length;
    const present = Object.values(attendanceData).filter(
      (value) => value === true,
    ).length;

    setStats({
      totalStudents: total,
      presentCount: present,
      absentCount: total - present,
    });
  }, [attendanceData, students, filterRollNo]);

  const fetchTeacherSubjects = async () => {
    try {
      if (!teacherId) {
        setResponseMessage("Teacher ID not found. Please log in again.");
        return;
      }

      const response = await axios.get(
        `${API_URL}/subjects/teacher/${teacherId}/assignments`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          signal: abortControllerRef.current?.signal 
        },
      );

      console.log("Teacher subjects response:", response.data);

      const subjectsData = response.data.subjects || [];

      // Transform each assignment into a selectable option
      const transformed = subjectsData.map((item) => ({
        assignmentId: item.assignmentId,
        subjectId: item.subject.id,
        subjectName: item.subject.subjectName,
        subjectCode: item.subject.subjectCode,
        semester: item.subject.semester,
        section: item.section,
        displayName: `${item.subject.subjectName} (${item.subject.subjectCode}) - Section ${item.section}`,
        totalStudents: item.stats?.totalStudents || 0,
        registeredStudents: item.stats?.registeredStudents || 0,
      }));

      setTeacherSubjects(transformed);

      if (transformed.length === 0) {
        setResponseMessage("No subjects assigned to you yet.");
      } else {
        // Set the first assignment as default
        setSelectedAssignment(transformed[0]);
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.error("Error fetching teacher subjects:", error);
        setResponseMessage(
          error.response?.data?.message || "Failed to load your subjects.",
        );
      }
    }
  };

  const fetchStudents = async (signal) => {
    setFetchingStudents(true);
    try {
      console.log("Fetching students for section:", selectedSection);
      const response = await axios.get(`${API_URL}/users/users`, {
        params: { section: selectedSection },
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      console.log("Response data:", response.data);
      
      const studentsData = response.data || [];
      setStudents(studentsData);

      if (studentsData.length === 0) {
        setResponseMessage(`No students found in section ${selectedSection}`);
        setAttendanceData({});
      } else {
        // 🔥 FIX: Always initialize fresh attendance data for the current section only
        const initialAttendance = {};
        studentsData.forEach((student) => {
          initialAttendance[student._id] = false;
        });
        setAttendanceData(initialAttendance);
        
        setExistingAttendance(false);
        setClassSessionInfo(null);
        setResponseMessage(""); // Clear any previous messages
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.error("Error fetching students:", error);
        setResponseMessage("Failed to load students.");
      }
    } finally {
      setFetchingStudents(false);
    }
  };

  const checkExistingAttendance = async () => {
    // Don't check if we don't have students yet
    if (students.length === 0) return;
    
    try {
      console.log("Checking attendance for:", {
        date: selectedDate,
        subjectId: selectedSubject,
        section: selectedSection,
      });

      const response = await axios.get(`${API_URL}/attendance/by-date`, {
        params: {
          date: selectedDate,
          subjectId: selectedSubject,
          section: selectedSection,
        },
        headers: { Authorization: `Bearer ${token}` },
        signal: abortControllerRef.current?.signal,
      });

      if (response.data.attendance && response.data.attendance.length > 0) {
        // 🔥 FIX: Only include attendance for students that exist in current section
        const existingAttendanceMap = {};
        const validStudentIds = new Set(students.map(s => s._id));
        
        response.data.attendance.forEach((record) => {
          if (validStudentIds.has(record.studentId._id)) {
            existingAttendanceMap[record.studentId._id] = record.status === "present";
          }
        });
        
        // If we have valid attendance records
        if (Object.keys(existingAttendanceMap).length > 0) {
          setAttendanceData(existingAttendanceMap);
          setExistingAttendance(true);
          
          setClassSessionInfo({
            totalRecords: response.data.totalRecords,
            classSlots: response.data.classSlots || []
          });
          
          setResponseMessage(`📋 Existing attendance loaded for ${format(new Date(selectedDate), "MMMM d, yyyy")}`);
        } else {
          // No valid records, reset to default
          const defaultAttendance = {};
          students.forEach((student) => {
            defaultAttendance[student._id] = false;
          });
          setAttendanceData(defaultAttendance);
          setExistingAttendance(false);
          setClassSessionInfo(null);
        }
      } else {
        // No existing attendance, reset to all absent
        const defaultAttendance = {};
        students.forEach((student) => {
          defaultAttendance[student._id] = false;
        });
        setAttendanceData(defaultAttendance);
        setExistingAttendance(false);
        setClassSessionInfo(null);
      }
    } catch (error) {
      if (error.name !== 'CanceledError' && error.name !== 'AbortError') {
        console.log("No existing attendance for this date");
        // Reset to all absent
        const defaultAttendance = {};
        students.forEach((student) => {
          defaultAttendance[student._id] = false;
        });
        setAttendanceData(defaultAttendance);
        setExistingAttendance(false);
        setClassSessionInfo(null);
      }
    }
  };

  const handleAttendanceChange = (studentId, isPresent) => {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: isPresent,
    }));
  };

  const markAllPresent = () => {
    const allPresent = {};
    students.forEach((student) => {
      allPresent[student._id] = true;
    });
    setAttendanceData(allPresent);
  };

  const markAllAbsent = () => {
    const allAbsent = {};
    students.forEach((student) => {
      allAbsent[student._id] = false;
    });
    setAttendanceData(allAbsent);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedDate || !selectedSubject || !selectedSection) {
      setResponseMessage("Please select date, subject, and section.");
      return;
    }

    // 🔥 FIX: Validate that all student IDs in attendanceData exist in current section
    const validStudentIds = new Set(students.map(s => s._id));
    const attendanceEntries = Object.entries(attendanceData);
    
    // Filter out any students not in current section
    const validEntries = attendanceEntries.filter(([studentId]) => 
      validStudentIds.has(studentId)
    );

    if (validEntries.length === 0) {
      setResponseMessage("No valid students to mark attendance for.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Format attendance data - only include valid students
      const formattedAttendance = {};
      
      validEntries.forEach(([studentId, isPresent]) => {
        formattedAttendance[studentId] = isPresent ? "present" : "absent";
      });

      console.log("📤 Sending payload:", {
        date: selectedDate,
        subjectId: selectedSubject,
        section: selectedSection,
        attendanceData: formattedAttendance
      });

      const response = await axios.post(
        `${API_URL}/attendance/mark`,
        {
          date: selectedDate,
          subjectId: selectedSubject,
          section: selectedSection,
          attendanceData: formattedAttendance,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.status === 200 || response.status === 201) {
        setResponseMessage(
          `✅ Attendance marked successfully! ` +
          `(${response.data.recordsCreated || 0} records created)`
        );
        
        // Refresh the attendance data to show updated status
        await checkExistingAttendance();
      }
    } catch (error) {
      console.error("Error marking attendance:", error);
      
      // Check if attendance already exists error
      if (error.response?.data?.message?.includes("already exists")) {
        setResponseMessage("⚠️ Attendance for this class session already exists. Please update if needed.");
        setExistingAttendance(true);
      } else {
        setResponseMessage(
          error.response?.data?.message || "Failed to mark attendance.",
        );
      }
    } finally {
      setIsLoading(false);
      setTimeout(() => setResponseMessage(""), 5000);
    }
  };

  // Calculate filtered students for display
  const filteredStudents = students.filter((student) => {
    const fullName = student.name || "";
    const rollNo = student.rollNo || "";
    const term = filterRollNo.toLowerCase();
    return (
      fullName.toLowerCase().includes(term) ||
      rollNo.toLowerCase().includes(term)
    );
  });

  // Add a section info display
  const SectionInfo = () => (
    <div className="mb-4 p-3 bg-slate-100 rounded-lg flex items-center gap-2">
      <Users className="h-5 w-5 text-slate-600" />
      <p className="text-slate-700">
        Currently viewing <strong>Section {selectedSection}</strong> - {students.length} student{students.length !== 1 ? 's' : ''}
      </p>
    </div>
  );

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
        <div className="max-w-7xl mx-auto bg-white rounded-2xl shadow-xl p-12 text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            Authentication Required
          </h2>
          <p className="text-slate-600">
            Please log in to access attendance management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl mb-8 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Mark Attendance
              </h1>
              <p className="text-slate-500 mt-2">
                {selectedAssignment
                  ? `Teaching ${selectedAssignment.subjectName} (${selectedAssignment.subjectCode}) - Section ${selectedAssignment.section}`
                  : "Select a subject to begin"}
              </p>
            </div>
            <div className="flex items-center space-x-4 text-sm text-slate-600">
              <Clock className="h-4 w-4" />
              <span>{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl">
          <div className="p-6">
            {/* Response Message */}
            <Transition
              show={!!responseMessage}
              enter="transition-opacity duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition-opacity duration-300"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div
                className={`border-l-4 p-4 mb-6 rounded-md flex items-center ${
                  responseMessage.includes("✅") ||
                  responseMessage.includes("📋")
                    ? "bg-green-50 border-green-500 text-green-700"
                    : responseMessage.includes("⚠️")
                    ? "bg-yellow-50 border-yellow-500 text-yellow-700"
                    : "bg-amber-50 border-amber-500 text-amber-700"
                }`}
              >
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <p>{responseMessage}</p>
              </div>
            </Transition>

            {/* Existing Attendance Indicator */}
            {existingAttendance && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="h-5 w-5 text-blue-600" />
                  <p className="text-blue-700 font-medium">
                    Attendance already marked for this date
                  </p>
                </div>
                {classSessionInfo && (
                  <div className="text-sm text-blue-600 ml-7">
                    <p>• Total records: {classSessionInfo.totalRecords}</p>
                    {classSessionInfo.classSlots && classSessionInfo.classSlots.length > 0 && (
                      <p>• Class sessions: {classSessionInfo.classSlots.map(s => `Period ${s.slot}`).join(', ')}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Selection Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Date Selection */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={format(new Date(), "yyyy-MM-dd")}
                  className="w-full rounded-lg border-slate-200 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                  required
                />
              </div>

              {/* Subject Selection */}
              <div className="md:col-span-2">
                <Listbox value={selectedAssignment} onChange={setSelectedAssignment}>
                  <div className="relative">
                    <Listbox.Label className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                      <Book className="h-4 w-4 mr-2" />
                      Subject & Section
                    </Listbox.Label>
                    <Listbox.Button className="w-full rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500">
                      <span className="block truncate">
                        {selectedAssignment?.displayName || "Select subject and section"}
                      </span>
                      <span className="absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      </span>
                    </Listbox.Button>
                    <Transition
                      as={Fragment}
                      leave="transition ease-in duration-100"
                      leaveFrom="opacity-100"
                      leaveTo="opacity-0"
                    >
                      <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                        {teacherSubjects.map((item) => (
                          <Listbox.Option
                            key={item.assignmentId}
                            value={item}
                            className={({ active }) =>
                              `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                active
                                  ? "bg-slate-100 text-slate-900"
                                  : "text-slate-700"
                              }`
                            }
                          >
                            {({ selected }) => (
                              <>
                                <span
                                  className={`block truncate ${selected ? "font-medium" : "font-normal"}`}
                                >
                                  {item.displayName}
                                </span>
                                {selected && (
                                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-600">
                                    <Check className="h-4 w-4" />
                                  </span>
                                )}
                              </>
                            )}
                          </Listbox.Option>
                        ))}
                      </Listbox.Options>
                    </Transition>
                  </div>
                </Listbox>
              </div>
            </div>

            {/* Section Info */}
            {selectedSection && <SectionInfo />}

            {/* Search and Quick Actions */}
            {selectedSection && students.length > 0 && (
              <div className="mb-8">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="relative flex-1">
                    <label className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                      <Search className="h-4 w-4 mr-2" />
                      Search Student
                    </label>
                    <input
                      type="text"
                      placeholder="Search by name or roll number..."
                      value={filterRollNo}
                      onChange={(e) => setFilterRollNo(e.target.value)}
                      className="w-full rounded-lg border-slate-200 shadow-sm focus:border-slate-500 focus:ring-slate-500 p-2"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={markAllPresent}
                      className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition flex items-center gap-2"
                    >
                      <UserCheck className="h-4 w-4" />
                      Mark All Present
                    </button>
                    <button
                      onClick={markAllAbsent}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex items-center gap-2"
                    >
                      <UserX className="h-4 w-4" />
                      Mark All Absent
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Summary */}
            {selectedSection && students.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-md p-6 border border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">
                        Total Students
                      </p>
                      <p className="text-2xl font-bold text-slate-800">
                        {stats.totalStudents}
                      </p>
                    </div>
                    <Users className="h-8 w-8 text-slate-400" />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6 border border-green-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">
                        Present
                      </p>
                      <p className="text-2xl font-bold text-green-600">
                        {stats.presentCount}
                      </p>
                    </div>
                    <Check className="h-8 w-8 text-green-400" />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6 border border-red-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">
                        Absent
                      </p>
                      <p className="text-2xl font-bold text-red-600">
                        {stats.absentCount}
                      </p>
                    </div>
                    <X className="h-8 w-8 text-red-400" />
                  </div>
                </div>
              </div>
            )}

            {/* Students Table */}
            {selectedSection && (
              <>
                {fetchingStudents ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-500">Loading students...</p>
                  </div>
                ) : students.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg">
                    <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-600 mb-2">
                      No students found
                    </h3>
                    <p className="text-slate-500">
                      No students are enrolled in section {selectedSection}.
                    </p>
                  </div>
                ) : filteredStudents.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Student Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Roll Number
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {filteredStudents.map((student) => (
                          <tr
                            key={student._id}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                                  <span className="text-sm font-medium text-slate-600">
                                    {student.name?.charAt(0) || "?"}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-slate-900">
                                    {student.name || "Unknown"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              {student.rollNo || "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                              <div className="flex justify-center space-x-4">
                                <button
                                  onClick={() =>
                                    handleAttendanceChange(student._id, true)
                                  }
                                  className={`p-2 rounded-lg transition-colors ${
                                    attendanceData[student._id] === true
                                      ? "bg-green-100 text-green-600"
                                      : "hover:bg-green-50 text-green-400"
                                  }`}
                                >
                                  <Check className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleAttendanceChange(student._id, false)
                                  }
                                  className={`p-2 rounded-lg transition-colors ${
                                    attendanceData[student._id] === false
                                      ? "bg-red-100 text-red-600"
                                      : "hover:bg-red-50 text-red-400"
                                  }`}
                                >
                                  <X className="h-5 w-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-lg">
                    <Search className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-600 mb-2">
                      No matching students
                    </h3>
                    <p className="text-slate-500">
                      No students match your search criteria.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Submit Button */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  isLoading || !selectedSection || students.length === 0
                }
                className={`w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-sm text-sm font-medium text-white 
                  ${
                    selectedSection && students.length > 0
                      ? "bg-slate-800 hover:bg-slate-700"
                      : "bg-slate-400 cursor-not-allowed"
                  } 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200`}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-5 w-5 mr-2" />
                )}
                {isLoading ? "Submitting..." : existingAttendance ? "Update Attendance" : "Submit Attendance"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}