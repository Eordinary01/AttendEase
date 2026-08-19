const mongoose = require("mongoose");

const permissionList = [
  "attendance:read", "attendance:write", "attendance:report",
  "exam:create", "exam:grade", "exam:read", "exam:publish", "exam:update", "exam:delete",
  "fee:collect", "fee:read", "fee:waive",
  "students:read", "students:write",
  "timetable:read", "timetable:write",
  "subjects:read", "subjects:write",
  "reports:view", "reports:export",
  "alerts:create", "alerts:manage",
  "tickets:verify",
  "settings:read", "settings:write",
];

const customRoleSchema = mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  permissions: [{
    type: String,
    enum: permissionList,
  }],
  assignedSections: [{
    type: String,
    trim: true,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { timestamps: true });

customRoleSchema.index({ tenantId: 1, name: 1 }, { unique: true });
customRoleSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model("CustomRole", customRoleSchema);
module.exports.permissionList = permissionList;
