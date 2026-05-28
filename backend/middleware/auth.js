/**
 * middleware/auth.js — Vérification du token JWT
 */

const jwt = require('jsonwebtoken');

/**
 * Middleware standard : vérifie Bearer token
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'authentification manquant.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, role, company }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expirée. Reconnectez-vous.' });
    }
    return res.status(401).json({ error: 'Token invalide.' });
  }
}

/**
 * Middleware admin uniquement
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
