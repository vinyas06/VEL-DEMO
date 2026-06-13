import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import TruckLoader from "../components/TruckLoader";
import Modal from "../components/Modal";
import { db } from "../firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { Landmark, Coins, TrendingUp, TrendingDown, IndianRupee, Wallet, BarChart3, Building2, PlusCircle, MinusCircle } from "lucide-react";
import { buildPartyBalanceMap, getAccountFinancialSummary } from "../utils/finance";
import "./AddDriver.css"; // Safely reusing your premium UI styles

function Accounts() {
  const [loading, setLoading] = useState(true);
  const [financials, setFinancials] = useState({
    cashAccounts: [],
    bankAccounts: [],
    totalCash: 0,
    totalBank: 0,
    totalIn: 0,
    totalOut: 0,
    outstandingMarket: 0,
  });
  const [adjustModal, setAdjustModal] = useState({ show: false, account: null });
  const [adjustForm, setAdjustForm] = useState({ type: "IN", amount: "", notes: "" });
  const [isSaving, setIsSaving] = useState(false);

  const fetchFinancialData = async () => {
    try {
        const [accSnap, trxSnap, bookSnap, partySnap] = await Promise.all([
          getDocs(collection(db, "accounts")),
          getDocs(collection(db, "transactions")),
          getDocs(collection(db, "bookings")),
          getDocs(collection(db, "parties")),
        ]);

        const accounts = accSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const transactions = trxSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const bookings = bookSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const parties = partySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const accountSummary = getAccountFinancialSummary(accounts, transactions);
        const partyBalanceMap = buildPartyBalanceMap(parties, bookings, transactions);
        const outstandingMarket = Object.values(partyBalanceMap).reduce(
          (sum, summary) => sum + Math.max(summary.currentBalance || 0, 0),
          0
        );

        setFinancials({
          cashAccounts: accountSummary.cashAccounts,
          bankAccounts: accountSummary.bankAccounts,
          totalCash: accountSummary.totalCash,
          totalBank: accountSummary.totalBank,
          totalIn: accountSummary.totalIn,
          totalOut: accountSummary.totalOut,
          outstandingMarket
        });

      } catch (error) {
        console.error("Error fetching financial data:", error);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const handleAdjustment = async () => {
    if (!adjustForm.amount || !adjustForm.notes) return alert("Please enter amount and notes.");
    setIsSaving(true);
    try {
      await addDoc(collection(db, "transactions"), {
        voucherNo: `ADJ-${Math.floor(10000 + Math.random() * 90000)}`,
        date: new Date().toISOString().split("T")[0],
        type: adjustForm.type,
        amount: Number(adjustForm.amount),
        paymentAccount: adjustModal.account.accountName,
        category: "Manual Adjustment",
        notes: adjustForm.notes,
        createdAt: new Date().toISOString()
      });
      alert("Adjustment saved successfully.");
      setAdjustModal({ show: false, account: null });
      setAdjustForm({ type: "IN", amount: "", notes: "" });
      fetchFinancialData();
    } catch (e) {
      console.error(e);
      alert("Error saving adjustment.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="list-container" style={{ maxWidth: "1000px" }}>
        
        <div className="list-header" style={{ marginBottom: "2rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <BarChart3 size={32} color="#2563eb" />
            <div>
              <h2 style={{ margin: 0, color: "#1e293b", fontSize: "2rem" }}>Financial Overview</h2>
              <p style={{ margin: "5px 0 0 0", color: "#64748b" }}>Live tracking of cash, banks, income, and market dues.</p>
            </div>
          </div>
        </div>

        {loading ? <TruckLoader text="Loading....." /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            
            {/* TOP ROW: MASTER BALANCES */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem" }}>
              
              {/* Cash Balance Card */}
              <div style={{ background: "white", padding: "1.5rem", borderRadius: "16px", border: "1px solid #e2e8f0", borderTop: "5px solid #f59e0b", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <span style={{ color: "#64748b", fontWeight: "bold", fontSize: "0.9rem", textTransform: "uppercase" }}>Total Cash in Hand</span>
                  <Coins size={24} color="#f59e0b" />
                </div>
                <h3 style={{ margin: 0, fontSize: "2.2rem", color: "#1e293b" }}>₹ {financials.totalCash.toLocaleString('en-IN')}</h3>
              </div>

              {/* Bank Balance Card */}
              <div style={{ background: "white", padding: "1.5rem", borderRadius: "16px", border: "1px solid #e2e8f0", borderTop: "5px solid #3b82f6", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <span style={{ color: "#64748b", fontWeight: "bold", fontSize: "0.9rem", textTransform: "uppercase" }}>Total Bank Balance</span>
                  <Landmark size={24} color="#3b82f6" />
                </div>
                <h3 style={{ margin: 0, fontSize: "2.2rem", color: "#1e293b" }}>₹ {financials.totalBank.toLocaleString('en-IN')}</h3>
              </div>

              {/* Market Outstanding Card */}
              <div style={{ background: "white", padding: "1.5rem", borderRadius: "16px", border: "1px solid #e2e8f0", borderTop: "5px solid #8b5cf6", boxShadow: "0 4px 6px rgba(0,0,0,0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <span style={{ color: "#64748b", fontWeight: "bold", fontSize: "0.9rem", textTransform: "uppercase" }}>Market Receivables</span>
                  <Wallet size={24} color="#8b5cf6" />
                </div>
                <h3 style={{ margin: 0, fontSize: "2.2rem", color: "#1e293b" }}>₹ {financials.outstandingMarket.toLocaleString('en-IN')}</h3>
                <small style={{ color: "#94a3b8" }}>Pending dues from trips</small>
              </div>

            </div>

            {/* MIDDLE ROW: IN vs OUT */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div style={{ background: "#f0fdf4", padding: "1.5rem", borderRadius: "16px", border: "1px solid #bbf7d0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <TrendingUp size={20} color="#166534" />
                  <span style={{ color: "#166534", fontWeight: "bold" }}>Total Income</span>
                </div>
                <h3 style={{ margin: 0, fontSize: "1.8rem", color: "#14532d" }}>₹ {financials.totalIn.toLocaleString('en-IN')}</h3>
              </div>

              <div style={{ background: "#fef2f2", padding: "1.5rem", borderRadius: "16px", border: "1px solid #fecaca" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <TrendingDown size={20} color="#b91c1c" />
                  <span style={{ color: "#b91c1c", fontWeight: "bold" }}>Total Expenses & Payouts</span>
                </div>
                <h3 style={{ margin: 0, fontSize: "1.8rem", color: "#7f1d1d" }}>₹ {financials.totalOut.toLocaleString('en-IN')}</h3>
              </div>
            </div>

            {/* BOTTOM ROW: ACCOUNT BREAKDOWN */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1rem" }}>
              
              {/* Cash Accounts List */}
              <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", padding: "1rem", borderBottom: "1px solid #e2e8f0", fontWeight: "bold", color: "#334155", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Coins size={18} color="#f59e0b" /> Cash Boxes
                </div>
                <div style={{ padding: "1rem" }}>
                  {financials.cashAccounts.length === 0 ? <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>No cash accounts created yet.</p> : 
                    financials.cashAccounts.map(acc => (
                      <div key={acc.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.8rem 0", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
                        <span style={{ color: "#475569", fontWeight: "500" }}>{acc.accountName}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <strong style={{ color: acc.liveBalance < 0 ? "#ef4444" : "#10b981" }}>₹{acc.liveBalance.toLocaleString('en-IN')}</strong>
                          <button onClick={() => setAdjustModal({ show: true, account: acc })} style={{ background: "none", border: "1px solid #e2e8f0", padding: "4px 8px", borderRadius: "6px", color: "#3b82f6", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}>Adjust</button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Bank Accounts List */}
              <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ background: "#f8fafc", padding: "1rem", borderBottom: "1px solid #e2e8f0", fontWeight: "bold", color: "#334155", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Building2 size={18} color="#3b82f6" /> Bank Accounts
                </div>
                <div style={{ padding: "1rem" }}>
                  {financials.bankAccounts.length === 0 ? <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>No bank accounts created yet.</p> : 
                    financials.bankAccounts.map(acc => (
                      <div key={acc.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.8rem 0", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span style={{ color: "#475569", fontWeight: "500" }}>{acc.accountName}</span>
                          {acc.accountNumber && <small style={{ color: "#94a3b8" }}>A/c: {acc.accountNumber}</small>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <strong style={{ color: acc.liveBalance < 0 ? "#ef4444" : "#10b981" }}>₹{acc.liveBalance.toLocaleString('en-IN')}</strong>
                          <button onClick={() => setAdjustModal({ show: true, account: acc })} style={{ background: "none", border: "1px solid #e2e8f0", padding: "4px 8px", borderRadius: "6px", color: "#3b82f6", cursor: "pointer", fontSize: "0.8rem", fontWeight: "bold" }}>Adjust</button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

            </div>

          </div>
        )}

        {adjustModal.show && (
          <Modal onClose={() => setAdjustModal({ show: false, account: null })}>
            <div className="pro-modal-content" style={{ maxWidth: "400px" }}>
              <div className="modal-header">
                <h3>Adjust Balance</h3>
                <span className="status-badge active">{adjustModal.account.accountName}</span>
              </div>
              <div className="modal-form-grid" style={{ marginTop: "1rem" }}>
                <div className="input-group full-width">
                  <label>Adjustment Type</label>
                  <select value={adjustForm.type} onChange={e => setAdjustForm({...adjustForm, type: e.target.value})}>
                    <option value="IN">Cash In (Increase Balance)</option>
                    <option value="OUT">Cash Out (Decrease Balance)</option>
                  </select>
                </div>
                <div className="input-group full-width">
                  <label>Amount (₹)</label>
                  <input type="number" placeholder="Enter amount" value={adjustForm.amount} onChange={e => setAdjustForm({...adjustForm, amount: e.target.value})} />
                </div>
                <div className="input-group full-width">
                  <label>Notes / Reason</label>
                  <input type="text" placeholder="e.g. Opening balance correction" value={adjustForm.notes} onChange={e => setAdjustForm({...adjustForm, notes: e.target.value})} />
                </div>
                <div className="modal-actions full-width" style={{ marginTop: "20px" }}>
                  <button className="btn-cancel" onClick={() => setAdjustModal({ show: false, account: null })}>Cancel</button>
                  <button className="btn-save" onClick={handleAdjustment} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Adjustment"}
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

export default Accounts;
