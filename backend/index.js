/**
 * index.js — Point d'entrée du serveur Express
 * RecouvrementPro Backend API
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Initialiser la DB en premier
require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// ─── Sécurité ─────────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' },
}));

// Rate limiting strict pour auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5173',
];

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (Postman, etc.) en dev
    if (!origin || process.env.NODE_ENV === 'development') return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS non autorisé pour cette origine.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Webhook Stripe — AVANT express.json() pour avoir le raw body ─────────────
const { handleStripeWebhook } = require('./routes/debtor');
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     authLimiter, require('./routes/auth'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/debtor',   require('./routes/debtor'));
app.use('/api/admin',    require('./routes/admin'));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  });
});

// ─── 404 JSON ─────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route introuvable : ${req.method} ${req.path}` });
});

// ─── Gestion d'erreurs globale ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Erreur non gérée:', err);

  if (err.message === 'CORS non autorisé pour cette origine.') {
    return res.status(403).json({ error: err.message });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur.'
      : err.message,
  });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   RecouvrementPro API — v1.0.0            ║
║   Port   : ${PORT}                           ║
║   Env    : ${(process.env.NODE_ENV || 'development').padEnd(11)}                  ║
║   URL    : http://localhost:${PORT}/api      ║
╚═══════════════════════════════════════════╝
  `);
});

module.exports = app;
