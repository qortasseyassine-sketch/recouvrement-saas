import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionExpired = params.get('session_expired');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="auth-page">
      {/* ── Panneau gauche (formulaire) ── */}
      <div className="auth-panel">
        <div style={{ marginBottom: 36 }}>
          <Link to="/" style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: '#0f2547', textDecoration: 'none' }}>
            Recouvrement<span style={{ color: '#f59e0b' }}>Pro</span>
          </Link>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#0f2547', marginTop: 28, marginBottom: 6 }}>
            Bon retour 👋
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Connectez-vous à votre espace créancier
          </p>
        </div>

        {sessionExpired && (
          <div className="alert alert-warning">
            ⏰ Votre session a expiré. Reconnectez-vous.
          </div>
        )}

        {error && (
          <div className="alert alert-error">❌ {error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Adresse email</label>
            <input
              type="email"
              className="form-input"
              placeholder="vous@entreprise.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading} style={{ justifyContent: 'center', marginTop: 8 }}>
            {loading ? <><span className="spinner" style={{ width:16,height:16,marginRight:8 }} />Connexion…</> : 'Se connecter →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#64748b' }}>
          Pas encore de compte ?{' '}
          <Link to="/register" style={{ color: '#2563eb', fontWeight: 600 }}>
            Créer un compte gratuit
          </Link>
        </div>
      </div>

      {/* ── Panneau droit (marketing) ── */}
      <div className="auth-hero" style={{ flex: 1 }}>
        <div style={{ maxWidth: 440 }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, color: '#fff', marginBottom: 20, lineHeight: 1.2 }}>
            Récupérez ce qui vous est dû — automatiquement.
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', lineHeight: 1.7, marginBottom: 40 }}>
            RecouvrementPro automatise 100% du cycle de relance, du rappel amiable
            à la mise en demeure, avec paiement Stripe intégré.
          </p>
          {[
            '✅ Import CSV en 30 secondes',
            '✅ Relances email automatiques',
            '✅ Portail de paiement débiteur',
            '✅ Tableau de bord DSO en temps réel',
            '✅ Conforme RGPD & droit français',
          ].map((item) => (
            <div key={item} style={{ fontSize: 15, color: 'rgba(255,255,255,.85)', marginBottom: 12 }}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
