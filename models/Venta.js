const mongoose = require("mongoose");

const ventaSchema = new mongoose.Schema({
  producto: { type: mongoose.Schema.Types.ObjectId, ref: "Producto", required: true },
  codigo: { type: String, default: "" },
  nombre: { type: String, required: true },
  imagen: { type: String, default: null },
  talla: { type: String, required: true },
  cantidad: { type: Number, required: true, default: 1 },
  precioUnitario: { type: Number, required: true },
  descuento: { type: Number, default: 0 },
  vendedorId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", default: null },
  vendedorNombre: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.model("Venta", ventaSchema);
