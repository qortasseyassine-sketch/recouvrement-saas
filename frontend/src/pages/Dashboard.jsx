import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { invoicesApi } from '../utils/api';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement, PointElement, LineElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

const STATUS_CONFIG = {
  pending:    { label: 'En attente',   badge: 'badge-gray',   icon: '⏳' },
  reminded_1: { label: 'Relancé 1×',   badge: 'badge-yellow', icon: '📧' },
  reminded_2: { label: 'Relancé 2×',   badge: 'badge-orange', icon: '⚠️' },
  reminded_3: { label: 'Relancé 3×',   badge: 'badge-red',    icon: '🔴' },
  in_payment: { label: 'En cours',     badge: 'badge-blue',   icon: '💳' },
  paid:       { label: 'Payé',         badge: 'badge-green',  icon: '✅' },
  disputed:   { label: 'Contentieux',  badge: 'badge-purple', icon: '⚖️' },
  legal:      { label: 'Judiciaire',   badge: 'badge-red',    icon: '🏛️' },
};

// ─── Composant Badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, badge: 'badge-gray', icon: '' };
  return <span className={`badge ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>;
}

// ─── Modal Créer/Modifier une facture ─────────────────────────────────────────
function InvoiceModal({ invoice, onClose, onSave }) {
  const [form, setForm] = useState({
    invoice_number: invoice?.invoice_number || '',
    debtor_name:    invoice?.debtor_name || '',
    debtor_email:   invoice?.debtor_email || '',
    debtor_phone:   invoice?.debtor_phone || '',
    amount:         invoice?.amount || '',
    due_date:       invoice?.due_date || '',
    invoice_date:   invoice?.invoice_date || '',
    description:    invoice?.description || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (f) => (e) => setForm((v) => ({ ...v, [f]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (invoice?.id) {
        await invoicesApi.update(invoice.id, form);
      } else {
        await invoicesApi.create(form);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la sauvegarde.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>{invoice ? '✏️ Modifier la facture' : '➕ Nouvelle facture'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="alert alert-error mb-4">❌ {error}</div>}
          <form id="invoice-form" onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">N° Facture *</label>
                <input className="form-input" value={form.invoice_number} onChange={set('invoice_number')}
                  placeholder="FAC-2024-001" required />
              </div>
              <div className="form-group">
                <label className="form-label">Montant TTC (€) *</label>
                <input className="form-input" type="number" step="0.01" min="0.01"
                  value={form.amount} onChange={set('amount')} placeholder="1 500.00" required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Nom du débiteur *</label>
              <input className="form-input" value={form.debtor_name} onChange={set('debtor_name')}
                placeholder="Société ABC SARL" required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Email débiteur</label>
                <input className="form-input" type="email" value={form.debtor_email} onChange={set('debtor_email')}
                  placeholder="comptabilite@abc.fr" />
              </div>
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input className="form-input" type="tel" value={form.debtor_phone} onChange={set('debtor_phone')}
                  placeholder="+33 1 23 45 67 89" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Date d'échéance *</label>
                <input className="form-input" type="date" value={form.due_date} onChange={set('due_date')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Date de facture</label>
                <input className="form-input" type="date" value={form.invoice_date} onChange={set('invoice_date')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description (optionnel)</label>
              <input className="form-input" value={form.description} onChange={set('description')}
                placeholder="Prestation de services — Novembre 2024" />
            </div>
          </form>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
          <button type="submit" form="invoice-form" className="btn btn-primary" disabled={loading}>
            {loading ? 'Sauvegarde…' : invoice ? 'Enregistrer' : 'Créer la facture'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import CSV Modal ─────────────────────────────────────────────────────────
function CsvImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleImport = async () => {
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const { data } = await invoicesApi.importCsv(file);
      setResult(data);
      if (data.imported > 0) onImported();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur d\'import.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>📥 Importer des factures (CSV)</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: 16, marginBottom: 20, fontSize: 13, color: '#475569',
          }}>
            <strong>Format attendu (colonnes) :</strong><br />
            <code style={{ fontSize: 11, background: '#e2e8f0', padding: '4px 8px', borderRadius: 4, display: 'block', marginTop: 6 }}>
              invoice_number, debtor_name, debtor_email, debtor_phone, amount, due_date, invoice_date, description
            </code>
            <div style={{ marginTop: 10, fontSize: 12 }}>
              ✅ Séparateur <code>;</code> ou <code>,</code> accepté &nbsp;|&nbsp;
              ✅ Dates : <code>JJ/MM/AAAA</code> ou <code>AAAA-MM-JJ</code> &nbsp;|&nbsp;
              ✅ Montants : <code>1 234,56</code> ou <code>1234.56</code>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {result ? (
            <div>
              <div className={`alert ${result.imported > 0 ? 'alert-success' : 'alert-warning'}`}>
                ✅ {result.imported} facture(s) importée(s) — {result.skipped} ignorée(s) (doublons)
              </div>
              {result.csv_errors?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>
                    ⚠️ {result.csv_errors.length} ligne(s) avec erreurs :
                  </p>
                  <div style={{ maxHeight: 150, overflow: 'auto', fontSize: 12, color: '#64748b' }}>
                    {result.csv_errors.map((e, i) => (
                      <div key={i}>Ligne {e.line} : {e.errors.join(', ')}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                border: '2px dashed #bfdbfe', borderRadius: 12, padding: '32px 20px',
                textAlign: 'center', cursor: 'pointer', background: file ? '#f0f9ff' : '#f8fafc',
              }}
              onClick={() => fileRef.current.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            >
              <input type="file" accept=".csv" ref={fileRef} style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files[0])} />
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              {file ? (
                <div>
                  <p style={{ fontWeight: 600, color: '#1e40af', margin: '0 0 4px' }}>{file.name}</p>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                    {(file.size / 1024).toFixed(1)} KB — Cliquez pour changer
                  </p>
                </div>
              ) : (
                <div>
                  <p style={{ fontWeight: 600, color: '#334155', margin: '0 0 4px' }}>
                    Glissez votre fichier CSV ici
                  </p>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>ou cliquez pour sélectionner</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Fermer</button>
          {!result && (
            <button className="btn btn-primary" onClick={handleImport} disabled={!file || loading}>
              {loading ? 'Import en cours…' : '📥 Importer'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard principal ──────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [view, setView] = useState('invoices'); // invoices | stats
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null); // null | 'create' | 'edit' | 'csv' | 'delete'
  const [editInvoice, setEditInvoice] = useState(null);
  const [reminderLoading, setReminderLoading] = useState('');
  const [toast, setToast] = useState(null);
  const toastTimeout = useRef();

  const showToast = (msg, type = 'success') => {
    clearTimeout(toastTimeout.current);
    setToast({ msg, type });
    toastTimeout.current = setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, statsRes] = await Promise.all([
        invoicesApi.list({ search, status: statusFilter }),
        invoicesApi.stats(),
      ]);
      setInvoices(invRes.data.invoices || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRemind = async (id) => {
    setReminderLoading(id);
    try {
      const { data } = await invoicesApi.remind(id);
      showToast(`✅ ${data.message}`);
      loadData();
    } catch (err) {
      showToast('❌ ' + (err.response?.data?.error || 'Erreur'), 'error');
    } finally { setReminderLoading(''); }
  };

  const handleBulkRemind = async () => {
    if (selected.length === 0) return;
    setReminderLoading('bulk');
    try {
      const { data } = await invoicesApi.remindBulk(selected);
      showToast(`✅ ${data.message}`);
      setSelected([]);
      loadData();
    } catch (err) {
      showToast('❌ Erreur lors des relances', 'error');
    } finally { setReminderLoading(''); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette facture ? Cette action est irréversible.')) return;
    try {
      await invoicesApi.delete(id);
      showToast('🗑️ Facture supprimée.');
      loadData();
    } catch { showToast('❌ Erreur lors de la suppression.', 'error'); }
  };

  const toggleSelect = (id) =>
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const selectAll = () =>
    setSelected(selected.length === invoices.length ? [] : invoices.map((i) => i.id));

  return (
    <div className="app-layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Recouvrement<span>Pro</span></h1>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 4 }}>{user?.company}</div>
        </div>

        <nav className="sidebar-nav">
          <div className={`nav-item ${view === 'invoices' ? 'active' : ''}`}
            onClick={() => setView('invoices')}>
            <span className="nav-icon">📋</span> Factures
          </div>
          <div className={`nav-item ${view === 'stats' ? 'active' : ''}`}
            onClick={() => setView('stats')}>
            <span className="nav-icon">📊</span> Statistiques
          </div>
          <div className="nav-item" onClick={() => setModal('csv')}>
            <span className="nav-icon">📥</span> Importer CSV
          </div>
          <div className="nav-item" onClick={() => { setEditInvoice(null); setModal('create'); }}>
            <span className="nav-icon">➕</span> Nouvelle facture
          </div>
          {user?.role === 'admin' && (
            <div className="nav-item" onClick={() => navigate('/admin')}>
              <span className="nav-icon">⚙️</span> Administration
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginBottom: 10 }}>
            Plan : <strong style={{ color: '#fcd34d' }}>{user?.plan}</strong>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}
            style={{ color: 'rgba(255,255,255,.5)', padding: '6px 0' }}>
            → Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Contenu principal ── */}
      <div className="main-content">
        <header className="top-bar">
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f2547', margin: 0 }}>
              {view === 'invoices' ? '📋 Factures impayées' : '📊 Statistiques'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>{user?.email}</div>
          </div>
        </header>

        <div className="page-content">

          {/* ─── Vue Statistiques ─── */}
          {view === 'stats' && stats && (
            <StatsView stats={stats} />
          )}

          {/* ─── Vue Factures ─── */}
          {view === 'invoices' && (
            <>
              {/* Stats rapides */}
              {stats && (
                <div className="stats-grid">
                  <div className="stat-card blue">
                    <div className="stat-label">Encours total</div>
                    <div className="stat-value">{fmt(stats.total_outstanding)}</div>
                    <div className="stat-sub">{stats.pending_count + stats.reminded_count} factures</div>
                  </div>
                  <div className="stat-card green">
                    <div className="stat-label">Recouvré</div>
                    <div className="stat-value">{fmt(stats.total_collected)}</div>
                    <div className="stat-sub">{stats.paid_count} factures payées</div>
                  </div>
                  <div className="stat-card gold">
                    <div className="stat-label">DSO</div>
                    <div className="stat-value">{stats.dso} j</div>
                    <div className="stat-sub">Délai moyen de paiement</div>
                  </div>
                  <div className="stat-card orange">
                    <div className="stat-label">Taux recouvrement</div>
                    <div className="stat-value">{stats.recovery_rate}%</div>
                    <div className="stat-sub">Sur le total facturé</div>
                  </div>
                </div>
              )}

              {/* Toolbar */}
              <div className="toolbar">
                <div className="search-wrapper">
                  <span className="search-icon">🔍</span>
                  <input className="search-input" placeholder="Chercher débiteur, n° facture…"
                    value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="form-select" style={{ width: 160 }}
                  value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">Tous les statuts</option>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                  {selected.length > 0 && (
                    <button className="btn btn-warning" onClick={handleBulkRemind}
                      disabled={reminderLoading === 'bulk'}>
                      📧 Relancer {selected.length} sélectionnée(s)
                    </button>
                  )}
                  <button className="btn btn-outline" onClick={() => setModal('csv')}>📥 Import CSV</button>
                  <button className="btn btn-primary" onClick={() => { setEditInvoice(null); setModal('create'); }}>
                    ➕ Nouvelle facture
                  </button>
                </div>
              </div>

              {/* Table */}
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                  <div className="spinner spinner-dark" style={{ width: 32, height: 32, margin: '0 auto 12px' }} />
                  Chargement…
                </div>
              ) : invoices.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>📭</div>
                  <h3 style={{ color: '#0f2547', marginBottom: 8 }}>Aucune facture</h3>
                  <p style={{ color: '#64748b', marginBottom: 24 }}>
                    Importez votre premier fichier CSV ou créez une facture manuellement.
                  </p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <button className="btn btn-outline" onClick={() => setModal('csv')}>📥 Importer CSV</button>
                    <button className="btn btn-primary" onClick={() => { setEditInvoice(null); setModal('create'); }}>➕ Créer une facture</button>
                  </div>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>
                          <input type="checkbox" checked={selected.length === invoices.length && invoices.length > 0}
                            onChange={selectAll} style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
                        </th>
                        <th>N° Facture</th>
                        <th>Débiteur</th>
                        <th>Montant</th>
                        <th>Reste dû</th>
                        <th>Échéance</th>
                        <th>Retard</th>
                        <th>Statut</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => {
                        const overdue = Math.max(0, Math.floor((Date.now() - new Date(inv.due_date)) / 86400000));
                        const remaining = inv.amount - inv.amount_paid;
                        return (
                          <tr key={inv.id}>
                            <td>
                              <input type="checkbox" checked={selected.includes(inv.id)}
                                onChange={() => toggleSelect(inv.id)}
                                style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
                            </td>
                            <td className="td-primary">{inv.invoice_number}</td>
                            <td>
                              <div className="td-primary">{inv.debtor_name}</div>
                              {inv.debtor_email && (
                                <div style={{ fontSize: 11, color: '#94a3b8' }}>{inv.debtor_email}</div>
                              )}
                            </td>
                            <td className="td-amount">{fmt(inv.amount)}</td>
                            <td className="td-amount" style={{ color: remaining > 0 ? '#dc2626' : '#16a34a' }}>
                              {fmt(remaining)}
                            </td>
                            <td>{fmtDate(inv.due_date)}</td>
                            <td>
                              {inv.status !== 'paid' && overdue > 0 ? (
                                <span style={{ color: overdue > 60 ? '#dc2626' : overdue > 30 ? '#ea580c' : '#f59e0b', fontWeight: 600, fontSize: 13 }}>
                                  {overdue} j
                                </span>
                              ) : '—'}
                            </td>
                            <td><StatusBadge status={inv.status} /></td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {inv.status !== 'paid' && inv.debtor_email && (
                                  <button className="btn btn-sm btn-warning"
                                    disabled={reminderLoading === inv.id}
                                    onClick={() => handleRemind(inv.id)}
                                    title="Envoyer une relance">
                                    {reminderLoading === inv.id ? '…' : '📧'}
                                  </button>
                                )}
                                {inv.payment_link && (
                                  <a href={inv.payment_link} target="_blank" rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline" title="Portail débiteur">🔗</a>
                                )}
                                <button className="btn btn-sm btn-outline"
                                  onClick={() => { setEditInvoice(inv); setModal('edit'); }}
                                  title="Modifier">✏️</button>
                                <button className="btn btn-sm btn-ghost"
                                  onClick={() => handleDelete(inv.id)}
                                  title="Supprimer" style={{ color: '#dc2626' }}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {(modal === 'create' || modal === 'edit') && (
        <InvoiceModal
          invoice={modal === 'edit' ? editInvoice : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); loadData(); showToast('✅ Facture sauvegardée !'); }}
        />
      )}
      {modal === 'csv' && (
        <CsvImportModal onClose={() => setModal(null)} onImported={loadData} />
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          background: toast.type === 'error' ? '#dc2626' : '#16a34a',
          color: '#fff', padding: '12px 20px', borderRadius: 10,
          fontSize: 14, fontWeight: 600,
          boxShadow: '0 8px 24px rgba(0,0,0,.15)',
          animation: 'slideUp .2s',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Composant Stats ──────────────────────────────────────────────────────────
function StatsView({ stats }) {
  const fmt = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);

  const barData = {
    labels: (stats.monthly || []).map((m) => {
      const [y, mo] = m.month.split('-');
      return new Date(y, parseInt(mo) - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    }),
    datasets: [
      {
        label: 'Facturé',
        data: (stats.monthly || []).map((m) => m.invoiced),
        backgroundColor: '#bfdbfe',
        borderColor: '#2563eb', borderWidth: 1.5, borderRadius: 6,
      },
      {
        label: 'Recouvré',
        data: (stats.monthly || []).map((m) => m.collected),
        backgroundColor: '#bbf7d0',
        borderColor: '#16a34a', borderWidth: 1.5, borderRadius: 6,
      },
    ],
  };

  const doughnutData = {
    labels: ['Payé', 'En attente', 'Relancé', 'Contentieux'],
    datasets: [{
      data: [
        stats.paid_count || 0,
        stats.pending_count || 0,
        stats.reminded_count || 0,
        stats.legal_count || 0,
      ],
      backgroundColor: ['#16a34a', '#94a3b8', '#f59e0b', '#dc2626'],
      borderWidth: 0,
    }],
  };

  return (
    <div>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card blue">
          <div className="stat-label">Total facturé</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{fmt(stats.total_invoiced)}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Recouvré</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{fmt(stats.total_collected)}</div>
        </div>
        <div className="stat-card orange">
          <div className="stat-label">DSO</div>
          <div className="stat-value">{stats.dso} j</div>
          <div className="stat-sub">Days Sales Outstanding</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-label">Taux de recouvrement</div>
          <div className="stat-value">{stats.recovery_rate}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 20, color: '#0f2547' }}>📈 Facturé vs Recouvré (6 mois)</h3>
          <Bar data={barData} options={{
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            scales: {
              y: { ticks: { callback: (v) => v.toLocaleString('fr-FR') + ' €' } }
            }
          }} />
        </div>
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 20, color: '#0f2547' }}>🥧 Répartition des factures</h3>
          <Doughnut data={doughnutData} options={{
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            cutout: '65%',
          }} />
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#0f2547', fontFamily: "'Syne', sans-serif" }}>
              {stats.total_invoices}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>factures totales</div>
          </div>
        </div>
      </div>
    </div>
  );
}
