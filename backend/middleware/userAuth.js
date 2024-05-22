const userAuth = (...allowedRoles) => {
    return async (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
  
      if (allowedRoles.length === 0 || allowedRoles.includes(req.user.role)) {
        next();
      } else {
        res.status(403).json({ message: 'Forbidden' });
      }
    };
  };
  
  module.exports = userAuth;