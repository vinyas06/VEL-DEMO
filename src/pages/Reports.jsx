import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  ArrowLeft, Calendar, Download, FileText, Filter, FileOutput, 
  ChevronRight, Star, CircleDollarSign, Landmark, Truck, Wallet, Search, Receipt
} from "lucide-react";
import { getCurrentMonthRange } from "../utils/dateRange";
import "./Reports.css"; 

// --- 1. FULL LOGISTICS REPORT CATEGORIES ---
const REPORT_CATEGORIES = [
  {
    title: "Financial & Cash Flow",
    reports: [
      { id: "pay_in", name: "Payment In (Receipts)" },
      { id: "pay_out", name: "Payment Out (Debits)" },
      { id: "expenses", name: "Expense Register" },
      { id: "trip_profit_loss", name: "Trip Profit & Loss" },
    ]
  },
  {
    title: "Operations & Freight",
    reports: [
      { id: "all_bookings", name: "All Bookings & Freight" },
      { id: "estimates", name: "Estimates & Quotations" },
    ]
  },
  {
    title: "Ledgers & Statements",
    reports: [
      { id: "party_ledger", name: "Party Ledger Statement" },
      { id: "agent_commission", name: "Agent Commission Ledger" }
    ]
  }
];

// --- 2. HELPER FUNCTIONS ---
const formatCurrency = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const getTimestamp = (record = {}) => {
  for (const v of [record.createdAt, record.date, record.loadingDate, record.dateRequested]) {
    if (!v) continue;
    const p = new Date(v).getTime();
    if (Number.isFinite(p)) return p;
  }
  return 0;
};

const getTransactionName = (t = {}) => t.partyName || t.payeeName || t.targetName || t.payee || t.party || "General";
const getTransactionAccount = (t = {}) => t.paymentAccount || t.paymentMode || t.accountName || "-";
const normalizeKey = (value) => String(value || "").trim().toLowerCase();
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const getBookingKeys = (booking = {}) =>
  [booking.id, booking.trackingId, booking.lrNumber].filter(Boolean).map(normalizeKey);
