import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { Activity, Clock, User, Shield, Briefcase, FileText, Landmark } from "lucide-react";
import { ACTIVITY_LOGS_COLLECTION } from "../utils/activityLog";

function ActivityTracker() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // Fetch the 100 most recent activities
        const q = query(collection(db, ACTIVITY_LOGS_COLLECTION), limit(100));
        const snapshot = await getDocs(q);
        
        const fetchedLogs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort newest first
        fetchedLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setLogs(fetchedLogs);
      } catch (error) {
        console.error("Error loading activity logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const getModuleIcon = (module) => {
    switch(module) {
      case "bookings": return <Briefcase size={16} color="#3b82f6" />;
      case "payments": return <Landmark size={16} color="#10b981" />;
      case "auth": return <Shield size={16} color="#8b5cf6" />;
      default: return <FileText size={16} color="#64748b" />;
    }
  };

  return (
    <div className="dashboard-page">
      <Navbar />
      <div className="dashboard-container">
        
        <div style={{ marginBottom: "25px" }}>
          <h1 style={{ margin: "0 0 5px 0", color: "#0f172a", fontSize: "2rem", display: "flex", alignItems: "center", gap: "10px" }}>
            <Activity size={32} color="#2563eb" /> System Audit Trail
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "1.1rem" }}>
            A pin-to-pin chronological record of every action taken in the ERP.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            Loading audit records...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <p style={{ color: "#64748b", margin: 0 }}>No activity logs found yet.</p>
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {logs.map((log, index) => (
              <div key={log.id} style={{ 
                display: "flex", gap: "20px", padding: "20px", 
                borderBottom: index !== logs.length - 1 ? "1px solid #f1f5f9" : "none",
                background: index % 2 === 0 ? "white" : "#f8fafc"
              }}>
                
                {/* Time Column */}
                <div style={{ minWidth: "120px", color: "#64748b", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "5px" }}>
                  <span style={{ fontWeight: "bold", color: "#334155" }}>
                    {new Date(log.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={14}/> {new Date(log.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Actor Column */}
                <div style={{ minWidth: "180px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "bold", color: "#0f172a" }}>
                    <User size={16} /> {log.actorName || "System"}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px", textTransform: "capitalize", background: "#e2e8f0", display: "inline-block", padding: "2px 8px", borderRadius: "10px" }}>
                    {log.actorRole || "Unknown Role"}
                  </div>
                </div>

                {/* Action & Summary Column */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", color: "#1e293b", marginBottom: "4px", textTransform: "uppercase", fontSize: "0.85rem", letterSpacing: "1px" }}>
                    {getModuleIcon(log.module)} {log.action.replace("_", " ")}
                  </div>
                  <div style={{ color: "#334155", fontSize: "1rem" }}>
                    {log.summary}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityTracker;