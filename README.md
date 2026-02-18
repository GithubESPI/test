# 📋 UploadsBulletins — Cahier des charges

Application web de génération automatique de bulletins de notes scolaires pour le **Groupe ESPI**, développée avec Next.js et déployée sur Azure App Service.

---

## 🎯 Objectif

Permettre aux responsables pédagogiques de générer automatiquement des bulletins de notes au format PDF pour l'ensemble des apprenants d'un groupe, en récupérant les données directement depuis l'API Yparéo (ERP scolaire du Groupe ESPI).

---

## 🏗️ Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 15 (App Router) |
| Langage | TypeScript |
| Authentification | NextAuth.js + Azure AD (SSO ESPI) |
| Base de données | SQL Server via Prisma ORM |
| Génération PDF | pdf-lib + @pdf-lib/fontkit |
| Compression ZIP | JSZip |
| UI | Tailwind CSS + shadcn/ui |
| Animations | Framer Motion |
| State management | TanStack Query (React Query) |
| Déploiement | Azure App Service (8GB RAM) |
| CI/CD | GitHub Actions |

---

## 🔐 Authentification

- Connexion via **SSO Azure Active Directory** (compte ESPI uniquement)
- Gestion des sessions via **NextAuth.js**
- Création automatique du compte utilisateur en base lors de la première connexion
- Mise à jour automatique des tokens OAuth à chaque reconnexion
- Redirection vers la page de connexion si non authentifié
- Page d'erreur d'authentification personnalisée (`/auth/error`)

---

## 📌 Fonctionnalités principales

### 1. Sélection des paramètres de génération

L'utilisateur choisit sur un formulaire :

- **Campus** — liste générée dynamiquement depuis l'API Yparéo, filtrée par site
- **Groupe** — filtré selon le campus sélectionné, avec exclusion automatique des groupes BTS, Césure, RP et DDS
- **Période d'évaluation** — filtrée sur l'année scolaire 2025-2026, avec exclusion des périodes BTS

Validation de cohérence entre le groupe et la période :
- Un groupe **ALT** (alternance) ne peut pas être associé à une période **TP** (temps plein)
- Un groupe **TP** ne peut pas être associé à une période **ALT**

---

### 2. Récupération des données Yparéo

Lors de la soumission du formulaire, l'application interroge l'API Yparéo pour récupérer en **parallèle** les données nécessaires à la génération des bulletins :

| Données | Description |
|---|---|
| `APPRENANT` | Identité des étudiants du groupe |
| `MOYENNES_UE` | Moyennes par Unité d'Enseignement |
| `MOYENNE_GENERALE` | Moyenne générale de chaque étudiant |
| `MATIERE` / `ECTS_PAR_MATIERE` | Matières, crédits ECTS, ordre d'affichage |
| `OBSERVATIONS` | Appréciations du responsable pédagogique |
| `ABSENCE` | Absences justifiées, injustifiées et retards |
| `GROUPE` | Informations du groupe (formation, étendu) |
| `SITE` | Informations du campus |
| `PERSONNEL` | Responsable pédagogique et signature |
| `NOTES` | Notes détaillées par matière |

Toutes les requêtes SQL sont exécutées en **parallèle** via `Promise.all` pour minimiser le temps de réponse.

---

### 3. Génération des bulletins PDF

Après validation des données, l'utilisateur lance la génération des bulletins. Pour chaque étudiant, le bulletin PDF contient :

**En-tête**
- Logo ESPI
- Titre : "Bulletin de notes 2025-2026"
- Formation et période d'évaluation
- Encadré : nom de l'apprenant, date de naissance, groupe, campus

