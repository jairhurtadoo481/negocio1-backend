const express = require("express");
const router = express.Router();
const protegerRuta = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const subirVideos = require("../middleware/uploadVideoMiddleware");
const {
  crearProducto,
  obtenerProductos,
  obtenerProductoPorId,
  obtenerVariantes,
  actualizarProducto,
  eliminarProducto,
  subirImagenesProducto,
  eliminarImagenProducto,
  subirVideosProducto,
  eliminarVideoProducto,
  venderTalla,
} = require("../controllers/productoController");

router.get("/", obtenerProductos);
router.get("/:id", obtenerProductoPorId);
router.get("/:id/variantes", obtenerVariantes);
router.post("/", protegerRuta, crearProducto);
router.put("/:id", protegerRuta, actualizarProducto);
router.delete("/:id", protegerRuta, eliminarProducto);
router.post("/:id/imagenes", protegerRuta, upload.array("imagenes", 5), subirImagenesProducto);
router.delete("/:id/imagenes", protegerRuta, eliminarImagenProducto);
router.post("/:id/videos", protegerRuta, subirVideos("videos", 3), subirVideosProducto);
router.delete("/:id/videos", protegerRuta, eliminarVideoProducto);
router.post("/:id/vender", protegerRuta, venderTalla);

module.exports = router;