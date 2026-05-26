import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs, deleteDoc, doc, addDoc } from "firebase/firestore";
import { CheckCircle, XCircle, Clock, IndianRupee, User, Truck, Calendar } from "lucide-react";
import { getCurrentMonthValue, getRecordDateInput } from "../utils/dateRange";
import "./BookingList.css";

function ExpenseApprovals() {
  const [submissions, setSubmissions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAcc, setSelectedAcc] = useState({});
  const [selectedDeduction, setSelectedDeduction] = useState({});
  const [filterMonth, setFilterMonth] = useState(getCurrentMonthValue());

  const fetchData = async () => {
    try {
      const subSnap = await getDocs(collection(db, "driver_submissions"));
      const submissionData = subSnap.docs
        .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
        .sort(
          (a, b) =>
            new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0)
        );
      setSubmissions(submissionData);

      const accSnap = await getDocs(collection(db, "accounts"));
      setAccounts(accSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
    } catch (error) {
      console.error("Error fetching expense approvals:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (submission) => {
    const deductionSource =
      selectedDeduction[submission.id] || submission.deductionSource || "admin_account";
    const accountForThis = selectedAcc[submission.id];
    if (deductionSource === "admin_account" && !accountForThis) {
      return alert("Please select a Payment Account first!");
    }

    const tripReference = submission.trackingId
      ? `Trip ${submission.trackingId}`
      : submission.vehicleNumber || "Driver Expense";

    try {
      await addDoc(collection(db, "transactions"), {
        voucherNo: `APP-${Math.floor(10000 + Math.random() * 90000)}`,
        date: submission.date,
        category: submission.category,
        payeeName: submission.driverName,
        payee: submission.driverName,
        targetName: submission.vehicleNumber,
        bookingId: submission.bookingId || "",
        bookingTrackingId: submission.trackingId || submission.tripId || "",
        amount: Number(submission.amount),
        paymentAccount: deductionSource === "admin_account" ? accountForThis : "",
        deductionSource,
        referenceNo: tripReference,
        notes:
          deductionSource === "driver_salary"
            ? `Deducted from driver salary/commission${submission.notes ? `: ${submission.notes}` : ""}`
            : `Approved Driver Submission${submission.notes ? `: ${submission.notes}` : ""}`,
        type: "EXPENSE",
        createdAt: new Date().toISOString(),
      });

      await deleteDoc(doc(db, "driver_submissions", submission.id));

      alert("Expense Approved & Ledger Updated!");
      fetchData();
    } catch (error) {
      console.error("Error approving expense:", error);
      alert("Error approving expense.");
    }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Are you sure you want to reject this expense?")) {
      return;
    }

    await deleteDoc(doc(db, "driver_submissions", id));
    fetchData();
  };

  const filteredSubmissions = submissions.filter((submission) => {
    const dateValue = getRecordDateInput(submission, ["date", "createdAt"]);
    return !filterMonth || dateValue.startsWith(filterMonth);
  });

  return (
    <div className="list-page-bg">
      <Navbar />
      <div className="list-container">
        <div className="list-header">
          <div>
            <h2>Pending Driver Expenses</h2>
            <p>Review and approve operational costs. Current month is selected by default.</p>
          </div>
          <div className="search-box" style={{ minWidth: "240px" }}>
            <Calendar size={18} className="search-icon" />
            <input type="month" value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Scanning submissions...</div>
        ) : (
          <div className="bookings-grid">
            {filteredSubmissions.length === 0 ? (
              <div className="empty-state">No pending expenses to approve.</div>
            ) : (
              filteredSubmissions.map((submission) => (
                <div
                  className="booking-card"
                  key={submission.id}
                  style={{ borderLeft: "5px solid #f59e0b" }}
                >
                  <div className="card-top">
                    <div className="card-top-left">
                      <Clock size={16} color="#f59e0b" />
                      <span style={{ fontWeight: "bold", color: "#b45309" }}>
                        {(submission.category || "Expense").toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={() => handleReject(submission.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                        }}
                      >
                        <XCircle size={22} />
                      </button>
                      <button
                        onClick={() => handleApprove(submission)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#10b981",
                          cursor: "pointer",
                        }}
                      >
                        <CheckCircle size={22} />
                      </button>
                    </div>
                  </div>

                  <div className="details-grid" style={{ marginTop: "10px" }}>
                    <div className="detail-item">
                      <User size={14} />
                      <p>{submission.driverName}</p>
                    </div>
                    <div className="detail-item">
                      <Truck size={14} />
                      <p>{submission.vehicleNumber}</p>
                    </div>
                    <div className="detail-item">
                      <IndianRupee size={14} />
                      <p style={{ fontSize: "1.1rem", fontWeight: "bold" }}>
                        Rs{submission.amount}
                      </p>
                    </div>
                  </div>

                  {submission.trackingId && (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#475569",
                        marginTop: "8px",
                        fontWeight: "600",
                      }}
                    >
                      Linked Trip: #{submission.trackingId}
                    </div>
                  )}

                  <div
                    style={{
                      padding: "10px",
                      background: "#fffbeb",
                      borderRadius: "6px",
                      fontSize: "0.85rem",
                      color: "#92400e",
                      margin: "10px 0",
                    }}
                  >
                    <strong>Driver Notes:</strong> {submission.notes || "None"}
                    <div style={{ marginTop: "6px" }}>
                      <strong>Driver Requested:</strong>{" "}
                      {(submission.deductionSource || "admin_account") === "driver_salary"
                        ? "Deduct from driver commission"
                        : "Use driver advance / company account"}
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px" }}>
                    <label
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        color: "#64748b",
                        display: "block",
                        marginBottom: "5px",
                      }}
                    >
                      DEDUCT FROM:
                    </label>
                    <select
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        outline: "none",
                        marginBottom: "10px",
                      }}
                      onChange={(event) =>
                        setSelectedDeduction({ ...selectedDeduction, [submission.id]: event.target.value })
                      }
                      value={selectedDeduction[submission.id] || submission.deductionSource || "admin_account"}
                    >
                      <option value="admin_account">Driver Advance / Company Account</option>
                      <option value="driver_salary">Driver Commission</option>
                    </select>

                    <label
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        color: "#64748b",
                        display: "block",
                        marginBottom: "5px",
                      }}
                    >
                      SELECT PAYMENT ACCOUNT:
                    </label>
                    <select
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        outline: "none",
                      }}
                      onChange={(event) =>
                        setSelectedAcc({ ...selectedAcc, [submission.id]: event.target.value })
                      }
                      value={selectedAcc[submission.id] || ""}
                      disabled={(selectedDeduction[submission.id] || submission.deductionSource || "admin_account") === "driver_salary"}
                    >
                      <option value="">
                        {(selectedDeduction[submission.id] || submission.deductionSource || "admin_account") === "driver_salary"
                          ? "-- No account needed --"
                          : "-- Choose Account --"}
                      </option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.accountName}>
                          {account.accountName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExpenseApprovals;
