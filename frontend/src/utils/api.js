/**
 * utils/api.js — Client HTTP centralisé (axios)
 */

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Injecter le token JWT automatiquement
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Gérer les erreurs globalement
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session expirée
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?session_expired=1';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/password', data),
};

// ─── Factures ────────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: (params) => api.get('/invoices', { params }),
  stats: () => api.get('/invoices/stats'),
  get: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  importCsv: (file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/invoices/import/csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  remind: (id) => api.post(`/invoices/${id}/remind`),
  remindBulk: (ids) => api.post('/invoices/remind/bulk', { invoice_ids: ids }),
};

// ─── Portail débiteur ─────────────────────────────────────────────────────────
export const debtorApi = {
  getInvoice: (token) => api.get(`/debtor/${token}`),
  createCheckout: (token, amount) =>
    api.post(`/debtor/${token}/checkout`, { amount_to_pay: amount }),
  requestInstallment: (token, data) =>
    api.post(`/debtor/${token}/installment-request`, data),
};

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminApi = {
  stats: () => api.get('/admin/stats'),
  users: (params) => api.get('/admin/users', { params }),
  toggleUser: (id) => api.put(`/admin/users/${id}/toggle`),
  updatePlan: (id, plan) => api.put(`/admin/users/${id}/plan`, { plan }),
  invoices: (params) => api.get('/admin/invoices', { params }),
};

export default api;
