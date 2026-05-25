import { useState, useEffect, useRef } from "react"; 
import { db } from "../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Search, MapPin, Truck, CheckCircle, Package, ArrowRight, ShieldAlert, Clock } from "lucide-react";
import logo from "../assets/vel logo.jpeg"; 
import "./TrackBooking.css"; 

function TrackBooking() {
  const [trackingId, setTrackingId] = useState("");
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resultRef = useRef(null);

  // Basic CAPTCHA State
  const [captcha, setCaptcha] = useState({ num1: 0, num2: 0, answer: "" });

  // Generate random math question on load
  const generateCaptcha = () => {
    setCaptcha({ 
      num1: Math.floor(Math.random() * 10) + 1, 
      num2: Math.floor(Math.random() * 10) + 1, 
      answer: "" 
    });
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  // Auto-scroll whenever a booking is successfully found
  useEffect(() => {
    if (booking && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [booking]); 

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!trackingId.trim()) return;

    // CAPTCHA Verification Check
    const expectedTotal = captcha.num1 + captcha.num2;
    if (parseInt(captcha.answer) !== expectedTotal) {
      setError("Verification failed. Please solve the math question correctly.");
      generateCaptcha(); 
      return;
    }

    setLoading(true);
    setError("");
    setBooking(null);

    try {
      const searchTerm = trackingId.trim();

      // First try: Search by Tracking ID (Uppercase)
      const q1 = query(collection(db, "bookings"), where("trackingId", "==", searchTerm.toUpperCase()));
      let snapshot = await getDocs(q1);

      // Second try: If not found, search by LR Number
      if (snapshot.empty) {
        const q2 = query(collection(db, "bookings"), where("lrNumber", "==", searchTerm));
        snapshot = await getDocs(q2);
      }

      if (snapshot.empty) {
        setError("No shipment found with this ID or LR Number. Please verify and try again.");
        generateCaptcha(); 
      } else {
        setBooking(snapshot.docs[0].data());
      }
    } catch (err) {
      console.error(err);
      setError("System error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to format timestamps beautifully
  const formatTime = (isoString) => {
    if (!isoString) return "Time unavailable";
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="track-page">
      <nav className="public-nav">
        <div className="nav-brand">
          <img src={logo} alt="Logo" className="nav-logo" />
          <span>Veerashaiva Roadways</span>
        </div>
      </nav>

      <div className="track-container">
        <div className="search-section">
          <h1>Track Your Shipment
            <p style={{fontSize: "0.8rem", color: "#94a3b8", fontWeight: "normal"}}>DADDY TYPE 487045 or 561361</p>
          </h1>
          <p>Enter your VR Tracking ID or LR Number to see real-time updates.</p>

          <form onSubmit={handleTrack} className="track-form-container">
            
            <div className="track-form">
              <div className="search-input-wrapper">
                <Search className="search-icon" size={20} />
                <input 
                  type="text" 
                  placeholder="e.g., VR-8492-X1A or LR-1029" 
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Simple CAPTCHA UI */}
            <div className="captcha-box">
              <div className="captcha-label">
                <ShieldAlert size={16} /> Verification: What is {captcha.num1} + {captcha.num2}?
              </div>
              <input 
                type="number" 
                placeholder="Answer" 
                value={captcha.answer}
                onChange={(e) => setCaptcha({...captcha, answer: e.target.value})}
                required
                className="captcha-input"
              />
            </div>

            <button type="submit" disabled={loading} className="track-submit-btn">
              {loading ? "Searching..." : "Track Order"}
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}
        </div>

        {booking && (
          <div className="shipment-card slide-up" ref={resultRef}>
            
            <div className="shipment-header">
              <div>
                <span className="label">Tracking ID</span>
                <h3 className="tracking-number">#{booking.trackingId}</h3>
                {booking.lrNumber && <p style={{margin: '5px 0 0 0', color: '#64748b', fontSize: '0.9rem'}}>LR No: {booking.lrNumber}</p>}
              </div>
              <div className="status-badge" style={{ 
                background: booking.status === 'Delay' ? '#fee2e2' : (booking.status === 'Booking Completed' ? '#dcfce3' : '#dbeafe'),
                color: booking.status === 'Delay' ? '#991b1b' : (booking.status === 'Booking Completed' ? '#166534' : '#1e40af')
              }}>
                {booking.status || "Pending"}
              </div>
            </div>

            {/* ROUTE DISPLAY */}
            <div className="route-display">
              <div className="route-point">
                <MapPin size={24} className="text-blue" />
                <div>
                  <small>Origin</small>
                  <strong>{booking.from}</strong>
                </div>
              </div>
              <div className="route-arrow">
                <ArrowRight size={24} color="#cbd5e1" />
              </div>
              <div className="route-point">
                <MapPin size={24} className="text-green" />
                <div>
                  <small>Destination</small>
                  <strong>{booking.to}</strong>
                </div>
              </div>
            </div>

            <hr className="divider" />

            {/* 🔥 DYNAMIC STATUS TIMELINE */}
            <div style={{ padding: "10px 20px" }}>
              <h3 style={{ margin: "0 0 20px 0", color: "#1e293b", fontSize: "1.2rem" }}>Tracking History</h3>
              
              <div style={{ position: "relative", paddingLeft: "10px" }}>
                {/* The vertical line connecting the dots */}
                <div style={{ position: "absolute", left: "19px", top: "10px", bottom: "20px", width: "2px", backgroundColor: "#e2e8f0" }}></div>

                {/* Map over the actual status history from Firebase */}
                {(booking.statusHistory && booking.statusHistory.length > 0 
                  ? booking.statusHistory 
                  : [{ status: booking.status || "Pending", timestamp: booking.createdAt }]
                ).map((historyItem, index, array) => {
                  const isLast = index === array.length - 1;
                  const isDelay = historyItem.status === "Delay";
                  const isComplete = historyItem.status === "Booking Completed" || historyItem.status === "Delivered";

                  // Determine colors based on status type
                  let iconColor = isLast ? "#2563eb" : "#94a3b8"; // Active blue, or gray
                  if (isDelay) iconColor = "#ef4444"; // Red for delay
                  if (isComplete) iconColor = "#10b981"; // Green for complete

                  return (
                    <div key={index} style={{ display: "flex", gap: "15px", marginBottom: "25px", position: "relative", opacity: isLast ? 1 : 0.6 }}>
                      
                      {/* The Dot/Icon */}
                      <div style={{ background: "white", borderRadius: "50%", padding: "2px", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", height: "24px" }}>
                        {historyItem.status === "Pending" ? <Package size={20} color={iconColor} fill="white" /> :
                         historyItem.status === "In Transit" ? <Truck size={20} color={iconColor} fill="white" /> :
                         <CheckCircle size={20} color={iconColor} fill="white" />}
                      </div>
                      
                      {/* The Text & Timestamp */}
                      <div>
                        <strong style={{ display: "block", color: isLast ? "#0f172a" : "#475569", fontSize: "1.1rem", marginBottom: "4px" }}>
                          {historyItem.status}
                        </strong>
                        <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "#64748b", fontSize: "0.85rem", fontWeight: "500" }}>
                          <Clock size={14} /> {formatTime(historyItem.timestamp)}
                        </span>
                      </div>
                      
                    </div>
                  );
                })}
              </div>
            </div>

            <hr className="divider" />

            {/* PUBLIC DETAILS */}
            <div className="public-details-grid">
              <div className="detail">
                <small>Booking Date</small>
                <p>{new Date(booking.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="detail">
                <small>Material</small>
                <p>{booking.material || "General Freight"}</p>
              </div>
              <div className="detail">
                <small>Vehicle Number</small>
                <p>{booking.vehicle || "Assigning..."}</p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default TrackBooking;