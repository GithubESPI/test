// Durée de conservation des ZIP de bulletins (téléchargeables depuis l'historique).
// Modifiable sans toucher au code : variable d'environnement HISTORY_FILE_RETENTION_DAYS.
// Ces fichiers contiennent des données d'élèves (notes) : ne pas allonger sans nécessité.
const parsed = parseInt(process.env.HISTORY_FILE_RETENTION_DAYS || "", 10);

export const RETENTION_DAYS = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 90) : 7;
export const RETENTION_MINUTES = RETENTION_DAYS * 24 * 60;
