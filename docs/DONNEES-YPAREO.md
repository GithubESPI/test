# 📋 Données YParéo / Ymag utilisées dans l'application

> Référence complète : toutes les données récupérées depuis l'API YParéo (SQL Requêteur + REST)
> et leur utilisation dans les bulletins PDF.
>
> Année scolaire de référence : **2025-2026** · Session : **5** · Source : code de `app/api/`

---

## 🔌 1. Les 3 sources de données

| Endpoint app | Type d'API | Variable d'env | Rôle |
|---|---|---|---|
| `/api/periods` | SQL Requêteur | `URL_REQUETEUR` + `TOKEN_REQUETEUR` | Liste des périodes d'évaluation |
| `/api/students` | SQL Requêteur | `URL_REQUETEUR` + `TOKEN_REQUETEUR` | Liste des campus (sites) |
| `/api/groups` | REST YParéo | `YPAERO_BASE_URL` + `YPAERO_API_TOKEN` | Liste des groupes |
| `/api/sql` | SQL Requêteur | `URL_REQUETEUR` + `TOKEN_REQUETEUR` | **Les 11 requêtes du bulletin** |

---

## 🗂️ 2. Données de sélection (écran de génération)

### 2.1 — Périodes d'évaluation · `/api/periods`
```sql
SELECT * FROM PERIODE_EVALUATION ORDER BY NOM_PERIODE_EVALUATION
```
| Champ | Usage |
|---|---|
| `CODE_PERIODE_EVALUATION` | Identifiant (envoyé aux requêtes du bulletin) |
| `NOM_PERIODE_EVALUATION` | Affiché dans le menu déroulant « Période » |
| `DATE_DEB` / `DATE_FIN` | Filtre : ne garde que les périodes de l'année scolaire |

### 2.2 — Campus / Sites · `/api/students`
```sql
SELECT DISTINCT CODE_SITE, NOM_SITE FROM SITE ORDER BY NOM_SITE
```
| Champ | Usage |
|---|---|
| `CODE_SITE` | Identifiant campus (= `campus` dans les requêtes) |
| `NOM_SITE` | Affiché dans le menu déroulant « Campus » |

### 2.3 — Groupes · `/api/groups` (REST)
```
GET /r/v1/formation-longue/groupes?codesPeriode=5
```
| Champ | Usage |
|---|---|
| `codeGroupe` | Identifiant groupe (= `group` dans les requêtes) |
| `nomGroupe` | Affiché dans le menu déroulant « Groupe » |
| `codeSite` | Permet de filtrer les groupes par campus |

> ⚠️ Groupes exclus de la liste : préfixes BTS (`P-BTS1`, `M-BTS2`, etc.) et termes `Césure`, `RP`, `DDS`.

---

## 🔍 3. Requêtes préalables (résolution du contexte)

Avant les 11 requêtes principales, `/api/sql` exécute 2 requêtes pour résoudre le contexte du groupe :

### 3.1 — Infos du groupe
```sql
SELECT NOM_GROUPE, NUMERO_ANNEE, CODE_FORMATION
FROM GROUPE WHERE CODE_GROUPE = {group}
```
| Champ | Usage |
|---|---|
| `NOM_GROUPE` | Détection « Rentrée décalée », nom de fichier |
| `NUMERO_ANNEE` | Année du cursus (1, 2, 3…) — filtre les référentiels |
| `CODE_FORMATION` | Résolution de la période d'évaluation |

### 3.2 — Code période (si non fourni)
```sql
SELECT DISTINCT r.CODE_PERIODE_EVALUATION FROM REFERENTIEL r
WHERE r.CODE_FORMATION = {codeFormation} AND r.CODE_SESSION = 5 AND r.CODE_ANNEE = {codeAnnee}
```

---

## 📦 4. Les 11 requêtes du bulletin · `/api/sql`

Toutes filtrées par `CODE_GROUPE`, `CODE_SITE` (campus), période et année. Exécutées par lots de 2.

