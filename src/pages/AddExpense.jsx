import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { TrendingDown, IndianRupee, Wrench, Landmark } from "lucide-react";
import { getDriverCarryForwardToMonth, getDriverMonthSummary } from "../utils/driverSalary";
import "./AddDriver.css"; 

function AddExpense() {
  const [accounts, setAccounts] = useState([]);
  const [targets, setTargets] = useState([]); // This will hold drivers or vehicles
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    voucherNo: `EXP-${Math.floor(10000 + Math.random() * 90000)}`,
    date: new Date().toISOString().split('T')[0],
    category: "Vehicle Maintenance", // Fleet operations
    targetName: "", // Which driver or vehicle is this for?
    amount: "",
    paymentAccount: "", 
    notes: "",
    type: "EXPENSE" 
  });

  // Fetch Accounts and salary data once
  useEffect(() => {
    const fetchData = async () => {
      const [accountSnap, driverSnap, bookingSnap, transactionSnap, submissionSnap] = await Promise.all([
        getDocs(collection(db, "accounts")),
        getDocs(collection(db, "drivers")),
        getDocs(collection(db, "bookings")),
        getDocs(collection(db, "transactions")),
        getDocs(collection(db, "driver_submissions")),
      ]);
      setAccounts(accountSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDrivers(
        driverSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      );
      setBookings(bookingSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTransactions(transactionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSubmissions(submissionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchData();
  }, []);

  // Dynamically fetch Drivers or Vehicles based on Expense Category
  useEffect(() => {
    const fetchTargets = async () => {
      setForm(prev => ({ ...prev, targetName: "" })); // Reset selection

      try {
        if (form.category.includes("Vehicle") || form.category.includes("Toll")) {
          const snap = await getDocs(collection(db, "vehicles"));
          const data = snap.docs.map(d => d.data().number);
          setTargets(data);
        } else if (form.category.includes("Driver")) {
          setTargets(drivers.map((driver) => driver.name));
        } else {
          setTargets(["Office / Admin"]); // Fallback for office expenses
        }
      } catch (error) {
        console.error("Error fetching targets:", error);
      }
    };
    fetchTargets();
  }, [drivers, form.category]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const salaryMonth = form.date.slice(0, 7);
  const selectedDriver = drivers.find((driver) => driver.name === form.targetName);
  const salarySummary =
    form.category === "Driver Salary" && selectedDriver
      ? getDriverMonthSummary(selectedDriver, salaryMonth, bookings, transactions, submissions)
      : null;
  const carriedUntilThisMonth =
    form.category === "Driver Salary" && selectedDriver
      ? getDriverCarryForwardToMonth(selectedDriver, salaryMonth, bookings, transactions, submissions)
      : 0;
  const previousCarryForward = salarySummary
    ? carriedUntilThisMonth - salarySummary.remainingThisMonth
    : 0;
  const salaryBalanceBeforePayment = previousCarryForward + (salarySummary?.remainingThisMonth || 0);
  const salaryBalanceAfterPayment = salaryBalanceBeforePayment - (Number(form.amount) || 0);

  const handleSave = async () => {
    if (!form.amount || !form.paymentAccount || !form.category) {
      return alert("❌ Amount, Category, and Payment Account are required.");
    }
    if (form.category.includes("Driver") && !form.targetName) {
      return alert("Please select the driver.");
    }

    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        payeeName: form.category === "Driver Salary" ? form.targetName : "",
        payee: form.category === "Driver Salary" ? form.targetName : "",
        driverName: form.category === "Driver Salary" ? form.targetName : "",
        salaryMonth: form.category === "Driver Salary" ? salaryMonth : "",
        salaryBalanceBefore: form.category === "Driver Salary" ? salaryBalanceBeforePayment : "",
        salaryBalanceAfter: form.category === "Driver Salary" ? salaryBalanceAfterPayment : "",
        amount: Number(form.amount),
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, "transactions"), payload);
      setTransactions((prev) => [...prev, { id: docRef.id, ...payload }]);

      alert(`Expense Recorded! ✅\nVoucher: ${form.voucherNo}`);
      setForm({
        ...form,
        voucherNo: `EXP-${Math.floor(10000 + Math.random() * 90000)}`,
        targetName: "", amount: "", paymentAccount: "", notes: ""
      });
    } catch {
      alert("Error saving expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #f97316" }}>
        
        <div className="driver-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="header-title">
            <TrendingDown size={32} color="#f97316" />
            <div>
              <h2>Fleet Operations Expense</h2>
              <p>Record Driver Batta, Maintenance, Fuel, and Office expenses.</p>
            </div>
          </div>
          <div style={{ textAlign: "right", background: "#fff7ed", padding: "10px 15px", borderRadius: "8px", border: "1px solid #ffedd5" }}>
            <small style={{ color: "#c2410c", fontWeight: "bold", display: "block" }}>EXPENSE VOUCHER</small>
            <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#9a3412" }}>{form.voucherNo}</span>
          </div>
        </div>

        <div className="form-grid">
          <div className="section-title full-width">
            <Wrench size={18} /> Expense Details
          </div>

          <div className="input-group">
            <label>Expense Category *</label>
            <select name="category" value={form.category} onChange={handleChange} style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
              <option value="Vehicle Maintenance">Vehicle Maintenance / Repairs</option>
              <option value="Vehicle Fuel/Toll">Vehicle Fuel & Toll</option>
              <option value="Driver Batta">Driver Batta (Trip Allowance)</option>
              <option value="Driver Salary">Driver Salary</option>
              <option value="Office Expense">General Office Expense</option>
            </select>
          </div>

          <div className="input-group">
            <label>Associated Vehicle or Driver</label>
            <select name="targetName" value={form.targetName} onChange={handleChange}>
              <option value="">-- Select Vehicle / Driver --</option>
              {targets.map((t, i) => <option key={i} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="section-title full-width mt-4">
            <IndianRupee size={18} /> Payment Information
          </div>

          <div className="input-group">
            <label>Expense Date *</label>
            <input name="date" type="date" value={form.date} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Amount (₹) *</label>
            <input name="amount" type="number" placeholder="0.00" value={form.amount} onChange={handleChange} style={{ borderColor: "#f97316", borderWidth: "2px" }} />
          </div>

          {salarySummary && (
            <div className="full-width" style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "14px", display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <strong style={{ color: "#1e40af" }}>{form.targetName} Salary / Commission Summary</strong>
                <span style={{ color: "#64748b", fontWeight: "800" }}>{salaryMonth}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" }}>
                {[
                  ["Fixed", salarySummary.fixedSalary],
                  ["Commission", salarySummary.commissionEarned],
                  ["Deductions", salarySummary.totalDeductions],
                  ["Paid This Month", salarySummary.paidSalary],
                  ["Prev. Carry", previousCarryForward],
                  ["To Pay Now", salaryBalanceBeforePayment],
                  ["After Payment", salaryBalanceAfterPayment],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: "#ffffff", border: "1px solid #dbeafe", borderRadius: "8px", padding: "10px" }}>
                    <small style={{ color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>{label}</small>
                    <strong style={{ display: "block", color: value < 0 ? "#b91c1c" : "#0f172a", marginTop: "4px" }}>
                      Rs {Math.round(value).toLocaleString("en-IN")}
                    </strong>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, amount: Math.max(0, Math.round(salaryBalanceBeforePayment)).toString() }))}
                style={{ justifySelf: "start", border: "0", borderRadius: "8px", background: "#2563eb", color: "white", padding: "0.65rem 0.9rem", fontWeight: "800", cursor: "pointer" }}
              >
                Fill Full Remaining
              </button>
            </div>
          )}

          {/* 🔥 STRICT ACCOUNT SELECTION */}
          <div className="input-group full-width">
            <label><Landmark size={14} style={{ display: "inline", marginRight: "5px"}}/> Paid From (Account) *</label>
            <select name="paymentAccount" value={form.paymentAccount} onChange={handleChange} style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
              <option value="">-- Select Bank or Cash Account --</option>
              {accounts.map(acc => <option key={acc.id} value={acc.accountName}>{acc.accountName}</option>)}
            </select>
          </div>

          <div className="input-group full-width">
            <label>Details / Description</label>
            <input name="notes" placeholder="e.g. 2 Tyres replaced at MRF shop, or Trip Advance" value={form.notes} onChange={handleChange} />
          </div>

          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleSave} disabled={isSubmitting} style={{ background: "#f97316" }}>
              {isSubmitting ? "Saving..." : "Record Expense"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddExpense;
