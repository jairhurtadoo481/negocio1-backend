const mongoose = require("mongoose");
const configuracionSchema = new mongoose.Schema({
  qrYape: { type: String, default: null },
  qrPlin: { type: String, default: null },
}, { timestamps: true });
module.exports = mongoose.model("Configuracion", configuracionSchema);
