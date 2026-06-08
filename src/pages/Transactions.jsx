import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { ArrowDownLeft, ArrowUpRight, Wallet, Printer, Download, Calendar, Edit, Save, Trash2, X } from "lucide-react";
import { fetchCompanyProfile } from "../utils/companyProfile";
import { getCurrentMonthValue, getRecordDateInput } from "../utils/dateRange";
import { isMoneyInTransaction } from "../utils/finance";
import { getDriverMonthSummary, getDriverCarryForwardToMonth } from "../utils/driverSalary";
import { logActivity } from "../utils/activityLog";
import "./BookingList.css"; 

const EXPENSE_CATEGORIES = [
  { value: "Petrol", label: "Petrol / Diesel", target: "trip" },
  { value: "Fastag", label: "FASTag / Toll", target: "trip" },
  { value: "Office Expense", label: "Office Expense", target: "office" },
  { value: "Hamali/Labour Loading Unloading", label: "Hamali / Labour Loading-Unloading", target: "trip" },
  { value: "Police Fine", label: "Police Fine", target: "trip" },
  { value: "Check Post Police Tips", label: "Check Post / Police Tips", target: "trip" },
  { value: "Loan EMI", label: "Loan EMI", target: "loan" },
  { value: "Driver Salary", label: "Driver Salary", target: "driver" },
  { value: "Driver Batta", label: "Driver Batta", target: "driver", hasDeductionSource: true },
  { value: "Trip Allowance", label: "Trip Allowance", target: "trip" },
  { value: "Vehicle Maintenance", label: "Vehicle Maintenance", target: "vehicle" },
  { value: "AdBlue", label: "AdBlue", target: "trip" },
];

const PAY_IN_CATEGORIES = [
  { value: "Party Receipt", label: "Party Receipt" },
  { value: "Trip Advance", label: "Trip Advance" },
  { value: "Owner Credit / Loan", label: "Owner Credit / Personal Loan" },
];

const PAY_OUT_CATEGORIES = [
  { value: "Commission Agent", label: "Broker / Commission Agent", payeeSource: "agents" },
  { value: "Direct Party / Vendor", label: "Direct Party / Vendor", payeeSource: "parties" },
];

const getValidTime = (value) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getTransactionSortTime = (transaction = {}) => {
  const dateTime = getValidTime(transaction.date);
  const createdTime = getValidTime(transaction.createdAt);

  if (dateTime && createdTime) {
    const dateKey = new Date(dateTime).toISOString().slice(0, 10);
    const createdKey = new Date(createdTime).toISOString().slice(0, 10);
    return dateKey === createdKey ? createdTime : dateTime;
  }

  return dateTime || createdTime || getValidTime(transaction.updatedAt);
};

