/**
 * utils/csv.js — Parsing et validation des fichiers CSV de factures
 *
 * Format attendu (colonnes) :
 * invoice_number, debtor_name, debtor_email, debtor_phone, amount, due_date,
 * invoice_date, description
 *
 * L'ordre des colonnes est flexible — on mappe par nom de colonne.
 */

const { parse } = require('csv-parse/sync');

// Mapping des noms de colonnes alternatifs (FR/EN)
const COLUMN_ALIASES = {
  invoice_number:  ['invoice_number', 'numero_facture', 'n_facture', 'facture', 'ref', 'reference'],
  debtor_name:     ['debtor_name', 'nom_debiteur', 'client', 'debiteur', 'nom_client', 'raison_sociale'],
  debtor_email:    ['debtor_email', 'email', 'email_debiteur', 'mail', 'email_client'],
  debtor_phone:    ['debtor_phone', 'telephone', 'phone', 'tel', 'mobile'],
  amount:          ['amount', 'montant', 'montant_ttc', 'total', 'total_ttc'],
  due_date:        ['due_date', 'date_echeance', 'echeance', 'date_limite'],
  invoice_date:    ['invoice_date', 'date_facture', 'date_emission'],
  description:     ['description', 'objet', 'libelle', 'details'],
};

/**
 * Normalise un nom de colonne brut en clé standard
 */
function normalizeColumnName(raw) {
  const cleaned = raw.toLowerCase().trim()
    .replace(/\s+/g, '_')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // retirer accents

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.includes(cleaned)) return key;
  }
  return cleaned; // retourner tel quel si inconnu
}

/**
 * Parse une date au format DD/MM/YYYY, YYYY-MM-DD ou MM/DD/YYYY
 * → retourne une chaîne ISO YYYY-MM-DD ou null
 */
function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  str = str.trim();

  // Format ISO : 2024-12-31
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d) ? null : str;
  }

  // Format FR : 31/12/2024
  const fr = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) {
    const [, day, month, year] = fr;
    const d = new Date(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`);
    return isNaN(d) ? null : d.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Parse un montant : "1 234,56 €" → 1234.56
 */
function parseAmount(str) {
  if (typeof str === 'number') return str;
  if (!str) return null;
  const cleaned = str.toString()
    .replace(/\s/g, '')
    .replace('€', '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

/**
 * Fonction principale : parse le buffer CSV et retourne un tableau de factures
 * @param {Buffer} buffer  — contenu du fichier CSV
 * @returns {{ rows: Array, errors: Array }}
 */
function parseInvoiceCSV(buffer) {
  let rawRecords;

  try {
    rawRecords = parse(buffer, {
      columns: (headers) => headers.map(normalizeColumnName),
      skip_empty_lines: true,
      trim: true,
      bom: true,           // supporter l'UTF-8 BOM de certains Excel
      delimiter: [',', ';'], // accepter , et ;
      relax_quotes: true,
    });
  } catch (err) {
    throw new Error(`Erreur de parsing CSV : ${err.message}`);
  }

  const rows = [];
  const errors = [];

  rawRecords.forEach((record, index) => {
    const lineNum = index + 2; // +2 car ligne 1 = header
    const row = {};
    const rowErrors = [];

    // ── Numéro de facture ──
    row.invoice_number = record.invoice_number?.trim();
    if (!row.invoice_number) rowErrors.push('Numéro de facture manquant');

    // ── Nom du débiteur ──
    row.debtor_name = record.debtor_name?.trim();
    if (!row.debtor_name) rowErrors.push('Nom du débiteur manquant');

    // ── Email débiteur (optionnel mais recommandé) ──
    row.debtor_email = record.debtor_email?.trim()?.toLowerCase() || null;
    if (row.debtor_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.debtor_email)) {
      rowErrors.push(`Email invalide : ${row.debtor_email}`);
      row.debtor_email = null;
    }

    // ── Téléphone ──
    row.debtor_phone = record.debtor_phone?.trim() || null;

    // ── Montant ──
    row.amount = parseAmount(record.amount);
    if (row.amount === null || row.amount <= 0) {
      rowErrors.push(`Montant invalide : "${record.amount}"`);
    }

    // ── Date d'échéance ──
    row.due_date = parseDate(record.due_date);
    if (!row.due_date) rowErrors.push(`Date d'échéance invalide : "${record.due_date}"`);

    // ── Date de facture (optionnel) ──
    row.invoice_date = parseDate(record.invoice_date) || null;

    // ── Description ──
    row.description = record.description?.trim() || null;

    if (rowErrors.length > 0) {
      errors.push({ line: lineNum, errors: rowErrors, data: record });
    } else {
      rows.push(row);
    }
  });

  return { rows, errors };
}

module.exports = { parseInvoiceCSV };
