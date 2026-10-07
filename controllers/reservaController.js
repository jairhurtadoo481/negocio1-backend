const Reserva = require("../models/Reserva");
const Producto = require("../models/Producto");
const subirImagen = require("../config/cloudinaryUpload");

const obtenerSiguienteNumero = async () => {
  const ultima = await Reserva.findOne({ numero: { $exists: true, $type: "number" } }).sort({ numero: -1 });
  return ultima ? ultima.numero + 1 : 1001;
};

const crearReserva = async (req, res) => {
  try {
    const { items, cliente, metodoPago } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ mensaje: "La reserva debe tener al menos un producto" });
    }

    if (!cliente || !cliente.nombre || !cliente.celular || !cliente.ciudad) {
      return res.status(400).json({ mensaje: "Faltan datos obligatorios del cliente" });
    }

    if (cliente.entregaDomicilio && !cliente.direccion) {
      return res.status(400).json({ mensaje: "Falta la direccion para la entrega a domicilio" });
    }

    if (!metodoPago || !["yape", "plin"].includes(metodoPago)) {
      return res.status(400).json({ mensaje: "Debes indicar un metodo de pago valido (yape o plin)" });
    }

    let total = 0;
    let requierePagoCompleto = false;
    const itemsProcesados = [];

    for (const item of items) {
      const producto = await Producto.findById(item.producto);
      if (!producto) {
        return res.status(404).json({ mensaje: `Producto no encontrado: ${item.producto}` });
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

      if (ofertaActiva) requierePagoCompleto = true;

      total += precioUnitario * item.cantidad;

      itemsProcesados.push({
        producto: producto._id,
        nombre: producto.nombre,
        codigo: producto.codigo || "",
        imagen: producto.imagenes && producto.imagenes.length > 0 ? producto.imagenes[0] : null,
        talla: item.talla,
        cantidad: item.cantidad,
        precioUnitario,
        tieneOferta: ofertaActiva,
      });
    }

    if (cliente.ciudad === "fuera") requierePagoCompleto = true;

    const numero = await obtenerSiguienteNumero();

    const reserva = new Reserva({
      numero,
      tipo: "web",
      items: itemsProcesados,
      cliente,
      metodoPago,
      total,
      requierePagoCompleto,
    });

    await reserva.save();
    res.status(201).json(reserva);
  } catch (error) {
    res.status(400).json({ mensaje: "Error al crear reserva", error: error.message });
  }
};

const subirComprobante = async (req, res) => {
  try {
    const reserva = await Reserva.findById(req.params.id);
    if (!reserva) {
      return res.status(404).json({ mensaje: "Reserva no encontrada" });
    }

    if (!req.file) {
      return res.status(400).json({ mensaje: "No se envio ninguna imagen de comprobante" });
    }

    const resultado = await subirImagen(req.file.buffer, "tejidos-macu/comprobantes");
    reserva.comprobante = resultado.secure_url;
    await reserva.save();

    res.json(reserva);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al subir comprobante", error: error.message });
  }
};

const obtenerReservas = async (req, res) => {
  try {
    const filtro = {};

    if (req.query.tipo) {
      filtro.tipo = req.query.tipo;
    }

    if (req.query.historial === "true") {
      filtro.estado = "entregado";
    } else {
      filtro.estado = { $ne: "entregado" };
    }

    const reservas = await Reserva.find(filtro).sort({ createdAt: -1 });
    res.json(reservas);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener reservas", error: error.message });
  }
};

const actualizarEstadoReserva = async (req, res) => {
  try {
    const { estado } = req.body;
    const estadosValidos = ["pendiente", "atendido", "listo_recoger", "entregado", "suspendido"];

    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ mensaje: "Estado invalido" });
    }

    const reserva = await Reserva.findByIdAndUpdate(
      req.params.id,
      { estado },
      { new: true }
    );

    if (!reserva) {
      return res.status(404).json({ mensaje: "Reserva no encontrada" });
    }

    res.json(reserva);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al actualizar reserva", error: error.message });
  }
};

const mensajeEstado = {
  pendiente: "Tu pago esta siendo verificado.",
  atendido: "Estamos tejiendo y coordinando tu pedido, en breve te escribiremos.",
  listo_recoger: "Tu pedido está listo. Coordinaremos la entrega contigo.",
  entregado: "Este pedido ya fue entregado. Gracias por tu compra!",
  suspendido: "Hubo un problema con este pedido, contactanos por WhatsApp.",
};

const seguimientoReserva = async (req, res) => {
  try {
    const { numero, celular } = req.query;

    if (!numero || !celular) {
      return res.status(400).json({ mensaje: "Debes indicar numero de pedido y celular" });
    }

    const reserva = await Reserva.findOne({
      numero: Number(numero),
      "cliente.celular": celular.trim(),
    });

    if (!reserva) {
      return res.status(404).json({ mensaje: "No se encontro ningun pedido con esos datos" });
    }

    res.json({
      numero: reserva.numero,
      estado: reserva.estado,
      mensaje: mensajeEstado[reserva.estado] || "",
      total: reserva.total,
      items: reserva.items,
      createdAt: reserva.createdAt,
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al buscar el pedido", error: error.message });
  }
};

const eliminarReserva = async (req, res) => {
  try {
    const reserva = await Reserva.findByIdAndDelete(req.params.id);
    if (!reserva) {
      return res.status(404).json({ mensaje: "Reserva no encontrada" });
    }
    res.json({ mensaje: "Compra eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar la compra", error: error.message });
  }
};

module.exports = {
  crearReserva,
  subirComprobante,
  obtenerReservas,
  actualizarEstadoReserva,
  seguimientoReserva,
  eliminarReserva,
};