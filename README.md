# 📄 Cahier des Charges – Application de Génération de Bulletins PDF (Next.js)

## Introduction

Développer une application web permettant de générer automatiquement des **bulletins scolaires au format PDF** à partir d’un formulaire de sélection (campus, groupe, période évaluation), via une interface simple, rapide et sécurisée.
🔗 **URL de production** : [https://bulletin.groupe-espi.fr](https://bulletin.groupe-espi.fr)

## 🎯 Objectifs du Projet

- Développer une application web réactive et dynamique.
- Utiliser les fonctionnalités avancées de Next.js pour optimiser les performances.
- Assurer une bonne expérience utilisateur grâce à une interface intuitive.
- Le traitement des données pour chaque élève,
- La génération des bulletins PDF,
- Le téléchargement d’un `.zip` contenant tous les documents.

## 🔧 Technologies utilisées

| Côté                      | Technologie                      | Rôle                                     |
| ------------------------- | -------------------------------- | ---------------------------------------- |
| Frontend                  | **Next.js**                      | Framework React (SSR + API routes)       |
| UI                        | **TailwindCSS**                  | Framework CSS utilitaire                 |
| Authentification          | **NextAuth.js**                  | Authentification OAuth sécurisée         |
| Base de données           | **Prisma + PostgreSQL**          | ORM pour la gestion des données          |
| Intégration données (API) | **Yparéo API + Requêteur SQL**   | Récupération des données élèves et notes |
| Backend                   | **API Routes Next.js et Python** | Traitement et génération serveur         |
| Génération PDF            | **pdf-lib**                      | Création et modification d'un PDF        |
| Déploiement               | **Vercel**                       | Hébergement frontend + backend           |
| Stockage                  | MySQL / Azure                    | Hébergement temporaire des fichiers      |

## ⚙️ Fonctionnalités principales

## 🔐 4. Authentification

- Basée sur Azure AD (via `NextAuth.js`)
- Sessions persistantes
- Stockage sécurisé via Prisma + PostgreSQL
- 
### 🎓 Utilisateur

- Authentification à son espace utilisateur via Azure AD
- Formulaire de sélection avec les données de l'API Yparéo.
- Génération des bulletins au format PDF
- Téléchargement d’un `.zip` avec les bulletins.

### 🧠 Côté serveur

- Extraction et récupération des données (requêteur Yparéo).
- Création et modification des PDF.
- Génération et enregistrement du `.zip`.
- Génération PDF (`pdf-lib`)
- Réponse avec lien de téléchargement.
- Traitement des notes et états (VA, NV, C)


### 🔐 Intégration Yparéo

Utilisation des endpoints et tokens suivants :

```env
YPAERO_BASE_URL=https://groupe-espi.ymag.cloud/index.php
YPAERO_API_TOKEN=<token secret>
URL_REQUETEUR=https://groupe-espi.ymag.cloud/index.php/r/v1/sql/requêteur
TOKEN_REQUETEUR=<token secret>
```

## 🗂️ Structure du projet

```bash
.
├── app/                           # Dossier principal Next.js (App Router)
│   ├── api/                       # API Routes (traitement serveur)
│   │   ├── auth/[...nextauth]     # Authentification NextAuth
│   │   ├── download/              # Génération & téléchargement de fichiers ZIP
│   │   ├── groups/                # Récupération des groupes Yparéo
│   │   ├── pdf/                   # Génération des bulletins PDF
│   │   ├── periods/               # Récupération des périodes d’évaluation
│   │   ├── sql/                   # Requêteur SQL Yparéo
│   │   ├── students/              # Données des étudiants
│   │   └── user/                  # Informations utilisateur connecté
│   ├── configure/form/            # Formulaire principal de sélection
│   └── home/                      # Page d’accueil
│       ├── layout.tsx
│       └── page.tsx
│
├── components/                    # Composants réutilisables
│   ├── magicui/                   # Composants UI personnalisés ou externes
│   └── ui/                        # Composants UI globaux (Navbar, Footer, etc.)
│       ├── ButtonProvider.tsx
│       ├── CallToAction.tsx
│       ├── Footer.tsx
│       ├── Hero.tsx
│       ├── MaxWidthWrapper.tsx
│       ├── Navbar.tsx
│       ├── Providers.tsx
│       ├── Templates.tsx
│       └── support.tsx
│
├── constants/                     # Constantes globales
│   └── index.ts
│
├── hooks/                         # Hooks React personnalisés
│   └── use-toast.ts
│
├── lib/                           # Fonctions utilitaires backend/frontend
│   ├── auth-options.ts            # Options de configuration NextAuth
│   ├── db.ts                      # Connexion à la base de données
│   ├── fileStorage.ts             # Gestion de stockage de fichiers
│   ├── memoryStore.ts             # Store en mémoire
│   ├── SessionWrapper.tsx         # Wrapper pour les sessions NextAuth
│   └── utils.ts                   # Fonctions utilitaires
│
├── prisma/                        # Modèle de base de données
│   └── schema.prisma
│
├── public/                        # Fichiers publics accessibles
│   ├── fonts/
│   ├── images/
│   ├── logo/
│   ├── signatures/                # Signatures pour bulletins
│   └── videos/                    # Vidéos (optionnelles)
│
├── temp/                          # Dossier temporaire pour génération (si utilisé)
│
├── .env                           # Variables d’environnement (locale)
├── .gitignore
├── components.json                # Config externe composants (MagicUI ?)
├── data.json                      # Données statiques
├── middleware.ts                  # Middleware NextAuth
├── next.config.ts                 # Configuration Next.js
├── tailwind.config.ts             # Configuration TailwindCSS
├── tsconfig.json                  # Configuration TypeScript
├── vercel.json                    # Configuration du déploiement Vercel
└── README.md                      # Cahier des charges / documentation projet
```

## 💾 Modèle de base de données (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String          @id @default(cuid())
  name          String?
  email         String          @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
  accounts      Account[]
  Authenticator Authenticator[]
  sessions      Session[]
}

