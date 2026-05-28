/**
 * routes/admin.js — Backoffice administrateur
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Toutes les routes admin nécessitent le rôle admin
router.use(requireAdmin);

// ─── GET /api/admin/stats — statistiques globales ─────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN active = 1 THEN 1 END) as active,
        COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as new_this_month,
        COUNT(CASE WHEN plan = 'starter' THEN 1 END) as starter,
        COUNT(CASE WHEN plan = 'pro' THEN 1 END) as pro,
        COUNT(CASE WHEN plan = 'enterprise' THEN 1 END) as enterprise
      FROM users WHERE role = 'client'
    `).get();

    const invoices = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(amount) as total_volume,
        SUM(amount_paid) as total_collected,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid,
        COUNT(CASE WHEN status != 'paid' THEN 1 END) as outstanding
      FROM invoices
    `).get();

    const payments = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(amount) as total_amount,
        COUNT(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 END) as this_month,
        SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN amount ELSE 0 END) as amount_this_month
      FROM payments WHERE status = 'succeeded'
    `).get();

    res.json({ users, invoices, payments });
  } catch (err) {
    console.error('GET /admin/stats:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── GET /api/admin/users — liste des clients ─────────────────────────────────
router.get('/users', (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT u.id, u.email, u.company, u.siren, u.plan, u.active, u.created_at,
             COUNT(i.id) as invoice_count,
             SUM(i.amount) as total_invoiced
      FROM users u
      LEFT JOIN invoices i ON i.user_id = u.id
      WHERE u.role = 'client'
    `;
    const params = [];

    if (search) {
      query += ' AND (u.email LIKE ? OR u.company LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const users = db.prepare(query).all(...params);
    const { total } = db.prepare(
      `SELECT COUNT(*) as total FROM users WHERE role = 'client'`
    ).get();

    res.json({ users, total });
  } catch (err) {
    console.error('GET /admin/users:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── PUT /api/admin/users/:id/toggle — activer/désactiver un compte ───────────
router.put('/users/:id/toggle', (req, res) => {
  try {
    const user = db.prepare('SELECT id, active FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const newActive = user.active ? 0 : 1;
    db.prepare("UPDATE users SET active = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newActive, req.params.id);

    res.json({ message: `Compte ${newActive ? 'activé' : 'désactivé'}.`, active: newActive });
  } catch (err) {
    console.error('PUT /admin/users/:id/toggle:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── PUT /api/admin/users/:id/plan — changer le plan ─────────────────────────
router.put('/users/:id/plan', (req, res) => {
  try {
    const { plan } = req.body;
    if (!['starter', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Plan invalide.' });
    }

    db.prepare("UPDATE users SET plan = ?, updated_at = datetime('now') WHERE id = ?")
      .run(plan, req.params.id);

    res.json({ message: `Plan mis à jour : ${plan}.` });
  } catch (err) {
    console.error('PUT /admin/users/:id/plan:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── GET /api/admin/invoices — toutes les factures ───────────────────────────
router.get('/invoices', (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const invoices = db.prepare(`
      SELECT i.*, u.company as creditor_company, u.email as creditor_email
      FROM invoices i
      JOIN users u ON i.user_id = u.id
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(limit), offset);

    const { total } = db.prepare('SELECT COUNT(*) as total FROM invoices').get();
    res.json({ invoices, total });
  } catch (err) {
    console.error('GET /admin/invoices:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

module.exports = router;