**Tableau des notes**
- Liste des UE (Unités d'Enseignement) et matières associées, ordonnées
- Colonne Moyenne (numérique, ou "Validé" / "Non Validé")
- Colonne Total ECTS
- Colonne État : **VA** (Validé), **NV** (Non Validé), **C** (Compensé)

**Logique de validation automatique**
- Une matière avec moyenne ≥ 10 → **VA**
- Une matière avec moyenne entre 8 et 10, compensée par une VA dans la même UE → **C**
- Une matière avec moyenne < 8 → **NV**
- Une UE est **VA** si aucune matière n'est NV et la moyenne UE ≥ 10
- Les crédits ECTS ne sont comptabilisés que pour les matières VA ou C

**Absences**
- Absences justifiées, injustifiées et retards calculés sur la période sélectionnée
- Déduplication automatique des absences en double dans Yparéo

**Appréciations**
- Texte libre saisi dans Yparéo, affiché avec retour à la ligne automatique

**Signature**
- Date et lieu de signature
- Nom et fonction du responsable pédagogique
- Image de signature (correspondance par code personnel)

**Légende**
- VA : Validé / NV : Non Validé / C : Compensation

**Gestion multi-pages**
- Saut de page automatique si le contenu dépasse la hauteur de la page
- Gestion spécifique des groupes TP (saut de page à l'UE 4)

**Optimisations de génération**
- Assets partagés préchargés **une seule fois** (logo, polices Poppins, signatures)
- Génération de tous les PDFs en **parallèle** via `Promise.all`
- Police Poppins embarquée (Regular et Bold), fallback Helvetica si absente

---

### 4. Export ZIP et téléchargement

- Tous les bulletins sont packagés dans une **archive ZIP**
- Nommage automatique des fichiers : `2025-2026_[Formation]_[Année]_[Période]_[NOM]_[Prénom].pdf`
- Stockage temporaire sur le système de fichiers du serveur (`os.tmpdir()`)
- Nettoyage automatique des fichiers temporaires toutes les heures
- Téléchargement via un lien sécurisé avec identifiant unique

---

### 5. Interface utilisateur

**Page d'accueil** (`/home`)
- Présentation de l'application
- Section "Comment ça marche" avec vidéos démo et navigation par étapes animée
- Section support avec lien vers le portail de tickets

**Page de génération** (`/configure/form`)
- Formulaire de sélection avec validation Zod
- Barre de progression pendant le chargement initial
- Modales de succès/erreur pour chaque étape

**Navbar**
- Logo ESPI cliquable
- Bouton "Générer vos bulletins" (visible uniquement si connecté)
- Lien Support
- Bouton Déconnexion

---

## 🔄 Architecture des APIs

| Route | Méthode | Description |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | Authentification Azure AD |
| `/api/sql` | POST | Récupération données Yparéo (11 requêtes parallèles) |
| `/api/pdf` | POST | Génération des bulletins PDF + ZIP |
| `/api/download` | GET | Téléchargement du ZIP généré |
| `/api/groups` | GET | Liste des groupes Yparéo |
| `/api/students` | GET | Liste des apprenants Yparéo |
| `/api/periods` | GET | Périodes d'évaluation |
| `/api/user` | GET | Données utilisateur connecté |

---

## ⚙️ Variables d'environnement requises

```env
# Azure AD
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=
AZURE_AD_TENANT_ID=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Base de données
DATABASE_URL=

# API Yparéo
YPAERO_BASE_URL=
YPAERO_API_TOKEN=
TOKEN_REQUETEUR=
URL_REQUETEUR=
```

---

## 🚀 Installation et démarrage

```bash
# Installer les dépendances
npm install

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy

# Démarrer en développement
npm run dev

# Build production
npm run build
npm start
```

---

## 📁 Structure du projet

```
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # Authentification
│   │   ├── sql/                  # Requêtes Yparéo
│   │   ├── pdf/                  # Génération PDF
│   │   ├── download/             # Téléchargement ZIP
│   │   ├── groups/               # Groupes
│   │   ├── students/             # Apprenants
│   │   ├── periods/              # Périodes
│   │   └── user/                 # Utilisateur
│   ├── configure/form/           # Page génération bulletins
│   ├── home/                     # Page d'accueil
│   └── page.tsx                  # Page de connexion
├── components/                   # Composants React
├── constants/                    # Données statiques
├── hooks/                        # Hooks personnalisés
├── lib/
│   ├── auth-options.ts           # Config NextAuth
│   ├── bulletin/ue.ts            # Logique UE/ECTS
│   ├── db.ts                     # Singleton Prisma
│   ├── fetchWithRetry.ts         # Utilitaire HTTP
│   └── fileStorage.ts            # Stockage fichiers temp
├── middleware.ts                 # CORS
└── prisma/                       # Schéma base de données
```

---

## 🛡️ Sécurité

- Authentification obligatoire sur toutes les pages via NextAuth
- CORS restreint au domaine de l'application
- Variables d'environnement pour tous les tokens et secrets
- Tokens API Yparéo jamais exposés côté client

---

## 📊 Performances

| Opération | Avant optimisation | Après optimisation |
|---|---|---|
| Requêtes SQL (`/api/sql`) | ~30 secondes (séquentiel) | ~3-5 secondes (parallèle) |
| Génération PDF 22 étudiants | ~66 secondes (séquentiel) | ~5-10 secondes (parallèle) |
| Chargement initial formulaire | 3× le temps d'un appel | 1× le temps du plus lent |

---

## ☁️ Déploiement Azure

- **Plan** : App Service avec 8GB RAM
- **Always On** : activé (évite les cold starts)
- **CI/CD** : GitHub Actions sur push `main`
- **Timeout proxy** : 230 secondes (largement suffisant après optimisations)
