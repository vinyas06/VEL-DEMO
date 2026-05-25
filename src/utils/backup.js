import { collection, doc, getDocs, writeBatch } from "firebase/firestore";

export const BACKUP_COLLECTIONS = [
  "accounts",
  "agents",
  "bookings",
  "company_profile",
  "drivers",
  "driver_submissions",
  "estimates",
  "parties",
  "portal_login_otps",
  "portal_users",
  "transactions",
  "trips",
  "truck_odo_logs",
  "vehicles",
  "activity_logs",
];

const serializeValue = (value) => {
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeValue(nestedValue)])
    );
  }

  return value;
};

export const exportFirestoreBackup = async (db) => {
  const collections = {};

  for (const collectionName of BACKUP_COLLECTIONS) {
    const snapshot = await getDocs(collection(db, collectionName));
    collections[collectionName] = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      data: serializeValue(docItem.data()),
    }));
  }

  return {
    app: "fleet-manager",
    version: 1,
    exportedAt: new Date().toISOString(),
    collections,
  };
};

export const downloadBackupFile = (backup) => {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  link.href = url;
  link.download = `fleet-manager-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const importFirestoreBackup = async (db, backup) => {
  if (!backup?.collections || typeof backup.collections !== "object") {
    throw new Error("Invalid backup file.");
  }

  let total = 0;

  for (const [collectionName, rows] of Object.entries(backup.collections)) {
    if (!Array.isArray(rows)) continue;

    for (let index = 0; index < rows.length; index += 400) {
      const batch = writeBatch(db);
      const chunk = rows.slice(index, index + 400);

      chunk.forEach((row) => {
        if (!row?.id || !row.data || typeof row.data !== "object") return;
        batch.set(doc(db, collectionName, row.id), row.data, { merge: true });
        total += 1;
      });

      await batch.commit();
    }
  }

  return total;
};
