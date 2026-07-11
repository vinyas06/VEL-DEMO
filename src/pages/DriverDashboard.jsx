import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, or } from "firebase/firestore";
import { Truck, MapPin, Navigation, PlusCircle, CheckCircle, LogOut, User, Clock, AlertTriangle, ArrowRightCircle, IndianRupee, X, WalletCards, Calendar } from "lucide-react";
import AttachmentUploader from "../components/AttachmentUploader";
import { uploadAttachments } from "../utils/attachments";
import { logActivity } from "../utils/activityLog";
import { api } from "../utils/api";
import "./DriverDashboard.css"; 

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

const getPayPlanLabel = (salaryType) => {
  if (salaryType === "commission") return "Commission Only";
  if (salaryType === "fixed_commission") return "Fixed + Commission";
  return "Fixed Salary";
};

const DRIVER_TRIP_EXPENSE_CATEGORIES = [
  "Petrol",
  "Fastag",
  "Hamali/Labour Loading Unloading",
  "Police Fine",
  "Check Post Police Tips",
  "Trip Allowance",
  "AdBlue",
];

const getDriverTransactionName = (record = {}) =>
  record.driverName || record.payeeName || record.payee || "";

const buildDriverWallet = (driverName, transactions = [], submissions = []) => {
  const driverTransactions = transactions.filter(
    (transaction) => getDriverTransactionName(transaction) === driverName
  );
  const givenByAdmin = driverTransactions
    .filter((transaction) => transaction.category === "Driver Advance")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const approvedSpent = driverTransactions
    .filter(
      (transaction) =>
        transaction.category !== "Driver Advance" &&
        transaction.category !== "Driver Salary" &&
        transaction.deductionSource !== "driver_salary" &&
        transaction.type !== "IN" &&
        transaction.type !== "TRANSFER_IN"
    )
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const pendingSpent = submissions
    .filter(
      (submission) =>
        getDriverTransactionName(submission) === driverName &&
        submission.deductionSource !== "driver_salary"
    )
    .reduce((sum, submission) => sum + Number(submission.amount || 0), 0);

  return {
    givenByAdmin,
    approvedSpent,
    pendingSpent,
    available: givenByAdmin - approvedSpent - pendingSpent,
  };
};

// Modified to load trips where the driver is EITHER driver 1 OR driver 2
const loadTripsForDriver = async (driverName) => {
  const q = query(
    collection(db, "bookings"), 
    or(where("driver", "==", driverName), where("driver2", "==", driverName))
  );
  const snapshot = await getDocs(q);
  const trips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  trips.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return trips;
};

