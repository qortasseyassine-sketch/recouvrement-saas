# RecouvrementPro 🧾

**SaaS de recouvrement de créances automatisé pour TPE/PME — France & Maroc**

Plateforme de Collection-as-a-Service permettant aux entreprises d'automatiser leurs relances
de factures impayées, avec portail de paiement intégré via Stripe.

---

## Fonctionnalités

- **Import CSV** de factures (format FR et EN)
- **Relances automatisées** par email (3 niveaux d'escalade)
- **Portail débiteur** : page de paiement publique avec lien unique
- **Paiement Stripe** : carte bancaire, confirmation automatique
- **Demande d'échéancier** : le débiteur propose un plan de paiement
- **Tableau de bord** : DSO, taux de recouvrement, graphiques
- **Backoffice admin** : gestion utilisateurs, plans, statistiques plateforme
- **RGPD** : consentement à l'inscription, mentions légales sur chaque email

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Backend | Node.js 18+ / Express 4 |
| Base de données | SQLite 3 (via better-sqlite3) |
| Frontend | React 18 / Vite |
| Emails | Nodemailer (SMTP) |
| Paiements | Stripe |
| Auth | JWT (HS256) |
| Hébergement | Render.com (gratuit) |

---

## Structure du projet

```
recouvrement-saas/
├── backend/
│   ├── index.js              # Serveur Express principal
│   ├── db.js                 # Schéma SQLite + initialisation
│   ├── package.json
│   ├── .env.example
│   ├── middleware/
│   │   └── auth.js           # JWT middleware
│   ├── routes/
│   │   ├── auth.js           # /api/auth/*
│   │   ├── invoices.js       # /api/invoices/*
│   │   ├── debtor.js         # /api/debtor/* (portail public)
│   │   └── admin.js          # /api/admin/*
│   └── utils/
│       ├── email.js          # Nodemailer + templates
│       └── csv.js            # Parser CSV
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── styles.css
│   │   ├── hooks/
│   │   │   └── useAuth.jsx
│   │   ├── utils/
│   │   │   └── api.js
│   │   └── pages/
│   │       ├── Landing.jsx
│   │       ├── Login.jsx
│   │       ├── Register.jsx
│   │       ├── Dashboard.jsx
│   │       ├── DebtorPortal.jsx
│   │       └── Admin.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── factures_exemple.csv
```

---

## Installation locale

### Prérequis

- Node.js 18 ou supérieur
- npm 9+
- Un compte Stripe (gratuit pour tester)
- Un compte SMTP (Gmail, Brevo, Mailgun…)

### 1. Cloner / récupérer le projet

```bash
cd recouvrement-saas
```

### 2. Installer le backend

```bash
cd backend
npm install
cp .env.example .env
# → Editez .env avec vos vraies valeurs (voir section Variables d'environnement)
```

### 3. Installer le frontend

```bash
cd ../frontend
npm install
```

### 4. Lancer en développement

**Terminal 1 — Backend :**
```bash
cd backend
npm run dev
# Démarre sur http://localhost:4000
```

**Terminal 2 — Frontend :**
```bash
cd frontend
npm run dev
# Démarre sur http://localhost:5173
```

Ouvrez **http://localhost:5173** dans votre navigateur.

---

## Variables d'environnement

Copiez `backend/.env.example` vers `backend/.env` et remplissez :

```env
# ── Serveur ────────────────────────────────────────
PORT=4000
NODE_ENV=development

# ── Sécurité ──────────────────────────────────────
JWT_SECRET=changez-moi-en-production-64-chars-minimum

# ── Email (SMTP) ───────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=votre@email.com
EMAIL_PASS=votre-mot-de-passe-application
EMAIL_FROM=RecouvrementPro <noreply@votredomaine.com>

# ── Stripe ────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── URLs ──────────────────────────────────────────
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:4000

# ── Admin ─────────────────────────────────────────
ADMIN_EMAIL=admin@votredomaine.com

# ── Twilio (optionnel - SMS) ───────────────────────
# TWILIO_ACCOUNT_SID=ACxxx
# TWILIO_AUTH_TOKEN=xxx
# TWILIO_FROM_NUMBER=+33...
```

### Configuration Gmail (recommandé pour tester)

1. Activez la validation en 2 étapes sur votre compte Google
2. Allez dans **Compte Google → Sécurité → Mots de passe des applications**
3. Créez un mot de passe pour "Mail" / "Windows"
4. Utilisez ce mot de passe 16 caractères comme `EMAIL_PASS`

### Configuration Stripe

1. Créez un compte sur [stripe.com](https://stripe.com)
2. Dashboard → Développeurs → Clés API → copiez `sk_test_...`
3. Pour les webhooks en local, installez Stripe CLI :

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux / Windows : https://stripe.com/docs/stripe-cli

stripe login
stripe listen --forward-to localhost:4000/api/payments/webhook
# → Copiez le webhook secret affiché (whsec_...)
```

---

## Créer le compte admin

Après avoir lancé le backend, inscrivez-vous normalement via `/register`,
puis promouvez votre compte en admin via SQLite :

```bash
cd backend
node -e "
const db = require('./db');
db.prepare(\"UPDATE users SET role='admin' WHERE email='votre@email.com'\").run();
console.log('Admin créé !');
"
```

---

## Import de factures (CSV)

Utilisez le fichier `factures_exemple.csv` comme modèle.

**Colonnes supportées (noms FR et EN) :**

| FR | EN | Obligatoire |
|----|-----|-------------|
| `numero_facture` | `invoice_number` | ✅ |
| `nom_debiteur` | `debtor_name` | ✅ |
| `email_debiteur` | `debtor_email` | ✅ |
| `montant` | `amount` | ✅ |
| `date_echeance` | `due_date` | ✅ |
| `telephone_debiteur` | `debtor_phone` | ❌ |
| `description` | `description` | ❌ |

**Formats de date acceptés :** `DD/MM/YYYY`, `YYYY-MM-DD`, `MM/DD/YYYY`

**Formats de montant acceptés :** `1 250,50` (FR), `1250.50` (EN), `1250` (entier)

---

## Déploiement sur Render.com (gratuit)

### Étape 1 — Préparer le dépôt Git

```bash
cd recouvrement-saas
git init
git add .
git commit -m "Initial commit — RecouvrementPro MVP"
```

Poussez sur GitHub / GitLab.

### Étape 2 — Déployer le backend

1. Allez sur [render.com](https://render.com) → **New → Web Service**
2. Connectez votre repo GitHub
3. Configurez le service :

| Champ | Valeur |
|-------|--------|
| **Root Directory** | `backend` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |
| **Environment** | `Node` |
| **Plan** | Free |

4. Ajoutez les **Variables d'environnement** (tous les champs de votre `.env`) :
   - `NODE_ENV` = `production`
   - `PORT` = `4000`
   - `JWT_SECRET` = *(générez avec `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
   - `FRONTEND_URL` = votre URL frontend (voir étape 3)
   - … (tous les autres)

5. Cliquez **Create Web Service**

> ⚠️ Sur le plan gratuit Render, le service "s'endort" après 15 min d'inactivité.
> Pour un usage production, passez sur le plan Starter ($7/mois) ou utilisez Railway.

### Étape 3 — Déployer le frontend

**Option A — Vercel (recommandé) :**

```bash
npm i -g vercel
cd frontend
vercel
# Suivez les instructions
```

Dans les paramètres du projet Vercel, ajoutez la variable d'environnement :
```
VITE_API_URL=https://votre-backend.onrender.com
```

Puis dans `frontend/src/utils/api.js`, la baseURL est déjà configurée pour lire
`import.meta.env.VITE_API_URL`.

**Option B — Render Static Site :**

1. New → Static Site
2. Root Directory : `frontend`
3. Build Command : `npm install && npm run build`
4. Publish Directory : `dist`
5. Ajoutez `VITE_API_URL` = URL de votre backend Render

### Étape 4 — Configurer le webhook Stripe en production

1. Dashboard Stripe → Développeurs → Webhooks → **Ajouter un endpoint**
2. URL : `https://votre-backend.onrender.com/api/payments/webhook`
3. Événements à écouter : `checkout.session.completed`
4. Copiez le **Signing secret** → ajoutez-le comme `STRIPE_WEBHOOK_SECRET` dans Render

### Étape 5 — Créer l'admin en production

Render ne donne pas accès direct à SQLite en production sur le plan gratuit.
Utilisez la **Shell** Render (onglet Shell dans votre service) :

```bash
node -e "
const db = require('./db');
db.prepare(\"UPDATE users SET role='admin' WHERE email='admin@votredomaine.com'\").run();
console.log('OK');
"
```

---

## Mise à jour du frontend pour pointer vers le backend Render

Dans `frontend/src/utils/api.js`, la baseURL est :
```js
const BASE_URL = import.meta.env.VITE_API_URL || '/api';
```

En développement local, le proxy Vite redirige `/api` → `localhost:4000`.
En production, définissez `VITE_API_URL=https://votre-backend.onrender.com/api` dans
les variables d'environnement de votre hébergeur frontend.

---

## Scripts disponibles

### Backend
```bash
npm start      # Production
npm run dev    # Développement (nodemon)
```

### Frontend
```bash
npm run dev    # Serveur de développement
npm run build  # Build de production (→ dist/)
npm run preview # Prévisualiser le build
```

---

## Sécurité

- Mots de passe hashés avec **bcrypt** (12 rounds)
- Tokens JWT avec expiration 7 jours
- Rate limiting : 100 req/15min globalement, 5 req/15min sur `/auth`
- Headers de sécurité via **Helmet**
- Validation des entrées sur toutes les routes
- Corps brut (raw body) sur le webhook Stripe pour validation de signature

---

## Conformité légale

- **RGPD** : consentement explicite à l'inscription, timestamp conservé en base
- **Emails** : mention légale automatique sur chaque email envoyé
- **Portail débiteur** : information sur le traitement automatisé
- **Paiements** : flux direct créancier → Stripe, RecouvrementPro ne touche pas les fonds

---

## Roadmap

- [ ] Envoi SMS via Twilio
- [ ] Génération PDF de mise en demeure
- [ ] Synchronisation Gmail (lecture factures reçues)
- [ ] Intégration comptable (Pennylane, Sage)
- [ ] Relances WhatsApp
- [ ] Application mobile React Native

---

## Support

Pour toute question technique, ouvrez une issue sur le dépôt Git.

---

*RecouvrementPro — Simplifier le recouvrement pour les TPE/PME*
