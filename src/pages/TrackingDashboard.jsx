import React, { useEffect, useState, useRef } from "react";
import { collection, onSnapshot, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import Navbar from "../components/Navbar";
import { Loader2, MapPin, Clock, Search, RefreshCw, Navigation, History, X } from "lucide-react";
import "./TrackingDashboard.css";

function TrackingDashboard() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const [hasAutoZoomed, setHasAutoZoomed] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [historyDriverId, setHistoryDriverId] = useState(null);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyPath, setHistoryPath] = useState([]);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const polylineRef = useRef(null);

  useEffect(() => {
    if (!historyDriverId) {
      setHistoryPath([]);
      if (polylineRef.current) polylineRef.current.setMap(null);
      return;
    }

    const fetchHistory = async () => {
      setFetchingHistory(true);
      try {
        const startOfDay = new Date(historyDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(historyDate);
        endOfDay.setHours(23, 59, 59, 999);

        const q = query(
          collection(db, "driver_location_history"), 
          where("driverName", "==", historyDriverId)
        );
        
        const snapshot = await getDocs(q);
        
        const pathData = snapshot.docs
          .map(doc => doc.data())
          .filter(d => d.timestamp)
          .filter(d => {
            const date = d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
            return date >= startOfDay && date <= endOfDay;
          })
          .sort((a, b) => {
            const d1 = a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            const d2 = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
            return d1 - d2;
          })
          .map(d => ({ lat: d.latitude, lng: d.longitude }));

        setHistoryPath(pathData);
      } catch(e) {
        console.error("Error fetching history:", e);
      } finally {
        setFetchingHistory(false);
      }
    };
    fetchHistory();
  }, [historyDriverId, historyDate]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    
    if (!polylineRef.current) {
      polylineRef.current = new window.google.maps.Polyline({
        path: [],
        geodesic: true,
        strokeColor: '#2563eb',
        strokeOpacity: 0.8,
        strokeWeight: 4,
      });
    }

    if (historyPath.length > 0) {
      polylineRef.current.setPath(historyPath);
      polylineRef.current.setMap(mapRef.current);
      
      const bounds = new window.google.maps.LatLngBounds();
      historyPath.forEach(coord => bounds.extend(coord));
      mapRef.current.fitBounds(bounds);
    } else {
      polylineRef.current.setMap(null);
    }
  }, [historyPath]);

  useEffect(() => {
    setLoading(true);
    // Listen to driver_locations in real-time
    const unsubscribe = onSnapshot(collection(db, "driver_locations"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDrivers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [refreshTrigger]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "Unknown";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date() - date) / 1000);
    
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hrs ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  const getStatusColor = (timestamp) => {
    if (!timestamp) return "#94a3b8"; // grey
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const hours = (new Date() - date) / (1000 * 60 * 60);
    
    if (hours < 1) return "#10b981"; // green (active)
    if (hours < 24) return "#f59e0b"; // yellow (idle)
    return "#ef4444"; // red (offline)
  };

  const filteredDrivers = drivers.filter(d => 
    (d.driverName || d.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Initialize Map
  useEffect(() => {
    if (window.google && !mapRef.current) {
      mapRef.current = new window.google.maps.Map(document.getElementById("google-map"), {
        center: { lat: 21.1458, lng: 79.0882 },
        zoom: 5,
      });
    }
  }, []);

  // Sync Markers
  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    filteredDrivers.forEach(driver => {
      if (driver.latitude && driver.longitude) {
        const position = { lat: driver.latitude, lng: driver.longitude };
        const popupContent = `
          <div class="popup-content" style="padding: 10px;">
            <strong>${driver.driverName || driver.id}</strong><br/>
            <span>Lat: ${driver.latitude}</span><br/>
            <span>Lng: ${driver.longitude}</span><br/>
            <small>Updated: ${formatTimeAgo(driver.updatedAt)}</small><br/>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${driver.latitude},${driver.longitude}" target="_blank" style="display:inline-block; margin-top:8px; background:#2563eb; color:#fff; padding:6px 10px; border-radius:4px; text-decoration:none; font-size:12px; font-weight: 500;">Get Directions</a>
          </div>
        `;

        if (!markersRef.current[driver.id]) {
          const marker = new window.google.maps.Marker({
            map: mapRef.current,
            position: position,
            title: driver.driverName || driver.id,
            label: '🚚'
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: popupContent
          });

          marker.addListener("click", () => {
            infoWindow.open({
              anchor: marker,
              map: mapRef.current,
            });
          });

          markersRef.current[driver.id] = { marker, infoWindow };
        } else {
          try {
            markersRef.current[driver.id].marker.setPosition(position);
            markersRef.current[driver.id].infoWindow.setContent(popupContent);
          } catch(e) {
            console.error(e);
          }
        }
      }
    });

    const currentIds = filteredDrivers.map(d => d.id);
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.includes(id)) {
        markersRef.current[id].marker.setMap(null);
        delete markersRef.current[id];
      }
    });

    // Auto-zoom on first load if we have drivers
    if (!hasAutoZoomed && filteredDrivers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      filteredDrivers.forEach(driver => {
        if (driver.latitude && driver.longitude) {
          bounds.extend({ lat: driver.latitude, lng: driver.longitude });
        }
      });
      mapRef.current.fitBounds(bounds);
      setHasAutoZoomed(true);
    }

  }, [filteredDrivers, hasAutoZoomed]);

  const handleCardClick = (driverId) => {
    const markerObj = markersRef.current[driverId];
    if (markerObj && mapRef.current) {
      mapRef.current.panTo(markerObj.marker.getPosition());
      mapRef.current.setZoom(14);
      markerObj.infoWindow.open({
        anchor: markerObj.marker,
        map: mapRef.current,
      });
    }
  };

  return (
    <div className="tracking-page">
      <Navbar />
      <div className="tracking-layout">
        
        {/* Sidebar */}
        <div className="tracking-sidebar">
          <div className="sidebar-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h2 style={{ margin: 0 }}>Live Tracking</h2>
              <button onClick={() => setRefreshTrigger(prev => prev + 1)} className="btn-secondary" style={{ padding: "6px 10px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                <RefreshCw size={14} /> Reload
              </button>
            </div>
            <div className="search-box">
              <Search size={16} />
              <input 
                type="text" 
                placeholder="Search drivers..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <p className="driver-count">Total Active: {filteredDrivers.length}</p>
          </div>

          {historyDriverId && (
            <div className="history-filter-card" style={{ padding: "12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", color: "#0f172a" }}>History: {historyDriverId}</h3>
                <button onClick={() => setHistoryDriverId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={16} /></button>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input 
                  type="date" 
                  value={historyDate} 
                  onChange={(e) => setHistoryDate(e.target.value)}
                  style={{ flex: 1, padding: "6px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                />
              </div>
              {fetchingHistory ? (
                <p style={{ fontSize: "12px", color: "#64748b", marginTop: "8px", margin: 0 }}>Loading history...</p>
              ) : (
                <p style={{ fontSize: "12px", color: "#64748b", marginTop: "8px", margin: 0 }}>{historyPath.length} locations found.</p>
              )}
            </div>
          )}

          <div className="driver-list">
            {loading ? (
              <div className="loading-state">
                <Loader2 size={24} className="animate-spin" />
                <p>Locating drivers...</p>
              </div>
            ) : filteredDrivers.length === 0 ? (
              <div className="empty-state">
                <p>No drivers found.</p>
              </div>
            ) : (
              filteredDrivers.map(driver => (
                <div 
                  key={driver.id} 
                  className="driver-card" 
                  onClick={() => handleCardClick(driver.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="driver-info">
                    <div className="status-indicator" style={{ backgroundColor: getStatusColor(driver.updatedAt) }}></div>
                    <h3>{driver.driverName || driver.id}</h3>
                  </div>
                  <div className="driver-meta" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span title="Last updated">
                      <Clock size={12} /> {formatTimeAgo(driver.updatedAt)}
                    </span>
                    <span title="Coordinates">
                      <MapPin size={12} /> {driver.latitude?.toFixed(4)}, {driver.longitude?.toFixed(4)}
                    </span>
                    <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${driver.latitude},${driver.longitude}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#2563eb", textDecoration: "none", fontSize: "12px", fontWeight: "500" }}>
                        <Navigation size={12} /> Get Directions
                      </a>
                      <button onClick={() => setHistoryDriverId(driver.driverName || driver.id)} style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#10b981", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "500", padding: 0 }}>
                        <History size={12} /> View Timeline
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Map Area */}
        <div className="map-container">
          <div id="google-map" style={{ width: "100%", height: "100%" }}></div>
        </div>

      </div>
    </div>
  );
}

export default TrackingDashboard;
