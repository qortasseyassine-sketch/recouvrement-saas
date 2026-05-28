import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../utils/api';
import { useAuth } from '../hooks/useAuth';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n ?? 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };
const PLAN_COLORS = { starter: 'badge-blue', pro: 'badge-gold', enterprise: 'badge-purple' };
const STATUS_COLORS = {
  paid: 'badge-green', pending: 'badge-yellow', overdue: 'badge-red',
  reminded_1: 'badge-blue', reminded_2: 'badge-orange', reminded_3: 'badge-red',
};
const STATUS_LABELS = {
  paid: 'Payée', pending: 'En attente', overdue: 'En retard',
  reminded_1: 'Relance 1', reminded_2: 'Relance 2', reminded_3: 'Relance 3',
};

function StatCard({ label, value, sub, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`} />
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`toast toast-${type}`}>
      {msg}
      <button onClick={onClose}>✕</button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  // ── Fetch all data ──────────────────────────────────────────────────────

  const loadStats = useCallback(async () => {
    try {
      const r = await adminApi.getStats();
      setStats(r.data);
    } catch {
      showToast('Erreur chargement statistiques', 'error');
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const r = await adminApi.getUsers();
      setUsers(r.data.users || []);
    } catch {
      showToast('Erreur chargement utilisateurs', 'error');
    }
  }, []);

  const loadInvoices = useCallback(async () => {
    try {
      const r = await adminApi.getInvoices();
      setInvoices(r.data.invoices || []);
    } catch {
      showToast('Erreur chargement factures', 'error');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadUsers(), loadInvoices()]);
      setLoading(false);
    })();
  }, [loadStats, loadUsers, loadInvoices]);

  // ── User actions ─────────────────────────────────────────────────────────

  const toggleUser = async (userId, currentActive) => {
    try {
      await adminApi.toggleUser(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: currentActive ? 0 : 1 } : u))
      );
      showToast(currentActive ? 'Compte suspendu' : 'Compte réactivé');
    } catch {
      showToast('Erreur lors de la modification', 'error');
    }
  };

  const changePlan = async (userId, newPlan) => {
    try {
      await adminApi.updatePlan(userId, newPlan);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan: newPlan } : u))
      );
      showToast(`Plan mis à jour : ${PLAN_LABELS[newPlan]}`);
    } catch {
      showToast('Erreur lors du changement de plan', 'error');
    }
  };

  // ── Filtered lists ────────────────────────────────────────────────────────

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      u.company_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q);
    const matchPlan = !planFilter || u.plan === planFilter;
    return matchSearch && matchPlan;
  });

  const filteredInvoices = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      inv.debtor_name?.toLowerCase().includes(q) ||
      inv.invoice_number?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Stats view ────────────────────────────────────────────────────────────

  const StatsTab = () => {
    if (!stats) return <div className="loading-state">Chargement…</div>;
    const { platform, invoices: inv, users: usr } = stats;
    return (
      <div>
        <h2 className="section-title">Vue d'ensemble de la plateforme</h2>

        <div className="stats-grid">
          <StatCard
            label="Utilisateurs totaux"
            value={usr?.total ?? 0}
            sub={`${usr?.active ?? 0} actifs`}
            color="icon-blue"
          />
          <StatCard
            label="Inscriptions ce mois"
            value={usr?.this_month ?? 0}
            color="icon-green"
          />
          <StatCard
            label="Factures totales"
            value={inv?.total ?? 0}
            sub={`${inv?.paid ?? 0} payées`}
            color="icon-gold"
          />
          <StatCard
            label="Volume total"
            value={fmt(platform?.total_volume)}
            sub={`${fmt(platform?.paid_volume)} encaissé`}
            color="icon-purple"
          />
        </div>

        <div className="admin-grid-2">
          {/* Répartition des plans */}
          <div className="card">
            <h3 className="card-title">Répartition des plans</h3>
            {[
              { key: 'starter', label: 'Starter', count: usr?.by_plan?.starter ?? 0 },
              { key: 'pro', label: 'Pro', count: usr?.by_plan?.pro ?? 0 },
              { key: 'enterprise', label: 'Enterprise', count: usr?.by_plan?.enterprise ?? 0 },
            ].map(({ key, label, count }) => {
              const pct = usr?.total ? Math.round((count / usr.total) * 100) : 0;
              return (
                <div key={key} className="plan-bar-row">
                  <span className={`badge ${PLAN_COLORS[key]}`}>{label}</span>
                  <div className="plan-bar-track">
                    <div className="plan-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="plan-bar-label">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>

          {/* Statut des factures */}
          <div className="card">
            <h3 className="card-title">Statut des factures</h3>
            {[
              { key: 'paid', label: 'Payées', count: inv?.paid ?? 0 },
              { key: 'pending', label: 'En attente', count: inv?.pending ?? 0 },
              { key: 'overdue', label: 'En retard', count: inv?.overdue ?? 0 },
            ].map(({ key, label, count }) => {
              const pct = inv?.total ? Math.round((count / inv.total) * 100) : 0;
              return (
                <div key={key} className="plan-bar-row">
                  <span className={`badge ${STATUS_COLORS[key]}`}>{label}</span>
                  <div className="plan-bar-track">
                    <div className={`plan-bar-fill fill-${key}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="plan-bar-label">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* MRR estimate */}
        <div className="card mrr-card">
          <h3 className="card-title">Estimation MRR</h3>
          <div className="mrr-grid">
            {[
              { plan: 'starter', price: 29, count: usr?.by_plan?.starter ?? 0 },
              { plan: 'pro', price: 79, count: usr?.by_plan?.pro ?? 0 },
              { plan: 'enterprise', price: 199, count: usr?.by_plan?.enterprise ?? 0 },
            ].map(({ plan, price, count }) => (
              <div key={plan} className="mrr-item">
                <span className={`badge ${PLAN_COLORS[plan]}`}>{PLAN_LABELS[plan]}</span>
                <span className="mrr-value">{fmt(price * count)}</span>
                <span className="mrr-sub">{count} × {price}€</span>
              </div>
            ))}
            <div className="mrr-item mrr-total">
              <span>Total MRR</span>
              <span className="mrr-value">
                {fmt(
                  (usr?.by_plan?.starter ?? 0) * 29 +
                  (usr?.by_plan?.pro ?? 0) * 79 +
                  (usr?.by_plan?.enterprise ?? 0) * 199
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Users tab ─────────────────────────────────────────────────────────────

  const UsersTab = () => (
    <div>
      <div className="toolbar">
        <h2 className="section-title">Utilisateurs ({filteredUsers.length})</h2>
        <div className="toolbar-controls">
          <input
            className="search-input"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
          >
            <option value="">Tous les plans</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Entreprise</th>
              <th>Email</th>
              <th>Plan</th>
              <th>Inscription</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  Aucun utilisateur trouvé
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.company_name || '—'}</strong></td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className={`badge-select badge ${PLAN_COLORS[u.plan] || 'badge-blue'}`}
                      value={u.plan}
                      onChange={(e) => changePlan(u.id, e.target.value)}
                    >
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </td>
                  <td>{fmtDate(u.created_at)}</td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      {u.is_active ? 'Actif' : 'Suspendu'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => toggleUser(u.id, u.is_active)}
                    >
                      {u.is_active ? 'Suspendre' : 'Réactiver'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Invoices tab ──────────────────────────────────────────────────────────

  const InvoicesTab = () => (
    <div>
      <div className="toolbar">
        <h2 className="section-title">Toutes les factures ({filteredInvoices.length})</h2>
        <div className="toolbar-controls">
          <input
            className="search-input"
            placeholder="Rechercher débiteur, n° facture…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="overdue">En retard</option>
            <option value="reminded_1">Relance 1</option>
            <option value="reminded_2">Relance 2</option>
            <option value="reminded_3">Relance 3</option>
            <option value="paid">Payée</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>N° Facture</th>
              <th>Débiteur</th>
              <th>Créancier</th>
              <th>Montant</th>
              <th>Échéance</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  Aucune facture trouvée
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td><code>{inv.invoice_number}</code></td>
                  <td>
                    <div>{inv.debtor_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{inv.debtor_email}</div>
                  </td>
                  <td>{inv.creditor_company || `User #${inv.user_id}`}</td>
                  <td><strong>{fmt(inv.amount)}</strong></td>
                  <td style={{ color: inv.status === 'overdue' ? 'var(--danger)' : 'inherit' }}>
                    {fmtDate(inv.due_date)}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_COLORS[inv.status] || 'badge-blue'}`}>
                      {STATUS_LABELS[inv.status] || inv.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Chargement du backoffice…</p>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">⚙️</span>
          <span>Admin</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${tab === 'stats' ? 'active' : ''}`}
            onClick={() => setTab('stats')}
          >
            <span className="nav-icon">📊</span> Statistiques
          </button>
          <button
            className={`nav-item ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            <span className="nav-icon">👥</span> Utilisateurs
            <span className="nav-badge">{users.length}</span>
          </button>
          <button
            className={`nav-item ${tab === 'invoices' ? 'active' : ''}`}
            onClick={() => setTab('invoices')}
          >
            <span className="nav-icon">🧾</span> Factures
            <span className="nav-badge">{invoices.length}</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={() => navigate('/dashboard')}>
            <span className="nav-icon">◀</span> Dashboard client
          </button>
          <button className="nav-item danger" onClick={logout}>
            <span className="nav-icon">🚪</span> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {tab === 'stats' && '📊 Statistiques plateforme'}
              {tab === 'users' && '👥 Gestion des utilisateurs'}
              {tab === 'invoices' && '🧾 Toutes les factures'}
            </h1>
            <p className="page-sub">Backoffice RecouvrementPro — accès restreint</p>
          </div>
          <div className="admin-badge">
            <span className="badge badge-red">ADMIN</span>
          </div>
        </div>

        <div className="content-area">
          {tab === 'stats' && <StatsTab />}
          {tab === 'users' && <UsersTab />}
          {tab === 'invoices' && <InvoicesTab />}
        </div>
      </main>

      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
