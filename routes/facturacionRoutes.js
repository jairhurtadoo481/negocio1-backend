const express = require("express");
const router = express.Router();
const protegerRuta = require("../middleware/authMiddleware");
const { soloAdmin } = require("../middleware/authMiddleware");
const uploadCert = require("../middleware/uploadCertMiddleware");
const {
  obtenerConfiguracion,
  guardarDatosEmpresa,
  guardarCredencialesSol,
  subirCertificado,
  buscarDocumento,
  guardarCliente,
  emitir,
  emitirNota,
  listarComprobantes,
} = require("../controllers/facturacionController");

router.get("/configuracion", protegerRuta, soloAdmin, obtenerConfiguracion);
router.put("/configuracion/empresa", protegerRuta, soloAdmin, guardarDatosEmpresa);
router.put("/configuracion/credenciales-sol", protegerRuta, soloAdmin, guardarCredencialesSol);
router.post("/configuracion/certificado", protegerRuta, soloAdmin, uploadCert.single("certificado"), subirCertificado);
router.get("/documento/:tipo/:numero", protegerRuta, soloAdmin, buscarDocumento);
router.put("/clientes/:documento", protegerRuta, soloAdmin, guardarCliente);
router.post("/emitir", protegerRuta, soloAdmin, emitir);
router.post("/notas-credito", protegerRuta, soloAdmin, emitirNota);
router.get("/comprobantes", protegerRuta, soloAdmin, listarComprobantes);

module.exports = router;
