const jwt = require("jsonwebtoken");

const protegerRuta = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.usuarioId = decoded.id;
      req.usuarioRol = decoded.rol;
      next();
    } catch (error) {
      return res.status(401).json({ mensaje: "Token invalido o expirado" });
    }
  } else {
    return res.status(401).json({ mensaje: "No autorizado, falta token" });
  }
};

const soloAdmin = (req, res, next) => {
  if (req.usuarioRol !== "admin") {
    return res.status(403).json({ mensaje: "Solo el administrador puede hacer esto" });
  }
  next();
};

const soloMayorista = (req, res, next) => {
  if (req.usuarioRol !== "mayorista") {
    return res.status(403).json({ mensaje: "Solo cuentas mayoristas pueden hacer esto" });
  }
  next();
};

module.exports = protegerRuta;
module.exports.soloAdmin = soloAdmin;
module.exports.soloMayorista = soloMayorista;