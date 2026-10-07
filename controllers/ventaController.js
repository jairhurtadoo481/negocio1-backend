const Venta = require("../models/Venta");
const Producto = require("../models/Producto");
const Usuario = require("../models/Usuario");

const registrarVenta = async (req, res) => {
  try {
    const { productoId, codigo, talla, cantidad, descuento } = req.body;

    if ((!productoId && !codigo) || !talla || !cantidad || cantidad <= 0) {
      return res.status(400).json({ mensaje: "Debes indicar el producto, el tamaño y la cantidad (mayor a 0)" });
    }

    const producto = productoId
      ? await Producto.findById(productoId)
      : await Producto.findOne({ codigo: String(codigo).trim() });
    if (!producto) {
      return res.status(404).json({ mensaje: "No se encontró el producto" });
    }

    const itemTalla = producto.tallas.find((t) => t.talla === talla);
    if (!itemTalla) {
      return res.status(404).json({ mensaje: `"${producto.nombre}" no tiene el tamaño ${talla}` });
    }

    if (itemTalla.stock < cantidad) {
      return res.status(400).json({
        mensaje: `Stock insuficiente para "${producto.nombre}" (${talla}). Disponible: ${itemTalla.stock}`,
      });
    }

    const ahora = new Date();
    const ofertaActiva =
      producto.precioOferta !== null &&
      producto.precioOferta !== undefined &&
      producto.ofertaInicio &&
      producto.ofertaFin &&
      ahora >= new Date(producto.ofertaInicio) &&
      ahora <= new Date(producto.ofertaFin);

    const precioUnitario = ofertaActiva ? producto.precioOferta : producto.precio;
    const descuentoAplicado = Number(descuento) || 0;
    const totalSinDescuento = precioUnitario * cantidad;

    if (descuentoAplicado < 0) {
      return res.status(400).json({ mensaje: "El descuento no puede ser negativo" });
    }

    if (descuentoAplicado > totalSinDescuento) {
      return res.status(400).json({ mensaje: "El descuento no puede ser mayor al total de la venta" });
    }

    itemTalla.stock -= cantidad;
    await producto.save();

    let vendedorNombre = "";

    if (req.usuarioId) {
      const vendedor = await Usuario.findById(req.usuarioId);
      if (vendedor) vendedorNombre = vendedor.nombre;

    }

    const venta = new Venta({
      producto: producto._id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      imagen: producto.imagenes && producto.imagenes.length > 0 ? producto.imagenes[0] : null,
      talla,
      cantidad,
      precioUnitario,
      descuento: descuentoAplicado,
      vendedorId: req.usuarioId || null,
      vendedorNombre,
    });

    await venta.save();

    res.status(201).json(venta);
  } catch (error) {
    res.status(400).json({ mensaje: "Error al registrar venta", error: error.message });
  }
};

const obtenerVentas = async (req, res) => {
  try {
    const ventas = await Venta.find().sort({ createdAt: -1 });
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener ventas", error: error.message });
  }
};

const actividadReciente = async (req, res) => {
  try {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const ventasHoy = await Venta.find({ createdAt: { $gte: inicioHoy } }).sort({ createdAt: -1 });

    res.json({
      ultimaVentaId: ventasHoy.length > 0 ? ventasHoy[0]._id : null,
      totalHoy: ventasHoy.length,
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener actividad", error: error.message });
  }
};

const eliminarVenta = async (req, res) => {
  try {
    const venta = await Venta.findById(req.params.id);
    if (!venta) {
      return res.status(404).json({ mensaje: "Venta no encontrada" });
    }

    const producto = await Producto.findById(venta.producto);
    if (producto) {
      const itemTalla = producto.tallas.find((t) => t.talla === venta.talla);
      if (itemTalla) {
        itemTalla.stock += venta.cantidad;
        await producto.save();
      }
    }

    await Venta.findByIdAndDelete(req.params.id);

    res.json({ mensaje: "Venta eliminada y stock restaurado correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar venta", error: error.message });
  }
};

module.exports = {
  registrarVenta,
  obtenerVentas,
  actividadReciente,
  eliminarVenta,
};