### 4.1 — `GROUPE` (en-tête)
| Champ | Apparaît dans le bulletin |
|---|---|
| `NOM_GROUPE` | Nom du groupe (cadre infos + nom de fichier) |
| `ETENDU_GROUPE` | **Titre du bulletin** (intitulé complet de la formation) |
| `NOM_FORMATION` | Nom de la formation (nom de fichier) |

### 4.2 — `SITE` (campus)
| Champ | Apparaît dans le bulletin |
|---|---|
| `CODE_SITE` | — (jointure) |
| `NOM_SITE` | **Campus** (cadre infos + lieu de signature « Fait à … ») |
| `ETENDU_SITE` | — |
| `CODE_PERSONNEL` | Responsable de signature (fallback) |

### 4.3 — `APPRENANT` (liste des étudiants)
| Champ | Apparaît dans le bulletin |
|---|---|
| `CODE_APPRENANT` | Identifiant (clé de tous les filtrages) |
| `NOM_APPRENANT` | **Nom de l'apprenant** |
| `PRENOM_APPRENANT` | **Prénom de l'apprenant** |
| `DATE_NAISSANCE` | **Date de naissance** (cadre infos) |
| `CODE_GROUPE`, `CODE_CALENDRIER`, `CODE_SESSION` | — (jointures) |
| `DATE_CLOTURE_INSCRIPTION` | — |

### 4.4 — `ABSENCE` (assiduité)
> Filtrée entre le `2025-08-25` et le `2026-08-23`, durée > 0.

| Champ | Apparaît dans le bulletin |
|---|---|
| `CODE_APPRENANT` / `NOM` / `PRENOM` | Rattachement étudiant |
| `CODE_ABSENCE` | Dédoublonnage des absences |
| `IS_RETARD` | Classe en **Retards** |
| `IS_JUSTIFIE` | Classe en **Absences justifiées / injustifiées** |
| `DUREE` | Durée cumulée (format `00h00`) |
| `DATE_DEB` (`DATE_ABSENCE`) / `DATE_FIN` | Filtrage par période |

➡️ **Bloc Absences du bulletin** : Absences justifiées · Absences injustifiées · Retards (en heures).

### 4.5 — `MATIERE` (enseignements)
| Champ | Apparaît dans le bulletin |
|---|---|
| `CODE_MATIERE` | Identifiant matière |
| `NOM_MATIERE` | **Nom de l'enseignement** (colonne « Enseignements ») |
| `CODE_TYPE_MATIERE` | Distinction UE / matière |
| `NUM_ORDRE` | **Ordre d'affichage** des lignes |
| `NOM_PERIODE_EVALUATION` | Période |
| `CODE_REFERENTIEL`, `CODE_ANNEE` | — (jointures) |
| `NOM_ANNEE` | Nom de fichier |

### 4.6 — `MOYENNES_UE` (moyennes par matière)
| Champ | Apparaît dans le bulletin |
|---|---|
| `CODE_MATIERE` / `NOM_MATIERE` | Rattachement matière/UE |
| `MOYENNE` | **Colonne « Moyenne »** + calcul de l'état (VA/NV/C) |
| `NUM_ORDRE` | Ordre |
| `NOM_EVALUATION_NOTE` | Gestion « Validé » / « Non Validé » |
| `CODE_REFERENTIEL` / `NOM_REFERENTIEL` | Regroupement par UE |

➡️ Sert au calcul des **moyennes UE** et à la **logique de compensation**.

### 4.7 — `MOYENNE_GENERALE`
| Champ | Apparaît dans le bulletin |
|---|---|
| `MOYENNE_GENERALE` | **Ligne « Moyenne générale »** (bas du tableau) |
| `CODE_APPRENANT` / `NOM` / `PRENOM` | Rattachement étudiant |

### 4.8 — `ECTS_PAR_MATIERE`
| Champ | Apparaît dans le bulletin |
|---|---|
| `CREDIT_ECTS` | **Colonne « Total ECTS »** (par matière et par UE) |
| `CODE_MATIERE` / `NOM_MATIERE` | Rattachement |
| `CODE_TYPE_MATIERE` | UE vs matière |
| `NUM_ORDRE` | Ordre |

