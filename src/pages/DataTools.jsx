import { useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { DatabaseBackup, Download, Upload, CalendarRange } from "lucide-react";
import {
  getFinancialYearOptions,
  getSelectedFinancialYear,
  setSelectedFinancialYear,
} from "../utils/dateRange";
import {
  BACKUP_COLLECTIONS,
  downloadBackupFile,
  exportFirestoreBackup,
  importFirestoreBackup,
} from "../utils/backup";
import "./AddDriver.css";

function DataTools() {
  const [selectedYear, setSelectedYear] = useState(getSelectedFinancialYear().value);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const financialYears = getFinancialYearOptions();

  const handleYearChange = (event) => {
    const value = event.target.value;
    setSelectedYear(value);
    setSelectedFinancialYear(value);
    setMessage("Financial year saved. Current-month views remain the default on list pages.");
  };

  const handleBackup = async () => {
    setBusy(true);
    setMessage("");

    try {
      const backup = await exportFirestoreBackup(db);
      downloadBackupFile(backup);
      setMessage("Backup file downloaded successfully.");
    } catch (error) {
      console.error("Backup failed:", error);
      setMessage("Backup failed. Please check the console and try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");

    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const collectionCount = Object.keys(backup.collections || {}).length;
      const confirmed = window.confirm(
        `Importing this backup will merge data into Firestore across ${collectionCount} collections. Existing matching records may be overwritten. Continue?`
      );

      if (!confirmed) {
        event.target.value = "";
        return;
      }

      setBusy(true);
      const importedCount = await importFirestoreBackup(db, backup);
      setMessage(`Backup import completed. ${importedCount} records merged.`);
    } catch (error) {
      console.error("Import failed:", error);
      setMessage("Import failed. Please select a valid backup JSON file.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #2563eb" }}>
        <div className="driver-header">
          <div className="header-title">
            <DatabaseBackup size={32} color="#2563eb" />
            <div>
              <h2>Financial Year & Backup</h2>
              <p>Set reporting year and manage Firestore backup files.</p>
            </div>
          </div>
        </div>

        {message && (
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1e40af",
              padding: "12px 14px",
              borderRadius: "8px",
              marginBottom: "18px",
              fontWeight: "600",
            }}
          >
            {message}
          </div>
        )}

        <div className="form-grid">
          <div className="section-title full-width">
            <CalendarRange size={18} /> Financial Year
          </div>

          <div className="input-group full-width">
            <label>Active Financial Year</label>
            <select value={selectedYear} onChange={handleYearChange}>
              {financialYears.map((year) => (
                <option key={year.value} value={year.value}>
                  {year.label} ({year.fromDate} to {year.toDate})
                </option>
              ))}
            </select>
          </div>

          <div className="section-title full-width mt-4">
            <DatabaseBackup size={18} /> Backup Tools
          </div>

          <div
            className="full-width"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
            }}
          >
            <button
              className="btn-submit"
              type="button"
              onClick={handleBackup}
              disabled={busy}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
            >
              <Download size={18} /> {busy ? "Working..." : "Take Backup File"}
            </button>

            <label
              className="btn-submit"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                background: "#0f766e",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              <Upload size={18} /> Upload Backup File
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleUpload}
                disabled={busy}
                style={{ display: "none" }}
              />
            </label>
          </div>

          <div
            className="full-width"
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              padding: "14px",
              borderRadius: "8px",
              color: "#475569",
              fontSize: "0.9rem",
              lineHeight: 1.5,
            }}
          >
            Backup includes: {BACKUP_COLLECTIONS.join(", ")}.
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataTools;
