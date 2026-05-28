/**
 * routes/auth.js — Inscription, connexion, profil
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendWelcomeEmail } = require('../utils/email');

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, company, siren, phone, rgpd_consent } = req.body;

    // Validations
    if (!email || !password || !company) {
      return res.status(400).json({ error: 'Email, mot de passe et nom d\'entreprise requis.' });
    }

    if (!rgpd_consent) {
      return res.status(400).json({
        error: 'Le consentement RGPD est obligatoire pour créer un compte.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Format d\'email invalide.' });
    }

    // Vérifier si l'email existe déjà
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé.' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    // Insérer l'utilisateur
    db.prepare(`
      INSERT INTO users (id, email, password, company, siren, phone, rgpd_consent, rgpd_date)
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).run(userId, email.toLowerCase(), hashedPassword, company, siren || null, phone || null);

    const user = db.prepare('SELECT id, email, company, plan, role FROM users WHERE id = ?').get(userId);

    // Envoyer email de bienvenue (non bloquant)
    sendWelcomeEmail(user).catch(console.error);

    // Générer le token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, company: user.company },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'Compte créé avec succès.',
      token,
      user: { id: user.id, email: user.email, company: user.company, plan: user.plan, role: user.role },
    });
  } catch (err) {
    console.error('Erreur register:', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const user = db.prepare(`
      SELECT id, email, password, company, plan, role, active
      FROM users WHERE email = ?
    `).get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Compte désactivé. Contactez le support.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    // Mettre à jour updated_at
    db.prepare("UPDATE users SET updated_at = datetime('now') WHERE id = ?").run(user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, company: user.company },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      message: 'Connexion réussie.',
      token,
      user: { id: user.id, email: user.email, company: user.company, plan: user.plan, role: user.role },
    });
  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ─── GET /api/auth/me — profil utilisateur ────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, email, company, siren, phone, plan, role, rgpd_consent, rgpd_date, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json(user);
  } catch (err) {
    console.error('Erreur /me:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── PUT /api/auth/profile — modifier profil ─────────────────────────────────
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { company, phone, siren } = req.body;

    db.prepare(`
      UPDATE users SET company = ?, phone = ?, siren = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(company, phone, siren, req.user.id);

    res.json({ message: 'Profil mis à jour.' });
  } catch (err) {
    console.error('Erreur profile:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── PUT /api/auth/password — changer mot de passe ───────────────────────────
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Les deux mots de passe sont requis.' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Nouveau mot de passe trop court (min. 8 caractères).' });
    }

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    const isValid = await bcrypt.compare(current_password, user.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
    }

    const hashed = await bcrypt.hash(new_password, 12);
    db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?")
      .run(hashed, req.user.id);

    res.json({ message: 'Mot de passe modifié avec succès.' });
  } catch (err) {
    console.error('Erreur password:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

module.exports = router;
