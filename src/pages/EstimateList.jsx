import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // 🔥 Navigation hook
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { Search, MapPin, Package, User, Trash2, Calendar, FileText, ArrowRightCircle } from "lucide-react"; 
import { getCurrentMonthValue, getRecordDateInput } from "../utils/dateRange";
import "./BookingList.css"; // Reuse your exact CSS

function EstimateList() {
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMonth, setFilterMonth] = useState(getCurrentMonthValue());
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const snapshot = await getDocs(collection(db, "estimates"));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setEstimates(data);
    } catch (error) {
      console.error("Error fetching estimates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this estimate?")) return;
    try {
      await deleteDoc(doc(db, "estimates", id));
      setEstimates(estimates.filter(e => e.id !== id));
    } catch { alert("Error deleting."); }
  };

  // 🔥 THE MAGIC CONVERT BUTTON LOGIC
  const handleConvert = (estimate) => {
    navigate("/new-booking", { state: { estimateData: estimate } });
  };

  const filteredEstimates = estimates.filter(e => {
    const searchMatches = !searchTerm ||
      e.party?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.estimateId?.toLowerCase().includes(searchTerm.toLowerCase());
    const dateValue = getRecordDateInput(e, ["date", "createdAt", "validUntil"]);
    const monthMatches = !filterMonth || dateValue.startsWith(filterMonth);

    return searchMatches && monthMatches;
  });

  return (
    <div className="list-page-bg">
      <Navbar />
      <div className="list-container">
        
        <div className="list-header" style={{ marginBottom: "1rem" }}>
          <div>
            <h2>Estimates & Quotations</h2>
            <p>Manage quotes and convert them to active bookings.</p>
          </div>
          <div style={{ display: "grid", gap: "10px", minWidth: "260px" }}>
            <div className="search-box">
              <Search size={20} className="search-icon" />
              <input type="text" placeholder="Search Party or ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="search-box">
              <Calendar size={20} className="search-icon" />
              <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
            </div>
          </div>
        </div>

        {loading ? <div className="loading-state">Loading Estimates...</div> : (
          <div className="bookings-grid">
            {filteredEstimates.length === 0 ? <div className="empty-state">No estimates found.</div> : 
              filteredEstimates.map((e) => (
                <div className="booking-card" key={e.id} style={{ borderTop: "4px solid #8b5cf6" }}>
                  
                  <div className="card-top">
                    <div className="card-top-left">
                      <span className="tracking-id" style={{ color: "#4c1d95", background: "#f5f3ff", borderColor: "#ddd6fe" }}>{e.estimateId}</span>
                      <span className="status-badge" style={{ background: e.status === "Converted to Booking" ? "#dcfce3" : "#fef08a", color: e.status === "Converted to Booking" ? "#166534" : "#854d0e" }}>
                        {e.status || "Quoted"}
                      </span>
                    </div>
                    <div className="action-buttons">
                      <button className="action-btn delete-btn" onClick={() => handleDelete(e.id)}><Trash2 size={18} /></button>
                    </div>
                  </div>

                  <div className="route-info">
                    <div className="location"><MapPin size={16} className="text-blue" /><span>{e.from || "N/A"}</span></div>
                    <div className="route-line"></div>
                    <div className="location"><MapPin size={16} className="text-green" /><span>{e.to || "N/A"}</span></div>
                  </div>

                  <div className="details-grid">
                    <div className="detail-item"><User size={16} /><div><small>Party</small><p>{e.party || "-"}</p></div></div>
                    <div className="detail-item"><Package size={16} /><div><small>Material</small><p>{e.material || "-"} ({e.weight ? `${e.weight}t` : '-'})</p></div></div>
                    <div className="detail-item" style={{ gridColumn: "span 2" }}><Calendar size={16} /><div><small>Validity</small><p style={{ color: new Date(e.validUntil) < new Date() ? "#ef4444" : "#10b981" }}>Valid Until: {e.validUntil || "-"}</p></div></div>
                  </div>

                  <div className="card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="financial-summary">
                      <span>Quote: <strong>₹{e.freight || 0}</strong></span>
                    </div>
                    
                    {/* Only show Convert button if it hasn't been converted yet */}
                    {e.status !== "Converted to Booking" && (
                      <button 
                        onClick={() => handleConvert(e)}
                        style={{ background: "#8b5cf6", color: "white", border: "none", padding: "8px 15px", borderRadius: "8px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", transition: "0.2s" }}
                      >
                        Convert <ArrowRightCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

export default EstimateList;
