const jwt = require("jsonwebtoken");

const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "Access denied" });
    }
  
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = verified.userId;
      next();
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  module.exports = authenticateToken;