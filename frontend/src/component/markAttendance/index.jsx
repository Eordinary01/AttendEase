import React, { useEffect, useState, Fragment } from "react";
import { Dialog, Transition, Listbox, Disclosure } from "@headlessui/react";
import {
  Calendar,
  Book,
  Filter,
  Plus,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  AlertCircle,
  Search,
  RefreshCw,
  Clock,
  Loader2,
} from "lucide-react";

export default function MarkAttendance() {
  const [subjects, setSubjects] = useState([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newSubjectSections, setNewSubjectSections] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [availableSections, setAvailableSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [students, setStudents] = useState([]);
  const [attendanceData, setAttendanceData] = useState({});
  const [token, setToken] = useState(null);
  const [filterRollNo, setFilterRollNo] = useState("");
  const [isNewSubjectOpen, setIsNewSubjectOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentCount: 0,
    absentCount: 0,
  });

  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) setToken(storedToken);
  }, []);

  useEffect(() => {
    if (token) {
      fetchSubjects();
    }
  }, [token]);

  useEffect(() => {
    if (selectedSubject) {
      // Get the sections for this subject
      const subject = subjects.find(s => s.code === selectedSubject);
      if (subject && subject.sections) {
        setAvailableSections(subject.sections);
        setSelectedSection(""); // Reset selected section when subject changes
      }
    } else {
      setAvailableSections([]);
      setSelectedSection("");
    }
  }, [selectedSubject, subjects]);

  useEffect(() => {
    if (token && selectedSection) {
      fetchStudents();
    }
  }, [token, selectedSection]);

  useEffect(() => {
    updateStats();
  }, [attendanceData]);

  const fetchSubjects = async () => {
    try {
      const response = await fetch(`${API_URL}/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSubjects(data);
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const fetchStudents = async () => {
    try {
      // Only fetch students for the selected section
      const response = await fetch(`${API_URL}/users?section=${selectedSection}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setStudents(data);
      // Reset attendance data when students change
      setAttendanceData({});
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const handleAttendanceChange = (studentId, isPresent) => {
    setAttendanceData((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [selectedSubject]: isPresent,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedSubject || !selectedSection) {
      setResponseMessage("Please select date, subject, and section.");
      setTimeout(() => setResponseMessage(""), 5000);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: selectedDate,
          subject: selectedSubject,
          section: selectedSection,
          data: attendanceData,
        }),
      });

      if (response.ok) {
        setResponseMessage("Attendance updated successfully!");
        setSelectedDate("");
        setSelectedSubject("");
        setSelectedSection("");
        setAttendanceData({});
      } else {
        throw new Error("Failed to update attendance");
      }
    } catch (error) {
      setResponseMessage("Error updating attendance. Please try again.");
    } finally {
      setIsLoading(false);
      setTimeout(() => setResponseMessage(""), 5000);
    }
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName || !newSubjectCode || newSubjectSections.length === 0) {
      setResponseMessage("All fields including sections are required.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/subjects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newSubjectName,
          code: newSubjectCode,
          sections: newSubjectSections,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSubjects([...subjects, data]);
        setNewSubjectName("");
        setNewSubjectCode("");
        setNewSubjectSections([]);
        setIsNewSubjectOpen(false);
        setResponseMessage("Subject created successfully!");
      } else {
        throw new Error("Failed to create subject");
      }
    } catch (error) {
      setResponseMessage("Error creating subject. Please try again.");
    }

    setTimeout(() => setResponseMessage(""), 5000);
  };

  const filteredStudents = students.filter((student) => {
    return (!filterRollNo || student.rollNo.includes(filterRollNo));
  });

  const updateStats = () => {
    const total = filteredStudents.length;
    const present = Object.values(attendanceData).filter(
      (student) => student[selectedSubject] === true
    ).length;

    setStats({
      totalStudents: total,
      presentCount: present,
      absentCount: total - present,
    });
  };

  const handleAddSection = () => {
    const section = document.getElementById("sectionInput").value.trim();
    if (section && !newSubjectSections.includes(section)) {
      setNewSubjectSections([...newSubjectSections, section]);
      document.getElementById("sectionInput").value = "";
    }
  };

  const handleRemoveSection = (sectionToRemove) => {
    setNewSubjectSections(newSubjectSections.filter(section => section !== sectionToRemove));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-2xl shadow-xl mb-8 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                Attendance Management
              </h1>
              <p className="text-slate-500 mt-2">
                Track and manage student attendance efficiently
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-600">
                <Clock className="h-4 w-4" />
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <button
                onClick={() => setIsNewSubjectOpen(true)}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Subject
              </button>
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
              <div className="bg-slate-50 border-l-4 border-slate-500 text-slate-700 p-4 mb-6 rounded-md flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                {responseMessage}
              </div>
            </Transition>

            {/* Filters Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-lg border-slate-200 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                  required
                />
              </div>

              {/* Subject Selection */}
              <div>
                <Listbox value={selectedSubject} onChange={setSelectedSubject}>
                  <div className="relative">
                    <Listbox.Label className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                      <Book className="h-4 w-4 mr-2" />
                      Subject
                    </Listbox.Label>
                    <Listbox.Button className="w-full rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500">
                      <span className="block truncate">
                        {subjects.find((s) => s.code === selectedSubject)?.name ||
                          "Select subject"}
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
                        {subjects.map((subject) => (
                          <Listbox.Option
                            key={subject._id}
                            value={subject.code}
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
                                  className={`block truncate ${
                                    selected ? "font-medium" : "font-normal"
                                  }`}
                                >
                                  {subject.name} ({subject.code})
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

              {/* Section Selection - only enabled after subject is selected */}
              <div>
                <Listbox 
                  value={selectedSection} 
                  onChange={setSelectedSection}
                  disabled={!selectedSubject || availableSections.length === 0}
                >
                  <div className="relative">
                    <Listbox.Label className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                      <Users className="h-4 w-4 mr-2" />
                      Section
                    </Listbox.Label>
                    <Listbox.Button 
                      className={`w-full rounded-lg bg-white py-2 pl-3 pr-10 text-left border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 ${
                        !selectedSubject ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      <span className="block truncate">
                        {selectedSection || "Select section"}
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
                        {availableSections.map((section) => (
                          <Listbox.Option
                            key={section}
                            value={section}
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
                                  className={`block truncate ${
                                    selected ? "font-medium" : "font-normal"
                                  }`}
                                >
                                  {section}
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

            {/* Search by Roll Number */}
            <div className="mb-8">
              <div className="relative">
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                  <Search className="h-4 w-4 mr-2" />
                  Search by Roll Number
                </label>
                <input
                  type="text"
                  placeholder="Enter roll number..."
                  value={filterRollNo}
                  onChange={(e) => setFilterRollNo(e.target.value)}
                  className="w-full rounded-lg border-slate-200 shadow-sm focus:border-slate-500 focus:ring-slate-500 p-2"
                />
              </div>
            </div>

            {/* Stats Summary */}
            {selectedSection && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-md p-6">
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
                <div className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">
                        Present Today
                      </p>
                      <p className="text-2xl font-bold text-emerald-600">
                        {stats.presentCount}
                      </p>
                    </div>
                    <Check className="h-8 w-8 text-emerald-400" />
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">
                        Absent Today
                      </p>
                      <p className="text-2xl font-bold text-rose-600">
                        {stats.absentCount}
                      </p>
                    </div>
                    <X className="h-8 w-8 text-rose-400" />
                  </div>
                </div>
              </div>
            )}

            {/* Students Table - Only show when a section is selected */}
            {selectedSection && filteredStudents.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                      >
                        Student Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                      >
                        Roll Number
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider"
                      >
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
                                {student.name.charAt(0)}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-slate-900">
                                {student.name}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm bg-gray-50 text-slate-500">
                          {student.rollNo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          <div className="flex justify-center space-x-4">
                            <button
                              onClick={() =>
                                handleAttendanceChange(student._id, true)
                              }
                              className={`p-2 rounded-lg transition-colors ${
                                attendanceData[student._id]?.[selectedSubject] ===
                                true
                                  ? "bg-emerald-100 text-emerald-600"
                                  : "hover:bg-green-100 text-emerald-400"
                              }`}
                            >
                              <Check className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() =>
                                handleAttendanceChange(student._id, false)
                              }
                              className={`p-2 rounded-lg transition-colors ${
                                attendanceData[student._id]?.[selectedSubject] ===
                                false
                                  ? "bg-rose-100 text-rose-600"
                                  : "hover:bg-red-100 text-rose-400"
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
            ) : selectedSection ? (
              <div className="text-center py-10 bg-slate-50 rounded-lg">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">No students found</h3>
                <p className="text-slate-500">
                  There are no students in this section or matching your search criteria.
                </p>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-lg">
                <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">Select a subject and section</h3>
                <p className="text-slate-500">
                  Please select a subject and section to view student attendance.
                </p>
              </div>
            )}

            {/* Submit Button - Only enabled when a section is selected */}
            <div className="mt-6">
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isLoading || !selectedSection}
                className={`w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-sm text-sm font-medium text-white 
                  ${selectedSection 
                      ? "bg-slate-800 hover:bg-slate-700" 
                      : "bg-slate-400 cursor-not-allowed"} 
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors duration-200`}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-5 w-5 mr-2" />
                )}
                {isLoading ? "Submitting..." : "Submit Attendance"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Subject Dialog */}
      <Transition appear show={isNewSubjectOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => setIsNewSubjectOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-slate-900 flex items-center mb-4"
                  >
                    <Book className="h-5 w-5 mr-2 text-slate-600" />
                    Add New Subject
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Subject Name
                      </label>
                      <input
                        type="text"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        className="w-full rounded-lg border-slate-200 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                        placeholder="Enter subject name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Subject Code
                      </label>
                      <input
                        type="text"
                        value={newSubjectCode}
                        onChange={(e) => setNewSubjectCode(e.target.value)}
                        className="w-full rounded-lg border-slate-200 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                        placeholder="Enter subject code"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Sections
                      </label>
                      <div className="flex space-x-2 mb-2">
                        <input
                          id="sectionInput"
                          type="text"
                          className="flex-grow rounded-lg border-slate-200 shadow-sm focus:border-slate-500 focus:ring-slate-500"
                          placeholder="Enter section name"
                        />
                        <button
                          type="button"
                          onClick={handleAddSection}
                          className="inline-flex justify-center rounded-lg border border-transparent bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {/* Display added sections */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {newSubjectSections.map((section) => (
                          <div 
                            key={section}
                            className="bg-slate-100 text-slate-800 px-3 py-1 rounded-full text-sm flex items-center"
                          >
                            {section}
                            <button
                              onClick={() => handleRemoveSection(section)}
                              className="ml-2 text-slate-500 hover:text-slate-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex space-x-3">
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center items-center rounded-lg border border-transparent bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 transition-colors duration-200"
                      onClick={handleCreateSubject}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Subject
                    </button>
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 transition-colors duration-200"
                      onClick={() => setIsNewSubjectOpen(false)}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}