import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { MapPin, Truck, Navigation, AlertTriangle, CheckCircle, Clock, RefreshCw } from "lucide-react"; 
import { getCurrentMonthRange, isRecordInDateRange } from "../utils/dateRange";
import "./BookingList.css"; 

function Trips() {
  const [activeTrips, setActiveTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const fetchActiveTrips = () => {
      const unsubscribe = onSnapshot(collection(db, "bookings"), (snapshot) => {
        const allBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // 🔥 FILTER: Only show trips that are actively moving or loading
        const inProgressStatuses = [
          "Moving Towards Load", 
          "Loading", 
          "In Transit", 
          "Delay", 
          "Reached Destination", 
          "Unloading",
          "Incomplete",
          "Pending"
        ];
        
        const { fromDate, toDate } = getCurrentMonthRange();
        const filteredTrips = allBookings.filter(
          (b) =>
            inProgressStatuses.includes(b.status) &&
            isRecordInDateRange(b, ["loadingDate", "createdAt", "updatedAt"], fromDate, toDate)
        );
        
        // Sort by most recently updated/created
        filteredTrips.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        setActiveTrips(filteredTrips);
        setLastUpdated(new Date());
        setLoading(false);
      }, (error) => {
        console.error("Error fetching live trips:", error);
        setLoading(false);
      });

      return unsubscribe;
    };

    const unsubscribe = fetchActiveTrips();

    return () => unsubscribe();
  }, []);

  // Helper to color-code the status
  const getStatusColor = (status) => {
    switch(status) {
      case "Delay": return { bg: "#fee2e2", text: "#991b1b", icon: <AlertTriangle size={16}/> };
      case "In Transit": return { bg: "#dbeafe", text: "#1e40af", icon: <Navigation size={16}/> };
      case "Loading": 
      case "Unloading": return { bg: "#fef3c7", text: "#9a3412", icon: <Clock size={16}/> };
      case "Reached Destination": return { bg: "#dcfce3", text: "#166534", icon: <CheckCircle size={16}/> };
      default: return { bg: "#f1f5f9", text: "#475569", icon: <Truck size={16}/> };
    }
  };

  return (
    <div className="list-page-bg" style={{ minHeight: "100vh" }}>
      <Navbar />
      
      <div className="list-container">
        <div className="list-header" style={{ marginBottom: "2rem" }}>
          <div>
            <h2>Live Tracking Dashboard</h2>
            <p>Real-time tracking of active trips for the current month.</p>
            <small style={{ color: "#64748b", display: "flex", alignItems: "center", gap: "5px" }}>
              <RefreshCw size={14} /> Last updated: {lastUpdated.toLocaleTimeString()}
            </small>
          </div>
          <div style={{ background: "#eff6ff", padding: "10px 20px", borderRadius: "8px", border: "1px solid #bfdbfe", color: "#1e40af", fontWeight: "bold" }}>
            {activeTrips.length} Active Vehicles
          </div>
        </div>

        {loading ? <div className="loading-state">Locating active trips...</div> : (
          <div className="bookings-grid">
            {activeTrips.length === 0 ? (
              <div className="empty-state" style={{ padding: "3rem", background: "white", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                <CheckCircle size={48} color="#10b981" style={{ marginBottom: "10px" }} />
                <h3>All Clear!</h3>
                <p>There are no active trips on the road right now.</p>
              </div>
            ) : (
              activeTrips.map((trip) => {
                const style = getStatusColor(trip.status);
                
                return (
                  <div className="booking-card" key={trip.id} style={{ borderLeft: `5px solid ${style.text}` }}>
                    
                    <div className="card-top" style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", marginBottom: "10px" }}>
                      <div className="card-top-left" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ background: "#f1f5f9", padding: "8px", borderRadius: "8px" }}>
                          <Truck size={24} color="#334155" />
                        </div>
                        <div>
                          <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#1e293b" }}>{trip.vehicle}</h3>
                          <small style={{ color: "#64748b", fontWeight: "bold" }}>Driver: {trip.driver || "Unassigned"}</small>
                        </div>
                      </div>
                      
                      <span className="status-badge" style={{ background: style.bg, color: style.text, padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}>
                        {style.icon} {trip.status}
                      </span>
                    </div>

                    <div className="route-info" style={{ background: "#f8fafc", padding: "15px", borderRadius: "8px", marginTop: "15px" }}>
                      <div className="location">
                        <MapPin size={18} color="#ef4444" />
                        <div>
                          <small style={{ display: "block", color: "#64748b", fontSize: "0.75rem", fontWeight: "bold" }}>ORIGIN</small>
                          <span style={{ fontWeight: "600", color: "#334155" }}>{trip.from}</span>
                        </div>
                      </div>
                      
                      <div className="route-line" style={{ margin: "10px 0" }}></div>
                      
                      <div className="location">
                        <MapPin size={18} color="#10b981" />
                        <div>
                          <small style={{ display: "block", color: "#64748b", fontSize: "0.75rem", fontWeight: "bold" }}>DESTINATION</small>
                          <span style={{ fontWeight: "600", color: "#334155" }}>{trip.to}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "15px", paddingTop: "15px", borderTop: "1px dashed #e2e8f0" }}>
                      <div>
                        <small style={{ color: "#64748b", display: "block" }}>Tracking ID</small>
                        <strong style={{ color: "#475569" }}>#{trip.trackingId}</strong>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <small style={{ color: "#64748b", display: "block" }}>Material</small>
                        <strong style={{ color: "#475569" }}>{trip.material} ({trip.weight}t)</strong>
                      </div>
                    </div>

                    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed #e2e8f0" }}>
                      <small style={{ color: "#64748b", display: "block" }}>Last Updated</small>
                      <strong style={{ color: "#475569" }}>{trip.updatedAt ? new Date(trip.updatedAt).toLocaleString() : "N/A"}</strong>
                      {trip.currentLocation && (
                        <div style={{ marginTop: "5px" }}>
                          <small style={{ color: "#64748b", display: "block" }}>Current Location</small>
                          <strong style={{ color: "#475569" }}>{trip.currentLocation}</strong>
                        </div>
                      )}
                    </div>

                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Trips;
