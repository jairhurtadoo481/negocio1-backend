const multer = require("multer");

const MAX_MB = 50;

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de video"), false);
    }
  },
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

const subirVideos = (campo, maximo) => (req, res, next) => {
  upload.array(campo, maximo)(req, res, (err) => {
    if (!err) return next();
    const mensaje =
      err.code === "LIMIT_FILE_SIZE"
        ? `Cada video puede pesar hasta ${MAX_MB} MB`
        : err.code === "LIMIT_UNEXPECTED_FILE"
        ? `Puedes subir hasta ${maximo} videos a la vez`
        : err.message;
    res.status(400).json({ mensaje });
  });
};

module.exports = subirVideos;
