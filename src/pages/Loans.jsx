import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { addDoc, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { Landmark, IndianRupee, Percent, Calendar, CheckCircle } from "lucide-react";
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css";
import "./BookingList.css";

const buildInitialForm = () => ({
  loanName: "",
  lenderName: "",
  totalAmount: "",
  interestRate: "",
  monthlyEmi: "",
  startDate: new Date().toISOString().split("T")[0],
  tenureMonths: "",
  notes: "",
  status: "active",
});

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function Loans() {
  const [loans, setLoans] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(buildInitialForm());
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [loanSnap, transactionSnap] = await Promise.all([
        getDocs(collection(db, "loans")),
        getDocs(collection(db, "transactions")),
      ]);
      setLoans(
        loanSnap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((a, b) => (a.loanName || "").localeCompare(b.loanName || ""))
      );
      setTransactions(transactionSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
    } catch (error) {
      console.error("Error loading loans:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const loanSummaries = useMemo(() => {
    return loans.map((loan) => {
      const paidAmount = transactions
        .filter((transaction) => transaction.category === "Loan EMI" && transaction.loanId === loan.id)
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
      return {
        ...loan,
        paidAmount,
        outstandingAmount: Math.max(0, toNumber(loan.totalAmount) - paidAmount),
      };
    });
  }, [loans, transactions]);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSave = async () => {
    if (!form.loanName || !form.totalAmount || !form.interestRate || !form.monthlyEmi) {
      return alert("Loan Name, Total Amount, Interest Rate, and Monthly EMI are required.");
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        totalAmount: toNumber(form.totalAmount),
        interestRate: toNumber(form.interestRate),
        monthlyEmi: toNumber(form.monthlyEmi),
        tenureMonths: toNumber(form.tenureMonths),
        createdAt: new Date().toISOString(),
      };
      const docRef = await addDoc(collection(db, "loans"), payload);
      await logActivity(db, {
        action: "loan_created",
        module: "loans",
        summary: `Created loan ${form.loanName} for Rs ${toNumber(form.totalAmount).toLocaleString("en-IN")}`,
        targetId: docRef.id,
        targetType: "loan",
      });
      setLoans((prev) => [...prev, { id: docRef.id, ...payload }]);
      setForm(buildInitialForm());
      alert("Loan saved successfully.");
    } catch (error) {
      console.error("Error saving loan:", error);
      alert("Error saving loan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (loan, status) => {
    try {
      await updateDoc(doc(db, "loans", loan.id), {
        status,
        updatedAt: new Date().toISOString(),
      });
      await logActivity(db, {
        action: "loan_status_updated",
        module: "loans",
        summary: `Marked loan ${loan.loanName} as ${status}`,
        targetId: loan.id,
        targetType: "loan",
      });
      setLoans((prev) => prev.map((item) => (item.id === loan.id ? { ...item, status } : item)));
    } catch (error) {
      console.error("Error updating loan:", error);
      alert("Error updating loan status.");
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #2563eb" }}>
        <div className="driver-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="header-title">
            <Landmark size={32} color="#2563eb" />
            <div>
              <h2>Loan Master</h2>
              <p>Create loan records so EMI payments can be selected inside Add Expense.</p>
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div className="section-title full-width">
            <Landmark size={18} /> Loan Details
          </div>

          <div className="input-group">
            <label>Loan Name *</label>
            <input name="loanName" value={form.loanName} onChange={handleChange} placeholder="e.g. HDFC Truck Loan" />
          </div>
          <div className="input-group">
            <label>Lender / Bank</label>
            <input name="lenderName" value={form.lenderName} onChange={handleChange} placeholder="Bank or finance company" />
          </div>
          <div className="input-group">
            <label><IndianRupee size={14} style={{ display: "inline", marginRight: "5px" }} /> Total Loan Amount *</label>
            <input name="totalAmount" type="number" value={form.totalAmount} onChange={handleChange} placeholder="0.00" />
          </div>
          <div className="input-group">
            <label><Percent size={14} style={{ display: "inline", marginRight: "5px" }} /> Interest Rate (%) *</label>
            <input name="interestRate" type="number" value={form.interestRate} onChange={handleChange} placeholder="e.g. 12" />
          </div>
          <div className="input-group">
            <label>Monthly EMI *</label>
            <input name="monthlyEmi" type="number" value={form.monthlyEmi} onChange={handleChange} placeholder="0.00" />
          </div>
          <div className="input-group">
            <label><Calendar size={14} style={{ display: "inline", marginRight: "5px" }} /> Start Date</label>
            <input name="startDate" type="date" value={form.startDate} onChange={handleChange} />
          </div>
          <div className="input-group">
            <label>Tenure Months</label>
            <input name="tenureMonths" type="number" value={form.tenureMonths} onChange={handleChange} placeholder="e.g. 48" />
          </div>
          <div className="input-group">
            <label>Status</label>
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="input-group full-width">
            <label>Notes</label>
            <input name="notes" value={form.notes} onChange={handleChange} placeholder="Vehicle number, agreement details, or reminder notes" />
          </div>
          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleSave} disabled={isSubmitting} style={{ background: "#2563eb" }}>
              {isSubmitting ? "Saving..." : "Save Loan"}
            </button>
          </div>
        </div>
      </div>

      <div className="list-container" style={{ marginTop: "1.5rem" }}>
        <div className="list-header">
          <div>
            <h2>Loan Register</h2>
            <p>EMI paid is calculated from Add Expense entries with category Loan EMI.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading loans...</div>
        ) : loanSummaries.length === 0 ? (
          <div className="empty-state">No loans created yet.</div>
        ) : (
          <div className="bookings-grid">
            {loanSummaries.map((loan) => (
              <div className="booking-card" key={loan.id} style={{ borderTop: "4px solid #2563eb" }}>
                <div className="card-top">
                  <div className="card-top-left">
                    <span className="tracking-id">{loan.loanName}</span>
                    <span className="status-badge" style={{ background: loan.status === "closed" ? "#dcfce7" : "#dbeafe", color: loan.status === "closed" ? "#166534" : "#1d4ed8" }}>
                      {loan.status || "active"}
                    </span>
                  </div>
                </div>
                <div className="details-grid">
                  <Metric label="Lender" value={loan.lenderName || "-"} />
                  <Metric label="Total Loan" value={`Rs ${toNumber(loan.totalAmount).toLocaleString("en-IN")}`} />
                  <Metric label="Interest" value={`${toNumber(loan.interestRate)}%`} />
                  <Metric label="Monthly EMI" value={`Rs ${toNumber(loan.monthlyEmi).toLocaleString("en-IN")}`} />
                  <Metric label="EMI Paid" value={`Rs ${loan.paidAmount.toLocaleString("en-IN")}`} />
                  <Metric label="Outstanding" value={`Rs ${loan.outstandingAmount.toLocaleString("en-IN")}`} />
                </div>
                {loan.status !== "closed" && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange(loan, "closed")}
                    style={{ marginTop: "1rem", border: "0", borderRadius: "8px", background: "#16a34a", color: "white", padding: "0.7rem 1rem", fontWeight: "800", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <CheckCircle size={16} /> Mark Closed
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="detail-item">
      <div>
        <small>{label}</small>
        <p>{value}</p>
      </div>
    </div>
  );
}

export default Loans;
