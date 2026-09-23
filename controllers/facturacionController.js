const FacturacionConfig = require("../models/FacturacionConfig");
const Cliente = require("../models/Cliente");
const Comprobante = require("../models/Comprobante");
const { cifrar } = require("../config/cifrado");
const { emitirComprobante, emitirNotaCredito } = require("../lib/emitirComprobante");

const MOTIVOS_NOTA_CREDITO = {
  "01": "Anulacion de la operacion",
  "02": "Anulacion por error en el RUC",
  "03": "Correccion por error en la descripcion",
  "04": "Descuento global",
  "05": "Descuento por item",
  "06": "Devolucion total",
  "07": "Devolucion por item",
  "10": "Otros conceptos",
};

const obtenerConfigDoc = async () => {
  let config = await FacturacionConfig.findOne();
  if (!config) {
    config = new FacturacionConfig();
    await config.save();
  }
  return config;
};

const obtenerConfiguracion = async (req, res) => {
  try {
    const config = await obtenerConfigDoc();
    res.json({
      ruc: config.ruc,
      razonSocial: config.razonSocial,
      nombreComercial: config.nombreComercial,
      direccion: config.direccion,
      ambiente: config.ambiente,
      series: config.series,
      correlativos: config.correlativos,
      tieneCertificado: Boolean(config.certificadoCifrado),
      tieneCredencialesSol: Boolean(config.usuarioSolCifrado && config.claveSolCifrada),
    });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener configuracion de facturacion", error: error.message });
  }
};

const guardarDatosEmpresa = async (req, res) => {
  try {
    const { ruc, razonSocial, nombreComercial, direccion, ambiente, serieBoleta, serieFactura } = req.body;
    const config = await obtenerConfigDoc();
    if (ruc !== undefined) config.ruc = ruc;
    if (razonSocial !== undefined) config.razonSocial = razonSocial;
    if (nombreComercial !== undefined) config.nombreComercial = nombreComercial;
    if (direccion !== undefined) config.direccion = direccion;
    if (ambiente !== undefined) config.ambiente = ambiente;
    if (serieBoleta !== undefined && serieBoleta !== config.series.boleta) {
      config.series.boleta = serieBoleta;
      config.correlativos.boleta = 0;
    }
    if (serieFactura !== undefined && serieFactura !== config.series.factura) {
      config.series.factura = serieFactura;
      config.correlativos.factura = 0;
    }
    await config.save();
    res.json({ mensaje: "Datos de la empresa guardados" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al guardar datos de la empresa", error: error.message });
  }
};

const guardarCredencialesSol = async (req, res) => {
  try {
    const { usuarioSol, claveSol } = req.body;
    if (!usuarioSol || !claveSol) {
      return res.status(400).json({ mensaje: "Falta usuario o clave SOL" });
    }
    const config = await obtenerConfigDoc();
    config.usuarioSolCifrado = cifrar(usuarioSol);
    config.claveSolCifrada = cifrar(claveSol);
    await config.save();
    res.json({ mensaje: "Credenciales SOL guardadas" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al guardar credenciales SOL", error: error.message });
  }
};

const subirCertificado = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ mensaje: "No se envio ningun archivo" });
    }
    const { claveCertificado } = req.body;
    if (!claveCertificado) {
      return res.status(400).json({ mensaje: "Falta la clave del certificado" });
    }
    const config = await obtenerConfigDoc();
    config.certificadoCifrado = cifrar(req.file.buffer);
    config.claveCertificadoCifrada = cifrar(claveCertificado);
    await config.save();
    res.json({ mensaje: "Certificado guardado" });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al guardar el certificado", error: error.message });
  }
};

