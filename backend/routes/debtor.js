/**
 * routes/debtor.js — Portail débiteur public
 * Accessible sans authentification via le token unique de la facture
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');
const {
  sendPaymentConfirmationEmail,
  sendPaymentNotificationToCreditor,
} = require('../utils/email');

// ─── GET /api/debtor/:token — récupérer les infos de la facture ───────────────
router.get('/:token', (req, res) => {
  try {
    const invoice = db.prepare(`
      SELECT
        i.id, i.invoice_number, i.debtor_name, i.debtor_email,
        i.amount, i.amount_paid, i.currency, i.due_date, i.invoice_date,
        i.description, i.status,
        u.company as creditor_name, u.email as creditor_email, u.phone as creditor_phone
      FROM invoices i
      JOIN users u ON i.user_id = u.id
      WHERE i.payment_token = ?
    `).get(req.params.token);

    if (!invoice) {
      return res.status(404).json({ error: 'Lien de paiement invalide ou expiré.' });
    }

    // Calculer le retard
    const overdueDays = Math.max(
      0,
      Math.floor((Date.now() - new Date(invoice.due_date)) / 86400000)
    );

    // Récupérer les échéanciers existants
    const installments = db.prepare(`
      SELECT * FROM installments
      WHERE invoice_id = ?
      ORDER BY due_date ASC
    `).get(invoice.id);

    res.json({
      invoice: {
        ...invoice,
        remaining: parseFloat((invoice.amount - invoice.amount_paid).toFixed(2)),
        overdue_days: overdueDays,
      },
      installments: installments || [],
    });
  } catch (err) {
    console.error('GET /debtor/:token:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── POST /api/debtor/:token/checkout — créer session Stripe ─────────────────
router.post('/:token/checkout', async (req, res) => {
  try {
    const { amount_to_pay } = req.body; // optionnel : paiement partiel

    const invoice = db.prepare(`
      SELECT i.*, u.company as creditor_name, u.email as creditor_email
      FROM invoices i
      JOIN users u ON i.user_id = u.id
      WHERE i.payment_token = ?
    `).get(req.params.token);

    if (!invoice) {
      return res.status(404).json({ error: 'Facture introuvable.' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Cette facture est déjà réglée.' });
    }

    const remaining = invoice.amount - invoice.amount_paid;
    const payAmount = amount_to_pay
      ? Math.min(parseFloat(amount_to_pay), remaining)
      : remaining;

    if (payAmount <= 0) {
      return res.status(400).json({ error: 'Montant invalide.' });
    }

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: {
              name: `Facture ${invoice.invoice_number}`,
              description: `${invoice.creditor_name} — ${invoice.description || 'Règlement facture'}`,
              metadata: {
                invoice_number: invoice.invoice_number,
                creditor: invoice.creditor_name,
              },
            },
            unit_amount: Math.round(payAmount * 100), // en centimes
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoice_id: invoice.id,
        payment_token: req.params.token,
        amount: payAmount.toString(),
      },
      success_url: `${process.env.FRONTEND_URL}/factures/${req.params.token}/payer?success=1`,
      cancel_url: `${process.env.FRONTEND_URL}/factures/${req.params.token}/payer?cancelled=1`,
      customer_email: invoice.debtor_email || undefined,
      locale: 'fr',
      payment_intent_data: {
        description: `Facture ${invoice.invoice_number} — ${invoice.creditor_name}`,
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
        },
      },
    });

    // Sauvegarder l'ID de session
    db.prepare(`
      UPDATE invoices
      SET stripe_session_id = ?, status = 'in_payment', updated_at = datetime('now')
      WHERE id = ?
    `).run(session.id, invoice.id);

    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error('POST /debtor/:token/checkout:', err);
    if (err.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: 'Erreur Stripe : ' + err.message });
    }
    res.status(500).json({ error: 'Erreur lors de la création du paiement.' });
  }
});

// ─── POST /api/debtor/:token/installment-request — demande d'échéancier ───────
router.post('/:token/installment-request', async (req, res) => {
  try {
    const { installments_count, message, contact_email } = req.body;

    if (!installments_count || installments_count < 2 || installments_count > 12) {
      return res.status(400).json({ error: 'Nombre d\'échéances invalide (2 à 12).' });
    }

    const invoice = db.prepare(`
      SELECT i.*, u.company as creditor_name, u.email as creditor_email
      FROM invoices i
      JOIN users u ON i.user_id = u.id
      WHERE i.payment_token = ?
    `).get(req.params.token);

    if (!invoice) return res.status(404).json({ error: 'Facture introuvable.' });

    const remaining = invoice.amount - invoice.amount_paid;
    const monthlyAmount = (remaining / installments_count).toFixed(2);

    // Notifier le créancier par email
    const nodemailer = require('nodemailer');
    const { sendReminderEmail } = require('../utils/email');

    // Enregistrer la demande comme note
    db.prepare(`
      UPDATE invoices
      SET notes = ?, status = 'disputed', updated_at = datetime('now')
      WHERE id = ?
    `).run(
      `Demande d'échéancier : ${installments_count}x ${monthlyAmount}€ — ${message || ''}`,
      invoice.id
    );

    // Email au créancier
    const transporter = require('../utils/email');
    // Simple notification via reminders table
    db.prepare(`
      INSERT INTO reminders (id, invoice_id, user_id, type, level, recipient, subject, body, status)
      VALUES (?, ?, ?, 'email', 0, ?, 'Demande échéancier', ?, 'sent')
    `).run(
      uuidv4(), invoice.id, invoice.user_id,
      invoice.creditor_email,
      `Le débiteur ${invoice.debtor_name} demande un échéancier de ${installments_count} mensualités de ${monthlyAmount}€`
    );

    res.json({
      message: 'Votre demande d\'échéancier a été transmise au créancier.',
      monthly_amount: parseFloat(monthlyAmount),
      installments_count,
    });
  } catch (err) {
    console.error('POST /debtor/:token/installment-request:', err);
    res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ─── POST /api/payments/webhook — Stripe webhook ─────────────────────────────
// (Monté séparément dans index.js pour accéder au raw body)
async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw Buffer
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📩 Stripe event: ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    if (session.payment_status !== 'paid') return res.json({ received: true });

    const { invoice_id, payment_token, amount } = session.metadata || {};
    if (!invoice_id) return res.json({ received: true });

    try {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoice_id);
      if (!invoice) {
        console.error('Webhook: facture introuvable', invoice_id);
        return res.json({ received: true });
      }

      const paidAmount = parseFloat(amount) || session.amount_total / 100;
      const newAmountPaid = invoice.amount_paid + paidAmount;
      const isPaid = newAmountPaid >= invoice.amount;

      // Mettre à jour la facture
      db.prepare(`
        UPDATE invoices
        SET amount_paid = ?, status = ?, stripe_session_id = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        newAmountPaid,
        isPaid ? 'paid' : 'in_payment',
        session.id,
        invoice_id
      );

      // Enregistrer le paiement
      const paymentId = uuidv4();
      db.prepare(`
        INSERT INTO payments
          (id, invoice_id, user_id, amount, currency, method, stripe_payment_id,
           stripe_session_id, status, paid_at)
        VALUES (?, ?, ?, ?, ?, 'stripe', ?, ?, 'succeeded', datetime('now'))
      `).run(
        paymentId, invoice_id, invoice.user_id,
        paidAmount, invoice.currency,
        session.payment_intent, session.id
      );

      const payment = { id: paymentId, amount: paidAmount, stripe_payment_id: session.payment_intent };
      const user = db.prepare('SELECT email FROM users WHERE id = ?').get(invoice.user_id);

      // Emails de confirmation (non bloquants)
      if (invoice.debtor_email) {
        sendPaymentConfirmationEmail({
          invoice, payment, debtorEmail: invoice.debtor_email
        }).catch(console.error);
      }
      if (user?.email) {
        sendPaymentNotificationToCreditor({
          invoice, payment, userEmail: user.email
        }).catch(console.error);
      }

      console.log(`✅ Paiement enregistré : ${paidAmount}€ pour facture ${invoice.invoice_number}`);
    } catch (err) {
      console.error('Erreur traitement webhook:', err);
    }
  }

  res.json({ received: true });
}

module.exports = router;
module.exports.handleStripeWebhook = handleStripeWebhook;
