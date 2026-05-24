// src/components/Admin/ManageSubjects.jsx
import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Plus, 
  Search, 
  Filter,
  Edit,
  Trash2,
  Eye,
  Check,
  X,
  Calendar,
  Award,
  Code,
  Layers,
  ChevronDown,
  Download,
  Upload
} from "lucide-react";
import Card from "./common/Card";
import Modal from "./common/Modal";

const ManageSubjects = () => {
  const [subjects, setSubjects] = useState([]);
  const [filteredSubjects, setFilteredSubjects] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [semesters, setSemesters] = useState([]);

  const [formData, setFormData] = useState({
    subjectCode: "",
    subjectName: "",
    semester: "",
    description: "",
    credits: "4",
    courseCode: "",
  });

  const API_URL = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    filterSubjects();
  }, [searchTerm, filterSemester, subjects]);

  const fetchSubjects = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/subjects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        const subjectsList = data.data || [];
        setSubjects(subjectsList);
        setFilteredSubjects(subjectsList);
        
        // Extract unique semesters
        const uniqueSemesters = [...new Set(subjectsList.map(s => s.semester).filter(Boolean))];
        setSemesters(uniqueSemesters.sort());
      }
    } catch (error) {
      console.error("Error fetching subjects:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterSubjects = () => {
    let filtered = [...subjects];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s => 
        s.subjectName?.toLowerCase().includes(term) ||
        s.subjectCode?.toLowerCase().includes(term) ||
        s.courseCode?.toLowerCase().includes(term)
      );
    }

    if (filterSemester) {
      filtered = filtered.filter(s => s.semester === filterSemester);
    }

    setFilteredSubjects(filtered);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.subjectCode || !formData.subjectName || !formData.semester) {
      alert("Please fill all required fields");
      return;
    }

    const tempId = Date.now();
    const optimisticSubject = {
      _id: tempId,
      ...formData,
      optimistic: true,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    setSubjects(prev => [optimisticSubject, ...prev]);
    setShowForm(false);

    try {
      const res = await fetch(`${API_URL}/subjects/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      setSubjects(prev =>
        prev.map(s =>
          s._id === tempId ? { ...data.subject, optimistic: false } : s
        )
      );

      setFormData({
        subjectCode: "",
        subjectName: "",
        semester: "",
        description: "",
        credits: "4",
        courseCode: "",
      });

    } catch (err) {
      setSubjects(prev => prev.filter(s => s._id !== tempId));
      alert(err.message);
    }
  };

  const viewSubjectDetails = (subject) => {
    setSelectedSubject(subject);
    setShowDetails(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manage Subjects</h1>
            <p className="text-gray-500 mt-1">
              {filteredSubjects.length} subjects found
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Subject
          </button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search subjects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="">All Semesters</option>
                {semesters.map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterSemester("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </Card>

        {/* Subjects Grid */}
        {loading ? (
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-full mb-4 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : filteredSubjects.length === 0 ? (
          <Card className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Subjects Found</h3>
            <p className="text-gray-500">
              {searchTerm || filterSemester
                ? "Try adjusting your filters"
                : "Get started by adding your first subject"}
            </p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSubjects.map((subject) => (
              <Card
                key={subject._id}
                hoverable
                onClick={() => viewSubjectDetails(subject)}
                className={`relative ${subject.optimistic ? 'opacity-75' : ''}`}
              >
                {subject.optimistic && (
                  <div className="absolute top-2 right-2">
                    <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                    {subject.subjectCode}
                  </span>
                </div>

                <h3 className="font-semibold text-lg text-gray-900 mb-1">
                  {subject.subjectName}
                </h3>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="w-4 h-4 mr-2" />
                    Semester {subject.semester}
                  </div>
                  {subject.credits && (
                    <div className="flex items-center text-sm text-gray-500">
                      <Award className="w-4 h-4 mr-2" />
                      {subject.credits} Credits
                    </div>
                  )}
                  {subject.courseCode && (
                    <div className="flex items-center text-sm text-gray-500">
                      <Code className="w-4 h-4 mr-2" />
                      {subject.courseCode}
                    </div>
                  )}
                </div>

                {subject.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {subject.description}
                  </p>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    subject.isActive 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {subject.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(subject.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Add Subject Modal */}
        <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Add New Subject" size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Code <span className="text-red-500">*</span>
                </label>
                <input
                  name="subjectCode"
                  value={formData.subjectCode}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="CS-101"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Course Code
                </label>
                <input
                  name="courseCode"
                  value={formData.courseCode}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="CSE-A"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject Name <span className="text-red-500">*</span>
              </label>
              <input
                name="subjectName"
                value={formData.subjectName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Data Structures"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Semester <span className="text-red-500">*</span>
                </label>
                <input
                  name="semester"
                  type="number"
                  value={formData.semester}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Credits
                </label>
                <input
                  name="credits"
                  type="number"
                  value={formData.credits}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="4"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Subject description..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Create Subject
              </button>
            </div>
          </form>
        </Modal>

        {/* Subject Details Modal */}
        <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} title="Subject Details" size="lg">
          {selectedSubject && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedSubject.subjectName}</h2>
                  <p className="text-gray-500">{selectedSubject.subjectCode}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Semester</p>
                  <p className="font-medium text-gray-900">{selectedSubject.semester}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Credits</p>
                  <p className="font-medium text-gray-900">{selectedSubject.credits || 'N/A'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Course Code</p>
                  <p className="font-medium text-gray-900">{selectedSubject.courseCode || 'N/A'}</p>
                </div>
              </div>

              {selectedSubject.description && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-2">Description</p>
                  <p className="text-gray-900">{selectedSubject.description}</p>
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-2">Additional Information</p>
                <div className="grid md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Created:</span>{' '}
                    <span className="text-gray-900">{new Date(selectedSubject.createdAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Updated:</span>{' '}
                    <span className="text-gray-900">{new Date(selectedSubject.updatedAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>{' '}
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      selectedSubject.isActive 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {selectedSubject.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default ManageSubjects;