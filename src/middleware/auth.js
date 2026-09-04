const bcrypt = require("bcryptjs");

function hashPassword(plainPassword) {
  return bcrypt.hashSync(plainPassword, 10);
}

function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compareSync(plainPassword, hashedPassword);
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.counselorId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  next();
}

module.exports = { hashPassword, verifyPassword, requireAuth };
