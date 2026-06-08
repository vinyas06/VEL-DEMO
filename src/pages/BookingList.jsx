import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs, deleteDoc, updateDoc, doc } from "firebase/firestore";
import TruckLoader from "../components/TruckLoader";
import { 
  Search, MapPin, Package, Truck, User, Trash2, Calendar, 
  Edit, Activity, X, Printer, ChevronLeft, ChevronRight, Filter, Clock 
} from "lucide-react"; 
import { fetchCompanyProfile, getCompanyAddressLine, getTermsList } from "../utils/companyProfile";
import { logActivity } from "../utils/activityLog";
import { getCurrentMonthValue } from "../utils/dateRange";
import "./BookingList.css"; 

// 🔥 THE MASTER STATUS LIST (Admin can select any of these)
const ALL_STATUSES = [
  "Pending",
  "Moving Towards Load",
  "Loading",
  "In Transit",
  "Delay",
  "Reached Destination",
  "Unloading",
  "Delivered",
  "Booking Completed"
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const transactionBelongsToBooking = (transaction = {}, booking = {}) => {
  const bookingKeys = [booking.id, booking.trackingId, booking.lrNumber]
    .filter(Boolean)
    .map(normalizeKey);
  const transactionKeys = [
    transaction.bookingId,
    transaction.linkedBookingId,
    transaction.bookingTrackingId,
    transaction.trackingId,
    transaction.tripId,
    transaction.bookingLrNumber,
    transaction.lrNumber,
  ]
    .filter(Boolean)
    .map(normalizeKey);

  if (transactionKeys.some((key) => bookingKeys.includes(key))) {
    return true;
  }

  const voucherNo = normalizeKey(transaction.voucherNo);
  const referenceNo = normalizeKey(transaction.referenceNo);
  return bookingKeys.some((key) => key && (voucherNo.includes(key) || referenceNo.includes(key)));
};

const findLinkedTransactions = (transactions, booking, category, type) =>
  transactions.filter(
    (transaction) =>
      transaction.category === category &&
      transaction.type === type &&
      transactionBelongsToBooking(transaction, booking)
  );

function BookingList() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [parties, setParties] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [companySettings, setCompanySettings] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterMonth, setFilterMonth] = useState(getCurrentMonthValue());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [statusModal, setStatusModal] = useState({ show: false, id: null, currentStatus: "", nextStatus: "", history: [] });
  const [editModal, setEditModal] = useState({ show: false, id: null, formData: {} });
  const [lrModal, setLrModal] = useState({ show: false, data: null }); 

  const fetchData = async () => {
    try {
      const snapshot = await getDocs(collection(db, "bookings"));
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setBookings(data);

      const pSnap = await getDocs(collection(db, "parties"));
      const vSnap = await getDocs(collection(db, "vehicles"));
      const dSnap = await getDocs(collection(db, "drivers"));
      const aSnap = await getDocs(collection(db, "agents"));
      const accSnap = await getDocs(collection(db, "accounts"));
      const trxSnap = await getDocs(collection(db, "transactions"));
      const settings = await fetchCompanyProfile(db);

      setParties(pSnap.docs.map(d => d.data().name));
      setVehicles(vSnap.docs.map(d => d.data().number));
      setDrivers(dSnap.docs.map(d => d.data().name));
      setAgents(aSnap.docs.map(d => ({ name: d.data().name, phone: d.data().phone || "" })));
      setAccounts(accSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTransactions(trxSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCompanySettings(settings);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDate, filterMonth]);

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this booking? This cannot be undone.");
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, "bookings", id));
      setBookings(bookings.filter(b => b.id !== id));
      await logActivity(db, {
        action: "booking_deleted",
        module: "bookings",
        summary: `deleted booking ${id}`,
        targetId: id,
        targetType: "booking",
      });
    } catch {
      alert("Error deleting booking.");
    }
  };

  const openStatusModal = (booking) => {
    const history = booking.statusHistory || [{ status: booking.status || "Pending", timestamp: booking.createdAt || new Date().toISOString() }];
    const current = booking.status || "Pending";
    
    setStatusModal({
      show: true, 
      id: booking.id, 
      currentStatus: current,
      nextStatus: current, // Default dropdown to the current status
      history: history
    });
  };

  const handleUpdateStatus = async () => {
    if (!statusModal.nextStatus || statusModal.nextStatus === statusModal.currentStatus) {
      return alert("Please select a different status to update.");
    }

    try {
      const timestamp = new Date().toISOString();
      const newHistoryItem = { status: statusModal.nextStatus, timestamp };
      const updatedHistory = [...statusModal.history, newHistoryItem];

      await updateDoc(doc(db, "bookings", statusModal.id), { 
        status: statusModal.nextStatus,
        statusHistory: updatedHistory 
      });
      await logActivity(db, {
        action: "booking_status_updated",
        module: "bookings",
        summary: `updated booking ${statusModal.id} status to ${statusModal.nextStatus}`,
        targetId: statusModal.id,
        targetType: "booking",
        metadata: {
          status: statusModal.nextStatus,
        },
      });

      alert("Admin Status Updated Successfully! 🚚");
      setStatusModal({ show: false, id: null, currentStatus: "", nextStatus: "", history: [] });
      fetchData(); 
    } catch {
      alert("Error updating status.");
    }
  };

  const openEditModal = (booking) => {
    const advanceTransaction = findLinkedTransactions(transactions, booking, "Trip Advance", "IN")[0];
    const commissionTransaction = findLinkedTransactions(
      transactions,
      booking,
      "Commission Agent",
      "OUT"
    )[0];

    setEditModal({
      show: true,
      id: booking.id,
      formData: {
        ...booking,
        advanceAccount: advanceTransaction?.paymentAccount || "",
        commissionAccount:
          commissionTransaction?.paymentAccount ||
          (toNumber(booking.commission) > 0 ? "To Be Paid Later" : ""),
      },
    });
  };

  const syncBookingFinancialTransactions = async (previousBooking, updatedBooking) => {
    const linkedAdvanceTransactions = findLinkedTransactions(
      transactions,
      previousBooking,
      "Trip Advance",
      "IN"
    );
    const linkedCommissionTransactions = findLinkedTransactions(
      transactions,
      previousBooking,
      "Commission Agent",
      "OUT"
    );
    const advanceAmount = toNumber(updatedBooking.advance);
    const commissionAmount = toNumber(updatedBooking.commission);
    const timestamp = new Date().toISOString();

    if (advanceAmount > 0 && !updatedBooking.advanceAccount && !linkedAdvanceTransactions[0]?.paymentAccount) {
      throw new Error("Please select the account where the advance was received.");
    }

    if (
      commissionAmount > 0 &&
      updatedBooking.agent &&
      !updatedBooking.commissionAccount &&
      !linkedCommissionTransactions[0]?.paymentAccount
    ) {
      throw new Error("Please select the account for commission payment, or choose To Be Paid Later.");
    }

    if (advanceAmount > 0) {
      const advancePayload = {
        voucherNo: `ADV-${updatedBooking.trackingId}`,
        date: updatedBooking.loadingDate,
        partyName: updatedBooking.party,
        amount: advanceAmount,
        paymentAccount:
          updatedBooking.advanceAccount || linkedAdvanceTransactions[0]?.paymentAccount || "",
        referenceNo: `LR: ${updatedBooking.lrNumber || updatedBooking.trackingId}`,
        notes: "Trip Advance Received",
        type: "IN",
        category: "Trip Advance",
        bookingId: updatedBooking.id,
        bookingTrackingId: updatedBooking.trackingId || "",
        bookingLrNumber: updatedBooking.lrNumber || "",
        updatedAt: timestamp,
      };

      if (linkedAdvanceTransactions[0]) {
        await updateDoc(doc(db, "transactions", linkedAdvanceTransactions[0].id), advancePayload);
      } else {
        await addDoc(collection(db, "transactions"), { ...advancePayload, createdAt: timestamp });
      }
      await Promise.all(
        linkedAdvanceTransactions.slice(1).map((transaction) =>
          deleteDoc(doc(db, "transactions", transaction.id))
        )
      );
    } else {
      await Promise.all(
        linkedAdvanceTransactions.map((transaction) =>
          deleteDoc(doc(db, "transactions", transaction.id))
        )
      );
    }

    if (
      commissionAmount > 0 &&
      updatedBooking.agent &&
      updatedBooking.commissionAccount !== "To Be Paid Later"
    ) {
      const commissionPayload = {
        voucherNo: `COM-${updatedBooking.trackingId}`,
        date: updatedBooking.loadingDate,
        payeeName: updatedBooking.agent,
        amount: commissionAmount,
        paymentAccount:
          updatedBooking.commissionAccount || linkedCommissionTransactions[0]?.paymentAccount || "",
        referenceNo: `LR: ${updatedBooking.lrNumber || updatedBooking.trackingId}`,
        notes: "Broker Commission Paid",
        type: "OUT",
        category: "Commission Agent",
        bookingId: updatedBooking.id,
        bookingTrackingId: updatedBooking.trackingId || "",
        bookingLrNumber: updatedBooking.lrNumber || "",
        updatedAt: timestamp,
      };

      if (linkedCommissionTransactions[0]) {
        await updateDoc(doc(db, "transactions", linkedCommissionTransactions[0].id), commissionPayload);
      } else {
        await addDoc(collection(db, "transactions"), { ...commissionPayload, createdAt: timestamp });
      }
      await Promise.all(
        linkedCommissionTransactions.slice(1).map((transaction) =>
          deleteDoc(doc(db, "transactions", transaction.id))
        )
      );
    } else {
      await Promise.all(
        linkedCommissionTransactions.map((transaction) =>
          deleteDoc(doc(db, "transactions", transaction.id))
        )
      );
    }
  };

  const handleSaveEdit = async () => {
    try {
      const previousBooking = bookings.find((booking) => booking.id === editModal.id);
      if (!previousBooking) {
        return alert("Original booking data was not found. Please refresh and try again.");
      }

      const updatedBooking = {
        ...editModal.formData,
        id: editModal.id,
        freight: toNumber(editModal.formData.freight),
        advance: toNumber(editModal.formData.advance),
        commission: toNumber(editModal.formData.commission),
      };
      const bookingPayload = { ...updatedBooking };
      delete bookingPayload.advanceAccount;
      delete bookingPayload.commissionAccount;

      await updateDoc(doc(db, "bookings", editModal.id), bookingPayload);
      await syncBookingFinancialTransactions(previousBooking, updatedBooking);
      await logActivity(db, {
        action: "booking_updated",
        module: "bookings",
        summary: `edited booking ${editModal.id} and synced linked financial entries`,
        targetId: editModal.id,
        targetType: "booking",
        metadata: {
          previousFreight: previousBooking.freight || 0,
          updatedFreight: updatedBooking.freight,
          previousAdvance: previousBooking.advance || 0,
          updatedAdvance: updatedBooking.advance,
          previousCommission: previousBooking.commission || 0,
          updatedCommission: updatedBooking.commission,
        },
      });
      alert("Booking Updated Successfully! ✅");
      setEditModal({ show: false, id: null, formData: {} });
      fetchData(); 
    } catch (error) {
      console.error("Error updating booking:", error);
      alert(error.message || "Error updating booking.");
    }
  };

  const filteredBookings = bookings.filter(b => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      b.party?.toLowerCase().includes(searchLower) || 
      b.vehicle?.toLowerCase().includes(searchLower) || 
      b.lrNumber?.toLowerCase().includes(searchLower) ||
      b.trackingId?.toLowerCase().includes(searchLower);
    
    let matchesDate = true;
    if (filterDate) matchesDate = b.loadingDate === filterDate;
    let matchesMonth = true;
    if (filterMonth && !filterDate) matchesMonth = b.loadingDate?.startsWith(filterMonth);

    return matchesSearch && matchesDate && matchesMonth;
  });

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentBookings = filteredBookings.slice(startIndex, startIndex + itemsPerPage);

  const formatTime = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="list-page-bg">
      <div className="hide-on-print"><Navbar /></div>
      
      <div className="list-container hide-on-print">
        <div className="list-header" style={{ marginBottom: "1rem" }}>
          <div>
            <h2>Booking Directory</h2>
            <p>Manage, track, and print invoices. Current month is selected by default.</p>
          </div>
        </div>

        <div className="filter-bar">
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input type="text" placeholder="Search Party, Vehicle, ID or LR..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          
          <div className="filter-group">
            <div className="date-filter">
              <label><Filter size={14}/> Specific Date:</label>
              <input type="date" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setFilterMonth(""); }} />
            </div>
            <div className="date-filter">
              <label><Calendar size={14}/> Or Month:</label>
              <input type="month" value={filterMonth} onChange={(e) => { setFilterMonth(e.target.value); setFilterDate(""); }} />
            </div>
            {(filterDate || filterMonth || searchTerm) && (
              <button className="clear-btn" onClick={() => { setFilterDate(""); setFilterMonth(""); setSearchTerm(""); }}>Clear</button>
            )}
          </div>
        </div>

        {loading ? <TruckLoader text="Loading Active Bookings..." /> : (
          <>
            <div className="bookings-grid">
              {currentBookings.length === 0 ? (
                <div className="empty-state">No bookings match your search.</div>
              ) : (
                currentBookings.map((b) => (
                  <div className="booking-card" key={b.id}>
                    <div className="card-top">
                      <div className="card-top-left">
                        <span className="tracking-id">#{b.trackingId || "OLD"}</span>
                        <span className="status-badge" style={{ 
                          background: b.status === 'Delay' ? '#fee2e2' : (b.status === 'Booking Completed' ? '#dcfce3' : '#dbeafe'),
                          color: b.status === 'Delay' ? '#991b1b' : (b.status === 'Booking Completed' ? '#166534' : '#1e40af'),
                          padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold"
                        }}>
                          {b.status || "Pending"}
                        </span>
                      </div>
                      
                      <div className="action-buttons">
                        <button className="action-btn print-btn" onClick={() => setLrModal({ show: true, data: b })} title="Print Invoice / LR">
                          <Printer size={18} />
                        </button>
                        <button className="action-btn status-btn" onClick={() => openStatusModal(b)} title="Update Status">
                          <Activity size={18} />
                        </button>
                        <button className="action-btn edit-btn" onClick={() => openEditModal(b)} title="Edit Booking">
                          <Edit size={18} />
                        </button>
                        <button className="action-btn delete-btn" onClick={() => handleDelete(b.id)} title="Delete">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="route-info">
                      <div className="location"><MapPin size={16} className="text-blue" /><span>{b.from || "N/A"}</span></div>
                      <div className="route-line"></div>
                      <div className="location"><MapPin size={16} className="text-green" /><span>{b.to || "N/A"}</span></div>
                    </div>

                    <div className="details-grid">
                      <div className="detail-item"><User size={16} /><div><small>Party</small><p>{b.party || "-"}</p></div></div>
                      <div className="detail-item"><Truck size={16} /><div><small>Vehicle</small><p>{b.vehicle || "-"}</p></div></div>
                      <div className="detail-item"><Package size={16} /><div><small>Material</small><p>{b.material || "-"} ({b.weight ? `${b.weight}t` : '-'})</p></div></div>
                      <div className="detail-item"><Calendar size={16} /><div><small>Date & LR</small><p>{b.loadingDate || "-"} | LR: {b.lrNumber || "-"}</p></div></div>
                    </div>

                    {(b.podUrl || (Array.isArray(b.attachments) && b.attachments.length > 0)) && (
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "1rem" }}>
                        {b.podUrl && (
                          <a
                            href={b.podUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#166534", fontSize: "0.85rem", fontWeight: "800", background: "#dcfce3", padding: "4px 8px", borderRadius: "6px", textDecoration: "none", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            📄 View POD
                          </a>
                        )}
                        {Array.isArray(b.attachments) && b.attachments.map((attachment, index) => {
                          const url = typeof attachment === 'string' ? attachment : attachment.url;
                          if (!url) return null;
                          return (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#2563eb", fontSize: "0.85rem", fontWeight: "800", background: "#dbeafe", padding: "4px 8px", borderRadius: "6px", textDecoration: "none", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              📎 Document {index + 1}
                            </a>
                          );
                        })}
                      </div>
                    )}

                    <div className="card-footer">
                      <div className="financial-summary">
                        <span>Total: <strong>₹{b.freight || 0}</strong></span>
                        {b.advance > 0 && <span className="advance-tag">Adv: ₹{b.advance}</span>}
                        <span style={{ fontSize: "0.8rem", color: b.paymentMode === "Paid" ? "#166534" : "#b91c1c", fontWeight: "bold", background: b.paymentMode === "Paid" ? "#dcfce3" : "#fee2e2", padding: "2px 8px", borderRadius: "4px" }}>{b.paymentMode || "To Pay"}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={18}/> Prev</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next <ChevronRight size={18}/></button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ADMIN STATUS TIMELINE MODAL */}
      {statusModal.show && (
        <div className="modal-overlay hide-on-print">
          <div className="modal-box" style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <h3>Admin Status Control</h3>
              <button onClick={() => setStatusModal({show: false, history: []})}><X size={20}/></button>
            </div>
            <div className="modal-body">
              
              <div style={{ background: "#f8fafc", padding: "15px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "20px", maxHeight: "250px", overflowY: "auto" }}>
                <h4 style={{ margin: "0 0 10px 0", color: "#475569", fontSize: "0.9rem" }}>Status History</h4>
                {statusModal.history.map((h, i) => (
                  <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "12px", opacity: i === statusModal.history.length - 1 ? 1 : 0.6 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ background: i === statusModal.history.length - 1 ? "#2563eb" : "#94a3b8", width: "12px", height: "12px", borderRadius: "50%", marginTop: "4px" }}></div>
                      {i !== statusModal.history.length - 1 && <div style={{ width: "2px", height: "100%", background: "#cbd5e1", flexGrow: 1, marginTop: "4px" }}></div>}
                    </div>
                    <div>
                      <strong style={{ color: i === statusModal.history.length - 1 ? "#1e293b" : "#475569" }}>{h.status}</strong>
                      <div style={{ fontSize: "0.8rem", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}><Clock size={12}/> {formatTime(h.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ADMIN FREE-SELECT DROPDOWN */}
              <label style={{ fontWeight: "bold", fontSize: "0.9rem", color: "#334155" }}>Override / Log New Status:</label>
              <select 
                value={statusModal.nextStatus} 
                onChange={(e) => setStatusModal({...statusModal, nextStatus: e.target.value})} 
                className="modal-input"
                style={{ borderColor: "#3b82f6", borderWidth: "2px", width: "100%", padding: "10px", borderRadius: "6px", marginBottom: "10px", cursor: "pointer" }}
              >
                {ALL_STATUSES.map((statusOp, idx) => (
                  <option key={idx} value={statusOp}>{statusOp}</option>
                ))}
              </select>
              <button className="modal-submit-btn" style={{ width: "100%", padding: "12px", background: "#2563eb", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold" }} onClick={handleUpdateStatus}>Force Update Status</button>
            </div>
          </div>
        </div>
      )}

      {/* FULL EDIT MODAL */}
      {editModal.show && (
        <div className="modal-overlay hide-on-print">
          <div className="modal-box edit-modal" style={{ maxWidth: "800px" }}>
            <div className="modal-header">
              <h3>Edit Booking Details</h3>
              <button onClick={() => setEditModal({show: false})}><X size={20}/></button>
            </div>
            <div className="modal-body" style={{ maxHeight: "75vh", overflowY: "auto", padding: "20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                
                <div><label>LR Number</label><input className="modal-input" value={editModal.formData.lrNumber || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, lrNumber: e.target.value}})} /></div>
                <div><label>Loading Date</label><input type="date" className="modal-input" value={editModal.formData.loadingDate || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, loadingDate: e.target.value}})} /></div>
                
                <div>
                  <label>Customer / Party</label>
                  <select className="modal-input" value={editModal.formData.party || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, party: e.target.value}})}>
                    <option value="">-- Select --</option>
                    {parties.map((p, i) => <option key={i} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label>Vehicle</label>
                  <select className="modal-input" value={editModal.formData.vehicle || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, vehicle: e.target.value}})}>
                    <option value="">-- Select --</option>
                    {vehicles.map((v, i) => <option key={i} value={v}>{v}</option>)}
                  </select>
                </div>
                
                <div>
                  <label>Driver</label>
                  <select className="modal-input" value={editModal.formData.driver || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, driver: e.target.value}})}>
                    <option value="">-- Select --</option>
                    {drivers.map((d, i) => <option key={i} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label>Broker / Agent</label>
                  <select className="modal-input" value={editModal.formData.agent || ""} onChange={(e) => {
                    const agentName = e.target.value;
                    const selectedAgent = agents.find(a => a.name === agentName);
                    setEditModal({...editModal, formData: {...editModal.formData, agent: agentName, agentNo: selectedAgent ? selectedAgent.phone : editModal.formData.agentNo}});
                  }}>
                    <option value="">-- None --</option>
                    {agents.map((a, i) => <option key={i} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
                <div><label>Agent No.</label><input className="modal-input" value={editModal.formData.agentNo || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, agentNo: e.target.value}})} /></div>

                <div><label>From (Loading Point)</label><input className="modal-input" value={editModal.formData.from || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, from: e.target.value}})} /></div>
                <div><label>To (Unloading Point)</label><input className="modal-input" value={editModal.formData.to || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, to: e.target.value}})} /></div>

                <div><label>Pickup Party No.</label><input className="modal-input" value={editModal.formData.pickupPartyNo || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, pickupPartyNo: e.target.value}})} /></div>
                <div><label>Delivery Party No.</label><input className="modal-input" value={editModal.formData.deliveryPartyNo || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, deliveryPartyNo: e.target.value}})} /></div>

                <div><label>Material</label><input className="modal-input" value={editModal.formData.material || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, material: e.target.value}})} /></div>
                <div><label>Weight (Tons)</label><input type="number" className="modal-input" value={editModal.formData.weight || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, weight: e.target.value}})} /></div>

                <div><label>Distance (KM)</label><input type="number" className="modal-input" value={editModal.formData.billingDistance || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, billingDistance: e.target.value}})} /></div>
                <div>
                  <label>Freight Calculation</label>
                  <select className="modal-input" value={editModal.formData.rateType || "lumpSum"} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, rateType: e.target.value}})}>
                    <option value="perKm">Rate Per KM</option>
                    <option value="lumpSum">Fixed / Lump Sum</option>
                  </select>
                </div>

                <div><label>Total Freight (₹)</label><input type="number" className="modal-input" value={editModal.formData.freight || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, freight: Number(e.target.value)}})} /></div>
                <div>
                  <label>Payment Mode</label>
                  <select className="modal-input" value={editModal.formData.paymentMode || "To Pay"} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, paymentMode: e.target.value}})}>
                    <option value="To Pay">To Pay</option>
                    <option value="Paid">Paid (T.B.B)</option>
                  </select>
                </div>

                <div><label>Advance Paid (₹)</label><input type="number" className="modal-input" value={editModal.formData.advance || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, advance: Number(e.target.value)}})} /></div>
                <div><label>Agent Commission (₹)</label><input type="number" className="modal-input" value={editModal.formData.commission || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, commission: Number(e.target.value)}})} /></div>

                <div>
                  <label>Advance Received In Account</label>
                  <select className="modal-input" value={editModal.formData.advanceAccount || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, advanceAccount: e.target.value}})}>
                    <option value="">-- Select when advance is paid --</option>
                    {accounts.map((account) => <option key={account.id} value={account.accountName}>{account.accountName}</option>)}
                  </select>
                </div>
                <div>
                  <label>Commission Paid From Account</label>
                  <select className="modal-input" value={editModal.formData.commissionAccount || ""} onChange={(e) => setEditModal({...editModal, formData: {...editModal.formData, commissionAccount: e.target.value}})}>
                    <option value="">-- Select when commission is paid --</option>
                    <option value="To Be Paid Later">To Be Paid Later</option>
                    {accounts.map((account) => <option key={account.id} value={account.accountName}>{account.accountName}</option>)}
                  </select>
                </div>

              </div>
              <button className="modal-submit-btn full-width-btn" style={{ marginTop: "20px", background: "#2563eb", color: "white", padding: "12px", border: "none", borderRadius: "8px", width: "100%", fontWeight: "bold" }} onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* LR / INVOICE PRINT MODAL */}
      {lrModal.show && lrModal.data && (
        <div className="modal-overlay lr-overlay">
          <div className="lr-modal-box">
            <div className="hide-on-print lr-modal-actions">
              <button className="btn-print-action" onClick={() => window.print()}><Printer size={18}/> Print / Save PDF</button>
              <button className="btn-close-action" onClick={() => setLrModal({ show: false, data: null })}><X size={24}/></button>
            </div>
            
            <div id="printable-lr" className="lr-paper" style={{ background: "white", padding: "30px", color: "black", fontFamily: "Arial, sans-serif", border: "2px solid #000", maxWidth: "800px", margin: "0 auto" }}>
              <div style={{ textAlign: "center", borderBottom: "3px solid #000", paddingBottom: "15px", marginBottom: "20px" }}>
                <h1 style={{ margin: "0 0 5px 0", fontSize: "28px", textTransform: "uppercase", letterSpacing: "1px" }}>
                  {companySettings?.companyName || "Veerashaiva Express Logistics"}
                </h1>
                <p style={{ margin: "2px 0", fontSize: "14px", fontWeight: "bold" }}>
                  {companySettings?.tagline || "Enterprise Fleet & Freight Management"}
                </p>
                <p style={{ margin: "2px 0", fontSize: "12px" }}>
                  {getCompanyAddressLine(companySettings || undefined)}
                </p>
                {(companySettings?.gstNumber || companySettings?.panNumber) && (
                  <p style={{ margin: "2px 0", fontSize: "12px", fontWeight: "bold" }}>
                    GSTIN: {companySettings?.gstNumber || "N/A"} | PAN: {companySettings?.panNumber || "N/A"}
                  </p>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, fontSize: "20px", border: "2px solid #000", padding: "5px 15px", background: "#f1f5f9" }}>LORRY RECEIPT / FREIGHT BILL</h2>
                <div style={{ border: "2px solid #000", padding: "5px 15px", fontSize: "16px", fontWeight: "bold", background: lrModal.data.paymentMode === "Paid" ? "#dcfce3" : "#f1f5f9" }}>
                  PAYMENT: {lrModal.data.paymentMode ? lrModal.data.paymentMode.toUpperCase() : "TO PAY"}
                </div>
              </div>

              <div style={{ display: "flex", border: "1px solid #000", marginBottom: "20px", fontSize: "14px" }}>
                <div style={{ flex: 1, padding: "10px", borderRight: "1px solid #000" }}>
                  <p style={{ margin: "5px 0" }}><strong>LR No:</strong> {lrModal.data.lrNumber || "N/A"}</p>
                  <p style={{ margin: "5px 0" }}><strong>Date:</strong> {lrModal.data.loadingDate}</p>
                  <p style={{ margin: "5px 0" }}><strong>Tracking ID:</strong> {lrModal.data.trackingId}</p>
                </div>
                <div style={{ flex: 1, padding: "10px" }}>
                  <p style={{ margin: "5px 0" }}><strong>Vehicle No:</strong> {lrModal.data.vehicle}</p>
                  <p style={{ margin: "5px 0" }}><strong>Driver:</strong> {lrModal.data.driver}</p>
                  <p style={{ margin: "5px 0" }}><strong>Billed Party:</strong> {lrModal.data.party}</p>
                </div>
              </div>

              <div style={{ display: "flex", border: "1px solid #000", marginBottom: "20px", background: "#fafafa" }}>
                <div style={{ flex: 1, padding: "15px", borderRight: "1px solid #000" }}>
                  <h4 style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#555", textTransform: "uppercase" }}>From (Consignor)</h4>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>{lrModal.data.from}</p>
                </div>
                <div style={{ flex: 1, padding: "15px" }}>
                  <h4 style={{ margin: "0 0 5px 0", fontSize: "12px", color: "#555", textTransform: "uppercase" }}>To (Consignee)</h4>
                  <p style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>{lrModal.data.to}</p>
                </div>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: "20px", fontSize: "14px" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ border: "1px solid #000", padding: "10px", textAlign: "left" }}>Description of Goods (Material)</th>
                    <th style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>Weight / Qty</th>
                    <th style={{ border: "1px solid #000", padding: "10px", textAlign: "center" }}>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #000", padding: "15px 10px" }}>{lrModal.data.material || "General Freight"}</td>
                    <td style={{ border: "1px solid #000", padding: "15px 10px", textAlign: "center" }}>{lrModal.data.weight ? `${lrModal.data.weight} Tons` : "-"}</td>
                    <td style={{ border: "1px solid #000", padding: "15px 10px", textAlign: "center" }}>{lrModal.data.billingDistance ? `${lrModal.data.billingDistance} KM` : "-"}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ display: "flex", gap: "20px" }}>
                <div style={{ flex: 2, fontSize: "11px", paddingRight: "10px" }}>
                  <p style={{ fontWeight: "bold", margin: "0 0 5px 0" }}>Terms & Conditions:</p>
                  <ol style={{ paddingLeft: "15px", margin: 0, color: "#444" }}>
                    {getTermsList(companySettings || undefined).map((term) => (
                      <li key={term}>{term}</li>
                    ))}
                  </ol>
                </div>

                <div style={{ flex: 1 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", fontSize: "14px" }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: "8px", border: "1px solid #000", background: "#f1f5f9" }}>Total Freight</td>
                        <td style={{ padding: "8px", border: "1px solid #000", textAlign: "right", fontWeight: "bold" }}>₹ {lrModal.data.freight || 0}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "8px", border: "1px solid #000" }}>Advance Paid</td>
                        <td style={{ padding: "8px", border: "1px solid #000", textAlign: "right" }}>(-) ₹ {lrModal.data.advance || 0}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "10px 8px", border: "1px solid #000", background: "#f1f5f9", fontWeight: "bold" }}>Net Balance</td>
                        <td style={{ padding: "10px 8px", border: "1px solid #000", textAlign: "right", fontWeight: "bold", fontSize: "16px" }}>
                          ₹ {(Number(lrModal.data.freight) || 0) - (Number(lrModal.data.advance) || 0)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "50px", fontSize: "12px", fontWeight: "bold", textAlign: "center" }}>
                <div><div style={{ borderTop: "1px solid #000", width: "150px", margin: "0 auto 5px auto" }}></div>Consignor Signature</div>
                <div><div style={{ borderTop: "1px solid #000", width: "150px", margin: "0 auto 5px auto" }}></div>Driver Signature</div>
                <div><div style={{ borderTop: "1px solid #000", width: "150px", margin: "0 auto 5px auto" }}></div>Authorised Signatory</div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BookingList;
