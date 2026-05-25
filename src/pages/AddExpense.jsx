import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { TrendingDown, IndianRupee, Wrench, Landmark } from "lucide-react";
import "./AddDriver.css"; 

function AddExpense() {
  const [accounts, setAccounts] = useState([]);
  const [targets, setTargets] = useState([]); // This will hold drivers or vehicles
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

  // Fetch Accounts Once
  useEffect(() => {
    const fetchAccounts = async () => {
      const snap = await getDocs(collection(db, "accounts"));
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchAccounts();
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
          const snap = await getDocs(collection(db, "drivers"));
          const data = snap.docs.map(d => d.data().name);
          setTargets(data);
        } else {
          setTargets(["Office / Admin"]); // Fallback for office expenses
        }
      } catch (error) {
        console.error("Error fetching targets:", error);
      }
    };
    fetchTargets();
  }, [form.category]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!form.amount || !form.paymentAccount || !form.category) {
      return alert("❌ Amount, Category, and Payment Account are required.");
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "transactions"), {
        ...form,
        amount: Number(form.amount),
        createdAt: new Date().toISOString()
      });

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
