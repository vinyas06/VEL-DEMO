import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore"; // 🔥 Added updateDoc and doc
import { ShieldAlert, Truck, User, ChevronDown, ChevronUp, AlertOctagon, RefreshCw, X } from "lucide-react";
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css"; 

function DocumentAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  
  // 🔥 NEW: State to control the Renew Modal
  const [renewModal, setRenewModal] = useState({
    show: false,
    id: null,
    type: "",
    docName: "",
    newDate: ""
  });

  // Moved this function outside useEffect so we can call it after a renewal to refresh the list
  const fetchAndCalculateAlerts = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const alertList = [];

      // 1. Check Vehicles
      const vSnap = await getDocs(collection(db, "vehicles"));
      vSnap.docs.forEach(document => {
        const v = document.data();
        const docsToCheck = [
          { name: "Insurance", date: v.insuranceExpiry },
          { name: "Fitness Certificate", date: v.fitnessExpiry },
          { name: "National Permit", date: v.permitExpiry }
        ];

        let vehicleAlerts = [];
        docsToCheck.forEach(docItem => {
          if (docItem.date) {
            const expDate = new Date(docItem.date);
            const diffTime = expDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Threshold: Alert if expiring in 25 days OR already expired (< 0)
            if (diffDays <= 25) {
              vehicleAlerts.push({
                docName: docItem.name,
                date: docItem.date,
                daysLeft: diffDays
              });
            }
          }
        });

        if (vehicleAlerts.length > 0) {
          alertList.push({
            id: document.id,
            type: "Vehicle",
            title: v.number,
            subtitle: `${v.truckType} | Cap: ${v.capacity}t`,
            expirations: vehicleAlerts
          });
        }
      });

      // 2. Check Drivers
      const dSnap = await getDocs(collection(db, "drivers"));
      dSnap.docs.forEach(document => {
        const d = document.data();
        if (d.licenseExpiry) {
          const expDate = new Date(d.licenseExpiry);
          const diffTime = expDate - today;
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays <= 25) {
            alertList.push({
              id: document.id,
              type: "Driver",
              title: d.name,
              subtitle: `Ph: ${d.phone}`,
              expirations: [{ docName: "Driving License", date: d.licenseExpiry, daysLeft: diffDays }]
            });
          }
        }
      });

      setAlerts(alertList);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndCalculateAlerts();
  }, []);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const openRenewModal = (alertId, alertType, docName) => {
    setRenewModal({
      show: true,
      id: alertId,
      type: alertType,
      docName: docName,
      newDate: "" // Clear any old input
    });
  };

  // 🔥 NEW: Logic to save the new date to Firestore
  const handleRenewSubmit = async () => {
    if (!renewModal.newDate) return alert("Please select a new expiry date.");

    // Map the readable document name to the exact database field name
    let dbField = "";
    if (renewModal.docName === "Insurance") dbField = "insuranceExpiry";
    else if (renewModal.docName === "Fitness Certificate") dbField = "fitnessExpiry";
    else if (renewModal.docName === "National Permit") dbField = "permitExpiry";
    else if (renewModal.docName === "Driving License") dbField = "licenseExpiry";

    // Determine which collection to update
    const collectionName = renewModal.type === "Vehicle" ? "vehicles" : "drivers";

    try {
      // Update the specific field in the database
      await updateDoc(doc(db, collectionName, renewModal.id), {
        [dbField]: renewModal.newDate
      });
      await logActivity(db, {
        action: "document_renewed",
        module: "compliance",
        summary: `Renewed ${renewModal.docName} for ${renewModal.type} until ${renewModal.newDate}`,
        targetId: renewModal.id,
        targetType: renewModal.type.toLowerCase(),
      });

      alert(`${renewModal.docName} renewed successfully!`);
      setRenewModal({ show: false, id: null, type: "", docName: "", newDate: "" });
      
      // Refresh the alerts list instantly
      fetchAndCalculateAlerts();

    } catch (error) {
      console.error("Error renewing document:", error);
      alert("Failed to renew document. Please try again.");
    }
  };

  return (
    <div className="page-bg" style={{ minHeight: "100vh" }}>
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #ef4444" }}>
        
        <div className="driver-header" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <AlertOctagon size={32} color="#ef4444" />
          <div>
            <h2>Compliance & Expiry Alerts</h2>
            <p>Monitors documents expiring within 25 days or already expired.</p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>Scanning Database...</div>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "3rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534" }}>
            <h3 style={{ margin: "0 0 10px 0" }}>All Clear! 🎉</h3>
            <p style={{ margin: 0 }}>No vehicles or drivers have documents expiring in the next 25 days.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {alerts.map((alert) => (
              <div key={alert.id} style={{ border: "1px solid #fee2e2", borderRadius: "8px", background: "#fff", overflow: "hidden" }}>
                
                {/* Alert Card Header */}
                <div 
                  onClick={() => toggleExpand(alert.id)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", background: "#fef2f2", cursor: "pointer", transition: "0.2s" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    {alert.type === "Vehicle" ? <Truck size={24} color="#b91c1c" /> : <User size={24} color="#b91c1c" />}
                    <div>
                      <h3 style={{ margin: 0, color: "#991b1b", fontSize: "1.1rem" }}>{alert.title}</h3>
                      <span style={{ fontSize: "0.85rem", color: "#b91c1c" }}>{alert.type} • {alert.subtitle}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                    <div style={{ background: "#ef4444", color: "white", padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "5px" }}>
                      <ShieldAlert size={14} /> {alert.expirations.length} Alert(s)
                    </div>
                    {expandedId === alert.id ? <ChevronUp size={20} color="#991b1b" /> : <ChevronDown size={20} color="#991b1b" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedId === alert.id && (
                  <div style={{ padding: "15px 20px", background: "white" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.95rem" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #fee2e2", color: "#7f1d1d" }}>
                          <th style={{ textAlign: "left", padding: "8px" }}>Document Type</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>Current Expiry</th>
                          <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
                          <th style={{ textAlign: "right", padding: "8px" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alert.expirations.map((exp, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                            <td style={{ padding: "10px 8px", fontWeight: "500" }}>{exp.docName}</td>
                            <td style={{ padding: "10px 8px" }}>{exp.date}</td>
                            <td style={{ padding: "10px 8px" }}>
                              {exp.daysLeft < 0 ? (
                                <span style={{ color: "white", background: "#7f1d1d", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold" }}>
                                  EXPIRED {Math.abs(exp.daysLeft)} DAYS AGO
                                </span>
                              ) : (
                                <span style={{ color: "#991b1b", background: "#fef2f2", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold" }}>
                                  EXPIRES IN {exp.daysLeft} DAYS
                                </span>
                              )}
                            </td>
                            {/* 🔥 NEW RENEW BUTTON */}
                            <td style={{ padding: "10px 8px", textAlign: "right" }}>
                              <button 
                                onClick={() => openRenewModal(alert.id, alert.type, exp.docName)}
                                style={{ background: "#2563eb", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "0.85rem", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "5px" }}
                              >
                                <RefreshCw size={14} /> Renew
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🔥 RENEWAL MODAL */}
      {renewModal.show && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ background: "white", padding: "2rem", borderRadius: "12px", width: "90%", maxWidth: "400px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>
              <h3 style={{ margin: 0, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
                <RefreshCw size={20} color="#2563eb"/> Renew Document
              </h3>
              <button onClick={() => setRenewModal({show: false})} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={20}/></button>
            </div>
            
            <div style={{ marginBottom: "1.5rem" }}>
              <p style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "#475569" }}>
                Updating <strong>{renewModal.docName}</strong> for {renewModal.type}.
              </p>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", fontSize: "0.9rem", color: "#334155" }}>New Expiry Date</label>
              <input 
                type="date" 
                value={renewModal.newDate}
                onChange={(e) => setRenewModal({...renewModal, newDate: e.target.value})}
                style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "8px", boxSizing: "border-box", fontFamily: "inherit" }}
              />
            </div>

            <button 
              onClick={handleRenewSubmit}
              style={{ width: "100%", padding: "12px", background: "#10b981", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", fontSize: "1rem", cursor: "pointer" }}
            >
              Confirm Renewal
            </button>
            
          </div>
        </div>
      )}

    </div>
  );
}

export default DocumentAlerts;
