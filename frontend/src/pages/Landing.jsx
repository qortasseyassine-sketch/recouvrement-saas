import { Link } from 'react-router-dom';

const PLANS = [
  {
    name: 'Starter',
    price: '29',
    color: '#2563eb',
    features: [
      '50 factures / mois',
      'Relances email automatiques',
      'Import CSV',
      'Portail débiteur',
      'Paiement Stripe',
    ],
    cta: 'Commencer gratuitement',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '79',
    color: '#f59e0b',
    features: [
      '500 factures / mois',
      'Relances email + SMS',
      'Mise en demeure PDF',
      'Statistiques avancées',
      'Support prioritaire',
    ],
    cta: 'Essai 14 jours gratuit',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '199',
    color: '#16a34a',
    features: [
      'Factures illimitées',
      'API complète',
      'Synchronisation ERP',
      'SLA 99.9%',
      'Manager dédié',
    ],
    cta: 'Contacter les ventes',
    highlighted: false,
  },
];

const FEATURES = [
  { icon: '📥', title: 'Import CSV en 1 clic', desc: 'Importez toutes vos factures impayées depuis votre logiciel comptable. Compatible Excel, Sage, QuickBooks.' },
  { icon: '📧', title: 'Relances automatiques', desc: '3 niveaux de relance progressive : rappel amiable, relance ferme, mise en demeure. Ton adapté à chaque étape.' },
  { icon: '💳', title: 'Paiement immédiat', desc: 'Chaque débiteur reçoit un lien de paiement sécurisé Stripe. Règlement en quelques clics, directement sur votre compte.' },
  { icon: '📊', title: 'Tableau de bord DSO', desc: 'Suivez votre DSO, taux de recouvrement, et montant en souffrance en temps réel. Graphiques et export inclus.' },
  { icon: '⚖️', title: 'Légalement conforme', desc: 'Mentions légales RGPD sur chaque communication. Traçabilité complète de toutes les actions.' },
  { icon: '🇫🇷🇲🇦', title: 'France & Maroc', desc: 'Adapté au droit français (L441-6 C.com) et marocain. Gestion multi-devises EUR / MAD.' },
];