➡️ ECTS mis à **0** automatiquement si la matière est **Non Validée**.

### 4.9 — `OBSERVATIONS` (appréciations)
| Champ | Apparaît dans le bulletin |
|---|---|
| `MEMO_OBSERVATION` | **Bloc « Appréciations »** (texte libre) |
| `CODE_APPRENANT` | Rattachement étudiant |
| `CODE_REFERENTIEL` | — |

### 4.10 — `PERSONNEL` (signataire)
| Champ | Apparaît dans le bulletin |
|---|---|
| `NOM_PERSONNEL` / `PRENOM_PERSONNEL` | **Nom du signataire** (bas de page) |
| `NOM_FONCTION_PERSONNEL` | **Fonction** (« Signature du Responsable… ») |
| `CODE_PERSONNEL` | Sélection de l'**image de signature** |
| `CODE_PERSONNEL_GESTIONNAIRE` | — |

➡️ Signatures images mappées par code : 460, 482, 500, 517, 2168, 2239, 89152, 306975, 650429, 1057288.

### 4.11 — `NOTES`
| Champ | Apparaît dans le bulletin |
|---|---|
| `VALEUR_NOTE` | Affinage de l'état d'une matière (VA si note validée) |
| `CODE_NOTE` | Identifiant |
| `NOM_APPRENANT` / `NOM_MATIERE` | Rattachement |

---

## 📄 5. Synthèse : structure du bulletin PDF

```
┌─────────────────────────────────────────────────────┐
│  [Logo ESPI]                          Identifiant     │  ← logo + CODE_APPRENANT
│         Bulletin de notes 2025-2026                   │
│         {ETENDU_GROUPE} — {Période}                   │  ← GROUPE + période
├─────────────────────────────────────────────────────┤
│  Apprenant : {NOM} {PRENOM}    │ Groupe : {NOM_GROUPE}│  ← APPRENANT + GROUPE
│  Naissance : {DATE_NAISSANCE}  │ Campus : {NOM_SITE}  │  ← APPRENANT + SITE
├──────────────────────┬─────────┬──────────┬──────────┤
│  Enseignements       │ Moyenne │ Tot. ECTS│  État    │
│  {NOM_MATIERE}       │{MOYENNE}│{CRED_ECTS}│ VA/NV/C │  ← MATIERE+MOYENNES_UE+ECTS
│  …                   │   …     │    …     │    …     │
│  Moyenne générale    │{MOY_GEN}│ {total}  │  VA/NV   │  ← MOYENNE_GENERALE
├──────────────────────┴─────────┴──────────┴──────────┤
│  Abs. justifiées │ Abs. injustifiées │   Retards      │  ← ABSENCE
├─────────────────────────────────────────────────────┤
│  Appréciations : {MEMO_OBSERVATION}                   │  ← OBSERVATIONS
│                                                       │
│  Fait à {NOM_SITE}, le {date}                         │
│  Signature du {NOM_FONCTION}    [image signature]     │  ← PERSONNEL
│  {PRENOM} {NOM}                                       │
│  VA : Validé / NV : Non Validé / C : Compensation     │
└─────────────────────────────────────────────────────┘
```

---

## 🧮 6. Logique de calcul des états (rappel)

| État | Signification | Condition |
|---|---|---|
| **VA** | Validé | Moyenne ≥ 10, ou note « Validé » |
| **NV** | Non Validé | Moyenne < 8, ou UE non validée |
| **C** | Compensation | Moyenne entre 8 et 10 **ET** moyenne UE ≥ 10 **ET** aucune note éliminatoire dans l'UE |

- Une matière **NV** → ses **ECTS sont remis à 0**.
- L'**état général** est VA seulement si **toutes les UE** sont VA.

---

*Document généré à partir du code source — `app/api/sql/route.ts`, `app/api/pdf/route.ts`, `app/api/periods`, `app/api/groups`, `app/api/students`.*
