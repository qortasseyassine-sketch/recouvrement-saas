/**
 * routes/invoices.js — CRUD factures + import CSV + envoi de relances
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { parseInvoiceCSV } = require('../utils/csv');
const { sendReminderEmail } = require('../utils/email');

// Multer en mémoire (pas de fichier disque)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers CSV sont acceptés.'));
    }
  },
});

// ─── Utilitaire : générer le lien débiteur ────────────────────────────────────
function generatePaymentLink(token) {
  return `${process.env.FRONTEND_URL}/factures/${token}/payer`;
}

// ─── GET /api/invoices — liste des factures ───────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT id, invoice_number, debtor_name, debtor_email, debtor_phone,
             amount, amount_paid, currency, due_date, invoice_date,
             description, status, payment_link, created_at, updated_at
      FROM invoices
      WHERE user_id = ?
    `;
    const params = [req.user.id];

    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (debtor_name LIKE ? OR invoice_number LIKE ? OR debtor_email LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY due_date ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const invoices = db.prepare(query).all(...params);

    // Total pour pagination
    let countQuery = 'SELECT COUNT(*) as total FROM invoices WHERE user_id = ?';
    const countParams = [req.user.id];
    if (status && status !== 'all') { countQuery += ' AND status = ?'; countParams.push(status); }
    if (search) {
      countQuery += ' AND (debtor_name LIKE ? OR invoice_number LIKE ? OR debtor_email LIKE ?)';
      const s = `%${search}%`;
      countParams.push(s, s, s);
    }
    const { total } = db.prepare(countQuery).get(...countParams);

    res.json({ invoices, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('GET /invoices:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── GET /api/invoices/stats — statistiques dashboard ────────────────────────
router.get('/stats', requireAuth, (req, res) => {
  try {
    const uid = req.user.id;

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_invoices,
        SUM(CASE WHEN status != 'paid' THEN amount - amount_paid ELSE 0 END) as total_outstanding,
        SUM(amount_paid) as total_collected,
        SUM(amount) as total_invoiced,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status LIKE 'reminded%' THEN 1 END) as reminded_count,
        COUNT(CASE WHEN status = 'legal' THEN 1 END) as legal_count,
        AVG(CASE WHEN status = 'paid'
            THEN julianday(updated_at) - julianday(invoice_date)
            END) as avg_collection_days
      FROM invoices
      WHERE user_id = ?
    `).get(uid);

    // DSO (Days Sales Outstanding) — sur 90 jours glissants
    const dso = db.prepare(`
      SELECT ROUND(
        COALESCE(
          SUM(CASE WHEN status != 'paid' THEN amount - amount_paid ELSE 0 END) /
          NULLIF(SUM(amount) / 90.0, 0),
          0
        )
      , 1) as dso
      FROM invoices
      WHERE user_id = ?
      AND created_at >= datetime('now', '-90 days')
    `).get(uid);

    // Évolution mensuelle (6 derniers mois)
    const monthly = db.prepare(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        SUM(amount) as invoiced,
        SUM(amount_paid) as collected,
        COUNT(*) as count
      FROM invoices
      WHERE user_id = ?
      AND created_at >= datetime('now', '-6 months')
      GROUP BY month
      ORDER BY month ASC
    `).all(uid);

    const recovery_rate = stats.total_invoiced > 0
      ? ((stats.total_collected / stats.total_invoiced) * 100).toFixed(1)
      : 0;

    res.json({
      ...stats,
      dso: dso.dso || 0,
      recovery_rate: parseFloat(recovery_rate),
      monthly,
    });
  } catch (err) {
    console.error('GET /invoices/stats:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── GET /api/invoices/:id — détail d'une facture ────────────────────────────
router.get('/:id', requireAuth, (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT * FROM invoices WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!invoice) return res.status(404).json({ error: 'Facture introuvable.' });

    // Historique des relances
    const reminders = db.prepare(`
      SELECT * FROM reminders WHERE invoice_id = ? ORDER BY sent_at DESC
    `).all(req.params.id);

    // Historique des paiements
    const payments = db.prepare(`
      SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC
    `).all(req.params.id);

    res.json({ invoice, reminders, payments });
  } catch (err) {
    console.error('GET /invoices/:id:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── POST /api/invoices — créer une facture ───────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  try {
    const {
      invoice_number, debtor_name, debtor_email, debtor_phone,
      amount, due_date, invoice_date, description, currency
    } = req.body;

    if (!invoice_number || !debtor_name || !amount || !due_date) {
      return res.status(400).json({
        error: 'Champs requis : invoice_number, debtor_name, amount, due_date.'
      });
    }

    // Vérifier doublons (même numéro pour ce créancier)
    const duplicate = db.prepare(`
      SELECT id FROM invoices WHERE invoice_number = ? AND user_id = ?
    `).get(invoice_number, req.user.id);
    if (duplicate) {
      return res.status(409).json({ error: `Facture ${invoice_number} déjà enregistrée.` });
    }

    const id = uuidv4();
    const token = uuidv4().replace(/-/g, '');
    const paymentLink = generatePaymentLink(token);

    db.prepare(`
      INSERT INTO invoices
        (id, user_id, invoice_number, debtor_name, debtor_email, debtor_phone,
         amount, currency, due_date, invoice_date, description, payment_token, payment_link)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, req.user.id, invoice_number, debtor_name,
      debtor_email || null, debtor_phone || null,
      parseFloat(amount), currency || 'EUR',
      due_date, invoice_date || null, description || null,
      token, paymentLink
    );

    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    res.status(201).json({ message: 'Facture créée.', invoice });
  } catch (err) {
    console.error('POST /invoices:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── PUT /api/invoices/:id — modifier une facture ────────────────────────────
router.put('/:id', requireAuth, (req, res) => {
  try {
    const invoice = db.prepare(
      'SELECT id FROM invoices WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!invoice) return res.status(404).json({ error: 'Facture introuvable.' });

    const {
      debtor_name, debtor_email, debtor_phone,
      amount, due_date, invoice_date, description, status, notes
    } = req.body;

    db.prepare(`
      UPDATE invoices SET
        debtor_name = COALESCE(?, debtor_name),
        debtor_email = COALESCE(?, debtor_email),
        debtor_phone = COALESCE(?, debtor_phone),
        amount = COALESCE(?, amount),
        due_date = COALESCE(?, due_date),
        invoice_date = COALESCE(?, invoice_date),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      debtor_name, debtor_email, debtor_phone,
      amount ? parseFloat(amount) : null,
      due_date, invoice_date, description, status, notes,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
    res.json({ message: 'Facture mise à jour.', invoice: updated });
  } catch (err) {
    console.error('PUT /invoices/:id:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── DELETE /api/invoices/:id ─────────────────────────────────────────────────
router.delete('/:id', requireAuth, (req, res) => {
  try {
    const result = db.prepare(
      'DELETE FROM invoices WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.user.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Facture introuvable.' });
    res.json({ message: 'Facture supprimée.' });
  } catch (err) {
    console.error('DELETE /invoices/:id:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── POST /api/invoices/import/csv — import en masse ─────────────────────────
router.post('/import/csv', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier CSV requis.' });

    const { rows, errors } = parseInvoiceCSV(req.file.buffer);

    if (rows.length === 0) {
      return res.status(400).json({
        error: 'Aucune ligne valide dans le CSV.',
        parse_errors: errors,
      });
    }

    // Insertion en transaction (tout ou rien par ligne valide)
    const insertMany = db.transaction((validRows) => {
      const inserted = [];
      const skipped = [];

      for (const row of validRows) {
        // Vérifier doublon
        const dup = db.prepare(`
          SELECT id FROM invoices WHERE invoice_number = ? AND user_id = ?
        `).get(row.invoice_number, req.user.id);

        if (dup) {
          skipped.push({ invoice_number: row.invoice_number, reason: 'Déjà existante' });
          continue;
        }

        const id = uuidv4();
        const token = uuidv4().replace(/-/g, '');
        const paymentLink = generatePaymentLink(token);

        db.prepare(`
          INSERT INTO invoices
            (id, user_id, invoice_number, debtor_name, debtor_email, debtor_phone,
             amount, due_date, invoice_date, description, payment_token, payment_link)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, req.user.id, row.invoice_number, row.debtor_name,
          row.debtor_email, row.debtor_phone,
          row.amount, row.due_date, row.invoice_date, row.description,
          token, paymentLink
        );
        inserted.push(row.invoice_number);
      }

      return { inserted, skipped };
    });

    const result = insertMany(rows);

    res.status(201).json({
      message: `Import terminé : ${result.inserted.length} facture(s) importée(s).`,
      imported: result.inserted.length,
      skipped: result.skipped.length,
      parse_errors: errors.length,
      details: result,
      csv_errors: errors,
    });
  } catch (err) {
    console.error('POST /import/csv:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de l\'import.' });
  }
});

// ─── POST /api/invoices/:id/remind — envoyer une relance ─────────────────────
router.post('/:id/remind', requireAuth, async (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT * FROM invoices WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!invoice) return res.status(404).json({ error: 'Facture introuvable.' });

    if (!invoice.debtor_email) {
      return res.status(400).json({ error: 'Pas d\'email débiteur pour cette facture.' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Cette facture est déjà payée.' });
    }

    // Calculer le niveau de relance
    const prevReminders = db.prepare(`
      SELECT COUNT(*) as count FROM reminders
      WHERE invoice_id = ? AND type = 'email'
    `).get(req.params.id);

    const level = Math.min(prevReminders.count + 1, 3);

    // Envoyer l'email
    const user = db.prepare('SELECT company FROM users WHERE id = ?').get(req.user.id);
    await sendReminderEmail({ invoice, level, companyName: user.company });

    // Mettre à jour le statut de la facture
    const newStatus = `reminded_${level}`;
    db.prepare(`
      UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newStatus, req.params.id);

    // Enregistrer la relance
    const reminderId = uuidv4();
    db.prepare(`
      INSERT INTO reminders (id, invoice_id, user_id, type, level, recipient, subject, status)
      VALUES (?, ?, ?, 'email', ?, ?, ?, 'sent')
    `).run(
      reminderId, req.params.id, req.user.id,
      level, invoice.debtor_email,
      `Relance niveau ${level} - Facture ${invoice.invoice_number}`
    );

    res.json({
      message: `Relance de niveau ${level} envoyée à ${invoice.debtor_email}.`,
      level,
      new_status: newStatus,
    });
  } catch (err) {
    console.error('POST /:id/remind:', err);
    res.status(500).json({ error: 'Erreur lors de l\'envoi de la relance.' });
  }
});

// ─── POST /api/invoices/remind/bulk — relances en masse ──────────────────────
router.post('/remind/bulk', requireAuth, async (req, res) => {
  try {
    const { invoice_ids } = req.body;
    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return res.status(400).json({ error: 'Liste d\'IDs requise.' });
    }

    const user = db.prepare('SELECT company FROM users WHERE id = ?').get(req.user.id);
    const results = { success: [], failed: [] };

    for (const invoiceId of invoice_ids) {
      try {
        const invoice = db.prepare(
          'SELECT * FROM invoices WHERE id = ? AND user_id = ?'
        ).get(invoiceId, req.user.id);

        if (!invoice || !invoice.debtor_email || invoice.status === 'paid') {
          results.failed.push({ id: invoiceId, reason: 'Non éligible' });
          continue;
        }

        const prevReminders = db.prepare(
          'SELECT COUNT(*) as count FROM reminders WHERE invoice_id = ? AND type = ?'
        ).get(invoiceId, 'email');

        const level = Math.min(prevReminders.count + 1, 3);
        await sendReminderEmail({ invoice, level, companyName: user.company });

        db.prepare(
          "UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(`reminded_${level}`, invoiceId);

        db.prepare(`
          INSERT INTO reminders (id, invoice_id, user_id, type, level, recipient, status)
          VALUES (?, ?, ?, 'email', ?, ?, 'sent')
        `).run(uuidv4(), invoiceId, req.user.id, level, invoice.debtor_email);

        results.success.push(invoiceId);
      } catch (e) {
        results.failed.push({ id: invoiceId, reason: e.message });
      }
    }

    res.json({
      message: `${results.success.length} relance(s) envoyée(s).`,
      ...results,
    });
  } catch (err) {
    console.error('POST /remind/bulk:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

module.exports = router;