export default function Landing() {
  return (
    <div style={{ background: '#0f2547', color: '#fff', fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── NAV ── */}
      <nav className="landing-nav">
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800 }}>
          Recouvrement<span style={{ color: '#f59e0b' }}>Pro</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="#fonctionnalites" style={{ color: 'rgba(255,255,255,.75)', fontSize: 14 }}>Fonctionnalités</a>
          <a href="#tarifs" style={{ color: 'rgba(255,255,255,.75)', fontSize: 14 }}>Tarifs</a>
          <Link to="/login" style={{ color: 'rgba(255,255,255,.75)', fontSize: 14 }}>Connexion</Link>
          <Link to="/register" className="btn btn-warning btn-sm">Essai gratuit →</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero-section">
        <div style={{ maxWidth: 680, zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.3)',
            borderRadius: 999, padding: '6px 16px', marginBottom: 28,
          }}>
            <span style={{ fontSize: 12, color: '#fcd34d', fontWeight: 600, letterSpacing: '.5px' }}>
              🚀 COLLECTION-AS-A-SERVICE - FRANCE & MAROC
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 800, lineHeight: 1.1, marginBottom: 24, letterSpacing: -1 }}>
            Recouvrez vos créances<br />
            <span style={{ color: '#f59e0b' }}>3× plus vite.</span>
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.75)', lineHeight: 1.7, marginBottom: 40, maxWidth: 520 }}>
            Importez vos factures impayées, envoyez des relances automatisées et
            encaissez directement par carte. Zéro paperasse, 100% en ligne.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-warning btn-lg">
              Commencer gratuitement →
            </Link>
            <a href="#fonctionnalites" className="btn btn-outline btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}>
              Voir comment ça marche
            </a>
          </div>
          <div style={{ marginTop: 48, display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            {[['98%', 'Taux de livraison email'], ['< 2 min', 'Pour envoyer une relance'], ['0€', "De frais d'installation"]].map(([val, lbl]) => (
              <div key={lbl}>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: '#fcd34d' }}>{val}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.55)', marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="fonctionnalites" style={{ background: '#f8fafc', padding: '80px 48px', color: '#1e293b' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 40, fontWeight: 800, color: '#0f2547', marginBottom: 12 }}>
              Tout ce qu'il vous faut pour recouvrer
            </h2>
            <p style={{ fontSize: 16, color: '#64748b', maxWidth: 480, margin: '0 auto' }}>
              Une plateforme complète, pensée pour les TPE et PME qui veulent
              automatiser sans complexité.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{
                background: '#fff', borderRadius: 16, padding: '28px 28px 24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: '#0f2547' }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: '80px 48px', background: '#0f2547', color: '#fff' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 40, fontWeight: 800, marginBottom: 56 }}>
            3 étapes, c'est tout.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
            {[
              { n: '1', title: 'Importez vos factures', desc: 'Glissez votre fichier CSV ou saisissez manuellement. Lecture en quelques secondes.' },
              { n: '2', title: 'Envoyez vos relances', desc: 'Un clic, et vos débiteurs reçoivent une relance personnalisée avec lien de paiement.' },
              { n: '3', title: 'Encaissez directement', desc: 'Stripe vire les fonds directement sur votre compte. Statut mis à jour automatiquement.' },
            ].map((s) => (
              <div key={s.n}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: '#f59e0b', color: '#0f2547',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 800, margin: '0 auto 20px',
                  fontFamily: "'Syne', sans-serif",
                }}>{s.n}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.65)', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="tarifs" style={{ background: '#f8fafc', padding: '80px 48px', color: '#1e293b' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 40, fontWeight: 800, color: '#0f2547', marginBottom: 12 }}>
              Des tarifs simples et transparents
            </h2>
            <p style={{ fontSize: 15, color: '#64748b' }}>Sans frais cachés. Sans commission sur vos encaissements.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {PLANS.map((plan) => (
              <div key={plan.name} style={{
                background: plan.highlighted ? '#0f2547' : '#fff',
                color: plan.highlighted ? '#fff' : '#1e293b',
                borderRadius: 20,
                padding: '36px 32px',
                border: plan.highlighted ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                boxShadow: plan.highlighted ? '0 20px 40px rgba(15,37,71,.2)' : '0 1px 3px rgba(0,0,0,.06)',
                position: 'relative',
              }}>
                {plan.highlighted && (
                  <div style={{
                    position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                    background: '#f59e0b', color: '#78350f',
                    padding: '4px 16px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                  }}>⭐ LE PLUS POPULAIRE</div>
                )}
                <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{plan.name}</h3>
                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, fontFamily: "'Syne', sans-serif" }}>
                    {plan.price}€
                  </span>
                  <span style={{ fontSize: 14, opacity: .65 }}>/mois</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', fontSize: 14 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: plan.highlighted ? '#fcd34d' : '#16a34a' }}>✓</span>
                      <span style={{ opacity: .85 }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/register" className={`btn btn-lg w-full ${plan.highlighted ? 'btn-warning' : 'btn-outline'}`}
                  style={plan.highlighted ? {} : { justifyContent: 'center', border: '1.5px solid #e2e8f0' }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: '#94a3b8' }}>
            TVA non incluse. Engagement mensuel. Résiliation à tout moment.
          </p>
        </div>
      </section>

      {/* ── LEGAL MENTION ── */}
      <div style={{ background: '#1e3a5f', padding: '16px 48px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', margin: 0 }}>
          RecouvrementPro est un outil SaaS de gestion des relances. Nous n'intervenons pas dans la relation contractuelle
          entre le créancier et le débiteur. Les fonds sont versés directement au créancier via Stripe.
          Conformité RGPD et droit français (L441-6 C.com).
        </p>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#0a1929', padding: '40px 48px', color: 'rgba(255,255,255,.45)', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 12, color: '#fff' }}>
          Recouvrement<span style={{ color: '#f59e0b' }}>Pro</span>
        </div>
        <div style={{ fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          <a href="#" style={{ color: 'rgba(255,255,255,.45)' }}>CGU</a>
          <a href="#" style={{ color: 'rgba(255,255,255,.45)' }}>Politique de confidentialité</a>
          <a href="#" style={{ color: 'rgba(255,255,255,.45)' }}>Mentions légales</a>
          <a href="mailto:contact@recouvrement.pro" style={{ color: 'rgba(255,255,255,.45)' }}>Contact</a>
        </div>
        <p style={{ fontSize: 12, margin: 0 }}>© 2024 RecouvrementPro. Tous droits réservés.</p>
      </footer>
    </div>
  );
}