const getTransactionBookingKeys = (transaction = {}) =>
  [
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
const transactionMatchesBooking = (transaction, booking) => {
  const bookingKeys = new Set(getBookingKeys(booking));
  const transactionKeys = getTransactionBookingKeys(transaction);

  if (transactionKeys.some((key) => bookingKeys.has(key))) {
    return true;
  }

  const voucherNo = normalizeKey(transaction.voucherNo);
  const referenceNo = normalizeKey(transaction.referenceNo);
  const notes = normalizeKey(transaction.notes);
  const trackingId = normalizeKey(booking.trackingId);
  const lrNumber = normalizeKey(booking.lrNumber);

  return (
    (trackingId && (voucherNo.includes(trackingId) || referenceNo.includes(trackingId) || notes.includes(trackingId))) ||
    (lrNumber && (referenceNo.includes(lrNumber) || notes.includes(lrNumber)))
  );
};
const csvEscape = (value) => {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

function Reports() {
  const currentMonthRange = getCurrentMonthRange();
  const [selectedReport, setSelectedReport] = useState(null);
  
  // Data State
  const [transactions, setTransactions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState(currentMonthRange.fromDate);
  const [toDate, setToDate] = useState(currentMonthRange.toDate);

  // --- 3. FETCH ALL DATA ONCE ---
  useEffect(() => {
    const fetchReportsData = async () => {
      try {
        const [bookingsSnap, transactionsSnap, estimatesSnap] = await Promise.all([
          getDocs(collection(db, "bookings")),
          getDocs(collection(db, "transactions")),
          getDocs(collection(db, "estimates")),
        ]);

        setBookings(bookingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => getTimestamp(b) - getTimestamp(a)));
        setTransactions(transactionsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => getTimestamp(b) - getTimestamp(a)));
        setEstimates(estimatesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => getTimestamp(b) - getTimestamp(a)));
      } catch (error) {
        console.error("Error fetching reports data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReportsData();
  }, []);

  // --- 4. GLOBAL DATE & SEARCH FILTERS ---
  const applyFilters = (record) => {
    const timestamp = getTimestamp(record);
    const recordDate = timestamp > 0 ? new Date(timestamp).toISOString().slice(0, 10) : "";
    
    // Date Filter
    if (fromDate && recordDate && recordDate < fromDate) return false;
    if (toDate && recordDate && recordDate > toDate) return false;

    // Search Filter
    if (searchTerm) {
      const searchString = Object.values(record).join(" ").toLowerCase();
      if (!searchString.includes(searchTerm.toLowerCase())) return false;
    }

    return true;
  };

  // Filtered Datasets based on active report
  const filteredTransactions = transactions.filter(applyFilters);
  const filteredBookings = bookings.filter(applyFilters);
  const filteredEstimates = estimates.filter(applyFilters);

  // Specific Data Cuts
  const payIn = filteredTransactions.filter(t => t.type === "IN");
  const payOut = filteredTransactions.filter(t => t.type === "OUT" && t.category !== "Expense");
  const expenses = filteredTransactions.filter(t => t.type === "EXPENSE" || t.category === "Expense");
  const tripProfitLoss = filteredBookings.map((booking) => {
    const tripTransactions = transactions.filter((transaction) => transactionMatchesBooking(transaction, booking));
    const payInTotal = tripTransactions
      .filter((transaction) => transaction.type === "IN")
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const payOutTotal = tripTransactions
      .filter((transaction) => transaction.type === "OUT")
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const expenseTotal = tripTransactions
      .filter((transaction) => transaction.type === "EXPENSE" || transaction.category === "Expense")
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const advanceFallback =
      payInTotal === 0 && toNumber(booking.advance) > 0 ? toNumber(booking.advance) : 0;
    const commissionFallback =
      !tripTransactions.some((transaction) => transaction.category === "Commission Agent") && toNumber(booking.commission) > 0
        ? toNumber(booking.commission)
        : 0;
    const totalIn = payInTotal + advanceFallback;
    const totalOut = payOutTotal + commissionFallback;

    return {
      ...booking,
      payInTotal: totalIn,
      payOutTotal: totalOut,
      expenseTotal,
      totalCost: totalOut + expenseTotal,
      profit: totalIn - totalOut - expenseTotal,
      transactionCount: tripTransactions.length,
    };
  });
  const tripProfitTotals = tripProfitLoss.reduce(
    (summary, trip) => ({
      freight: summary.freight + toNumber(trip.freight),
      payIn: summary.payIn + trip.payInTotal,
      payOut: summary.payOut + trip.payOutTotal,
      expense: summary.expense + trip.expenseTotal,
      profit: summary.profit + trip.profit,
    }),
    { freight: 0, payIn: 0, payOut: 0, expense: 0, profit: 0 }
  );

  // Ledger Generators
  const partyLedger = Array.from(new Set(filteredTransactions.map(getTransactionName))).map(party => {
    const txns = filteredTransactions.filter(t => getTransactionName(t) === party);
    const received = txns.filter(t => t.type === "IN").reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const paid = txns.filter(t => t.type !== "IN").reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    return { party, received, paid, balance: received - paid, count: txns.length };
  });

  // --- 5. EXPORT TO EXCEL ---
  const downloadFilteredReport = () => {
    let rows = [];
    let headers = [];
    let dataToExport = [];

    if (["pay_in", "pay_out", "expenses"].includes(selectedReport.id)) {
      headers = ["Date", "Voucher No", "Party/Payee", "Category", "Account", "Notes", "Amount"];
      dataToExport = selectedReport.id === "pay_in" ? payIn : selectedReport.id === "pay_out" ? payOut : expenses;
      rows = dataToExport.map(t => [t.date || "", t.voucherNo || "", getTransactionName(t), t.category || "", getTransactionAccount(t), t.notes || "", Number(t.amount) || 0]);
    } 
    else if (selectedReport.id === "all_bookings") {
      headers = ["Date", "Tracking ID", "LR No", "Party", "Vehicle", "From", "To", "Freight", "Advance", "Status"];
      dataToExport = filteredBookings;
      rows = dataToExport.map(b => [b.loadingDate || b.createdAt || "", b.trackingId || "", b.lrNumber || "", b.party || "", b.vehicle || "", b.from || "", b.to || "", Number(b.freight) || 0, Number(b.advance) || 0, b.status || ""]);
    }
    else if (selectedReport.id === "trip_profit_loss") {
      headers = ["Date", "Tracking ID", "LR No", "Party", "Vehicle", "Freight", "Pay In", "Pay Out", "Expense", "Profit/Loss"];
      dataToExport = tripProfitLoss;
      rows = dataToExport.map(b => [b.loadingDate || b.createdAt || "", b.trackingId || "", b.lrNumber || "", b.party || "", b.vehicle || "", Number(b.freight) || 0, b.payInTotal, b.payOutTotal, b.expenseTotal, b.profit]);
    }
    else if (selectedReport.id === "estimates") {
      headers = ["Date", "Estimate ID", "Party", "From", "To", "Material", "Freight Status"];
      dataToExport = filteredEstimates;
      rows = dataToExport.map(e => [e.dateRequested || e.createdAt || "", e.estimateId || "", e.party || "", e.from || "", e.to || "", e.material || "", Number(e.freight) || 0]);
    }
    else if (selectedReport.id === "party_ledger" || selectedReport.id === "agent_commission") {
      headers = ["Party / Agent Name", "Transactions Count", "Total Received (IN)", "Total Paid (OUT)", "Net Balance"];
      dataToExport = partyLedger;
      rows = dataToExport.map(p => [p.party, p.count, p.received, p.paid, p.balance]);
    }

    if (rows.length === 0) return alert("No data to export!");

    const csvContent = [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${selectedReport.name}_Export.csv`;
    link.click();
  };

  // --- RENDER 1: INSIDE SPECIFIC REPORT ---
  if (selectedReport) {
    
    // Determine active dataset length for empty state checks
    let activeDataLength = 0;
    if (selectedReport.id === "pay_in") activeDataLength = payIn.length;
    else if (selectedReport.id === "pay_out") activeDataLength = payOut.length;
    else if (selectedReport.id === "expenses") activeDataLength = expenses.length;
    else if (selectedReport.id === "trip_profit_loss") activeDataLength = tripProfitLoss.length;
    else if (selectedReport.id === "all_bookings") activeDataLength = filteredBookings.length;
    else if (selectedReport.id === "estimates") activeDataLength = filteredEstimates.length;
    else if (selectedReport.id === "party_ledger" || selectedReport.id === "agent_commission") activeDataLength = partyLedger.length;

    return (
      <div className="dashboard-page">
        <Navbar />
        <div className="dashboard-container">
          
          <div className="admin-form-card" style={{ padding: 0, overflow: "hidden", maxWidth: "1100px", margin: "0 auto", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            
            {/* REPORT HEADER */}
            <div style={{ backgroundColor: "white", padding: "15px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <ArrowLeft size={24} color="#334155" style={{ cursor: "pointer" }} onClick={() => {setSelectedReport(null); setSearchTerm("");}} />
                <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#1e293b", fontWeight: "600" }}>{selectedReport.name}</h2>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={downloadFilteredReport} disabled={activeDataLength === 0} style={{ border: "none", padding: "8px 12px", backgroundColor: "#f0fdf4", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", color: "#16a34a", fontWeight: "bold" }}>
                  <FileText size={18} /> Export XLS
                </button>
              </div>
            </div>

            {/* FILTERS BAR */}
            <div style={{ backgroundColor: "#f8fafc", padding: "12px 20px", display: "flex", alignItems: "center", gap: "15px", borderBottom: "1px solid #e2e8f0", fontSize: "0.9rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#475569", fontWeight: "bold" }}>
                <Calendar size={18} color="#2563eb" /> Date Range:
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: "4px", padding: "4px 8px", outline: "none", fontWeight: "normal" }} />
                <span> TO </span>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ border: "1px solid #cbd5e1", borderRadius: "4px", padding: "4px 8px", outline: "none", fontWeight: "normal" }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", background: "white", border: "1px solid #cbd5e1", borderRadius: "20px", padding: "4px 12px", marginLeft: "auto" }}>
                <Search size={14} color="#64748b" style={{ marginRight: "5px" }} />
                <input type="text" placeholder="Search this report..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: "none", outline: "none", background: "transparent", fontSize: "0.9rem", width: "180px" }} />
              </div>
            </div>

            {/* CONTENT RENDERER */}
            <div style={{ padding: "20px", minHeight: "500px", backgroundColor: "#f1f5f9" }}>
              {loading ? (
                <div style={{ textAlign: "center", marginTop: "100px", color: "#64748b" }}>Loading report data...</div>
              ) : activeDataLength === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: "80px", textAlign: "center" }}>
                  <div style={{ position: "relative", marginBottom: "20px", opacity: 0.8 }}>
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#bae6fd" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  </div>
                  <h3 style={{ margin: "0 0 8px 0", color: "#334155", fontSize: "1.2rem", fontWeight: "600" }}>No Data Available</h3>
                  <p style={{ margin: 0, color: "#64748b", maxWidth: "300px", fontSize: "0.95rem" }}>No matching records found for the selected dates or search term.</p>
                </div>
              ) : (
                <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", overflowX: "auto" }}>
                  <table className="reports-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                    
                    {/* TABLE HEADERS based on report type */}
                    <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      <tr>
                        {["pay_in", "pay_out", "expenses"].includes(selectedReport.id) && (
                          <><th>Date & Voucher</th><th>Party / Payee</th><th>Category</th><th>Account</th><th>Amount</th></>
                        )}
                        {selectedReport.id === "trip_profit_loss" && (
                          <><th>Trip</th><th>Party & Vehicle</th><th>Freight</th><th>Pay In</th><th>Pay Out</th><th>Expense</th><th>Profit/Loss</th></>
                        )}
                        {selectedReport.id === "all_bookings" && (
                          <><th>Date & LR No</th><th>Party & Vehicle</th><th>Route Details</th><th>Financials</th><th>Status</th></>
                        )}
                        {selectedReport.id === "estimates" && (
                          <><th>Date & ID</th><th>Party</th><th>Route</th><th>Material</th><th>Est. Freight</th></>
                        )}
                        {(selectedReport.id === "party_ledger" || selectedReport.id === "agent_commission") && (
                          <><th>Entity Name</th><th>Transactions</th><th>Received (IN)</th><th>Paid (OUT)</th><th>Net Balance</th></>
                        )}
                      </tr>
                    </thead>

                    {/* TABLE BODY */}
                    <tbody>
                      {/* TRANSACTIONS RENDERER */}
                      {["pay_in", "pay_out", "expenses"].includes(selectedReport.id) && (selectedReport.id === "pay_in" ? payIn : selectedReport.id === "pay_out" ? payOut : expenses).map((t) => (
                        <tr key={t.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px" }}><strong>{t.date || "-"}</strong><br/><span style={{color: "#64748b", fontSize: "0.8rem"}}>{t.voucherNo || "No Voucher"}</span></td>
                          <td style={{ padding: "12px" }}>{getTransactionName(t)}</td>
                          <td style={{ padding: "12px" }}>{t.category || "General"}</td>
                          <td style={{ padding: "12px" }}>{getTransactionAccount(t)}</td>
                          <td style={{ padding: "12px", fontWeight: "bold", color: selectedReport.id === "pay_in" ? "#16a34a" : "#dc2626" }}>{formatCurrency(t.amount)}</td>
                        </tr>
                      ))}

                      {selectedReport.id === "trip_profit_loss" && (
                        <>
                          <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", fontWeight: "bold" }}>
                            <td style={{ padding: "12px" }} colSpan={2}>Totals</td>
                            <td style={{ padding: "12px" }}>{formatCurrency(tripProfitTotals.freight)}</td>
                            <td style={{ padding: "12px", color: "#16a34a" }}>{formatCurrency(tripProfitTotals.payIn)}</td>
                            <td style={{ padding: "12px", color: "#dc2626" }}>{formatCurrency(tripProfitTotals.payOut)}</td>
                            <td style={{ padding: "12px", color: "#dc2626" }}>{formatCurrency(tripProfitTotals.expense)}</td>
                            <td style={{ padding: "12px", color: tripProfitTotals.profit >= 0 ? "#16a34a" : "#dc2626" }}>{formatCurrency(tripProfitTotals.profit)}</td>
                          </tr>
                          {tripProfitLoss.map((trip) => (
                            <tr key={trip.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "12px" }}>
                                <strong>{trip.trackingId || trip.id}</strong><br/>
                                <span style={{ color: "#64748b", fontSize: "0.8rem" }}>LR: {trip.lrNumber || "-"} | {trip.loadingDate || "-"}</span>
                              </td>
                              <td style={{ padding: "12px" }}>
                                <strong>{trip.party || "-"}</strong><br/>
                                <span style={{ color: "#64748b", fontSize: "0.8rem" }}>{trip.vehicle || "-"} | {trip.from || "-"} to {trip.to || "-"}</span>
                              </td>
                              <td style={{ padding: "12px", fontWeight: "bold" }}>{formatCurrency(trip.freight)}</td>
                              <td style={{ padding: "12px", color: "#16a34a", fontWeight: "bold" }}>{formatCurrency(trip.payInTotal)}</td>
                              <td style={{ padding: "12px", color: "#dc2626", fontWeight: "bold" }}>{formatCurrency(trip.payOutTotal)}</td>
                              <td style={{ padding: "12px", color: "#dc2626", fontWeight: "bold" }}>{formatCurrency(trip.expenseTotal)}</td>
                              <td style={{ padding: "12px", color: trip.profit >= 0 ? "#16a34a" : "#dc2626", fontWeight: "bold" }}>
                                {formatCurrency(trip.profit)}
                              </td>
                            </tr>
                          ))}
                        </>
                      )}

                      {/* BOOKINGS RENDERER */}
                      {selectedReport.id === "all_bookings" && filteredBookings.map((b) => (
                        <tr key={b.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px" }}><strong>{b.loadingDate || "-"}</strong><br/><span style={{color: "#64748b", fontSize: "0.8rem"}}>LR: {b.lrNumber || b.trackingId}</span></td>
                          <td style={{ padding: "12px" }}><strong>{b.party}</strong><br/><span style={{color: "#64748b", fontSize: "0.8rem"}}>{b.vehicle}</span></td>
                          <td style={{ padding: "12px" }}>From: {b.from}<br/>To: {b.to}</td>
                          <td style={{ padding: "12px" }}>Fr: {formatCurrency(b.freight)}<br/><span style={{color: "#16a34a", fontSize: "0.8rem"}}>Adv: {formatCurrency(b.advance)}</span></td>
                          <td style={{ padding: "12px" }}><span style={{ background: "#e0e7ff", color: "#3730a3", padding: "4px 8px", borderRadius: "4px", fontSize: "0.8rem", fontWeight: "bold" }}>{b.status || "Pending"}</span></td>
                        </tr>
                      ))}

                      {/* ESTIMATES RENDERER */}
                      {selectedReport.id === "estimates" && filteredEstimates.map((e) => (
                        <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px" }}><strong>{e.dateRequested || "-"}</strong><br/><span style={{color: "#64748b", fontSize: "0.8rem"}}>ID: {e.estimateId}</span></td>
                          <td style={{ padding: "12px" }}>{e.party}</td>
                          <td style={{ padding: "12px" }}>{e.from} → {e.to}</td>
                          <td style={{ padding: "12px" }}>{e.material || "N/A"}</td>
                          <td style={{ padding: "12px", fontWeight: "bold" }}>{formatCurrency(e.freight)}</td>
                        </tr>
                      ))}

                      {/* LEDGER RENDERER */}
                      {(selectedReport.id === "party_ledger" || selectedReport.id === "agent_commission") && partyLedger.filter(p => selectedReport.id === "agent_commission" ? p.party.toLowerCase().includes("agent") || p.party.toLowerCase().includes("broker") : true).map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px", fontWeight: "bold", fontSize: "1rem" }}>{p.party}</td>
                          <td style={{ padding: "12px" }}>{p.count} Entries</td>
                          <td style={{ padding: "12px", color: "#16a34a", fontWeight: "bold" }}>{formatCurrency(p.received)}</td>
                          <td style={{ padding: "12px", color: "#dc2626", fontWeight: "bold" }}>{formatCurrency(p.paid)}</td>
                          <td style={{ padding: "12px", color: p.balance >= 0 ? "#16a34a" : "#dc2626", fontWeight: "bold", fontSize: "1rem" }}>{formatCurrency(p.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER 2: MAIN MENU LIST ---
  return (
    <div className="dashboard-page">
      <Navbar />
      <div className="dashboard-container">
        
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <div style={{ backgroundColor: "white", padding: "20px", display: "flex", alignItems: "center", borderBottom: "1px solid #e2e8f0", marginBottom: "25px", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
            <h1 style={{ margin: 0, fontSize: "1.6rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "10px" }}><Receipt size={28} color="#2563eb" /> Reports Center</h1>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
            {REPORT_CATEGORIES.map((category, catIndex) => (
              <div key={catIndex} style={{ backgroundColor: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
                <div style={{ backgroundColor: "#f8fafc", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#334155", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }}>{category.title}</h3>
                </div>
                <div>
                  {category.reports.map((report, repIndex) => (
                    <div 
                      key={report.id} 
                      onClick={() => setSelectedReport(report)}
                      style={{ 
                        padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", 
                        borderBottom: repIndex !== category.reports.length - 1 ? "1px solid #f1f5f9" : "none",
                        cursor: "pointer", transition: "all 0.2s"
                      }}
                      onMouseEnter={(e) => {e.currentTarget.style.backgroundColor = "#eff6ff"; e.currentTarget.style.paddingLeft = "25px";}}
                      onMouseLeave={(e) => {e.currentTarget.style.backgroundColor = "white"; e.currentTarget.style.paddingLeft = "20px";}}
                    >
                      <span style={{ fontSize: "1rem", color: "#1e293b", fontWeight: "500" }}>{report.name}</span>
                      <ChevronRight size={18} color="#94a3b8" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default Reports;
