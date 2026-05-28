/**
 * db.js — Initialisation et schéma SQLite
 * Utilise better-sqlite3 (synchrone, rapide, pas de dépendances natives complexes)
 */

require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './database.db';

const db = new Database(DB_PATH);

// Performance : activer WAL pour lectures concurrentes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Initialisation du schéma — idempotent (CREATE TABLE IF NOT EXISTS)
 */
function initDatabase() {
  db.exec(`
    -- =============================================
    -- TABLE : utilisateurs (créanciers / clients SaaS)
    -- =============================================
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      email       TEXT UNIQUE NOT NULL,
      password    TEXT NOT NULL,
      company     TEXT NOT NULL,
      siren       TEXT,
      phone       TEXT,
      plan        TEXT NOT NULL DEFAULT 'starter',  -- starter | pro | enterprise
      role        TEXT NOT NULL DEFAULT 'client',   -- client | admin
      rgpd_consent INTEGER NOT NULL DEFAULT 0,      -- 1 = accepté
      rgpd_date   TEXT,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =============================================
    -- TABLE : débiteurs
    -- =============================================
    CREATE TABLE IF NOT EXISTS debtors (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      email       TEXT,
      phone       TEXT,
      address     TEXT,
      city        TEXT,
      country     TEXT DEFAULT 'FR',
      siren       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =============================================
    -- TABLE : factures
    -- =============================================
    CREATE TABLE IF NOT EXISTS invoices (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      debtor_id       TEXT REFERENCES debtors(id),
      invoice_number  TEXT NOT NULL,
      debtor_name     TEXT NOT NULL,
      debtor_email    TEXT,
      debtor_phone    TEXT,
      amount          REAL NOT NULL,             -- montant TTC en euros
      amount_paid     REAL NOT NULL DEFAULT 0,
      currency        TEXT NOT NULL DEFAULT 'EUR',
      due_date        TEXT NOT NULL,             -- date d'échéance ISO
      invoice_date    TEXT,
      description     TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
        -- pending | reminded_1 | reminded_2 | reminded_3 | in_payment | paid | disputed | legal
      payment_token   TEXT UNIQUE,               -- token public pour le lien débiteur
      payment_link    TEXT,                      -- URL complète du portail débiteur
      stripe_session_id TEXT,
      notes           TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =============================================
    -- TABLE : relances envoyées
    -- =============================================
    CREATE TABLE IF NOT EXISTS reminders (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,  -- email | sms | letter
      level       INTEGER NOT NULL DEFAULT 1,  -- 1, 2, 3 (niveau de relance)
      recipient   TEXT NOT NULL,
      subject     TEXT,
      body        TEXT,
      status      TEXT NOT NULL DEFAULT 'sent',  -- sent | delivered | failed
      sent_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =============================================
    -- TABLE : paiements
    -- =============================================
    CREATE TABLE IF NOT EXISTS payments (
      id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      invoice_id      TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount          REAL NOT NULL,
      currency        TEXT NOT NULL DEFAULT 'EUR',
      method          TEXT NOT NULL DEFAULT 'stripe',  -- stripe | virement | cheque
      stripe_payment_id TEXT,
      stripe_session_id TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',  -- pending | succeeded | failed | refunded
      paid_at         TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =============================================
    -- TABLE : échéanciers
    -- =============================================
    CREATE TABLE IF NOT EXISTS installments (
      id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      invoice_id  TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      due_date    TEXT NOT NULL,
      amount      REAL NOT NULL,
      status      TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | overdue
      payment_id  TEXT REFERENCES payments(id),
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- =============================================
    -- INDEX pour performances
    -- =============================================
    CREATE INDEX IF NOT EXISTS idx_invoices_user_id   ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status    ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_token     ON invoices(payment_token);
    CREATE INDEX IF NOT EXISTS idx_reminders_invoice  ON reminders(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice   ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_debtors_user       ON debtors(user_id);
  `);

  console.log('✅ Base de données initialisée :', DB_PATH);
}

// Lancer l'init au démarrage
initDatabase();

module.exports = db;
