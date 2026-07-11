import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import Modal from "../components/Modal";
import { db } from "../firebase";
import { collection, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { Search, User, Phone, FileText, Edit, Eye, ShieldAlert } from "lucide-react";
import { logActivity } from "../utils/activityLog";
import { getActiveSalaryScheme, getRecordMonthKey } from "../utils/driverSalary";
import "./DriverList.css"; 

const getSalaryTypeLabel = (driver = {}) => {
  if (driver.salaryType === "commission") {
    return `Commission Based: ${driver.commissionRate || 0}% on monthly booking amount`;
  }

  if (driver.salaryType === "fixed_commission") {
    return `Fixed + Commission: Rs ${Number(driver.salary || 0).toLocaleString("en-IN")} + ${
      driver.commissionRate || 0
    }%`;
  }

  if (driver.salaryType === "fixed_km") {
    return `Fixed + KM: Rs ${Number(driver.salary || 0).toLocaleString("en-IN")} + Rs ${driver.kmRate || 0}/KM`;
  }

  return `Fixed Salary: Rs ${Number(driver.salary || 0).toLocaleString("en-IN")} / month`;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDriverName = (record = {}) => record.driverName || record.payeeName || record.payee || "";

const getRecordMonth = (record = {}) => String(record.loadingDate || record.date || record.createdAt || "").slice(0, 7);

function DriverList() {
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal states
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubDrivers = onSnapshot(collection(db, "drivers"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setDrivers(data);
      setLoading(false);
    });
    const unsubBookings = onSnapshot(collection(db, "bookings"), (snap) => {
      setBookings(snap.docs.map(docItem => ({ id: docItem.id, ...docItem.data() })));
    });
    const unsubTransactions = onSnapshot(collection(db, "transactions"), (snap) => {
      setTransactions(snap.docs.map(docItem => ({ id: docItem.id, ...docItem.data() })));
    });
    const unsubSubmissions = onSnapshot(collection(db, "driver_submissions"), (snap) => {
      setSubmissions(snap.docs.map(docItem => ({ id: docItem.id, ...docItem.data() })));
    });

    return () => {
      unsubDrivers();
      unsubBookings();
      unsubTransactions();
      unsubSubmissions();
    };
  }, []);

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      // Clean up fields based on salary type to prevent dirty data
      const updatePayload = { ...selected };
      if (updatePayload.salaryType === "commission") {
        updatePayload.salary = ""; // Clear fixed salary
        updatePayload.kmRate = "";
      } else if (updatePayload.salaryType === "fixed" || !updatePayload.salaryType) {
        updatePayload.commissionRate = ""; // Clear commission rate
        updatePayload.kmRate = "";
      } else if (updatePayload.salaryType === "fixed_km") {
        updatePayload.commissionRate = "";
      } else if (updatePayload.salaryType === "fixed_commission") {
        updatePayload.kmRate = "";
      }
      updatePayload.salary = updatePayload.salary === "" ? "" : Number(updatePayload.salary) || 0;
      updatePayload.commissionRate =
        updatePayload.commissionRate === "" ? "" : Number(updatePayload.commissionRate) || 0;
      updatePayload.kmRate =
        updatePayload.kmRate === "" ? "" : Number(updatePayload.kmRate) || 0;

      const currentDriver = drivers.find(d => d.id === selected.id) || selected;
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      let newHistory = currentDriver.salaryHistory ? [...currentDriver.salaryHistory] : [{
          effectiveMonth: "2000-01",
          salaryType: currentDriver.salaryType || "fixed",
          salary: currentDriver.salary || 0,
          commissionRate: currentDriver.commissionRate || 0,
          kmRate: currentDriver.kmRate || 0
      }];
      
      const newEntry = {
          effectiveMonth: currentMonth,
          salaryType: updatePayload.salaryType || "fixed",
          salary: updatePayload.salary || 0,
          commissionRate: updatePayload.commissionRate || 0,
          kmRate: updatePayload.kmRate || 0
      };

      const existingEntryIndex = newHistory.findIndex(h => h.effectiveMonth === currentMonth);
      if (existingEntryIndex >= 0) {
          newHistory[existingEntryIndex] = newEntry;
      } else {
          newHistory.push(newEntry);
      }
      
      newHistory.sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
      updatePayload.salaryHistory = newHistory;

      await updateDoc(doc(db, "drivers", selected.id), updatePayload);
      await logActivity(db, {
        action: "driver_updated",
        module: "drivers",
        summary: `Updated driver profile for ${updatePayload.name || selected.name || selected.id}`,
        targetId: selected.id,
        targetType: "driver",
      });
      
      // Update local state instantly so we don't have to refresh
      setDrivers(drivers.map(d => d.id === selected.id ? updatePayload : d));
      
      alert("Driver Profile Updated Successfully! ✅");
      setSelected(null);
    } catch (error) {
      alert("Error updating driver.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  // 🔍 Search Filter
  const filteredDrivers = drivers.filter(d => 
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.phone?.includes(searchTerm)
  );

  const selectedCommissionSummary = useMemo(() => {
    if (!selected?.name) {
      return null;
    }

    const driverTrips = bookings.filter(
      (booking) => booking.driver === selected.name || booking.driver2 === selected.name
    );
    
    let bookingAmount = 0;
    let commissionEarned = 0;
    
    driverTrips.forEach((booking) => {
        const month = getRecordMonthKey(booking);
        const activeScheme = getActiveSalaryScheme(selected, month);
        const rate = activeScheme.salaryType === "fixed" ? 0 : toNumber(activeScheme.commissionRate);
        const freight = toNumber(booking.freight);
        
        bookingAmount += freight;
        commissionEarned += freight * (rate / 100);
    });

    const commissionRate =
      selected.salaryType === "fixed" ? 0 : toNumber(selected.commissionRate);

    const approvedDeductions = transactions
      .filter(
        (transaction) =>
          getDriverName(transaction) === selected.name &&
          transaction.deductionSource === "driver_salary"
      )
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const pendingDeductions = submissions
      .filter(
        (submission) =>
          getDriverName(submission) === selected.name &&
          submission.deductionSource === "driver_salary"
      )
      .reduce((sum, submission) => sum + toNumber(submission.amount), 0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthTrips = driverTrips.filter((booking) => getRecordMonth(booking) === currentMonth);
    const currentMonthBookingAmount = currentMonthTrips.reduce(
      (sum, booking) => sum + toNumber(booking.freight),
      0
    );

    return {
      tripCount: driverTrips.length,
      bookingAmount,
      commissionRate,
      commissionEarned,
      approvedDeductions,
      pendingDeductions,
      netCommission: commissionEarned - approvedDeductions - pendingDeductions,
      currentMonthTripCount: currentMonthTrips.length,
      currentMonthCommission: currentMonthBookingAmount * (commissionRate / 100),
    };
  }, [bookings, selected, submissions, transactions]);

  return (
    <div className="list-page-bg">
      <Navbar />
      
      <div className="list-container">
        {/* HEADER SECTION */}
        <div className="list-header">
          <div>
            <h2>Driver Directory</h2>
            <p>Manage your fleet personnel, pay structures, and compliance documents.</p>
          </div>
          
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by Name or Phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* LOADING & LIST SECTION */}
        {loading ? (
          <div className="loading-state">Loading Driver Data...</div>
        ) : (
          <div className="driver-grid">
            {filteredDrivers.length === 0 ? (
              <div className="empty-state">No drivers found.</div>
            ) : (
              filteredDrivers.map((d) => (
                <div className="driver-card" key={d.id}>
                  
                  <div className="driver-card-top">
                    <div className="driver-avatar">
                      {d.name ? d.name.charAt(0).toUpperCase() : "D"}
                    </div>
                    <div className="driver-basic-info">
                      <h3>{d.name || "Unknown"}</h3>
                      <span className={`status-badge ${d.status === 'inactive' ? 'inactive' : 'active'}`}>
                        {d.status || "Active"}
                      </span>
                    </div>
                  </div>

                  <div className="driver-card-body">
                    <div className="info-row">
                      <Phone size={16} /> <span>{d.phone || "N/A"}</span>
                    </div>
                    <div className="info-row">
                      <FileText size={16} /> <span>DL: {d.licenseNumber || "N/A"}</span>
                    </div>
                  </div>

                  <div className="driver-card-actions">
                    <button className="btn-view" onClick={() => { setSelected(d); setEdit(false); }}>
                      <Eye size={16} /> View Profile
                    </button>
                    <button className="btn-edit" onClick={() => { setSelected(d); setEdit(true); }}>
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
                <h3>{edit ? "Edit Driver Profile" : "Driver Details"}</h3>
                <span className={`status-badge ${selected.status === 'inactive' ? 'inactive' : 'active'}`}>
                  {selected.status || "Active"}
                </span>
              </div>

              {edit ? (
                /* --- EDIT MODE FORM --- */
                <div className="modal-form-grid">
                  <div className="input-group">
                    <label>Full Name</label>
                    <input value={selected.name || ""} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Phone Number</label>
                    <input value={selected.phone || ""} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>License Number</label>
                    <input value={selected.licenseNumber || ""} onChange={(e) => setSelected({ ...selected, licenseNumber: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>License Expiry</label>
                    <input type="date" value={selected.licenseExpiry || ""} onChange={(e) => setSelected({ ...selected, licenseExpiry: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Aadhaar / KYC</label>
                    <input value={selected.aadhaarNumber || ""} onChange={(e) => setSelected({ ...selected, aadhaarNumber: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Blood Group</label>
                    <input value={selected.bloodGroup || ""} onChange={(e) => setSelected({ ...selected, bloodGroup: e.target.value })} />
                  </div>
                  
                  {/* 🔥 NEW: SALARY SYSTEM */}
                  <div className="section-title full-width" style={{ marginTop: "15px", borderBottom: "2px solid #e2e8f0", paddingBottom: "5px", fontWeight: "bold", color: "#1e293b" }}>
                    Compensation & Pay System
                  </div>
                  
                  <div className="input-group full-width">
                    <label>Salary Type</label>
                    <select 
                      value={selected.salaryType || "fixed"} 
                      onChange={(e) => setSelected({ ...selected, salaryType: e.target.value })}
                      style={{ background: "#f8fafc", border: "1px solid #cbd5e1" }}
                    >
                      <option value="fixed">Fixed Monthly Salary</option>
                      <option value="commission">Commission Based (% of Booking)</option>
                      <option value="fixed_commission">Fixed Salary + Commission %</option>
                      <option value="fixed_km">Fixed Salary + Per KM Rate</option>
                    </select>
                  </div>

                  {(selected.salaryType === "fixed_km") && (
                    <div className="input-group full-width" style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <label>Calculation Start Date</label>
                      <input 
                        type="date" 
                        value={selected.salaryCalculationDate || ""} 
                        onChange={(e) => setSelected({ ...selected, salaryCalculationDate: e.target.value })} 
                      />
                    </div>
                  )}

                  {(selected.salaryType === "fixed" || selected.salaryType === "fixed_commission" || selected.salaryType === "fixed_km" || !selected.salaryType) && (
                    <div className={selected.salaryType === "fixed_commission" ? "input-group" : "input-group full-width"}>
                      <label>Base Salary (₹ per month)</label>
                      <input type="number" value={selected.salary || ""} onChange={(e) => setSelected({ ...selected, salary: e.target.value })} />
                    </div>
                  )}

                  {(selected.salaryType === "commission" || selected.salaryType === "fixed_commission") && (
                    <div className={selected.salaryType === "fixed_commission" ? "input-group" : "input-group full-width"}>
                      <label>Commission Percentage (%)</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 10 for 10%" 
                        value={selected.commissionRate || ""} 
                        onChange={(e) => setSelected({ ...selected, commissionRate: e.target.value })} 
                        style={{ borderColor: "#10b981" }}
                      />
                    </div>
                  )}

                  {selected.salaryType === "fixed_km" && (
                    <div className="input-group full-width">
                      <label>Per KM Rate (₹)</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 2.5" 
                        value={selected.kmRate || ""} 
                        onChange={(e) => setSelected({ ...selected, kmRate: e.target.value })} 
                        style={{ borderColor: "#3b82f6" }}
                      />
                    </div>
                  )}

                  <div className="input-group full-width" style={{ marginTop: "10px" }}>
                    <label>Account Status</label>
                    <select value={selected.status || "active"} onChange={(e) => setSelected({ ...selected, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  
                  <div className="modal-actions full-width" style={{ marginTop: "20px" }}>
                    <button className="btn-cancel" onClick={() => setSelected(null)}>Cancel</button>
                    <button className="btn-save" onClick={handleUpdate} disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                /* --- VIEW MODE DETAILS --- */
                <div className="modal-view-grid">
                  <DetailBox label="Phone Number" value={selected.phone} />
                  <DetailBox label="Aadhaar KYC" value={selected.aadhaarNumber} />
                  <DetailBox label="License No." value={selected.licenseNumber} />
                  <DetailBox label="License Expiry" value={selected.licenseExpiry} />
                  
                  <div className="detail-box full-width" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "15px", borderRadius: "8px" }}>
                    <small style={{ color: "#166534", fontWeight: "bold" }}>PAY SYSTEM</small>
                    <p style={{ margin: "5px 0 0 0", fontSize: "1.1rem" }}>
                      {getSalaryTypeLabel(selected)}
                    </p>
                  </div>

                  {selectedCommissionSummary && (
                    <div className="detail-box full-width" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "15px", borderRadius: "8px" }}>
                      <small style={{ color: "#1d4ed8", fontWeight: "bold" }}>COMMISSION EARNED TILL NOW</small>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: "10px", marginTop: "10px" }}>
                        <CommissionMetric label="Trips" value={selectedCommissionSummary.tripCount} />
                        <CommissionMetric label="Booking Amount" value={`Rs ${selectedCommissionSummary.bookingAmount.toLocaleString("en-IN")}`} />
                        <CommissionMetric label="Rate" value={`${selectedCommissionSummary.commissionRate}%`} />
                        <CommissionMetric label="Earned" value={`Rs ${Math.round(selectedCommissionSummary.commissionEarned).toLocaleString("en-IN")}`} />
                        <CommissionMetric label="Approved Deduct" value={`Rs ${Math.round(selectedCommissionSummary.approvedDeductions).toLocaleString("en-IN")}`} />
                        <CommissionMetric label="Pending Deduct" value={`Rs ${Math.round(selectedCommissionSummary.pendingDeductions).toLocaleString("en-IN")}`} />
                        <CommissionMetric label="Net Commission" value={`Rs ${Math.round(selectedCommissionSummary.netCommission).toLocaleString("en-IN")}`} highlight />
                        <CommissionMetric label="This Month" value={`Rs ${Math.round(selectedCommissionSummary.currentMonthCommission).toLocaleString("en-IN")} / ${selectedCommissionSummary.currentMonthTripCount} trips`} />
                      </div>
                    </div>
                  )}

                  <DetailBox label="Blood Group" value={selected.bloodGroup} />
                  <DetailBox label="Emergency Contact" value={selected.emergencyContact} />
                  <DetailBox label="Experience" value={selected.experience ? `${selected.experience} Years` : "N/A"} />
                  <div className="detail-box full-width">
                    <small>Full Address</small>
                    <p>{selected.address || "No address provided."}</p>
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

// Reusable mini-component for the View Modal
function DetailBox({ label, value }) {
  return (
    <div className="detail-box">
      <small>{label}</small>
      <p>{value || "N/A"}</p>
    </div>
  );
}

function CommissionMetric({ label, value, highlight = false }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #dbeafe", borderRadius: "8px", padding: "10px" }}>
      <small style={{ color: "#64748b", fontWeight: "800" }}>{label}</small>
      <p style={{ margin: "4px 0 0", color: highlight ? "#166534" : "#0f172a", fontWeight: "900" }}>
        {value}
      </p>
    </div>
  );
}

export default DriverList;
