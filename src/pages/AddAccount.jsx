import { useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { Wallet, Building, IndianRupee } from "lucide-react";
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css"; // Safely reusing your premium CSS

function AddAccount() {
  const [form, setForm] = useState({
    accountName: "",
    accountType: "Bank Account",
    accountNumber: "",
    openingBalance: "",
    status: "Active"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!form.accountName || !form.openingBalance) {
      return alert("❌ Account Name and Opening Balance are required.");
    }

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "accounts"), {
        ...form,
        openingBalance: Number(form.openingBalance),
        currentBalance: Number(form.openingBalance), // Initial balance
        createdAt: new Date().toISOString()
      });
      await logActivity(db, {
        action: "account_created",
        module: "accounts",
        summary: `Created account ${form.accountName} with opening balance Rs ${Number(form.openingBalance).toLocaleString("en-IN")}`,
        targetId: docRef.id,
        targetType: "account",
      });

      alert("Account Created Successfully! ✅");
      setForm({ accountName: "", accountType: "Bank Account", accountNumber: "", openingBalance: "", status: "Active" });
    } catch {
      alert("Error creating account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #8b5cf6" }}>
        <div className="driver-header" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <Wallet size={32} color="#8b5cf6" />
          <div>
            <h2>Create Financial Account</h2>
            <p>Add a new Bank Account or Cash Ledger to track balances.</p>
          </div>
        </div>

        <div className="form-grid">
          <div className="input-group full-width">
            <label>Account Name (e.g., Main Office Cash, SBI Current) *</label>
            <input name="accountName" value={form.accountName} onChange={handleChange} placeholder="Enter Account Name" />
          </div>

          <div className="input-group">
            <label>Account Type</label>
            <select name="accountType" value={form.accountType} onChange={handleChange}>
              <option value="Bank Account">Bank Account</option>
              <option value="Cash Account">Cash Box / Petty Cash</option>
            </select>
          </div>

          <div className="input-group">
            <label>Account Number (If Bank)</label>
            <input name="accountNumber" value={form.accountNumber} onChange={handleChange} placeholder="Optional" />
          </div>

          <div className="input-group full-width">
            <label>Opening Balance (₹) *</label>
            <input type="number" name="openingBalance" value={form.openingBalance} onChange={handleChange} placeholder="0.00" style={{ borderColor: "#8b5cf6" }} />
          </div>

          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleSave} disabled={isSubmitting} style={{ background: "#8b5cf6" }}>
              {isSubmitting ? "Creating..." : "Create Account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddAccount;