function DriverDashboard() {
  const [allTrips, setAllTrips] = useState([]);
  const [driverTransactions, setDriverTransactions] = useState([]);
  const [driverSubmissions, setDriverSubmissions] = useState([]);
  const [driverProfile, setDriverProfile] = useState(null); // 🔥 NEW: To store salary details
  const [driverWallet, setDriverWallet] = useState({
    givenByAdmin: 0,
    approvedSpent: 0,
    pendingSpent: 0,
    available: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("current"); 
  const navigate = useNavigate();
  
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const loggedInDriverName = storedUser.name || "Unknown Driver"; 

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showEarningsModal, setShowEarningsModal] = useState(false); // 🔥 NEW
  const [earningsMonth, setEarningsMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [statusOdo, setStatusOdo] = useState("");
  
  const [expenseForm, setExpenseForm] = useState({ type: "Petrol", amount: "", description: "", deductionSource: "admin_account" });
  const [expenseAttachmentFiles, setExpenseAttachmentFiles] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingStatus, setSubmittingStatus] = useState(null); 

  useEffect(() => {
    if (!storedUser.name) {
      navigate("/login");
      return;
    }

    const fetchInitialData = async () => {
      try {
        const data = await api.getDriverDashboard();
        
        if (data.profile) {
          setDriverProfile(data.profile);
        }
        setAllTrips(data.bookings || []);
        setDriverTransactions(data.transactions || []);
        setDriverSubmissions(data.submissions || []);
        if (data.wallet) {
          setDriverWallet(data.wallet);
        }
      } catch (error) {
        console.error("Error fetching driver data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [loggedInDriverName, navigate, storedUser.name]);

  const fetchMyTrips = async () => {
    try {
      const data = await api.getDriverDashboard();
      setAllTrips(data.bookings || []);
    } catch (error) {
      console.error(error);
    }
  };

  const getAllowedNextStatuses = (currentStatus) => {
    switch(currentStatus) {
      case "Pending": return ["Moving Towards Load"];
      case "Moving Towards Load": return ["Loading"];
      case "Loading": return ["In Transit"];
      case "In Transit": return ["Reached Destination", "Delay"];
      case "Delay": return ["In Transit"];
      case "Reached Destination": return ["Unloading"];
      case "Unloading": return ["Delivered"];
      case "Delivered": return ["Booking Completed"];
      case "Booking Completed": return [];
      default: return ["Moving Towards Load"];
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (!selectedTrip || !newStatus) return;
    if (!statusOdo || Number(statusOdo) <= 0) {
      return alert("Please enter a valid odometer reading before updating trip status.");
    }

    setIsSubmitting(true);
    setSubmittingStatus(newStatus);

    let coords = null;
    try {
      coords = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) reject(new Error("Geolocation not supported"));
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 15000 }
        );
      });
    } catch {
      console.warn("Could not get exact location");
    }

    try {
      const timestamp = new Date().toISOString();
      const newHistoryItem = { status: newStatus, timestamp, odometer: Number(statusOdo), location: coords };
      
      const existingHistory = selectedTrip.statusHistory || [{ status: selectedTrip.status || "Pending", timestamp: selectedTrip.createdAt || timestamp }];
      const updatedHistory = [...existingHistory, newHistoryItem];

      await updateDoc(doc(db, "bookings", selectedTrip.id), { 
        status: newStatus,
        statusHistory: updatedHistory,
        updatedAt: timestamp
      });

      await addDoc(collection(db, "truck_odo_logs"), {
        truckNumber: selectedTrip.vehicle || "Unknown",
        bookingId: selectedTrip.id,
        trackingId: selectedTrip.trackingId,
        driverName: loggedInDriverName,
        status: newStatus,
        odometer: Number(statusOdo),
        location: coords, 
        timestamp,
        createdAt: timestamp
      });
      await logActivity(db, {
        action: "trip_status_updated",
        module: "bookings",
        summary: `${loggedInDriverName} updated trip ${selectedTrip.trackingId || selectedTrip.id} to ${newStatus}`,
        targetId: selectedTrip.id,
        targetType: "booking",
        metadata: { odometer: Number(statusOdo), location: coords },
      });

      alert(`Status updated to: ${newStatus} ✅`);
      setShowStatusModal(false);
      setStatusOdo("");
      fetchMyTrips(); 
    } catch (error) {
      console.error(error);
      alert("Error updating status.");
    } finally {
      setIsSubmitting(false);
      setSubmittingStatus(null);
    }
  };

  const handleExpenseSubmit = async () => {
    if (!expenseForm.amount) return alert("Please enter the amount.");
    setIsSubmitting(true);
    try {
      const recordKey = `${loggedInDriverName}-${selectedTrip.trackingId || selectedTrip.id}-${Date.now()}`;
      const attachments = await uploadAttachments(expenseAttachmentFiles, "driver-expenses", recordKey);
      const payload = {
        date: new Date().toISOString().split("T")[0],
        category: expenseForm.type,
        amount: Number(expenseForm.amount),
        vehicleNumber: selectedTrip.vehicle,
        trackingId: selectedTrip.trackingId,
        bookingId: selectedTrip.id,
        driverName: loggedInDriverName,
        notes: expenseForm.description,
        deductionSource: expenseForm.deductionSource,
        createdAt: new Date().toISOString(),
        status: "Pending Approval",
        attachments,
      };
      const docRef = await addDoc(collection(db, "driver_submissions"), payload);
      await logActivity(db, {
        action: "driver_expense_submitted",
        module: "driver_expenses",
        summary: `${loggedInDriverName} submitted ${expenseForm.type} expense Rs ${Number(expenseForm.amount).toLocaleString("en-IN")}`,
        targetId: docRef.id,
        targetType: "driver_submission",
      });
      setDriverSubmissions((prev) => [...prev, { id: docRef.id, ...payload }]);
      if (expenseForm.deductionSource !== "driver_salary") {
        setDriverWallet((prev) => ({
          ...prev,
          pendingSpent: prev.pendingSpent + Number(expenseForm.amount),
          available: prev.givenByAdmin - prev.approvedSpent - (prev.pendingSpent + Number(expenseForm.amount)),
        }));
      }
      alert("Expense submitted to Admin! ✅");
      setShowExpenseModal(false);
      setExpenseForm({ type: "Petrol", amount: "", description: "", deductionSource: "admin_account" });
      setExpenseAttachmentFiles([]);
    } catch {
      alert("Error submitting expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/login"; 
  };

  // 🔥 EARNINGS CALCULATION LOGIC
  const currentMonthTrips = allTrips.filter(t => t.loadingDate && t.loadingDate.startsWith(earningsMonth));
  const salaryDeductionList = driverTransactions.filter(
    (transaction) =>
      transaction.deductionSource === "driver_salary" &&
      ((transaction.date || transaction.createdAt || "").startsWith(earningsMonth))
  );
  const pendingSalaryDeductionList = driverSubmissions.filter(
    (submission) =>
      submission.deductionSource === "driver_salary" &&
      ((submission.date || submission.createdAt || "").startsWith(earningsMonth))
  );
  const approvedSalaryDeductions = salaryDeductionList.reduce(
    (sum, transaction) => sum + Number(transaction.amount || 0),
    0
  );
  const pendingSalaryDeductions = pendingSalaryDeductionList.reduce(
    (sum, submission) => sum + Number(submission.amount || 0),
    0
  );
  const salaryDeductions = approvedSalaryDeductions + pendingSalaryDeductions;
  
  const salaryType = driverProfile?.salaryType || "fixed";
  const monthlyBookingAmount = currentMonthTrips.reduce(
    (sum, trip) => sum + (Number(trip.freight) || 0),
    0
  );
  const fixedMonthlySalary = salaryType === "commission" ? 0 : Number(driverProfile?.salary) || 0;
  const commissionRate = salaryType === "fixed" ? 0 : Number(driverProfile?.commissionRate) || 0;
  const monthlyCommissionEarned = monthlyBookingAmount * (commissionRate / 100);
  const grossMonthlyEarnings = fixedMonthlySalary + monthlyCommissionEarned;
  const totalMonthlyEarnings = grossMonthlyEarnings - salaryDeductions;

  const currentTrips = allTrips.filter(t => t.status !== "Booking Completed");
  const pastTrips = allTrips.filter(t => t.status === "Booking Completed");
  const displayTrips = activeTab === "current" ? currentTrips : pastTrips;

  return (
    <div className="driver-mobile-bg">
      <div className="driver-nav-pro">
        <div className="nav-profile-area">
          <div className="avatar-pro"><User size={24} /></div>
          <div className="nav-text">
            <span className="greeting">Welcome back,</span>
            <h3 className="driver-name">{loggedInDriverName}</h3>
          </div>
        </div>
        <div className="driver-nav-actions">
          <button className="driver-commission-nav" onClick={() => setShowEarningsModal(true)}>
            <span>Commission</span>
            <strong>Rs {formatMoney(totalMonthlyEarnings)}</strong>
          </button>
          <button className="logout-btn-pro" onClick={handleLogout}><LogOut size={22}/></button>
        </div>
      </div>

      {/* 🔥 NEW: EARNINGS WIDGET */}
      <section className="earnings-shell">
        <button className="driver-wallet-card" onClick={() => navigate("/driver-expense")}>
          <div className="driver-wallet-heading">
            <span>Expense Advance</span>
            <WalletCards size={22} />
          </div>
          <div className="driver-wallet-amount">
            <IndianRupee size={25} />
            <strong>{formatMoney(driverWallet.available)}</strong>
          </div>
          <div className="earnings-mini-grid driver-wallet-grid">
            <div>
              <span>Given</span>
              <strong>Rs {formatMoney(driverWallet.givenByAdmin)}</strong>
            </div>
            <div>
              <span>Spent</span>
              <strong>Rs {formatMoney(driverWallet.approvedSpent)}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>Rs {formatMoney(driverWallet.pendingSpent)}</strong>
            </div>
          </div>
        </button>
      </section>

      <div className="driver-tabs">
        <button className={`tab-btn ${activeTab === 'current' ? 'active' : ''}`} onClick={() => setActiveTab('current')}>
          <Truck size={18} /> Active Trips ({currentTrips.length})
        </button>
        <button className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`} onClick={() => setActiveTab('past')}>
          <CheckCircle size={18} /> Past Trips ({pastTrips.length})
        </button>
      </div>

      <div className="driver-container">
        {loading ? (
          <div className="loading">Loading your assigned trips...</div>
        ) : displayTrips.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={48} color="#10b981" />
            <p>No trips found in this category. You're all caught up!</p>
          </div>
        ) : (
          <div className="trip-list">
            {displayTrips.map(trip => {
              const allowedNext = getAllowedNextStatuses(trip.status || "Pending");
              
              return (
                <div className="mobile-trip-card" key={trip.id}>
                  <div className="trip-header">
                    <div>
                      <small className="card-label">TRIP ID / LR</small>
                      <span className="tracking-id">#{trip.trackingId}</span>
                      <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "#64748b" }}>LR: {trip.lrNumber || "N/A"}</p>
                    </div>
                    <span className="status-badge" style={{ 
                      background: trip.status === 'Delay' ? '#fee2e2' : (trip.status === 'Booking Completed' ? '#dcfce3' : '#dbeafe'),
                      color: trip.status === 'Delay' ? '#991b1b' : (trip.status === 'Booking Completed' ? '#166534' : '#1e40af'),
                      padding: "6px 12px", borderRadius: "20px", fontSize: "0.85rem", fontWeight: "bold"
                    }}>
                      {trip.status || "Pending"}
                    </span>
                  </div>

                  <div className="trip-route">
                    <div className="point">
                      <MapPin size={18} color="#3b82f6" />
                      <div>
                        <small>Loading Point</small>
                        <p>{trip.from}</p>
                      </div>
                    </div>
                    <div className="route-line"></div>
                    <div className="point">
                      <Navigation size={18} color="#10b981" />
                      <div>
                        <small>Unloading Point</small>
                        <p>{trip.to}</p>
                      </div>
                    </div>
                  </div>

                  <div className="trip-details">
                    <div className="detail"><Truck size={14}/> {trip.vehicle}</div>
                    <div className="detail"><Clock size={14}/> {trip.loadingDate}</div>
                  </div>

                  <div className="card-actions">
                    {activeTab === "current" && allowedNext.length > 0 && (
                      <button 
                        className="btn-action primary"
                        onClick={() => { setSelectedTrip(trip); setStatusOdo(""); setShowStatusModal(true); }}
                        style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, justifyContent: "center", padding: "12px", background: "#2563eb", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold" }}
                      >
                        <ArrowRightCircle size={18} /> Update Status
                      </button>
                    )}
                    
                    <button 
                      className="btn-action secondary"
                      onClick={() => { setSelectedTrip(trip); setExpenseAttachmentFiles([]); setShowExpenseModal(true); }}
                      style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, justifyContent: "center", padding: "12px", background: "#f59e0b", color: "white", borderRadius: "8px", border: "none", fontWeight: "bold" }}
                    >
                      <PlusCircle size={18} /> Add Expense
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🔥 NEW: EARNINGS BREAKDOWN MODAL */}
      {showEarningsModal && (
        <div className="modal-overlay earnings-overlay">
          <div className="modal-content earnings-modal">
            <div className="earnings-modal-header">
              <div>
                <h3>Earnings Breakdown</h3>
                <p>{earningsMonth}</p>
              </div>
              <button onClick={() => setShowEarningsModal(false)}><X size={24}/></button>
            </div>

            <div className="earnings-modal-body">
              <label className="earnings-month-picker">
                <span><Calendar size={14} /> Select Month</span>
                <input type="month" value={earningsMonth} onChange={(event) => setEarningsMonth(event.target.value)} />
              </label>

              <div className="pay-plan-strip">
                <span>Pay Plan</span>
                <strong>{getPayPlanLabel(salaryType)}</strong>
              </div>

              <div className="earnings-breakdown-grid">
                <div>
                  <span>Fixed Salary</span>
                  <strong>Rs {formatMoney(fixedMonthlySalary)}</strong>
                </div>
                <div>
                  <span>Booking Amount</span>
                  <strong>Rs {formatMoney(monthlyBookingAmount)}</strong>
                </div>
                <div>
                  <span>Commission Rate</span>
                  <strong>{commissionRate}%</strong>
                </div>
                <div>
                  <span>Commission Earned</span>
                  <strong>Rs {formatMoney(monthlyCommissionEarned)}</strong>
                </div>
                <div>
                  <span>Deductions</span>
                  <strong>Rs {formatMoney(salaryDeductions)}</strong>
                </div>
                <div>
                  <span>Net Payable</span>
                  <strong>Rs {formatMoney(totalMonthlyEarnings)}</strong>
                </div>
              </div>

              <div className="earnings-trip-section">
                <h4>Salary / Commission Deductions ({salaryDeductionList.length + pendingSalaryDeductionList.length})</h4>
                {salaryDeductionList.length + pendingSalaryDeductionList.length === 0 ? (
                  <p className="earnings-empty">No salary deductions for this month.</p>
                ) : (
                  <div className="earnings-trip-list">
                    {salaryDeductionList.map((transaction) => (
                      <div key={transaction.id} className="earnings-trip-row deduction-row">
                        <div>
                          <strong>{transaction.category || "Driver Expense Deduction"}</strong>
                          <small>{transaction.date || "-"} | {transaction.notes || "Deducted from salary/commission"}</small>
                        </div>
                        <div>
                          <span>Deducted</span>
                          <strong>- Rs {formatMoney(transaction.amount)}</strong>
                        </div>
                      </div>
                    ))}
                    {pendingSalaryDeductionList.map((submission) => (
                      <div key={submission.id} className="earnings-trip-row deduction-row">
                        <div>
                          <strong>{submission.category || "Driver Expense Deduction"}</strong>
                          <small>{submission.date || "-"} | Pending approval{submission.notes ? `: ${submission.notes}` : ""}</small>
                        </div>
                        <div>
                          <span>Pending</span>
                          <strong>- Rs {formatMoney(submission.amount)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="earnings-trip-section">
                <h4>Trips This Month ({currentMonthTrips.length})</h4>
                {currentMonthTrips.length === 0 ? (
                  <p className="earnings-empty">No trips logged this month yet.</p>
                ) : (
                  <div className="earnings-trip-list">
                    {currentMonthTrips.map(trip => {
                      const tripAmount = Number(trip.freight) || 0;
                      const tripComm = tripAmount * (commissionRate / 100);
                      return (
                        <div key={trip.id} className="earnings-trip-row">
                          <div>
                            <strong>#{trip.trackingId}</strong>
                            <small>{trip.loadingDate} | {trip.from || "-"} to {trip.to || "-"}</small>
                          </div>
                          <div>
                            <span>Freight: Rs {formatMoney(tripAmount)}</span>
                            <strong>+ Rs {formatMoney(tripComm)}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="earnings-grand-total">
                <span>Net Payable This Month</span>
                <strong>Rs {formatMoney(totalMonthlyEarnings)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS UPDATE MODAL */}
      {showStatusModal && selectedTrip && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-content" style={{ background: "white", width: "90%", maxWidth: "400px", padding: "20px", borderRadius: "12px", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 5px 0" }}>Update Trip Status</h3>
            <p style={{ margin: "0 0 20px 0", color: "#64748b" }}>For Trip #{selectedTrip.trackingId}</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ textAlign: "left" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "700", color: "#334155" }}>Odometer Reading (km)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter current odometer reading"
                  value={statusOdo}
                  disabled={isSubmitting}
                  onChange={(e) => setStatusOdo(e.target.value)}
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "1rem", boxSizing: "border-box" }}
                />
              </div>
              {getAllowedNextStatuses(selectedTrip.status || "Pending").map((statusOption) => (
                <button 
                  key={statusOption}
                  style={{
                    padding: "15px", background: statusOption === 'Delay' ? "#fee2e2" : "#dcfce3",
                    color: statusOption === 'Delay' ? "#991b1b" : "#166534", border: "none",
                    borderRadius: "8px", fontWeight: "bold", fontSize: "1rem",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                    opacity: isSubmitting && submittingStatus !== statusOption ? 0.5 : 1
                  }}
                  onClick={() => handleStatusUpdate(statusOption)}
                  disabled={isSubmitting}
                >
                  {submittingStatus === statusOption ? "📍 Updating..." : <>
                    {statusOption === 'Delay' ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
                    Mark as "{statusOption}"
                  </>}
                </button>
              ))}
            </div>

            <button disabled={isSubmitting} style={{ marginTop: "20px", padding: "12px", width: "100%", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontWeight: "bold" }} onClick={() => setShowStatusModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* EXPENSE MODAL */}
      {showExpenseModal && selectedTrip && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="modal-content" style={{ background: "white", width: "90%", maxWidth: "400px", padding: "20px", borderRadius: "12px" }}>
            <h3 style={{ margin: "0 0 5px 0" }}>Add Trip Expense</h3>
            <p style={{ margin: "0 0 20px 0", color: "#64748b" }}>For Trip: #{selectedTrip.trackingId}</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#334155" }}>Expense Type</label>
                <select style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} value={expenseForm.type} onChange={(e) => setExpenseForm({...expenseForm, type: e.target.value})}>
                  {DRIVER_TRIP_EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#334155" }}>Amount (₹)</label>
                <input style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} type="number" placeholder="Enter amount" value={expenseForm.amount} onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#334155" }}>Deduct From</label>
                <select style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} value={expenseForm.deductionSource} onChange={(e) => setExpenseForm({...expenseForm, deductionSource: e.target.value})}>
                  <option value="admin_account">Use My Advance / Company Account</option>
                  <option value="driver_salary">Deduct From My Commission</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold", color: "#334155" }}>Description</label>
                <input style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }} type="text" placeholder="e.g. Pump name, Toll plaza name" value={expenseForm.description} onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})} />
              </div>

              <AttachmentUploader
                files={expenseAttachmentFiles}
                onFilesChange={setExpenseAttachmentFiles}
                label="Expense Bill / Photo"
                hint="Take a photo or choose an image/PDF from your phone."
              />

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button style={{ flex: 1, padding: "12px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "8px", fontWeight: "bold" }} onClick={() => { setShowExpenseModal(false); setExpenseAttachmentFiles([]); }}>Cancel</button>
                <button style={{ flex: 1, padding: "12px", background: "#10b981", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold" }} onClick={handleExpenseSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverDashboard;
