import React, { useEffect, useState, useRef } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import Navbar from "../components/Navbar";
import { Loader2, MapPin, Clock, Search } from "lucide-react";
import "./TrackingDashboard.css";

function TrackingDashboard() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const mapRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
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
  }, []);

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
    if (window.mappls && !mapRef.current) {
      mapRef.current = new window.mappls.Map("mappls-map", {
        center: [21.1458, 79.0882],
        zoom: 5,
      });
    }
  }, []);

  // Sync Markers
  useEffect(() => {
    if (!mapRef.current || !window.mappls) return;

    filteredDrivers.forEach(driver => {
      if (driver.latitude && driver.longitude) {
        const position = { lat: driver.latitude, lng: driver.longitude };
        const popupContent = `
          <div class="popup-content" style="padding: 10px;">
            <strong>${driver.driverName || driver.id}</strong><br/>
            <span>Lat: ${driver.latitude}</span><br/>
            <span>Lng: ${driver.longitude}</span><br/>
            <small>Updated: ${formatTimeAgo(driver.updatedAt)}</small>
          </div>
        `;

        const markerHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; transform: translate(-50%, -100%);">
            <div style="background-color: #1e3a8a; color: white; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3); margin-bottom: 2px;">
              ${driver.driverName || driver.id}
            </div>
            <div style="font-size: 28px; line-height: 1; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.4));">🚚</div>
          </div>
        `;

        if (!markersRef.current[driver.id]) {
          markersRef.current[driver.id] = new window.mappls.Marker({
            map: mapRef.current,
            position: position,
            html: markerHtml,
            popupHtml: popupContent
          });
        } else {
          try {
            markersRef.current[driver.id].setPosition(position);
            // Updating html property if supported by Mappls API, or recreate if necessary
            // MapmyIndia markers usually update automatically or we can set it.
            // For safety, we just update the position and popup.
            markersRef.current[driver.id].setPopupHtml(popupContent);
          } catch(e) {
            console.error(e);
          }
        }
      }
    });

    const currentIds = filteredDrivers.map(d => d.id);
    Object.keys(markersRef.current).forEach(id => {
      if (!currentIds.includes(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

  }, [filteredDrivers]);

  return (
    <div className="tracking-page">
      <Navbar />
      <div className="tracking-layout">
        
        {/* Sidebar */}
        <div className="tracking-sidebar">
          <div className="sidebar-header">
            <h2>Live Tracking</h2>
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
                <div key={driver.id} className="driver-card">
                  <div className="driver-info">
                    <div className="status-indicator" style={{ backgroundColor: getStatusColor(driver.updatedAt) }}></div>
                    <h3>{driver.driverName || driver.id}</h3>
                  </div>
                  <div className="driver-meta">
                    <span title="Last updated">
                      <Clock size={12} /> {formatTimeAgo(driver.updatedAt)}
                    </span>
                    <span title="Coordinates">
                      <MapPin size={12} /> {driver.latitude?.toFixed(4)}, {driver.longitude?.toFixed(4)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Map Area */}
        <div className="map-container">
          <div id="mappls-map" style={{ width: "100%", height: "100%" }}></div>
        </div>

      </div>
    </div>
  );
}

export default TrackingDashboard;
