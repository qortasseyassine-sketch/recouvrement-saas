import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { debtorApi } from '../utils/api';

const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

export default function DebtorPortal() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const success = params.get('success');
  const cancelled = params.get('cancelled');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('payment'); // payment | installment
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [installmentForm, setInstallmentForm] = useState({ count: 3, message: '', email: '' });
  const [installmentSent, setInstallmentSent] = useState(false);

  useEffect(() => {
    debtorApi.getInvoice(token)
      .then(({ data }) => setData(data))
      .catch(() => setError('Ce lien de paiement est invalide ou a expiré.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handlePay = async () => {
    setCheckoutLoading(true);
    try {
      const { data: res } = await debtorApi.createCheckout(token);
      window.location.href = res.checkout_url;
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la création du paiement.');
      setCheckoutLoading(false);
    }
  };

  const handleInstallmentRequest = async (e) => {
    e.preventDefault();
    try {
      await debtorApi.requestInstallment(token, {
        installments_count: installmentForm.count,
        message: installmentForm.message,
        contact_email: installmentForm.email,
      });
      setInstallmentSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'envoi de la demande.');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div className="spinner spinner-dark" style={{ width: 36, height: 36 }} />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: "'DM Sans', sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
          <div style={{ fontSize: 64, marginBottom: 20 }}>🔗</div>
          <h2 style={{ color: '#0f2547', marginBottom: 12, fontFamily: "'Syne', sans-serif" }}>Lien invalide</h2>
          <p style={{ color: '#64748b' }}>{error}</p>
        </div>
      </div>
    );
  }

  const { invoice } = data;
  const isPaid = invoice.status === 'paid';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', sans-serif", padding: '20px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: 24, paddingTop: 20 }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: '#0f2547', marginBottom: 4 }}>
            Recouvrement<span style={{ color: '#f59e0b' }}>Pro</span>
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Portail de paiement sécurisé</p>
        </div>

        {/* Success */}
        {success && (
          <div className="card" style={{ textAlign: 'center', padding: '40px 32px', marginBottom: 20, border: '2px solid #86efac' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", color: '#16a34a', marginBottom: 12 }}>
              Paiement confirmé !
            </h2>
            <p style={{ color: '#475569' }}>
              Votre paiement a bien été traité. Un email de confirmation vous a été envoyé.
            </p>
          </div>
        )}

        {/* Cancelled */}
        {cancelled && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            ⚠️ Paiement annulé. Vous pouvez réessayer ci-dessous.
          </div>
        )}

        {/* Facture */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            background: isPaid ? 'linear-gradient(135deg,#166534,#16a34a)' : 'linear-gradient(135deg,#0f2547,#1e3a5f)',
            margin: '-24px -24px 24px', padding: '24px', borderRadius: '14px 14px 0 0',
            color: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, opacity: .65, marginBottom: 4 }}>
                  De la part de
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
                  {invoice.creditor_name}
                </div>
              </div>
              {isPaid ? (
                <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  ✅ PAYÉ
                </span>
              ) : (
                <span style={{ background: 'rgba(245,158,11,.2)', color: '#fcd34d', padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                  ⏳ IMPAYÉ
                </span>
              )}
            </div>
          </div>

          {/* Détails facture */}
          <div style={{ display: 'grid', gap: 0 }}>
            {[
              ['À', invoice.debtor_name],
              ['N° Facture', invoice.invoice_number],
              ['Description', invoice.description || '—'],
              ['Date d\'émission', fmtDate(invoice.invoice_date)],
              ['Date d\'échéance', fmtDate(invoice.due_date)],
              ['Montant total', fmt(invoice.amount)],
              invoice.amount_paid > 0 && ['Déjà payé', fmt(invoice.amount_paid)],
            ].filter(Boolean).map(([label, value], i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0',
                borderBottom: i < 6 ? '1px solid #f1f5f9' : 'none',
              }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: label === 'Montant total' ? 700 : 500, color: '#1e293b' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Montant restant */}
          {!isPaid && (
            <div style={{
              background: '#fef3c7', border: '1px solid #fcd34d',
              borderRadius: 10, padding: '16px 20px', marginTop: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 14, color: '#78350f' }}>Montant à régler</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#92400e', fontFamily: "'Syne', sans-serif" }}>
                {fmt(invoice.remaining)}
              </span>
            </div>
          )}
        </div>

        {/* Actions (seulement si non payé) */}
        {!isPaid && !success && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 16 }}>
              {[
                { key: 'payment', label: '💳 Payer maintenant' },
                { key: 'installment', label: '📅 Demander un échéancier' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setView(key)}
                  style={{
                    flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                    borderRadius: 8, fontSize: 13, fontWeight: 600, transition: 'all .15s',
                    background: view === key ? '#fff' : 'transparent',
                    color: view === key ? '#0f2547' : '#64748b',
                    boxShadow: view === key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Vue paiement */}
            {view === 'payment' && (
              <div className="card">
                <h3 style={{ fontFamily: "'Syne', sans-serif", color: '#0f2547', marginBottom: 8, fontSize: 17 }}>
                  Paiement sécurisé par carte
                </h3>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
                  Votre paiement est traité par <strong>Stripe</strong>, la référence mondiale
                  du paiement en ligne. Vos données bancaires ne sont jamais stockées sur nos serveurs.
                </p>

                {error && <div className="alert alert-error">{error}</div>}

                <button className="btn btn-success btn-lg w-full"
                  style={{ justifyContent: 'center', fontSize: 17 }}
                  onClick={handlePay} disabled={checkoutLoading}>
                  {checkoutLoading
                    ? <><span className="spinner" style={{ width: 18, height: 18, marginRight: 10 }} />Redirection…</>
                    : `💳 Payer ${fmt(invoice.remaining)} maintenant`
                  }
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>🔒 Paiement SSL sécurisé · Powered by Stripe</span>
                </div>
              </div>
            )}

            {/* Vue échéancier */}
            {view === 'installment' && (
              <div className="card">
                {installmentSent ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <div style={{ fontSize: 56, marginBottom: 16 }}>📨</div>
                    <h3 style={{ color: '#16a34a', marginBottom: 8 }}>Demande envoyée !</h3>
                    <p style={{ color: '#64748b', fontSize: 14 }}>
                      Votre demande d'échéancier a été transmise à {invoice.creditor_name}.
                      Vous serez contacté pour confirmer les modalités.
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 style={{ fontFamily: "'Syne', sans-serif", color: '#0f2547', marginBottom: 8, fontSize: 17 }}>
                      Demander un paiement échelonné
                    </h3>
                    <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
                      Si vous avez des difficultés à régler la totalité, vous pouvez
                      soumettre une demande d'échéancier. Le créancier étudiera votre demande.
                    </p>

                    <form onSubmit={handleInstallmentRequest}>
                      <div className="form-group">
                        <label className="form-label">Nombre de mensualités souhaitées</label>
                        <select className="form-select"
                          value={installmentForm.count}
                          onChange={(e) => setInstallmentForm((f) => ({ ...f, count: parseInt(e.target.value) }))}>
                          {[2,3,4,5,6,9,12].map((n) => (
                            <option key={n} value={n}>
                              {n}× {fmt(invoice.remaining / n)}/mois
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Votre email de contact</label>
                        <input className="form-input" type="email"
                          placeholder="votre@email.fr"
                          value={installmentForm.email}
                          onChange={(e) => setInstallmentForm((f) => ({ ...f, email: e.target.value }))}
                          required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Message (optionnel)</label>
                        <textarea className="form-textarea" rows={3}
                          placeholder="Expliquez votre situation si besoin…"
                          value={installmentForm.message}
                          onChange={(e) => setInstallmentForm((f) => ({ ...f, message: e.target.value }))}
                          style={{ resize: 'vertical' }} />
                      </div>
                      {error && <div className="alert alert-error">{error}</div>}
                      <button type="submit" className="btn btn-primary btn-lg w-full" style={{ justifyContent: 'center' }}>
                        📅 Envoyer la demande d'échéancier
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ── MENTION LÉGALE OBLIGATOIRE ── */}
        <div style={{
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 10, padding: '16px 18px', marginTop: 20,
          fontSize: 11, color: '#94a3b8', lineHeight: 1.7,
        }}>
          <strong style={{ color: '#64748b' }}>Mention légale :</strong> Ceci est une relance
          automatisée envoyée au nom de votre créancier ({invoice.creditor_name}).
          RecouvrementPro agit exclusivement comme assistant technique du créancier et
          ne collecte ni ne détient aucun fonds. Les paiements sont traités par Stripe
          et versés directement au créancier.<br />
          Conformément au RGPD (UE 2016/679), vous disposez d'un droit d'accès et de
          rectification. Contactez {invoice.creditor_name} pour exercer ces droits.
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, marginBottom: 32, fontSize: 11, color: '#cbd5e1' }}>
          RecouvrementPro — plateforme SaaS de recouvrement · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
