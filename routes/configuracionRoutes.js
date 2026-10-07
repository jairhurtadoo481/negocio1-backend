const express = require("express");
const router = express.Router();
const protegerRuta = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const {
  obtenerConfiguracion,
  subirQrYape,
  subirQrPlin,
} = require("../controllers/configuracionController");
router.get("/", obtenerConfiguracion);
router.post("/qr-yape", protegerRuta, upload.single("imagen"), subirQrYape);
router.post("/qr-plin", protegerRuta, upload.single("imagen"), subirQrPlin);
module.exports = router;