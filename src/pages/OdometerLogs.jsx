import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { Truck, Clock, Activity, Hash, Calendar, MapPin } from "lucide-react"; // 🔥 Added MapPin
import TruckLoader from "../components/TruckLoader";
import { getCurrentMonthValue, getRecordDateInput } from "../utils/dateRange";

function OdometerLogs() {
  const [loading, setLoading] = useState(true);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [truckData, setTruckData] = useState({});
  const [filterMonth, setFilterMonth] = useState(getCurrentMonthValue());

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const snapshot = await getDocs(collection(db, "truck_odo_logs"));
        const allLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort all logs by timestamp (newest first)
        allLogs.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
        const visibleLogs = allLogs.filter((log) => {
          const dateValue = getRecordDateInput(log, ["timestamp", "createdAt", "date"]);
          return !filterMonth || dateValue.startsWith(filterMonth);
        });

        // Group logs by Truck Number
        const grouped = {};
        visibleLogs.forEach(log => {
          const truckNo = log.truckNumber || "Unknown";
          if (!grouped[truckNo]) grouped[truckNo] = [];
          grouped[truckNo].push(log);
        });

        setTruckData(grouped);
        
        // Auto-select the first truck in the list on load
        const truckKeys = Object.keys(grouped);
        if (truckKeys.length > 0) {
          setSelectedTruck(truckKeys[0]); 
        }
      } catch (error) {
        console.error("Error loading odometer logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [filterMonth]);

  // Helper to format timestamps beautifully
  const formatTime = (iso) => {
    if (!iso) return "N/A";
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    // 🔥 Using dashboard-page and dashboard-container ensures the sidebar NEVER overlaps
    <div className="dashboard-page"> 
      <Navbar />
      <div className="dashboard-container"> 
        
        <div style={{ marginBottom: "25px" }}>
          <h1 style={{ margin: "0 0 5px 0", color: "#0f172a", fontSize: "2rem" }}>Fleet Odometer Logs</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "1.1rem" }}>
            Select a vehicle to view odometer history and exact GPS location tracking.
          </p>
          <div className="search-box" style={{ maxWidth: "260px", marginTop: "12px", background: "white" }}>
            <Calendar size={18} className="search-icon" />
            <input type="month" value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} />
          </div>
        </div>

        {loading ? <TruckLoader text="Scanning Odometer & GPS Records..." /> : (
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>
            
            {/* LEFT COLUMN: TRUCK LIST & FINAL READINGS */}
            <div style={{ flex: "1 1 350px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ background: "white", padding: "15px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <h3 style={{ margin: "0 0 15px 0", color: "#334155", display: "flex", justifyContent: "space-between" }}>
                  <span>Registered Vehicles</span>
                  <span style={{ background: "#e2e8f0", padding: "2px 8px", borderRadius: "12px", fontSize: "0.85rem" }}>{Object.keys(truckData).length}</span>
                </h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Object.keys(truckData).map(truck => {
                    const truckLogs = truckData[truck];
                    const latestLog = truckLogs[0]; // The newest record is the Final Reading
                    const isSelected = selectedTruck === truck;

                    return (
                      <div
                        key={truck}
                        onClick={() => setSelectedTruck(truck)}
                        style={{
                          background: isSelected ? "#eff6ff" : "#f8fafc",
                          border: isSelected ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                          padding: "15px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: "bold", fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "8px", color: isSelected ? "#1e40af" : "#0f172a" }}>
                            <Truck size={18} /> {truck}
                          </span>
                          <span style={{ fontSize: "1.2rem", fontWeight: "800", color: "#10b981" }}>
                            {latestLog?.odometer ? `${latestLog.odometer} km` : "N/A"}
                          </span>
                        </div>
                        <div style={{ marginTop: "8px", fontSize: "0.85rem", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                          <span>Updated: {formatTime(latestLog?.timestamp || latestLog?.createdAt).split(',')[0]}</span>
                          <span>{truckLogs.length} Updates</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: DETAILED HISTORY OF SELECTED TRUCK */}
            <div style={{ flex: "2 1 500px", background: "white", padding: "25px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
              {selectedTruck && truckData[selectedTruck] ? (
                <>
                  <div style={{ borderBottom: "2px solid #f1f5f9", paddingBottom: "15px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px", fontSize: "1.4rem" }}>
                        <Truck size={24} color="#3b82f6" /> {selectedTruck}
                      </h3>
                      <p style={{ margin: "5px 0 0 0", color: "#64748b", fontSize: "0.95rem" }}>Odometer and GPS history</p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "15px", maxHeight: "70vh", overflowY: "auto", paddingRight: "10px" }}>
                    {truckData[selectedTruck].map((log) => (
                      <div key={log.id} style={{
                        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "20px",
                        padding: "18px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0"
                      }}>
                        
                        {/* BIG Odo Reading */}
                        <div style={{ background: "#dcfce3", color: "#166534", padding: "12px 20px", borderRadius: "8px", fontWeight: "800", fontSize: "1.3rem", minWidth: "130px", textAlign: "center", border: "1px solid #bbf7d0" }}>
                          {log.odometer ? `${log.odometer} km` : "No Data"}
                        </div>

                        {/* Trip & Status Details */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "bold", color: "#1e293b", fontSize: "1.1rem", marginBottom: "6px" }}>
                            <Activity size={18} color="#3b82f6" /> {log.status || "Status Updated"}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "0.95rem", marginBottom: "4px" }}>
                            <Clock size={16} /> {formatTime(log.timestamp || log.createdAt)}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "0.95rem" }}>
                            <Hash size={16} /> Trip / LR: <span style={{ color: "#0f172a", fontWeight: "bold" }}>{log.trackingId || log.bookingId || "N/A"}</span>
                          </div>
                        </div>

                        {/* Driver Chip & Location Button */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <div style={{ background: "white", padding: "10px 15px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.9rem", color: "#334155" }}>
                            <small style={{ display: "block", color: "#94a3b8", fontWeight: "bold", fontSize: "0.75rem", marginBottom: "2px" }}>SUBMITTED BY</small>
                            <strong>{log.driverName || "Unknown Driver"}</strong>
                          </div>
                          
                          {/* 🔥 NEW: Google Maps Link Generator */}
                          {log.location && log.location.lat && log.location.lng ? (
                            <a 
                              href={`https://www.google.com/maps?q=${log.location.lat},${log.location.lng}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", padding: "8px 12px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: "8px", fontWeight: "bold", textDecoration: "none", fontSize: "0.85rem", transition: "0.2s" }}
                            >
                              <MapPin size={16} /> View on Map
                            </a>
                          ) : (
                            <span style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", display: "block" }}>No GPS Data</span>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", color: "#64748b", padding: "60px 20px" }}>
                  <Truck size={48} color="#cbd5e1" style={{ margin: "0 auto 15px auto" }} />
                  <h2>Select a vehicle</h2>
                  <p>Click on a vehicle from the list to view its odometer history.</p>
                </div>
              )}
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
}

export default OdometerLogs;