function TransactionList() {
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [parties, setParties] = useState([]);
  const [agents, setAgents] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loans, setLoans] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("All");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [filterMonth, setFilterMonth] = useState(getCurrentMonthValue());
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState({});
  const [receiptModal, setReceiptModal] = useState({ open: false, transaction: null });
  const [editModal, setEditModal] = useState({ open: false, transactionId: null, form: {} });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accSnap, trxSnap, partySnap, agentSnap, driverSnap, bookingSnap, vehicleSnap, loanSnap, subSnap] =
          await Promise.all([
            getDocs(collection(db, "accounts")),
            getDocs(collection(db, "transactions")),
            getDocs(collection(db, "parties")),
            getDocs(collection(db, "agents")),
            getDocs(collection(db, "drivers")),
            getDocs(collection(db, "bookings")),
            getDocs(collection(db, "vehicles")),
            getDocs(collection(db, "loans")),
            getDocs(collection(db, "driver_submissions")),
          ]);

        setAccounts(accSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTransactions(trxSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setParties(partySnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
        setAgents(agentSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
        setDrivers(driverSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
        setBookings(bookingSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => new Date(b.loadingDate || b.createdAt || 0) - new Date(a.loadingDate || a.createdAt || 0)));
        setVehicles(vehicleSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.number || "").localeCompare(b.number || "")));
        setLoans(loanSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.loanName || "").localeCompare(b.loanName || "")));
        setSubmissions(subSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        setCompanySettings(await fetchCompanyProfile(db));
      } catch (error) {
        console.error("Error fetching ledger:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter transactions based on selected account, month, and category
  const filteredTrx = transactions.filter((transaction) => {
    const accountMatches =
      selectedAccount === "All" ||
      transaction.paymentAccount === selectedAccount ||
      transaction.paymentMode === selectedAccount;
    const dateValue = getRecordDateInput(transaction, ["date", "createdAt"]);
    const monthMatches = !filterMonth || dateValue.startsWith(filterMonth);
    const categoryMatches = selectedCategoryFilter === "All" || transaction.category === selectedCategoryFilter;

    return accountMatches && monthMatches && categoryMatches;
  });

  // 🔥 CORE ENGINE: Calculate Running Balance based on IN and OUT/EXPENSE
  let currentRunningBalance = 0;
  if (selectedAccount !== "All") {
    const acc = accounts.find(a => a.accountName === selectedAccount);
    currentRunningBalance = acc ? Number(acc.openingBalance) : 0;
  }

  const ledgerData = [...filteredTrx]
  .sort((a, b) => getTransactionSortTime(a) - getTransactionSortTime(b))
  .map(trx => {
    if (isMoneyInTransaction(trx)) {
      currentRunningBalance += Number(trx.amount);
    } else {
      currentRunningBalance -= Number(trx.amount); // OUT or EXPENSE
    }
    return { ...trx, runningBalance: currentRunningBalance };
  });

  // Reverse it so newest is at the top for the UI
  ledgerData.reverse();

  const openReceipt = (transaction) => {
    setReceiptModal({ open: true, transaction });
  };

  const closeReceipt = () => {
    setReceiptModal({ open: false, transaction: null });
  };

  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    const receiptContent = document.getElementById('receipt-content');
    
    if (printWindow && receiptContent) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Transaction Receipt</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .receipt { max-width: 600px; margin: 0 auto; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>
            <div class="receipt">
              ${receiptContent.innerHTML}
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const downloadReceipt = () => {
    // For now, just use print. In production, you might want to add html2pdf library
    printReceipt();
  };

  const openEditModal = (transaction) => {
    setEditModal({
      open: true,
      transactionId: transaction.id,
      form: {
        voucherNo: transaction.voucherNo || "",
        date: transaction.date || "",
        type: transaction.type || "EXPENSE",
        category: transaction.category || "",
        amount: transaction.amount || "",
        paymentAccount: transaction.paymentAccount || transaction.paymentMode || "",
        referenceNo: transaction.referenceNo || "",
        partyName: transaction.partyName || "",
        partyId: transaction.partyId || "",
        payeeName: transaction.payeeName || "",
        payeeId: transaction.payeeId || "",
        payee: transaction.payee || "",
        targetName: transaction.targetName || "",
        driverName: transaction.driverName || "",
        bookingId: transaction.bookingId || "",
        bookingTrackingId: transaction.bookingTrackingId || transaction.trackingId || "",
        bookingLrNumber: transaction.bookingLrNumber || transaction.lrNumber || "",
        vehicleNumber: transaction.vehicleNumber || "",
        loanId: transaction.loanId || "",
        deductionSource: transaction.deductionSource || "admin_account",
        notes: transaction.notes || "",
      },
    });
  };

  const updateEditField = (field, value) => {
    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        [field]: value,
      },
    }));
  };

  const updateEditType = (type) => {
    const defaultCategory =
      type === "IN"
        ? "Party Receipt"
        : type === "OUT"
          ? "Commission Agent"
          : "Petrol";

    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        type,
        category: defaultCategory,
        partyId: "",
        partyName: "",
        payeeId: "",
        payeeName: "",
        payee: "",
        targetName: "",
        driverName: "",
        bookingId: "",
        bookingTrackingId: "",
        bookingLrNumber: "",
        vehicleNumber: "",
        loanId: "",
      },
    }));
  };

  const updateEditCategory = (category) => {
    const expenseCategory = EXPENSE_CATEGORIES.find((item) => item.value === category);
    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        category,
        targetName: expenseCategory?.target === "office" ? "Office / Admin" : "",
        driverName: "",
        payeeName: "",
        payee: "",
        bookingId: "",
        bookingTrackingId: "",
        bookingLrNumber: "",
        vehicleNumber: "",
        loanId: "",
      },
    }));
  };

  const updateEditParty = (partyId) => {
    const party = parties.find((item) => item.id === partyId);
    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        partyId,
        partyName: party?.name || "",
      },
    }));
  };

  const updateEditPayee = (payeeId, source) => {
    const payeeList = source === "agents" ? agents : parties;
    const payee = payeeList.find((item) => item.id === payeeId);
    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        payeeId,
        payeeName: payee?.name || "",
        payee: payee?.name || "",
      },
    }));
  };

  const updateEditBooking = (bookingId) => {
    const booking = bookings.find((item) => item.id === bookingId);
    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        bookingId,
        bookingTrackingId: booking?.trackingId || "",
        bookingLrNumber: booking?.lrNumber || "",
        vehicleNumber: booking?.vehicle || "",
        targetName: booking ? `${booking.trackingId || booking.id} - ${booking.from || ""} to ${booking.to || ""}` : "",
      },
    }));
  };

  const updateEditDriver = (driverName) => {
    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        driverName,
        payeeName: driverName,
        payee: driverName,
        targetName: driverName,
      },
    }));
  };

  const updateEditLoan = (loanId) => {
    const loan = loans.find((item) => item.id === loanId);
    setEditModal((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        loanId,
        targetName: loan?.loanName || "",
      },
    }));
  };

  const closeEditModal = () => {
    setEditModal({ open: false, transactionId: null, form: {} });
  };

  const handleSaveEdit = async () => {
    if (!editModal.transactionId) return;

    const amount = Number(editModal.form.amount);
    if (!editModal.form.date || !amount || amount <= 0) {
      return alert("Please enter a valid date and amount.");
    }

    setIsSavingEdit(true);
    try {
      const form = editModal.form;
      const isPaymentIn = form.type === "IN";
      const isPaymentOut = form.type === "OUT";
      const isExpense = form.type === "EXPENSE";
      const isDriverExpense =
        isExpense && ["Driver Salary", "Driver Batta"].includes(form.category);
      const usesOwnerAccount = true;

      const payload = {
        ...form,
        amount,
        paymentAccount: usesOwnerAccount ? form.paymentAccount || "" : "",
        paymentMode: usesOwnerAccount ? form.paymentAccount || "" : "",
        partyName: isPaymentIn ? form.partyName || "" : "",
        payeeName:
          isPaymentOut || isDriverExpense ? form.payeeName || form.driverName || form.targetName || "" : "",
        payee:
          isPaymentOut || isDriverExpense ? form.payee || form.payeeName || form.driverName || form.targetName || "" : "",
        driverName: isDriverExpense ? form.driverName || form.payeeName || form.targetName || "" : form.driverName || "",
        deductionSource: isExpense ? form.deductionSource || "admin_account" : "",
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, "transactions", editModal.transactionId), payload);
      await logActivity(db, {
        action: "transaction_updated",
        module: "payments",
        summary: `Updated transaction ${editModal.form.voucherNo || editModal.transactionId} for Rs ${amount.toLocaleString("en-IN")}`,
        targetId: editModal.transactionId,
        targetType: "transaction",
      });
      setTransactions((prev) =>
        prev.map((transaction) =>
          transaction.id === editModal.transactionId
            ? { ...transaction, ...payload }
            : transaction
        )
      );
      closeEditModal();
      alert("Transaction updated successfully.");
    } catch (error) {
      console.error("Error updating transaction:", error);
      alert("Error updating transaction.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteTransaction = async (transaction) => {
    if (!window.confirm(`Delete transaction ${transaction.voucherNo || transaction.id}? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "transactions", transaction.id));
      await logActivity(db, {
        action: "transaction_deleted",
        module: "payments",
        summary: `Deleted transaction ${transaction.voucherNo || transaction.id} for Rs ${Number(transaction.amount || 0).toLocaleString("en-IN")}`,
        targetId: transaction.id,
        targetType: "transaction",
      });
      setTransactions((prev) => prev.filter((item) => item.id !== transaction.id));
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("Error deleting transaction.");
    }
  };

  const editForm = editModal.form || {};
  const editType = editForm.type || "EXPENSE";
  const editExpenseCategory = EXPENSE_CATEGORIES.find((item) => item.value === editForm.category);
  const editPayOutCategory = PAY_OUT_CATEGORIES.find((item) => item.value === editForm.category) || PAY_OUT_CATEGORIES[0];
  const editPayees = editPayOutCategory.payeeSource === "agents" ? agents : parties;
  const editNeedsTrip = editType === "EXPENSE" && editExpenseCategory?.target === "trip";
  const editNeedsDriver = editType === "EXPENSE" && editExpenseCategory?.target === "driver";
  const editNeedsVehicle = editType === "EXPENSE" && editExpenseCategory?.target === "vehicle";
  const editNeedsLoan = editType === "EXPENSE" && editExpenseCategory?.target === "loan";
  const editNeedsDeduction =
    editType === "EXPENSE" &&
    (editExpenseCategory?.hasDeductionSource || editForm.deductionSource === "driver_salary");
  const editUsesOwnerAccount = true;

  return (
    <div className="list-page-bg">
      <Navbar />
      <div className="list-container">
        
        <div className="list-header" style={{ marginBottom: "1rem" }}>
          <div>
            <h2>Master Cashbook & Ledger</h2>
            <p>Track all IN/OUT transactions and updated account balances.</p>
            <small style={{ color: "#64748b" }}>Current month is selected by default. Clear the month to view all records.</small>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" }}>
          <div className="search-box">
            <select 
              value={selectedAccount} 
              onChange={(e) => setSelectedAccount(e.target.value)}
              style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none" }}
            >
              <option value="All">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.accountName}>{acc.accountName}</option>
              ))}
            </select>
          </div>
          <div className="search-box">
            <select 
              value={selectedCategoryFilter} 
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", outline: "none" }}
            >
              <option value="All">All Categories</option>
              <optgroup label="Expense Categories">
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </optgroup>
              <optgroup label="Pay IN Categories">
                {PAY_IN_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </optgroup>
              <optgroup label="Pay OUT Categories">
                {PAY_OUT_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </optgroup>
            </select>
          </div>
          <div className="search-box">
            <Calendar size={18} className="search-icon" />
            <input
              type="month"
              value={filterMonth}
              onChange={(event) => setFilterMonth(event.target.value)}
              style={{ paddingLeft: "2.5rem" }}
            />
          </div>
          </div>
        </div>

        {/* Live Balance Summary Box */}
        {selectedAccount !== "All" && (
          <div style={{ background: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Wallet size={24} color="#3b82f6" />
              <h3 style={{ margin: 0, color: "#1e293b" }}>{selectedAccount}</h3>
            </div>
            <div style={{ textAlign: "right" }}>
              <small style={{ color: "#64748b", fontWeight: "bold" }}>CURRENT UPDATED BALANCE</small>
              <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: ledgerData.length > 0 && ledgerData[0].runningBalance < 0 ? "#ef4444" : "#10b981" }}>
                ₹ {ledgerData.length > 0 ? ledgerData[0].runningBalance.toLocaleString('en-IN') : (accounts.find(a => a.accountName === selectedAccount)?.openingBalance || 0)}
              </div>
            </div>
          </div>
        )}

        {loading ? <div className="loading-state">Loading Ledger...</div> : (
          <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "800px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.9rem", textTransform: "uppercase" }}>
                  <th style={{ padding: "1rem" }}>Date & Voucher</th>
                  <th style={{ padding: "1rem" }}>Type / Details</th>
                  <th style={{ padding: "1rem" }}>Account Used</th>
                  <th style={{ padding: "1rem", color: "#166534" }}>IN (Cr)</th>
                  <th style={{ padding: "1rem", color: "#991b1b" }}>OUT (Dr)</th>
                  {selectedAccount !== "All" && <th style={{ padding: "1rem" }}>Balance</th>}
                  <th style={{ padding: "1rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.length === 0 ? (
                  <tr><td colSpan={selectedAccount !== "All" ? "7" : "6"} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>No transactions found for this account.</td></tr>
                ) : (
                  ledgerData.map(trx => (
                    <tr key={trx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "1rem" }}>
                        <strong style={{ color: "#1e293b" }}>{trx.date}</strong><br/>
                        <small style={{ color: "#94a3b8", fontWeight: "600" }}>{trx.voucherNo}</small>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          {isMoneyInTransaction(trx) ? <ArrowDownLeft size={16} color="#10b981" /> : <ArrowUpRight size={16} color="#ef4444" />}
                          <strong style={{ color: "#334155" }}>{trx.partyName || trx.payeeName || trx.targetName || trx.payee || "General"}</strong>
                        </div>
                        <small style={{ color: "#64748b", display: "block" }}>{trx.category || "Payment"} {trx.notes ? `| ${trx.notes}` : ""}</small>
                        {Array.isArray(trx.attachments) && trx.attachments.length > 0 && (
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                            {trx.attachments.map((attachment, index) => (
                              <a
                                key={attachment.path || attachment.url || index}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#2563eb", fontSize: "0.78rem", fontWeight: "700" }}
                              >
                                Proof {index + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "1rem", color: "#475569", fontWeight: "500" }}>{trx.paymentAccount || trx.paymentMode}</td>
                      
                      <td style={{ padding: "1rem", fontWeight: "bold", color: "#10b981", fontSize: "1.1rem" }}>{isMoneyInTransaction(trx) ? `₹${trx.amount}` : "-"}</td>
                      <td style={{ padding: "1rem", fontWeight: "bold", color: "#ef4444", fontSize: "1.1rem" }}>{!isMoneyInTransaction(trx) ? `₹${trx.amount}` : "-"}</td>
                      
                      {selectedAccount !== "All" && (
                        <td style={{ padding: "1rem", fontWeight: "bold", background: "#f8fafc", color: "#1e293b", fontSize: "1.1rem" }}>₹{trx.runningBalance}</td>
                      )}
                      
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button 
                            onClick={() => openReceipt(trx)}
                            style={{ 
                              background: "#3b82f6", 
                              color: "white", 
                              border: "none", 
                              padding: "6px 10px", 
                              borderRadius: "6px", 
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.8rem"
                            }}
                          >
                            <Printer size={14} /> Receipt
                          </button>
                          <button
                            onClick={() => openEditModal(trx)}
                            style={{
                              background: "#f59e0b",
                              color: "white",
                              border: "none",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.8rem"
                            }}
                          >
                            <Edit size={14} /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(trx)}
                            style={{
                              background: "#ef4444",
                              color: "white",
                              border: "none",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "0.8rem"
                            }}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editModal.open && (
        <div className="modal-overlay">
          <div className="modal-box edit-modal" style={{ maxWidth: "760px" }}>
            <div className="modal-header">
              <h3>Edit Transaction</h3>
              <button onClick={closeEditModal}><X size={20} /></button>
            </div>
            <div className="edit-grid modal-body">
              <div>
                <label>Voucher No.</label>
                <input className="modal-input" value={editModal.form.voucherNo || ""} onChange={(e) => updateEditField("voucherNo", e.target.value)} />
              </div>
              <div>
                <label>Date</label>
                <input type="date" className="modal-input" value={editModal.form.date || ""} onChange={(e) => updateEditField("date", e.target.value)} />
              </div>
              <div>
                <label>Type</label>
                <select className="modal-input" value={editType} onChange={(e) => updateEditType(e.target.value)}>
                  <option value="IN">Payment In / Credit</option>
                  <option value="OUT">Payment Out / Debit</option>
                  <option value="EXPENSE">Expense</option>
                  <option value="TRANSFER_IN">Transfer In</option>
                  <option value="TRANSFER_OUT">Transfer Out</option>
                </select>
              </div>
              <div>
                <label>Category</label>
                {editType === "IN" ? (
                  <select className="modal-input" value={editForm.category || "Party Receipt"} onChange={(e) => updateEditCategory(e.target.value)}>
                    {PAY_IN_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                  </select>
                ) : editType === "OUT" ? (
                  <select className="modal-input" value={editForm.category || "Commission Agent"} onChange={(e) => updateEditCategory(e.target.value)}>
                    {PAY_OUT_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                  </select>
                ) : editType === "EXPENSE" ? (
                  <select className="modal-input" value={editForm.category || "Petrol"} onChange={(e) => updateEditCategory(e.target.value)}>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>{category.label}</option>
                    ))}
                  </select>
                ) : (
                  <input className="modal-input" value={editForm.category || ""} onChange={(e) => updateEditField("category", e.target.value)} />
                )}
              </div>
              <div>
                <label>Amount</label>
                <input type="number" className="modal-input" value={editModal.form.amount || ""} onChange={(e) => updateEditField("amount", e.target.value)} />
              </div>

              {editType === "IN" && (
                <>
                  <div className="full-width">
                    <label>Received From (Party / Customer)</label>
                    <select className="modal-input" value={editForm.partyId || ""} onChange={(e) => updateEditParty(e.target.value)}>
                      <option value="">-- Select Party --</option>
                      {parties.map((party) => (
                        <option key={party.id} value={party.id}>{party.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="full-width">
                    <label>Link With Booking / LR</label>
                    <select className="modal-input" value={editForm.bookingId || ""} onChange={(e) => updateEditBooking(e.target.value)}>
                      <option value="">-- Keep as general receipt --</option>
                      {bookings.map((booking) => (
                        <option key={booking.id} value={booking.id}>
                          {booking.trackingId || booking.id} | {booking.party || "-"} | {booking.vehicle || "-"} | {booking.from || "-"} to {booking.to || "-"}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {editType === "OUT" && (
                <>
                  <div className="full-width">
                    <label>Paid To</label>
                    <select className="modal-input" value={editForm.payeeId || ""} onChange={(e) => updateEditPayee(e.target.value, editPayOutCategory.payeeSource)}>
                      <option value="">-- Select Payee --</option>
                      {editPayees.map((payee) => (
                        <option key={payee.id} value={payee.id}>{payee.name}</option>
                      ))}
                    </select>
                  </div>
                  {editPayOutCategory.payeeSource === "agents" && (
                    <div className="full-width">
                      <label>Link With Booking / LR</label>
                      <select className="modal-input" value={editForm.bookingId || ""} onChange={(e) => updateEditBooking(e.target.value)}>
                        <option value="">-- Keep as general payout --</option>
                        {bookings.map((booking) => (
                          <option key={booking.id} value={booking.id}>
                            {booking.trackingId || booking.id} | {booking.agent || "-"} | {booking.vehicle || "-"} | {booking.from || "-"} to {booking.to || "-"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              {editNeedsTrip && (
                <div className="full-width">
                  <label>Trip</label>
                  <select className="modal-input" value={editForm.bookingId || ""} onChange={(e) => updateEditBooking(e.target.value)}>
                    <option value="">-- Select Trip --</option>
                    {bookings.map((booking) => (
                      <option key={booking.id} value={booking.id}>
                        {booking.trackingId || booking.id} | {booking.vehicle || "-"} | {booking.from || "-"} to {booking.to || "-"}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editNeedsDriver && (
                <div>
                  <label>Driver</label>
                  <select className="modal-input" value={editForm.driverName || editForm.payeeName || ""} onChange={(e) => updateEditDriver(e.target.value)}>
                    <option value="">-- Select Driver --</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.name}>{driver.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {editNeedsVehicle && (
                <div>
                  <label>Vehicle</label>
                  <select className="modal-input" value={editForm.targetName || editForm.vehicleNumber || ""} onChange={(e) => updateEditField("targetName", e.target.value)}>
                    <option value="">-- Select Vehicle --</option>
                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.number}>{vehicle.number}</option>
                    ))}
                  </select>
                </div>
              )}

              {editNeedsLoan && (
                <div>
                  <label>Loan</label>
                  <select className="modal-input" value={editForm.loanId || ""} onChange={(e) => updateEditLoan(e.target.value)}>
                    <option value="">-- Select Loan --</option>
                    {loans.map((loan) => (
                      <option key={loan.id} value={loan.id}>{loan.loanName}</option>
                    ))}
                  </select>
                </div>
              )}

              {editNeedsDeduction && (
                <div>
                  <label>Deduct From</label>
                  <select className="modal-input" value={editForm.deductionSource || "admin_account"} onChange={(e) => updateEditField("deductionSource", e.target.value)}>
                    <option value="admin_account">Owner Account</option>
                    <option value="driver_salary">Deduct From Driver Commission</option>
                  </select>
                </div>
              )}

              {(editForm.deductionSource === "driver_salary" || editForm.category === "Driver Salary") && (
                (() => {
                  const targetDriverName = editForm.driverName || editForm.payeeName || editForm.targetName;
                  const salaryMonth = (editForm.date || new Date().toISOString()).slice(0, 7);
                  const selectedDriver = drivers.find((d) => d.name === targetDriverName);
                  if (!selectedDriver) return null;

                  const salarySummary = getDriverMonthSummary(selectedDriver, salaryMonth, bookings, transactions, submissions);
                  const carriedUntilThisMonth = getDriverCarryForwardToMonth(selectedDriver, salaryMonth, bookings, transactions, submissions);
                  const previousCarryForward = carriedUntilThisMonth - salarySummary.remainingThisMonth;
                  const salaryBalanceBeforePayment = previousCarryForward + salarySummary.remainingThisMonth;
                  const salaryBalanceAfterPayment = salaryBalanceBeforePayment - Number(editForm.amount || 0);

                  return (
                    <div className="full-width" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "12px", marginTop: "10px", marginBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                        <strong style={{ color: "#1e40af", fontSize: "0.85rem" }}>{targetDriverName} Balance Impact</strong>
                        <span style={{ color: "#64748b", fontWeight: "bold", fontSize: "0.85rem" }}>{salaryMonth}</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "0.85rem" }}>
                        <div style={{ background: "white", padding: "6px", borderRadius: "6px", border: "1px solid #dbeafe" }}>
                          <small style={{ color: "#64748b", display: "block" }}>BEFORE</small>
                          <strong style={{ color: salaryBalanceBeforePayment < 0 ? "#b91c1c" : "#0f172a" }}>Rs {Math.round(salaryBalanceBeforePayment).toLocaleString("en-IN")}</strong>
                        </div>
                        <div style={{ background: "white", padding: "6px", borderRadius: "6px", border: "1px solid #dbeafe" }}>
                          <small style={{ color: "#64748b", display: "block" }}>AFTER DEDUCT</small>
                          <strong style={{ color: salaryBalanceAfterPayment < 0 ? "#b91c1c" : "#0f172a" }}>Rs {Math.round(salaryBalanceAfterPayment).toLocaleString("en-IN")}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {editUsesOwnerAccount && (
                <div>
                  <label>{editType === "IN" ? "Deposited Into" : "Account Used"}</label>
                  <select className="modal-input" value={editForm.paymentAccount || ""} onChange={(e) => updateEditField("paymentAccount", e.target.value)}>
                    <option value="">-- Select Account --</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.accountName}>{account.accountName}</option>
                    ))}
                  </select>
                </div>
              )}

              {editType === "EXPENSE" && !editNeedsTrip && !editNeedsDriver && !editNeedsVehicle && !editNeedsLoan && (
                <div>
                  <label>Applied To</label>
                  <input className="modal-input" value={editForm.targetName || ""} onChange={(e) => updateEditField("targetName", e.target.value)} />
                </div>
              )}

              <div>
                <label>Reference No.</label>
                <input className="modal-input" value={editModal.form.referenceNo || ""} onChange={(e) => updateEditField("referenceNo", e.target.value)} />
              </div>
              <div className="full-width">
                <label>Notes</label>
                <input className="modal-input" value={editModal.form.notes || ""} onChange={(e) => updateEditField("notes", e.target.value)} />
              </div>
            </div>
            <button
              className="modal-submit-btn full-width-btn"
              style={{ marginTop: "20px", background: "#2563eb", color: "white", padding: "12px", border: "none", borderRadius: "8px", width: "100%", fontWeight: "bold", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
            >
              <Save size={18} /> {isSavingEdit ? "Saving..." : "Save Transaction"}
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModal.open && receiptModal.transaction && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "white",
            borderRadius: "12px",
            maxWidth: "600px",
            width: "90%",
            maxHeight: "90vh",
            overflow: "auto",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{
              padding: "20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <h3 style={{ margin: 0, color: "#1e293b" }}>Transaction Receipt</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={printReceipt} style={{
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <Printer size={14} /> Print
                </button>
                <button onClick={downloadReceipt} style={{
                  background: "#3b82f6",
                  color: "white",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}>
                  <Download size={14} /> Download
                </button>
                <button onClick={closeReceipt} style={{
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}>
                  ✕
                </button>
              </div>
            </div>
            
            <div id="receipt-content" style={{
              padding: "30px",
              fontFamily: "Arial, sans-serif",
              lineHeight: "1.6"
            }}>
              {/* Company Header */}
              <div style={{
                textAlign: "center",
                borderBottom: "2px solid #1e293b",
                paddingBottom: "20px",
                marginBottom: "30px"
              }}>
                <h1 style={{ margin: "0 0 5px 0", color: "#1e293b", fontSize: "24px" }}>
                  {companySettings.companyName || "Company Name"}
                </h1>
                <p style={{ margin: "0", color: "#64748b", fontSize: "14px" }}>
                  {companySettings.tagline || "Tagline"}
                </p>
                <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748b" }}>
                  {companySettings.address && <div>{companySettings.address}</div>}
                  {companySettings.phone && <div>Phone: {companySettings.phone}</div>}
                  {companySettings.email && <div>Email: {companySettings.email}</div>}
                  {companySettings.gstNumber && <div>GST: {companySettings.gstNumber}</div>}
                </div>
              </div>

              {/* Receipt Title */}
              <div style={{
                textAlign: "center",
                marginBottom: "30px"
              }}>
                <h2 style={{ margin: "0", color: "#1e293b", fontSize: "20px" }}>
                  {isMoneyInTransaction(receiptModal.transaction) ? "RECEIPT" : "PAYMENT VOUCHER"}
                </h2>
                <p style={{ margin: "5px 0 0 0", color: "#64748b" }}>
                  Voucher No: {receiptModal.transaction.voucherNo}
                </p>
              </div>

              {/* Transaction Details */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
                marginBottom: "30px"
              }}>
                <div>
                  <h4 style={{ margin: "0 0 10px 0", color: "#1e293b", fontSize: "14px", textTransform: "uppercase" }}>
                    Transaction Details
                  </h4>
                  <div style={{ fontSize: "14px", color: "#374151" }}>
                    <div style={{ marginBottom: "5px" }}>
                      <strong>Date:</strong> {receiptModal.transaction.date}
                    </div>
                    <div style={{ marginBottom: "5px" }}>
                      <strong>Type:</strong> {isMoneyInTransaction(receiptModal.transaction) ? "Credit" : "Debit"}
                    </div>
                    <div style={{ marginBottom: "5px" }}>
                      <strong>Amount:</strong> ₹{receiptModal.transaction.amount}
                    </div>
                    <div style={{ marginBottom: "5px" }}>
                      <strong>Payment Mode:</strong> {receiptModal.transaction.paymentAccount || receiptModal.transaction.paymentMode}
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 style={{ margin: "0 0 10px 0", color: "#1e293b", fontSize: "14px", textTransform: "uppercase" }}>
                    Party Details
                  </h4>
                  <div style={{ fontSize: "14px", color: "#374151" }}>
                    <div style={{ marginBottom: "5px" }}>
                      <strong>Name:</strong> {receiptModal.transaction.partyName || receiptModal.transaction.payeeName || receiptModal.transaction.targetName || receiptModal.transaction.payee || "General"}
                    </div>
                    {receiptModal.transaction.category && (
                      <div style={{ marginBottom: "5px" }}>
                        <strong>Category:</strong> {receiptModal.transaction.category}
                      </div>
                    )}
                    {receiptModal.transaction.notes && (
                      <div style={{ marginBottom: "5px" }}>
                        <strong>Notes:</strong> {receiptModal.transaction.notes}
                      </div>
                    )}
                    {Array.isArray(receiptModal.transaction.attachments) && receiptModal.transaction.attachments.length > 0 && (
                      <div style={{ marginBottom: "5px" }}>
                        <strong>Proof:</strong>{" "}
                        {receiptModal.transaction.attachments.map((attachment, index) => (
                          <a
                            key={attachment.path || attachment.url || index}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#2563eb", marginRight: "8px" }}
                          >
                            {attachment.name || `Attachment ${index + 1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Amount in Words */}
              <div style={{
                background: "#f8fafc",
                padding: "15px",
                borderRadius: "8px",
                marginBottom: "30px",
                textAlign: "center"
              }}>
                <strong style={{ color: "#1e293b" }}>Amount in Words:</strong>
                <div style={{ marginTop: "5px", color: "#374151" }}>
                  {numberToWords(receiptModal.transaction.amount)} Rupees Only
                </div>
              </div>

              {/* Bank Details */}
              {(companySettings.bankName || companySettings.accountName) && (
                <div style={{
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "20px",
                  marginBottom: "30px"
                }}>
                  <h4 style={{ margin: "0 0 10px 0", color: "#1e293b", fontSize: "14px", textTransform: "uppercase" }}>
                    Bank Details
                  </h4>
                  <div style={{ fontSize: "14px", color: "#374151" }}>
                    {companySettings.bankName && <div><strong>Bank:</strong> {companySettings.bankName}</div>}
                    {companySettings.accountName && <div><strong>A/c Name:</strong> {companySettings.accountName}</div>}
                    {companySettings.accountNumber && <div><strong>A/c No:</strong> {companySettings.accountNumber}</div>}
                    {companySettings.ifscCode && <div><strong>IFSC:</strong> {companySettings.ifscCode}</div>}
                  </div>
                </div>
              )}

              {/* Terms and Conditions */}
              {companySettings.termsAndConditions && (
                <div style={{
                  borderTop: "1px solid #e2e8f0",
                  paddingTop: "20px",
                  marginBottom: "30px"
                }}>
                  <h4 style={{ margin: "0 0 10px 0", color: "#1e293b", fontSize: "14px", textTransform: "uppercase" }}>
                    Terms & Conditions
                  </h4>
                  <div style={{ fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                    {companySettings.termsAndConditions.split('\n').map((term, index) => (
                      <div key={index} style={{ marginBottom: "3px" }}>{term}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Signatures */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "50px",
                paddingTop: "20px",
                borderTop: "1px solid #e2e8f0"
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ borderTop: "1px solid #374151", width: "150px", margin: "0 auto 5px auto" }}></div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Receiver's Signature</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ borderTop: "1px solid #374151", width: "150px", margin: "0 auto 5px auto" }}></div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Authorized Signatory</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                textAlign: "center",
                marginTop: "30px",
                fontSize: "10px",
                color: "#9ca3af"
              }}>
                This is a computer generated receipt. No signature required.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function to convert number to words
function numberToWords(num) {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  
  let result = '';
  let crores = Math.floor(num / 10000000);
  let lakhs = Math.floor((num % 10000000) / 100000);
  let thousands = Math.floor((num % 100000) / 1000);
  let hundreds = Math.floor((num % 1000) / 100);
  let tens = Math.floor((num % 100) / 10);
  let units = num % 10;
  
  if (crores > 0) result += a[crores] + ' Crore ';
  if (lakhs > 0) result += a[lakhs] + ' Lakh ';
  if (thousands > 0) result += a[thousands] + ' Thousand ';
  if (hundreds > 0) result += a[hundreds] + ' Hundred ';
  if (tens === 1) result += a[tens * 10 + units];
  else {
    if (tens > 0) result += b[tens] + ' ';
    if (units > 0) result += a[units];
  }
  
  return result.trim();
}

export default TransactionList;
