const { filterUserByRole, filterUsersByRole } = require("../utils/responseFormatter");

/**
 * Middleware that intercepts res.json() and filters User objects
 * based on the requesting user's role.
 */
const autoFilterUserResponses = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (data) => {
    if (!data || !req.user) return originalJson(data);

    const role = req.user.role;

    // Filter single user object: { user: {...} }
    if (data.user && typeof data.user === "object" && !Array.isArray(data.user) && data.user.email) {
      data.user = filterUserByRole(data.user, role);
    }

    // Filter arrays of user objects
    const arrayKeys = ["users", "students", "teachers", "admins"];
    arrayKeys.forEach((key) => {
      if (Array.isArray(data[key]) && data[key].length > 0 && data[key][0]?.email) {
        data[key] = filterUsersByRole(data[key], role);
      }
    });

    // Filter "data" arrays that contain user objects
    if (Array.isArray(data.data) && data.data.length > 0 && data.data[0]?.email) {
      data.data = filterUsersByRole(data.data, role);
    }

    return originalJson(data);
  };

  next();
};

module.exports = { autoFilterUserResponses };
