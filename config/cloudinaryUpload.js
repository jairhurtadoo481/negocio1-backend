const cloudinary = require("./cloudinary");
const streamifier = require("streamifier");

const subirImagen = (buffer, carpeta = "tejidos-macu/productos") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: carpeta },
      (error, resultado) => {
        if (error) return reject(error);
        resolve(resultado);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

const subirVideo = (buffer, carpeta = "tejidos-macu/videos") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: carpeta, resource_type: "video" },
      (error, resultado) => {
        if (error) return reject(error);
        resolve(resultado);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

const subirArchivo = (buffer, carpeta, nombrePublico) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: carpeta, public_id: nombrePublico, resource_type: "raw", overwrite: true },
      (error, resultado) => {
        if (error) return reject(error);
        resolve(resultado);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

module.exports = subirImagen;
module.exports.subirArchivo = subirArchivo;
module.exports.subirVideo = subirVideo;
