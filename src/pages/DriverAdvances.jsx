import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { HandCoins, IndianRupee, Landmark, UserRound, WalletCards } from "lucide-react";
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css";

const buildAdvanceVoucher = () => `DRV-ADV-${Math.floor(10000 + Math.random() * 90000)}`;
const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getDriverName = (record = {}) => record.driverName || record.payeeName || record.payee || "";

function DriverAdvances() {
  const [drivers, setDrivers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    voucherNo: buildAdvanceVoucher(),
    date: new Date().toISOString().split("T")[0],
    driverId: "",
    driverName: "",
    amount: "",
    paymentAccount: "",
    referenceNo: "",
    notes: "",
  });

  const fetchData = async () => {
    try {
      const [driverSnap, accountSnap, transactionSnap, submissionSnap] = await Promise.all([
        getDocs(collection(db, "drivers")),
        getDocs(collection(db, "accounts")),
        getDocs(collection(db, "transactions")),
        getDocs(collection(db, "driver_submissions")),
      ]);

      setDrivers(
        driverSnap.docs
          .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
      );
      setAccounts(accountSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
      setTransactions(transactionSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
      setSubmissions(submissionSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
    } catch (error) {
      console.error("Error loading driver advance data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const driverBalances = useMemo(() => {
    return drivers.map((driver) => {
      const driverName = driver.name || "";
      const advances = transactions
        .filter((transaction) => transaction.category === "Driver Advance" && getDriverName(transaction) === driverName)
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
      const approvedExpenses = transactions
        .filter(
          (transaction) =>
            getDriverName(transaction) === driverName &&
            transaction.category !== "Driver Advance" &&
            transaction.category !== "Driver Salary" &&
            transaction.deductionSource !== "driver_salary" &&
            transaction.type !== "IN" &&
            transaction.type !== "TRANSFER_IN"
        )
        .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
      const pendingExpenses = submissions
        .filter(
          (submission) =>
            getDriverName(submission) === driverName &&
            submission.deductionSource !== "driver_salary"
        )
        .reduce((sum, submission) => sum + toNumber(submission.amount), 0);

      return {
        ...driver,
        advances,
        approvedExpenses,
        pendingExpenses,
        available: advances - approvedExpenses - pendingExpenses,
      };
    });
  }, [drivers, submissions, transactions]);

  const selectedDriver = driverBalances.find((driver) => driver.id === form.driverId);

  const handleDriverChange = (event) => {
    const driverId = event.target.value;
    const driver = drivers.find((item) => item.id === driverId);
    setForm((prev) => ({
      ...prev,
      driverId,
      driverName: driver?.name || "",
    }));
  };

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSave = async () => {
    if (!form.driverId || !form.amount || !form.paymentAccount) {
      return alert("Please select Driver, Amount, and Paid From account.");
    }

    const amount = Number(form.amount);
    if (amount <= 0) {
      return alert("Please enter a valid advance amount.");
    }

    const payload = {
      voucherNo: form.voucherNo,
      date: form.date,
      category: "Driver Advance",
      payeeId: form.driverId,
      payeeName: form.driverName,
      driverName: form.driverName,
      targetName: form.driverName,
      amount,
      paymentAccount: form.paymentAccount,
      referenceNo: form.referenceNo,
      notes: form.notes || "Advance given to driver for trip/road expenses",
      type: "EXPENSE",
      createdAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "transactions"), payload);
      await logActivity(db, {
        action: "driver_advance_created",
        module: "payments",
        summary: `Recorded driver advance Rs ${amount.toLocaleString("en-IN")} for ${form.driverName}`,
        targetId: docRef.id,
        targetType: "transaction",
      });
      setTransactions((prev) => [...prev, { id: docRef.id, ...payload }]);
      alert(`Driver advance recorded.\nVoucher: ${form.voucherNo}`);
      setForm({
        voucherNo: buildAdvanceVoucher(),
        date: new Date().toISOString().split("T")[0],
        driverId: "",
        driverName: "",
        amount: "",
        paymentAccount: "",
        referenceNo: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error saving driver advance:", error);
      alert("Error saving driver advance.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #0f766e" }}>
        <div className="driver-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="header-title">
            <WalletCards size={32} color="#0f766e" />
            <div>
              <h2>Driver Advance Account</h2>
              <p>Give a driver road expense money and track what remains after approved expenses.</p>
            </div>
          </div>
          <div style={{ textAlign: "right", background: "#ecfdf5", padding: "10px 15px", borderRadius: "8px", border: "1px solid #99f6e4" }}>
            <small style={{ color: "#0f766e", fontWeight: "bold", display: "block" }}>ADVANCE VOUCHER</small>
            <span style={{ fontSize: "1.1rem", fontWeight: "bold", color: "#134e4a" }}>{form.voucherNo}</span>
          </div>
        </div>

        <div className="form-grid">
          <div className="section-title full-width">
            <UserRound size={18} /> Driver Selection
          </div>

          <div className="input-group">
            <label>Driver *</label>
            <select name="driverId" value={form.driverId} onChange={handleDriverChange}>
              <option value="">-- Select Driver --</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Advance Date *</label>
            <input name="date" type="date" value={form.date} onChange={handleChange} />
          </div>

          {selectedDriver && (
            <div className="full-width" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginTop: "-8px" }}>
              {[
                ["Given by Admin", selectedDriver.advances, "#0f766e"],
                ["Approved Spent", selectedDriver.approvedExpenses, "#b91c1c"],
                ["Pending Approval", selectedDriver.pendingExpenses, "#b45309"],
                ["Available", selectedDriver.available, selectedDriver.available < 0 ? "#b91c1c" : "#166534"],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px" }}>
                  <span style={{ color: "#64748b", fontSize: "0.78rem", fontWeight: "800", textTransform: "uppercase" }}>{label}</span>
                  <strong style={{ display: "block", color, fontSize: "1.15rem", marginTop: "4px" }}>
                    Rs {toNumber(value).toLocaleString("en-IN")}
                  </strong>
                </div>
              ))}
            </div>
          )}

          <div className="section-title full-width mt-4">
            <IndianRupee size={18} /> Payment Information
          </div>

          <div className="input-group">
            <label>Amount Given (Rs) *</label>
            <input name="amount" type="number" placeholder="e.g. 10000" value={form.amount} onChange={handleChange} style={{ borderColor: "#0f766e", borderWidth: "2px" }} />
          </div>

          <div className="input-group">
            <label>
              <Landmark size={14} style={{ display: "inline", marginRight: "5px" }} />
              Paid From Account *
            </label>
            <select name="paymentAccount" value={form.paymentAccount} onChange={handleChange} style={{ background: "#ecfdf5", borderColor: "#99f6e4" }}>
              <option value="">-- Select Bank or Cash Account --</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.accountName}>
                  {account.accountName}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Reference / UTR No.</label>
            <input name="referenceNo" placeholder="Optional" value={form.referenceNo} onChange={handleChange} />
          </div>

          <div className="input-group full-width">
            <label>Notes</label>
            <input name="notes" placeholder="e.g. Diesel and toll advance for this week" value={form.notes} onChange={handleChange} />
          </div>

          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleSave} disabled={isSubmitting || loading} style={{ background: "#0f766e" }}>
              {isSubmitting ? "Saving..." : "Give Driver Advance"} <HandCoins size={18} style={{ marginLeft: "8px" }} />
            </button>
          </div>
        </div>
      </div>

      <div className="list-container" style={{ marginTop: "1.5rem" }}>
        <div className="list-header">
          <div>
            <h2>Driver Advance Balances</h2>
            <p>Advance minus approved and pending driver expenses.</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading driver accounts...</div>
        ) : (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "12px", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "760px" }}>
              <thead>
                <tr style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.85rem", textTransform: "uppercase" }}>
                  <th style={{ padding: "1rem" }}>Driver</th>
                  <th style={{ padding: "1rem" }}>Given By Admin</th>
                  <th style={{ padding: "1rem" }}>Approved Spent</th>
                  <th style={{ padding: "1rem" }}>Pending Approval</th>
                  <th style={{ padding: "1rem" }}>Available</th>
                </tr>
              </thead>
              <tbody>
                {driverBalances.map((driver) => (
                  <tr key={driver.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem", fontWeight: "800", color: "#1e293b" }}>{driver.name}</td>
                    <td style={{ padding: "1rem", color: "#0f766e", fontWeight: "800" }}>Rs {driver.advances.toLocaleString("en-IN")}</td>
                    <td style={{ padding: "1rem", color: "#b91c1c", fontWeight: "800" }}>Rs {driver.approvedExpenses.toLocaleString("en-IN")}</td>
                    <td style={{ padding: "1rem", color: "#b45309", fontWeight: "800" }}>Rs {driver.pendingExpenses.toLocaleString("en-IN")}</td>
                    <td style={{ padding: "1rem", color: driver.available < 0 ? "#b91c1c" : "#166534", fontWeight: "900" }}>Rs {driver.available.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverAdvances;
