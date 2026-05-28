import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Register() {
  const [form, setForm] = useState({
    email: '', password: '', confirmPassword: '',
    company: '', siren: '', phone: '',
    rgpd_consent: false, cgu_consent: false,
  });
  const [errors, setErrors] = useState({});
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  const set = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Email requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email invalide';
    if (!form.password) e.password = 'Mot de passe requis';
    else if (form.password.length < 8) e.password = 'Minimum 8 caractères';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Les mots de passe ne correspondent pas';
    if (!form.company) e.company = 'Nom d\'entreprise requis';
    if (!form.rgpd_consent) e.rgpd_consent = 'Le consentement RGPD est obligatoire';
    if (!form.cgu_consent) e.cgu_consent = 'Vous devez accepter les CGU';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const result = await register({
      email: form.email, password: form.password, company: form.company,
      siren: form.siren, phone: form.phone, rgpd_consent: form.rgpd_consent,
    });
    if (result.success) navigate('/dashboard');
    else setErrors({ submit: result.error });
  };

  return (
    <div className="auth-page">
      <div className="auth-panel" style={{ width: 520, overflowY: 'auto', padding: '40px' }}>
        <div style={{ marginBottom: 28 }}>
          <Link to="/" style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#0f2547', textDecoration: 'none' }}>
            Recouvrement<span style={{ color: '#f59e0b' }}>Pro</span>
          </Link>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f2547', marginTop: 24, marginBottom: 4 }}>
            Créer votre compte
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Gratuit. Aucune carte bancaire requise.</p>
        </div>

        {errors.submit && <div className="alert alert-error">❌ {errors.submit}</div>}

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email professionnel *</label>
            <input type="email" className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="vous@entreprise.fr" value={form.email} onChange={set('email')} />
            {errors.email && <div className="form-error">{errors.email}</div>}
          </div>

          {/* Entreprise */}
          <div className="form-group">
            <label className="form-label">Nom de l'entreprise *</label>
            <input type="text" className={`form-input ${errors.company ? 'error' : ''}`}
              placeholder="Ma Société SARL" value={form.company} onChange={set('company')} />
            {errors.company && <div className="form-error">{errors.company}</div>}
          </div>

          {/* SIREN + Téléphone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">SIREN / ICE (optionnel)</label>
              <input type="text" className="form-input"
                placeholder="123 456 789" value={form.siren} onChange={set('siren')} />
            </div>
            <div className="form-group">
              <label className="form-label">Téléphone (optionnel)</label>
              <input type="tel" className="form-input"
                placeholder="+33 6 12 34 56 78" value={form.phone} onChange={set('phone')} />
            </div>
          </div>

          {/* Mot de passe */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Mot de passe *</label>
              <input type="password" className={`form-input ${errors.password ? 'error' : ''}`}
                placeholder="••••••••" value={form.password} onChange={set('password')} />
              {errors.password && <div className="form-error">{errors.password}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirmer *</label>
              <input type="password" className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                placeholder="••••••••" value={form.confirmPassword} onChange={set('confirmPassword')} />
              {errors.confirmPassword && <div className="form-error">{errors.confirmPassword}</div>}
            </div>
          </div>

          {/* ── Consentements RGPD ─────────────────────────── */}
          <div style={{
            background: '#f0f9ff', border: '1px solid #bae6fd',
            borderRadius: 10, padding: '16px 18px', marginBottom: 16,
          }}>
            <p style={{ fontSize: 12, color: '#0369a1', marginBottom: 12, fontWeight: 600 }}>
              🔒 Consentements obligatoires (RGPD)
            </p>

            <label className="checkbox-wrapper" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={form.rgpd_consent} onChange={set('rgpd_consent')} />
              <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                J'accepte que mes données soient traitées conformément à la{' '}
                <a href="#" style={{ color: '#2563eb' }}>politique de confidentialité</a>.
                Je comprends que mes factures et données débiteurs sont stockées de façon sécurisée.
              </span>
            </label>
            {errors.rgpd_consent && <div className="form-error">{errors.rgpd_consent}</div>}

            <label className="checkbox-wrapper">
              <input type="checkbox" checked={form.cgu_consent} onChange={set('cgu_consent')} />
              <span style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                J'accepte les{' '}
                <a href="#" style={{ color: '#2563eb' }}>CGU</a>
                {' '}et comprends que RecouvrementPro est un outil technique ; les paiements
                vont directement à mon compte Stripe, RecouvrementPro ne détient aucun fonds.
              </span>
            </label>
            {errors.cgu_consent && <div className="form-error">{errors.cgu_consent}</div>}
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full"
            disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? <><span className="spinner" style={{ width:16,height:16,marginRight:8 }} />Création du compte…</> : 'Créer mon compte gratuit →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#64748b' }}>
          Déjà un compte ?{' '}
          <Link to="/login" style={{ color: '#2563eb', fontWeight: 600 }}>Se connecter</Link>
        </div>
      </div>

      {/* Panneau droit */}
      <div className="auth-hero" style={{ flex: 1 }}>
        <div style={{ maxWidth: 420 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', marginBottom: 20, lineHeight: 1.2 }}>
            Commencez à recouvrer en moins de 5 minutes.
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { icon: '1', title: 'Créez votre compte', desc: 'Inscription en 2 minutes, sans CB.' },
              { icon: '2', title: 'Importez vos factures', desc: 'Glissez votre CSV ou saisissez manuellement.' },
              { icon: '3', title: 'Envoyez vos premières relances', desc: 'Cliquez et c\'est parti. Vos débiteurs reçoivent leur lien de paiement.' },
            ].map((s) => (
              <div key={s.icon} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#f59e0b', color: '#0f2547',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 16,
                  flexShrink: 0,
                }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{s.title}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,.65)' }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
