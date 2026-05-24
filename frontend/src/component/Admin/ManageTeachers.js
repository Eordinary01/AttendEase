// src/components/Admin/ManageTeachers.jsx
import React, { useState, useEffect } from "react";
import {
  UserPlus,
  Search,
  Filter,
  Mail,
  Phone,
  MapPin,
  BookOpen,
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  X,
  Check,
  AlertCircle,
  Users,
  ChevronDown,
} from "lucide-react";
import Card from "./common/Card";
import Modal from "./common/Modal";
import Table from "./common/Table";

const ManageTeachers = () => {
  const [teachers, setTeachers] = useState([]);
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [sections, setSections] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    // section: "",
    rollNo: "",
    phone: "",
    address: "",
    qualification: "",
    specialization: "",
    joiningDate: "",
  });

  const API_URL = process.env.REACT_APP_API_URL;
  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    filterTeachers();
  }, [searchTerm, filterSection, teachers]);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/admin/teachers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const teachersList = data.data || [];
        setTeachers(teachersList);
        setFilteredTeachers(teachersList);

        // Extract unique sections
        const uniqueSections = [
          ...new Set(teachersList.map((t) => t.section).filter(Boolean)),
        ];
        setSections(uniqueSections);
      }
    } catch (error) {
      console.error("Error fetching teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterTeachers = () => {
    let filtered = [...teachers];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name?.toLowerCase().includes(term) ||
          t.email?.toLowerCase().includes(term) ||
          t.rollNo?.toLowerCase().includes(term),
      );
    }

    if (filterSection) {
      filtered = filtered.filter((t) => t.section === filterSection);
    }

    setFilteredTeachers(filtered);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.rollNo) {
      alert("Please fill all required fields");
      return;
    }

    const tempId = "temp-" + Date.now();
    const optimisticTeacher = {
      _id: tempId,
      ...formData,
      optimistic: true,
      createdAt: new Date().toISOString(),
    };

    setTeachers((prev) => [optimisticTeacher, ...prev]);
    setShowForm(false);

    try {
      const res = await fetch(`${API_URL}/admin/create-teacher`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      setTeachers((prev) =>
        prev.map((t) =>
          t._id === tempId ? { ...data.data, optimistic: false } : t,
        ),
      );

      setFormData({
        name: "",
        email: "",
        section: "",
        rollNo: "",
        phone: "",
        address: "",
        qualification: "",
        specialization: "",
        joiningDate: "",
      });
    } catch (err) {
      setTeachers((prev) => prev.filter((t) => t._id !== tempId));
      alert(err.message);
    }
  };

  const viewTeacherDetails = (teacher) => {
    setSelectedTeacher(teacher);
    setShowDetails(true);
  };

  const columns = [
    {
      header: "Teacher",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <span className="text-indigo-600 font-semibold">
              {row.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{row.name}</p>
            <p className="text-sm text-gray-500">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Section",
      accessor: "section",
      cell: (row) => (
        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm">
          Section {row.section}
        </span>
      ),
    },
    {
      header: "Roll No",
      accessor: "rollNo",
    },
    {
      header: "Status",
      cell: (row) => (
        <span className="flex items-center gap-1">
          {row.optimistic ? (
            <>
              <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-yellow-600 text-sm">Saving...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 text-green-500" />
              <span className="text-green-600 text-sm">Active</span>
            </>
          )}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <button
            onClick={() => viewTeacherDetails(row)}
            className="p-1 hover:bg-gray-100 rounded"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-gray-600" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded" title="Edit">
            <Edit className="w-4 h-4 text-blue-600" />
          </button>
          <button className="p-1 hover:bg-gray-100 rounded" title="Delete">
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Manage Teachers
            </h1>
            <p className="text-gray-500 mt-1">
              {filteredTeachers.length} teachers found
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add Teacher
          </button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search teachers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="">All Sections</option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    Section {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSearchTerm("");
                  setFilterSection("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </Card>

        {/* Teachers Table */}
        <Card>
          <Table
            columns={columns}
            data={filteredTeachers}
            loading={loading}
            emptyMessage="No teachers found"
          />
        </Card>

        {/* Add Teacher Modal */}
        <Modal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          title="Add New Teacher"
          size="lg"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="teacher@example.com"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Section <span className="text-red-500">*</span>
                </label>
                <input
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="A"
                />
              </div> */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Roll Number <span className="text-red-500">*</span>
                </label>
                <input
                  name="rollNo"
                  value={formData.rollNo}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="T001"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="+1234567890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Qualification
                </label>
                <input
                  name="qualification"
                  value={formData.qualification}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="M.Sc., B.Ed"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="123 Main St, City"
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
                Create Teacher
              </button>
            </div>
          </form>
        </Modal>

        {/* Teacher Details Modal */}
        <Modal
          isOpen={showDetails}
          onClose={() => setShowDetails(false)}
          title="Teacher Details"
          size="lg"
        >
          {selectedTeacher && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl text-indigo-600 font-semibold">
                    {selectedTeacher.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedTeacher.name}
                  </h2>
                  <p className="text-gray-500">{selectedTeacher.email}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Section</p>
                  <p className="font-medium text-gray-900">
                    Section {selectedTeacher.section}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Roll Number</p>
                  <p className="font-medium text-gray-900">
                    {selectedTeacher.rollNo}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Teaching Sections</p>
                  <p className="font-medium text-gray-900">
                    {selectedTeacher.teachingSections?.join(', ') || "None"}
                  </p>
                </div>
                {/* <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Phone</p>
                  <p className="font-medium text-gray-900">
                    {selectedTeacher.phone || "N/A"}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Qualification</p>
                  <p className="font-medium text-gray-900">
                    {selectedTeacher.qualification || "N/A"}
                  </p>
                </div> */}
              </div>

              {selectedTeacher.address && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Address</p>
                  <p className="text-gray-900">{selectedTeacher.address}</p>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default ManageTeachers;