const buscarDocumento = async (req, res) => {
  try {
    const { tipo, numero } = req.params;
    if (tipo !== "dni" && tipo !== "ruc") {
      return res.status(400).json({ mensaje: "Tipo de documento invalido" });
    }
    if (tipo === "dni" && !/^\d{8}$/.test(numero)) {
      return res.status(400).json({ mensaje: "El DNI debe tener 8 digitos" });
    }
    if (tipo === "ruc" && !/^\d{11}$/.test(numero)) {
      return res.status(400).json({ mensaje: "El RUC debe tener 11 digitos" });
    }

    const clienteExistente = await Cliente.findOne({ documento: numero });
    if (clienteExistente) {
      return res.json({
        documento: clienteExistente.documento,
        nombre: clienteExistente.nombre,
        direccion: clienteExistente.direccion,
        telefono: clienteExistente.telefono || "",
        correo: clienteExistente.correo || "",
        contacto: clienteExistente.contacto || "",
        referencia: clienteExistente.referencia || "",
        esClienteConocido: true,
      });
    }

    const respuesta = await fetch(`https://api.factiliza.com/v1/${tipo}/info/${numero}`, {
      headers: { Authorization: `Bearer ${process.env.FACTILIZA_TOKEN}` },
    });
    const data = await respuesta.json();

    if (!respuesta.ok || !data.success) {
      return res.status(404).json({ mensaje: "No se encontro el documento" });
    }

    const resultado = tipo === "dni"
      ? { documento: data.data.numero, nombre: data.data.nombre_completo, direccion: data.data.direccion_completa || "" }
      : { documento: data.data.numero, nombre: data.data.nombre_o_razon_social, direccion: data.data.direccion_completa || "" };

    await Cliente.findOneAndUpdate(
      { documento: resultado.documento },
      { $setOnInsert: { tipoDocumento: tipo.toUpperCase() }, $set: { nombre: resultado.nombre, direccion: resultado.direccion } },
      { upsert: true }
    );

    res.json({ ...resultado, esClienteConocido: false });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al consultar el documento", error: error.message });
  }
};

const guardarCliente = async (req, res) => {
  try {
    const { documento } = req.params;
    const { tipoDocumento, nombre, direccion, telefono, correo, contacto, referencia } = req.body;
    if (!tipoDocumento || !nombre) {
      return res.status(400).json({ mensaje: "Faltan datos del cliente" });
    }
    const cliente = await Cliente.findOneAndUpdate(
      { documento },
      {
        tipoDocumento,
        nombre,
        direccion: direccion || "",
        telefono: telefono || "",
        correo: correo || "",
        contacto: contacto || "",
        referencia: referencia || "",
      },
      { upsert: true, returnDocument: "after" }
    );
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al guardar el cliente", error: error.message });
  }
};

const emitir = async (req, res) => {
  try {
    const { tipo, cliente, items } = req.body;
    if (tipo !== "factura" && tipo !== "boleta") {
      return res.status(400).json({ mensaje: "Tipo de comprobante invalido" });
    }
    if (!cliente || !cliente.tipoDocumento || !cliente.documento || !cliente.nombre) {
      return res.status(400).json({ mensaje: "Faltan datos del cliente" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ mensaje: "El comprobante debe tener al menos un item" });
    }

    const comprobante = await emitirComprobante({ tipo, cliente, items });
    res.json(comprobante);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al emitir el comprobante", error: error.message });
  }
};

const emitirNota = async (req, res) => {
  try {
    const { comprobanteId, motivoCodigo } = req.body;
    if (!comprobanteId) {
      return res.status(400).json({ mensaje: "Falta el comprobante a anular" });
    }
    if (!motivoCodigo || !MOTIVOS_NOTA_CREDITO[motivoCodigo]) {
      return res.status(400).json({ mensaje: "Motivo de la nota de credito invalido" });
    }

    const notaCredito = await emitirNotaCredito({
      comprobanteAfectadoId: comprobanteId,
      motivoCodigo,
      motivoDescripcion: MOTIVOS_NOTA_CREDITO[motivoCodigo],
    });
    res.json(notaCredito);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al emitir la nota de credito", error: error.message });
  }
};

const listarComprobantes = async (req, res) => {
  try {
    const comprobantes = await Comprobante.find().sort({ createdAt: -1 }).limit(200);
    res.json(comprobantes);
  } catch (error) {
    res.status(500).json({ mensaje: "Error al listar comprobantes", error: error.message });
  }
};

module.exports = {
  obtenerConfiguracion,
  guardarDatosEmpresa,
  guardarCredencialesSol,
  subirCertificado,
  buscarDocumento,
  guardarCliente,
  emitir,
  emitirNota,
  listarComprobantes,
};
