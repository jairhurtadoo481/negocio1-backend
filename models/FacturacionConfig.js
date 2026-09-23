const mongoose = require("mongoose");

const facturacionConfigSchema = new mongoose.Schema({
  ruc: { type: String, default: null },
  razonSocial: { type: String, default: null },
  nombreComercial: { type: String, default: null },
  direccion: { type: String, default: null },
  usuarioSolCifrado: { type: String, default: null },
  claveSolCifrada: { type: String, default: null },
  certificadoCifrado: { type: String, default: null },
  claveCertificadoCifrada: { type: String, default: null },
  ambiente: { type: String, enum: ["beta", "produccion"], default: "beta" },
  series: {
    factura: { type: String, default: "F001" },
    boleta: { type: String, default: "B001" },
    notaCreditoFactura: { type: String, default: "FC01" },
    notaCreditoBoleta: { type: String, default: "BC01" },
  },
  correlativos: {
    factura: { type: Number, default: 0 },
    boleta: { type: Number, default: 0 },
    notaCreditoFactura: { type: Number, default: 0 },
    notaCreditoBoleta: { type: Number, default: 0 },
  },
}, { timestamps: true });

module.exports = mongoose.model("FacturacionConfig", facturacionConfigSchema);