model Account {
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([provider, providerAccountId])
}

model Session {
  sessionToken String   @unique
  userId       String
  expires      DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@id([identifier, token])
}

model Authenticator {
  credentialID         String  @unique
  userId               String
  providerAccountId    String
  credentialPublicKey  String
  counter              Int
  credentialDeviceType String
  credentialBackedUp   Boolean
  transports           String?
  user                 User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, credentialID])
}
```

## ✅ Livrables attendus

- Application web déployée sur Vercel
- Fichiers PDF + fichier ZIP téléchargeable
- Documentation technique dans le dépôt
- Exemple de fichiers : PDF, ZIP

## 🛠️ Évolutions possibles

- Envoi automatique des bulletins vers Yparéo
- Dashboard administrateur
- Statistiques d’émission (connexion des utilisateurs, nombre de téléchargements effectués)

## 📌 Contraintes techniques

- Le traitement des données doit se faire uniquement côté serveur (jamais côté client).
- Les fichiers temporaires (PDF, ZIP) ne doivent pas être conservés plus de 24h.
- L’application doit pouvoir gérer la génération de bulletins pour une classe entière (jusqu’à 100 étudiants) sans crash.
- Respect du RGPD : les données personnelles (noms, notes, commentaires) doivent être sécurisées et inaccessibles aux personnes non autorisées.

## 🆘 12. Que faire si le site retourne une erreur 404 ?

### ✅ Étapes de vérification (Vercel)

1. Accéder au dashboard : https://vercel.com/espi1 ( Se connecter avec le compte Github de GithubESPI )
2. Projet : test / bulletin.groupe-espi.fr
3. Vérifier :
   - Le dernier déploiement est vert ✅
   - Pas d’erreur `build failed`
4. Cliquer sur `Deploy` > `Redeploy production`
5. Vérifier que `app/page.tsx` existe
6. Vérifier les routes d’API :
   - `/api/pdf`, `/api/auth/session`, etc.
7. Vérifier l’onglet **Domains** > reconnecter `bulletin.groupe-espi.fr` si besoin

---

## ✉️ Contact en cas d’urgence

> Responsable technique : **Andy Vespuce**  
> Mail : **a.vespuce@groupe-espi.fr**  

```



```
