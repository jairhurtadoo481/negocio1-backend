const Producto = require("../models/Producto");
const subirImagen = require("../config/cloudinaryUpload");
const { subirVideo } = require("../config/cloudinaryUpload");
const cloudinary = require("../config/cloudinary");

const calcularOfertaActiva = (producto) => {
  const obj = producto.toObject ? producto.toObject() : producto;
  const ahora = new Date();

  const ofertaVigente =
    obj.precioOferta !== null &&
    obj.precioOferta !== undefined &&
    obj.ofertaInicio &&
    obj.ofertaFin &&
    ahora >= new Date(obj.ofertaInicio) &&
    ahora <= new Date(obj.ofertaFin);

  return { ...obj, ofertaActiva: ofertaVigente };
};

const crearProducto = async (req, res) => {
  try {
    const producto = new Producto(req.body);
    await producto.save();
    res.status(201).json(calcularOfertaActiva(producto));
  } catch (error) {
    res.status(400).json({ mensaje: "Error al crear producto", error: error.message });
  }
};

const obtenerProductos = async (req, res) => {
  try {
    const filtro = {};
    if (req.query.categoria) filtro.categoria = req.query.categoria;
    if (req.query.destacado) filtro.destacado = req.query.destacado === "true";
    filtro.activo = true;

    if (req.query.q) {
      const textoEscapado = req.query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(textoEscapado, "i");
      filtro.$or = [{ nombre: regex }, { descripcion: regex }];
    }

    if (req.query.enOferta === "true") {
      const ahora = new Date();
      filtro.precioOferta = { $ne: null };
      filtro.ofertaInicio = { $lte: ahora };
      filtro.ofertaFin = { $gte: ahora };
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const [productos, total] = await Promise.all([
      Producto.find(filtro).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Producto.countDocuments(filtro),
    ]);

    res.json({
      productos: productos.map(calcularOfertaActiva),
      total,
      pagina: page,
      totalPaginas: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener productos", error: error.message });
  }
};

const obtenerProductoPorId = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }
    res.json(calcularOfertaActiva(producto));
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener producto", error: error.message });
  }
};

const obtenerVariantes = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    if (!producto.modeloBase) {
      return res.json([]);
    }

    const variantes = await Producto.find({
      modeloBase: producto.modeloBase,
      _id: { $ne: producto._id },
      activo: true,
    });

    res.json(variantes.map(calcularOfertaActiva));
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener variantes", error: error.message });
  }
};

const actualizarProducto = async (req, res) => {
  try {
    const producto = await Producto.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }
    res.json(calcularOfertaActiva(producto));
  } catch (error) {
    res.status(400).json({ mensaje: "Error al actualizar producto", error: error.message });
  }
};

const eliminarProducto = async (req, res) => {
  try {
    const producto = await Producto.findByIdAndDelete(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    const pendientes = [
      ...producto.imagenes.map((url) => ({ url, tipo: "image" })),
      ...(producto.videos || []).map((url) => ({ url, tipo: "video" })),
    ];
    await Promise.allSettled(
      pendientes
        .map(({ url, tipo }) => ({ publicId: extraerPublicId(url), tipo }))
        .filter(({ publicId }) => publicId)
        .map(({ publicId, tipo }) => cloudinary.uploader.destroy(publicId, { resource_type: tipo, invalidate: true }))
    );

    res.json({ mensaje: "Producto eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar producto", error: error.message });
  }
};

const subirImagenesProducto = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ mensaje: "No se enviaron imagenes" });
    }

    const urls = [];
    for (const archivo of req.files) {
      const resultado = await subirImagen(archivo.buffer);
      urls.push(resultado.secure_url);
    }

    producto.imagenes.push(...urls);
    await producto.save();

    res.json(calcularOfertaActiva(producto));
  } catch (error) {
    res.status(500).json({ mensaje: "Error al subir imagenes", error: error.message });
  }
};

const extraerPublicId = (url) => {
  const partes = url.split("/upload/")[1];
  if (!partes) return null;
  const sinVersion = partes.replace(/^v[0-9]+\//, "");
  const sinExtension = sinVersion.replace(/\.[^/.]+$/, "");
  return sinExtension;
};

const eliminarImagenProducto = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ mensaje: "Falta la url de la imagen a eliminar" });
    }

    if (!producto.imagenes.includes(url)) {
      return res.status(404).json({ mensaje: "Esa imagen no pertenece a este producto" });
    }

    const publicId = extraerPublicId(url);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { invalidate: true });
    }

    producto.imagenes = producto.imagenes.filter((img) => img !== url);
    await producto.save();

    res.json(calcularOfertaActiva(producto));
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar imagen", error: error.message });
  }
};

const MAX_VIDEOS = 3;

const subirVideosProducto = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ mensaje: "No se enviaron videos" });
    }

    const actuales = (producto.videos || []).length;
    if (actuales + req.files.length > MAX_VIDEOS) {
      return res.status(400).json({
        mensaje: `Cada producto puede tener hasta ${MAX_VIDEOS} videos (ya tiene ${actuales})`,
      });
    }

    const urls = [];
    for (const archivo of req.files) {
      const resultado = await subirVideo(archivo.buffer);
      urls.push(resultado.secure_url);
    }

    producto.videos.push(...urls);
    await producto.save();

    res.json(calcularOfertaActiva(producto));
  } catch (error) {
    res.status(500).json({ mensaje: "Error al subir videos", error: error.message });
  }
};

const eliminarVideoProducto = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ mensaje: "Falta la url del video a eliminar" });
    }

    if (!(producto.videos || []).includes(url)) {
      return res.status(404).json({ mensaje: "Ese video no pertenece a este producto" });
    }

    const publicId = extraerPublicId(url);
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { resource_type: "video", invalidate: true });
    }

    producto.videos = producto.videos.filter((v) => v !== url);
    await producto.save();

    res.json(calcularOfertaActiva(producto));
  } catch (error) {
    res.status(500).json({ mensaje: "Error al eliminar video", error: error.message });
  }
};

const venderTalla = async (req, res) => {
  try {
    const producto = await Producto.findById(req.params.id);
    if (!producto) {
      return res.status(404).json({ mensaje: "Producto no encontrado" });
    }

    const { talla, cantidad } = req.body;
    if (!talla || !cantidad || cantidad <= 0) {
      return res.status(400).json({ mensaje: "Debes indicar talla y cantidad (mayor a 0)" });
    }

    const itemTalla = producto.tallas.find((t) => t.talla === talla);
    if (!itemTalla) {
      return res.status(404).json({ mensaje: "Esa talla no existe para este producto" });
    }

    if (itemTalla.stock < cantidad) {
      return res.status(400).json({
        mensaje: `Stock insuficiente. Disponible: ${itemTalla.stock}, solicitado: ${cantidad}`,
      });
    }

    itemTalla.stock -= cantidad;
    await producto.save();

    res.json({
      mensaje: "Venta registrada correctamente",
      producto: calcularOfertaActiva(producto),
      stockBajo: itemTalla.stock <= 2,
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al registrar venta", error: error.message });
  }
};

module.exports = {
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
};