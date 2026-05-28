/**
 * utils/email.js — Envoi d'emails via Nodemailer
 * Templates HTML responsive pour les relances
 */

const nodemailer = require('nodemailer');

// Création du transporteur SMTP
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  },
});

// Vérifier la connexion au démarrage
transporter.verify((err) => {
  if (err) console.error('❌ Email SMTP non connecté:', err.message);
  else console.log('✅ Serveur email SMTP prêt');
});

// ─── Pied de page légal OBLIGATOIRE (RGPD + mention légale) ───────────────────
const LEGAL_FOOTER = `
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;
     font-size:11px;color:#94a3b8;line-height:1.6;">
  <p><strong>Mention légale obligatoire :</strong> Ceci est une relance automatisée envoyée
  au nom de votre créancier. Notre outil agit exclusivement comme assistant technique du
  créancier et ne collecte ni ne détient aucun fonds. Les paiements sont traités directement
  par Stripe et versés au créancier.</p>
  <p>Conformément au RGPD (Règlement UE 2016/679), vous disposez d'un droit d'accès,
  de rectification et d'opposition. Pour exercer ces droits, contactez le créancier
  directement.</p>
  <p style="color:#cbd5e1;">RecouvrementPro — plateforme SaaS de gestion des créances</p>
</div>
`;

// ─── Template HTML générique ──────────────────────────────────────────────────
function htmlTemplate(title, bodyContent) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;
                      box-shadow:0 4px 6px rgba(0,0,0,0.05);overflow:hidden;">

          <!-- En-tête -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);
                        padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;
                          letter-spacing:-0.5px;">
                💼 RecouvrementPro
              </h1>
              <p style="margin:4px 0 0;color:#93c5fd;font-size:13px;">${title}</p>
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:40px;">
              ${bodyContent}
              ${LEGAL_FOOTER}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Email de bienvenue ───────────────────────────────────────────────────────
async function sendWelcomeEmail(user) {
  const body = `
    <h2 style="color:#1e3a5f;margin-top:0;">Bienvenue, ${user.company} ! 🎉</h2>
    <p style="color:#475569;font-size:15px;line-height:1.7;">
      Votre compte RecouvrementPro a été créé avec succès. Vous pouvez maintenant
      importer vos factures impayées et automatiser vos relances.
    </p>
    <div style="background:#f0f9ff;border-left:4px solid #2563eb;
                padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0;">
      <p style="margin:0;color:#1e40af;font-size:14px;">
        <strong>Votre plan actuel :</strong> ${user.plan}<br>
        <strong>Email :</strong> ${user.email}
      </p>
    </div>
    <a href="${process.env.FRONTEND_URL}/dashboard"
       style="display:inline-block;background:#2563eb;color:#ffffff;
              text-decoration:none;padding:14px 28px;border-radius:8px;
              font-weight:600;font-size:15px;margin-top:8px;">
      Accéder à mon tableau de bord →
    </a>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `Bienvenue sur RecouvrementPro !`,
    html: htmlTemplate('Confirmation de création de compte', body),
  });
}

// ─── Email de relance (niveau 1, 2 ou 3) ──────────────────────────────────────
async function sendReminderEmail({ invoice, level, companyName }) {
  const levelConfig = {
    1: {
      subject: `Rappel amiable - Facture ${invoice.invoice_number}`,
      tone: 'amiable',
      color: '#f59e0b',
      icon: '📄',
      message: `Nous vous contactons au sujet d'une facture dont l'échéance est dépassée.
                Nous vous invitons à régulariser cette situation dans les meilleurs délais.`,
    },
    2: {
      subject: `⚠️ 2ème relance - Facture ${invoice.invoice_number}`,
      tone: 'ferme',
      color: '#ef4444',
      icon: '⚠️',
      message: `Malgré notre précédent rappel, votre facture reste impayée. Nous vous
                demandons de procéder au règlement dans un délai de 8 jours pour éviter
                des frais supplémentaires.`,
    },
    3: {
      subject: `🔴 Mise en demeure - Facture ${invoice.invoice_number}`,
      tone: 'juridique',
      color: '#dc2626',
      icon: '🔴',
      message: `Sans règlement de votre part dans un délai de 15 jours, notre client sera
                contraint d'engager une procédure de recouvrement judiciaire. Des pénalités
                de retard et frais de procédure pourront être exigés.`,
    },
  };

  const cfg = levelConfig[level] || levelConfig[1];
  const overdueDays = Math.floor(
    (Date.now() - new Date(invoice.due_date)) / 86400000
  );

  const body = `
    <div style="border:2px solid ${cfg.color};border-radius:8px;padding:20px;margin-bottom:24px;">
      <h2 style="color:${cfg.color};margin:0 0 8px;">${cfg.icon} Facture impayée — ${level}ère/ème relance</h2>
      <p style="color:#64748b;margin:0;font-size:13px;">Expéditeur : ${companyName}</p>
    </div>

    <p style="color:#374151;font-size:15px;line-height:1.7;">
      Madame, Monsieur <strong>${invoice.debtor_name}</strong>,
    </p>
    <p style="color:#374151;font-size:15px;line-height:1.7;">${cfg.message}</p>

    <!-- Détails facture -->
    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f8fafc;border-radius:8px;
                  border:1px solid #e2e8f0;margin:24px 0;">
      <tr style="background:#f1f5f9;">
        <th colspan="2" style="padding:12px 20px;text-align:left;
                                color:#374151;font-size:13px;font-weight:600;
                                border-bottom:1px solid #e2e8f0;">
          Détails de la facture
        </th>
      </tr>
      <tr>
        <td style="padding:12px 20px;color:#64748b;font-size:14px;width:40%;">N° Facture</td>
        <td style="padding:12px 20px;color:#1e293b;font-size:14px;font-weight:600;">
          ${invoice.invoice_number}
        </td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:12px 20px;color:#64748b;font-size:14px;">Montant dû</td>
        <td style="padding:12px 20px;color:${cfg.color};font-size:18px;font-weight:700;">
          ${(invoice.amount - invoice.amount_paid).toFixed(2)} €
        </td>
      </tr>
      <tr>
        <td style="padding:12px 20px;color:#64748b;font-size:14px;">Date d'échéance</td>
        <td style="padding:12px 20px;color:#1e293b;font-size:14px;">
          ${new Date(invoice.due_date).toLocaleDateString('fr-FR')}
        </td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:12px 20px;color:#64748b;font-size:14px;">Retard</td>
        <td style="padding:12px 20px;color:${cfg.color};font-size:14px;font-weight:600;">
          ${overdueDays} jour(s)
        </td>
      </tr>
      ${invoice.description ? `
      <tr>
        <td style="padding:12px 20px;color:#64748b;font-size:14px;">Description</td>
        <td style="padding:12px 20px;color:#1e293b;font-size:14px;">${invoice.description}</td>
      </tr>` : ''}
    </table>

    <!-- Bouton de paiement -->
    <div style="text-align:center;margin:32px 0;">
      <a href="${invoice.payment_link}"
         style="display:inline-block;background:#16a34a;color:#ffffff;
                text-decoration:none;padding:16px 36px;border-radius:8px;
                font-weight:700;font-size:16px;letter-spacing:-0.3px;">
        💳 Payer maintenant — ${(invoice.amount - invoice.amount_paid).toFixed(2)} €
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:12px;">
        Paiement sécurisé par carte bancaire · Powered by Stripe
      </p>
    </div>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;
                padding:16px 20px;margin-top:16px;">
      <p style="margin:0;color:#166534;font-size:13px;">
        <strong>💡 Vous souhaitez un échéancier ?</strong><br>
        Rendez-vous sur votre portail de paiement pour demander un étalement en plusieurs fois.
      </p>
    </div>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: invoice.debtor_email,
    subject: cfg.subject,
    html: htmlTemplate(cfg.subject, body),
  });
}

