const express = require("express");
const { getUser, login, register } = require("../controllers/AuthControllers");
const authenticateToken = require("../middlewares/authenticateToken");

const router = express.Router();

router.get("/user", authenticateToken, getUser);
router.post("/login", login);
router.post("/register", register);
module.exports = router;
