const path = require("path");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const LOGO_PATH = path.join(__dirname, "..", "assets", "logo.png");

const TIPO_DOC_CODE = { DNI: "1", RUC: "6" };
const TIPO_COMPROBANTE_CODE = { factura: "01", boleta: "03", nota_credito: "07" };
const TIPO_COMPROBANTE_TEXTO = {
  factura: "FACTURA ELECTRONICA",
  boleta: "BOLETA DE VENTA ELECTRONICA",
  nota_credito: "NOTA DE CREDITO ELECTRONICA",
};

const construirContenidoQr = (comprobante, emisor) => {
  const campos = [
    emisor.ruc,
    TIPO_COMPROBANTE_CODE[comprobante.tipo],
    comprobante.serie,
    String(comprobante.correlativo),
    comprobante.igv.toFixed(2),
    comprobante.total.toFixed(2),
    comprobante.fechaEmision,
    TIPO_DOC_CODE[comprobante.cliente.tipoDocumento],
    comprobante.cliente.documento,
  ];
  return campos.join("|") + "|";
};

const generarPdfComprobante = async (comprobante, emisor) => {
  const qrBuffer = await QRCode.toBuffer(construirContenidoQr(comprobante, emisor), {
    margin: 1,
    width: 150,
  });

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [420, 650], margin: 20 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const anchoUtil = right - left;

    // Encabezado: logo + datos de la empresa a la izquierda, caja RUC/tipo a la derecha
    const anchoCaja = 150;
    const xCaja = right - anchoCaja;
    const yEncabezado = doc.y;

    try {
      doc.image(LOGO_PATH, left, yEncabezado, { width: 55, height: 55 });
    } catch (e) {
      // si el logo no esta disponible, seguimos sin el
    }

    const xInfo = left + 65;
    const anchoInfo = xCaja - xInfo - 10;
    doc.font("Helvetica-Bold").fontSize(11).text(emisor.nombreComercial || emisor.razonSocial, xInfo, yEncabezado, { width: anchoInfo });
    doc.font("Helvetica").fontSize(7.5);
    doc.text(emisor.razonSocial, xInfo, doc.y, { width: anchoInfo });
    if (emisor.direccion) doc.text(emisor.direccion, xInfo, doc.y, { width: anchoInfo });

    doc.lineWidth(0.8).rect(xCaja, yEncabezado, anchoCaja, 70).stroke();
    doc.font("Helvetica-Bold").fontSize(8).text(`RUC: ${emisor.ruc}`, xCaja + 5, yEncabezado + 6, { width: anchoCaja - 10, align: "center" });
    doc.fontSize(9).text(TIPO_COMPROBANTE_TEXTO[comprobante.tipo], xCaja + 5, doc.y + 3, { width: anchoCaja - 10, align: "center" });
    doc.fontSize(11).text(`${comprobante.serie}-${comprobante.correlativo}`, xCaja + 5, doc.y + 3, { width: anchoCaja - 10, align: "center" });

    doc.x = left;
    doc.y = yEncabezado + 78;
    doc.lineWidth(0.5).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
    doc.moveDown(0.6);
    doc.x = left;

    // Datos del cliente (dos columnas)
    const xColB = left + anchoUtil * 0.62;
    const yCliente = doc.y;
    doc.font("Helvetica-Bold").fontSize(7.5);
    doc.text("CLIENTE:", left, yCliente, { continued: true, width: xColB - left - 5 });
    doc.font("Helvetica").text(` ${comprobante.cliente.nombre}`);

    doc.font("Helvetica-Bold").text(`${comprobante.cliente.tipoDocumento}:`, xColB, yCliente, { continued: true });
    doc.font("Helvetica").text(` ${comprobante.cliente.documento}`);

    doc.x = left;
    const yFila2 = doc.y;
    doc.font("Helvetica-Bold").text("DIRECCION:", left, yFila2, { continued: true, width: xColB - left - 5 });
    doc.font("Helvetica").text(` ${comprobante.cliente.direccion || "-"}`);

    doc.font("Helvetica-Bold").text("FECHA:", xColB, yFila2, { continued: true });
    doc.font("Helvetica").text(` ${comprobante.fechaEmision}`);

    doc.x = left;
    const yFila3 = doc.y;
    doc.font("Helvetica-Bold").text("FORMA PAGO:", left, yFila3, { continued: true, width: xColB - left - 5 });
    doc.font("Helvetica").text(" CONTADO");

    doc.font("Helvetica-Bold").text("MONEDA:", xColB, yFila3, { continued: true });
    doc.font("Helvetica").text(" SOLES");

    if (comprobante.tipo === "nota_credito" && comprobante.comprobanteAfectado) {
      doc.x = left;
      const yFila4 = doc.y;
      const afectado = comprobante.comprobanteAfectado;
      doc.font("Helvetica-Bold").text("REFIERE A:", left, yFila4, { continued: true, width: xColB - left - 5 });
      doc.font("Helvetica").text(` ${afectado.serie}-${afectado.correlativo}`);
      doc.font("Helvetica-Bold").text("MOTIVO:", xColB, yFila4, { continued: true });
      doc.font("Helvetica").text(` ${comprobante.motivoDescripcion || ""}`);
    }

    doc.x = left;
    doc.moveDown(0.6);
    doc.x = left;

    // Tabla de items
    const wN = 20, wCant = 28, wUM = 35, wPU = 50, wImp = 55;
    const wDesc = anchoUtil - (wN + wCant + wUM + wPU + wImp);
    const colN = left;
    const colCant = colN + wN;
    const colUM = colCant + wCant;
    const colDesc = colUM + wUM;
    const colPU = colDesc + wDesc;
    const colImp = colPU + wPU;

    doc.rect(left, doc.y, anchoUtil, 16).fill("#111827");
    const yCab = doc.y + 4;
    doc.fillColor("white").font("Helvetica-Bold").fontSize(7.5);
    doc.text("N°", colN, yCab, { width: wN, align: "center" });
    doc.text("CANT.", colCant, yCab, { width: wCant, align: "center" });
    doc.text("U.M.", colUM, yCab, { width: wUM, align: "center" });
    doc.text("DESCRIPCION", colDesc, yCab, { width: wDesc });
    doc.text("P.U.", colPU, yCab, { width: wPU, align: "right" });
    doc.text("IMPORTE", colImp, yCab, { width: wImp, align: "right" });
    doc.fillColor("black");
    doc.x = left;
    doc.y = yCab + 14;

    doc.font("Helvetica").fontSize(7.5);
    comprobante.items.forEach((item, indice) => {
      const importe = item.cantidad * item.precioUnitario;
      const yFila = doc.y;
      const alturaDesc = doc.heightOfString(item.descripcion, { width: wDesc - 5 });
      doc.text(String(indice + 1), colN, yFila, { width: wN, align: "center" });
      doc.text(String(item.cantidad), colCant, yFila, { width: wCant, align: "center" });
      doc.text("UNIDAD", colUM, yFila, { width: wUM, align: "center" });
      doc.text(item.descripcion, colDesc, yFila, { width: wDesc - 5 });
      doc.text(item.precioUnitario.toFixed(2), colPU, yFila, { width: wPU, align: "right" });
      doc.text(importe.toFixed(2), colImp, yFila, { width: wImp, align: "right" });
      doc.x = left;
      doc.y = yFila + Math.max(alturaDesc, 10) + 5;
    });

    doc.x = left;
    doc.lineWidth(0.5).moveTo(left, doc.y).lineTo(right, doc.y).stroke();
    doc.moveDown(0.5);
    doc.x = left;

    // SON: ... / IMPORTE TOTAL en la misma linea
    const ySon = doc.y;
    const anchoSon = anchoUtil * 0.6;
    doc.font("Helvetica-Bold").fontSize(7.5).text(comprobante.montoEnLetras, left, ySon, { width: anchoSon });
    doc.fontSize(9).text(`IMPORTE TOTAL: S/ ${comprobante.total.toFixed(2)}`, left + anchoSon, ySon, {
      width: anchoUtil - anchoSon,
      align: "right",
    });
    doc.x = left;
    doc.moveDown(1);
    doc.x = left;

    // Observaciones + QR
    const yObs = doc.y;
    const altoObs = 70;
    doc.lineWidth(0.5).rect(left, yObs, anchoUtil, altoObs).stroke();
    doc.font("Helvetica-Bold").fontSize(7).text("OBSERVACIONES:", left + 8, yObs + 8, { width: anchoUtil - 100 });
    doc.font("Helvetica").fontSize(6.5);
    doc.text("Representacion impresa de la " + TIPO_COMPROBANTE_TEXTO[comprobante.tipo] + ".", left + 8, doc.y + 2, {
      width: anchoUtil - 100,
    });
    doc.text("Consulte la validez de este comprobante en la pagina web de SUNAT.", left + 8, doc.y + 2, {
      width: anchoUtil - 100,
    });
    doc.image(qrBuffer, right - 75, yObs + 8, { width: 60 });

    doc.x = left;
    doc.y = yObs + altoObs + 15;
    doc.font("Helvetica-Bold").fontSize(8).text("GRACIAS POR SU PREFERENCIA...", left, doc.y, { width: anchoUtil, align: "center" });

    doc.end();
  });
};

module.exports = { generarPdfComprobante, construirContenidoQr };