// ─── Email de confirmation de paiement ───────────────────────────────────────
async function sendPaymentConfirmationEmail({ invoice, payment, debtorEmail }) {
  const body = `
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:64px;margin-bottom:16px;">✅</div>
      <h2 style="color:#16a34a;margin:0 0 8px;">Paiement confirmé !</h2>
      <p style="color:#64748b;">Votre paiement a bien été reçu.</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0"
           style="background:#f0fdf4;border:1px solid #86efac;
                  border-radius:8px;margin:24px 0;">
      <tr>
        <td style="padding:12px 20px;color:#166534;font-size:14px;width:40%;">Facture</td>
        <td style="padding:12px 20px;color:#14532d;font-size:14px;font-weight:600;">
          ${invoice.invoice_number}
        </td>
      </tr>
      <tr style="background:#dcfce7;">
        <td style="padding:12px 20px;color:#166534;font-size:14px;">Montant payé</td>
        <td style="padding:12px 20px;color:#15803d;font-size:18px;font-weight:700;">
          ${payment.amount.toFixed(2)} €
        </td>
      </tr>
      <tr>
        <td style="padding:12px 20px;color:#166534;font-size:14px;">Date</td>
        <td style="padding:12px 20px;color:#14532d;font-size:14px;">
          ${new Date().toLocaleDateString('fr-FR', { 
            day: 'numeric', month: 'long', year: 'numeric' 
          })}
        </td>
      </tr>
      <tr style="background:#dcfce7;">
        <td style="padding:12px 20px;color:#166534;font-size:14px;">Référence</td>
        <td style="padding:12px 20px;color:#14532d;font-size:14px;font-family:monospace;">
          ${payment.stripe_payment_id || payment.id}
        </td>
      </tr>
    </table>

    <p style="color:#475569;font-size:14px;text-align:center;">
      Conservez cet email comme preuve de paiement. Merci !
    </p>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: debtorEmail,
    subject: `✅ Paiement confirmé - Facture ${invoice.invoice_number}`,
    html: htmlTemplate('Confirmation de paiement', body),
  });
}

// ─── Email de notification créancier ─────────────────────────────────────────
async function sendPaymentNotificationToCreditor({ invoice, payment, userEmail }) {
  const body = `
    <h2 style="color:#1e3a5f;margin-top:0;">💰 Nouveau paiement reçu !</h2>
    <p style="color:#475569;">
      <strong>${invoice.debtor_name}</strong> vient de payer la facture
      <strong>${invoice.invoice_number}</strong>.
    </p>
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;
                padding:20px;margin:24px 0;">
      <p style="margin:0;color:#16a34a;font-size:24px;font-weight:700;text-align:center;">
        +${payment.amount.toFixed(2)} €
      </p>
      <p style="margin:4px 0 0;color:#64748b;font-size:13px;text-align:center;">
        Les fonds seront virés sur votre compte Stripe.
      </p>
    </div>
    <a href="${process.env.FRONTEND_URL}/dashboard"
       style="display:inline-block;background:#2563eb;color:#ffffff;
              text-decoration:none;padding:12px 24px;border-radius:8px;
              font-weight:600;font-size:14px;">
      Voir mon tableau de bord →
    </a>
  `;

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: userEmail,
    subject: `💰 Paiement reçu : ${payment.amount.toFixed(2)} € — Facture ${invoice.invoice_number}`,
    html: htmlTemplate('Notification de paiement', body),
  });
}

module.exports = {
  sendWelcomeEmail,
  sendReminderEmail,
  sendPaymentConfirmationEmail,
  sendPaymentNotificationToCreditor,
};
