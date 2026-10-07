const express = require("express");
const router = express.Router();
const protegerRuta = require("../middleware/authMiddleware");
const { soloAdmin } = require("../middleware/authMiddleware");
const {
  registrarVenta,
  obtenerVentas,
  actividadReciente,
  eliminarVenta,
} = require("../controllers/ventaController");

router.get("/", protegerRuta, obtenerVentas);
router.get("/actividad", protegerRuta, actividadReciente);
router.post("/", protegerRuta, registrarVenta);
router.delete("/:id", protegerRuta, soloAdmin, eliminarVenta);

module.exports = router;
