import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Modal from "../components/Modal";
import { db } from "../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { Search, Truck, Eye, Edit, ShieldAlert, Wrench, User, FileCheck } from "lucide-react";
import "./VehicleList.css";

function VehicleList() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]); // Needed for re-assigning drivers in Edit mode
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal states
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch both vehicles and active drivers concurrently
        const [vehSnap, drvSnap] = await Promise.all([
          getDocs(collection(db, "vehicles")),
          getDocs(collection(db, "drivers"))
        ]);

        const vehData = vehSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort alphabetically by vehicle number
        vehData.sort((a, b) => (a.number || "").localeCompare(b.number || ""));
        setVehicles(vehData);

        // Get active drivers for the dropdown
        const activeDrivers = drvSnap.docs
          .map(d => d.data())
          .filter(d => d.status !== "inactive")
          .map(d => d.name);
        setDrivers(activeDrivers);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      // Force uppercase for vehicle number
      const updatedData = { ...selected, number: selected.number.toUpperCase() };
      
      await updateDoc(doc(db, "vehicles", selected.id), updatedData);
      
      // Update UI instantly
      setVehicles(vehicles.map(v => v.id === selected.id ? updatedData : v));
      
      alert("Vehicle Updated Successfully! ✅");
      setSelected(null);
    } catch (error) {
      alert("Error updating vehicle.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // 🔍 Search Filter (By Number or Assigned Driver)
  const filteredVehicles = vehicles.filter(v => 
    v.number?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.driver?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="list-page-bg">
      <Navbar />
      
      <div className="list-container">
        {/* HEADER SECTION */}
        <div className="list-header">
          <div>
            <h2>Fleet Directory</h2>
            <p>Manage your trucks, assignments, and RTO compliance.</p>
          </div>
          
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by Truck No. or Driver..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* LOADING & LIST SECTION */}
        {loading ? (
          <div className="loading-state">Loading Fleet Data...</div>
        ) : (
          <div className="vehicle-grid">
            {filteredVehicles.length === 0 ? (
              <div className="empty-state">No vehicles found.</div>
            ) : (
              filteredVehicles.map((v) => (
                <div className="vehicle-card" key={v.id}>
                  
                  <div className="vehicle-card-top">
                    <div className="vehicle-icon-wrapper">
                      <Truck size={24} className="text-blue" />
                    </div>
                    <div className="vehicle-basic-info">
                      <h3>{v.number || "UNREGISTERED"}</h3>
                      <span className={`status-badge ${v.status || 'active'}`}>
                        {v.status || "active"}
                      </span>
                    </div>
                  </div>

                  <div className="vehicle-card-body">
                    <div className="info-row">
                      <Wrench size={16} /> <span>{v.makeModel || "Unknown Make"} ({v.type || "-"})</span>
                    </div>
                    <div className="info-row">
                      <User size={16} /> <span>Driver: <strong>{v.driver || "Unassigned"}</strong></span>
                    </div>
                  </div>

                  <div className="vehicle-card-actions">
                    <button className="btn-view" onClick={() => { setSelected(v); setEdit(false); }}>
                      <Eye size={16} /> Details
                    </button>
                    <button className="btn-edit" onClick={() => { setSelected(v); setEdit(true); }}>
                      <Edit size={16} /> Edit
                    </button>
                  </div>

                </div>
              ))
            )}
          </div>
        )}

        {/* 🪟 MODAL SECTION (VIEW & EDIT) */}
        {selected && (
          <Modal onClose={() => setSelected(null)}>
            <div className="pro-modal-content">
              
              <div className="modal-header">
                <h3>{edit ? "Edit Vehicle Details" : "Vehicle Profile"}</h3>
                <span className={`status-badge ${selected.status || 'active'}`}>
                  {selected.status || "active"}
                </span>
              </div>

              {edit ? (
                /* --- EDIT MODE FORM --- */
                <div className="modal-form-grid">
                  <div className="input-group">
                    <label>Registration Number</label>
                    <input style={{textTransform: 'uppercase'}} value={selected.number} onChange={(e) => setSelected({ ...selected, number: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Make & Model</label>
                    <input value={selected.makeModel || ""} onChange={(e) => setSelected({ ...selected, makeModel: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Body Type</label>
                    <select value={selected.type} onChange={(e) => setSelected({ ...selected, type: e.target.value })}>
                      <option value="Open Half Mixture">Open Half Mixture</option>
                      <option value="Container">Closed Container</option>
                      <option value="Trailer">Flatbed Trailer</option>
                      <option value="Tanker">Liquid Tanker</option>
                      <option value="Tipper">Tipper / Dumper</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Payload Capacity (Tons)</label>
                    <input type="number" value={selected.capacity} onChange={(e) => setSelected({ ...selected, capacity: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Assigned Driver</label>
                    <select value={selected.driver || ""} onChange={(e) => setSelected({ ...selected, driver: e.target.value })}>
                      <option value="">Unassigned</option>
                      {drivers.map((d, i) => <option key={i} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Owner (If Attached)</label>
                    <input value={selected.owner || ""} onChange={(e) => setSelected({ ...selected, owner: e.target.value })} />
                  </div>
                  
                  {/* COMPLIANCE SECTION */}
                  <div className="section-divider full-width">Compliance & Expiries</div>
                  
                  <div className="input-group">
                    <label>Insurance Expiry</label>
                    <input type="date" value={selected.insuranceExpiry || ""} onChange={(e) => setSelected({ ...selected, insuranceExpiry: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Fitness Expiry</label>
                    <input type="date" value={selected.fitnessExpiry || ""} onChange={(e) => setSelected({ ...selected, fitnessExpiry: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Permit Expiry</label>
                    <input type="date" value={selected.permitExpiry || ""} onChange={(e) => setSelected({ ...selected, permitExpiry: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>PUC Expiry</label>
                    <input type="date" value={selected.pucExpiry || ""} onChange={(e) => setSelected({ ...selected, pucExpiry: e.target.value })} />
                  </div>

                  <div className="input-group full-width">
                    <label>Operating Status</label>
                    <select value={selected.status || "active"} onChange={(e) => setSelected({ ...selected, status: e.target.value })}>
                      <option value="active">Active (On Road)</option>
                      <option value="maintenance">Maintenance / Garage</option>
                      <option value="sold">Sold / Decommissioned</option>
                    </select>
                  </div>
                  
                  <div className="modal-actions full-width">
                    <button className="btn-cancel" onClick={() => setSelected(null)}>Cancel</button>
                    <button className="btn-save" onClick={handleUpdate} disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                /* --- VIEW MODE DETAILS --- */
                <div className="modal-view-wrapper">
                  <div className="modal-view-grid">
                    <DetailBox label="Make & Model" value={selected.makeModel} />
                    <DetailBox label="Body Type" value={selected.type} />
                    <DetailBox label="Capacity" value={selected.capacity ? `${selected.capacity} Tons` : "N/A"} />
                    <DetailBox label="Current Driver" value={selected.driver} highlight={true} />
                    <DetailBox label="Chassis No." value={selected.chassisNumber} />
                    <DetailBox label="Engine No." value={selected.engineNumber} />
                    <DetailBox label="Owner" value={selected.owner} />
                  </div>
                  
                  <h4 className="compliance-heading"><FileCheck size={16}/> RTO Compliance</h4>
                  <div className="modal-view-grid compliance-grid">
                    <DetailBox label="Insurance" value={selected.insuranceExpiry} type="date" />
                    <DetailBox label="Fitness" value={selected.fitnessExpiry} type="date" />
                    <DetailBox label="National Permit" value={selected.permitExpiry} type="date" />
                    <DetailBox label="PUC (Pollution)" value={selected.pucExpiry} type="date" />
                  </div>
                </div>
              )}

            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

// Reusable mini-component for View Modal
function DetailBox({ label, value, highlight, type }) {
  // Bonus: If it's a date and it's missing, show a warning
  let displayValue = value || "Not Updated";
  let isWarning = type === "date" && !value;

  return (
    <div className={`detail-box ${highlight ? 'box-highlight' : ''} ${isWarning ? 'box-warning' : ''}`}>
      <small>{label}</small>
      <p>{displayValue}</p>
    </div>
  );
}

export default VehicleList;