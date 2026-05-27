import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { ArrowLeftRight, IndianRupee, Landmark, ReceiptText } from "lucide-react";
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css";

const buildTransferVoucher = () => `TRF-${Math.floor(10000 + Math.random() * 90000)}`;

function SelfTransfer() {
  const [accounts, setAccounts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    voucherNo: buildTransferVoucher(),
    date: new Date().toISOString().split("T")[0],
    fromAccount: "",
    toAccount: "",
    amount: "",
    referenceNo: "",
    notes: "",
  });

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accountSnap = await getDocs(collection(db, "accounts"));
        setAccounts(accountSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
      } catch (error) {
        console.error("Error loading accounts:", error);
      }
    };

    fetchAccounts();
  }, []);

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSave = async () => {
    if (!form.fromAccount || !form.toAccount || !form.amount) {
      return alert("Please select From Account, To Account, and Amount.");
    }

    if (form.fromAccount === form.toAccount) {
      return alert("From Account and To Account cannot be same.");
    }

    const amount = Number(form.amount);
    if (amount <= 0) {
      return alert("Please enter a valid transfer amount.");
    }

    const timestamp = new Date().toISOString();
    const transferId = `${form.voucherNo}-${Date.now()}`;
    const commonFields = {
      voucherNo: form.voucherNo,
      transferId,
      date: form.date,
      category: "Self Transfer",
      amount,
      referenceNo: form.referenceNo,
      notes: form.notes || `Self transfer from ${form.fromAccount} to ${form.toAccount}`,
      createdAt: timestamp,
    };

    setIsSubmitting(true);
    try {
      const [outRef, inRef] = await Promise.all([
        addDoc(collection(db, "transactions"), {
          ...commonFields,
          type: "TRANSFER_OUT",
          paymentAccount: form.fromAccount,
          targetName: form.toAccount,
          payeeName: form.toAccount,
        }),
        addDoc(collection(db, "transactions"), {
          ...commonFields,
          type: "TRANSFER_IN",
          paymentAccount: form.toAccount,
          targetName: form.fromAccount,
          partyName: form.fromAccount,
        }),
      ]);
      await logActivity(db, {
        action: "self_transfer_created",
        module: "payments",
        summary: `Transferred Rs ${amount.toLocaleString("en-IN")} from ${form.fromAccount} to ${form.toAccount}`,
        targetId: transferId,
        targetType: "transfer",
        metadata: { outTransactionId: outRef.id, inTransactionId: inRef.id },
      });

      alert(`Self transfer recorded.\nVoucher: ${form.voucherNo}`);
      setForm({
        voucherNo: buildTransferVoucher(),
        date: new Date().toISOString().split("T")[0],
        fromAccount: "",
        toAccount: "",
        amount: "",
        referenceNo: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error saving self transfer:", error);
      alert("Error saving transfer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #2563eb" }}>
        <div className="driver-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="header-title">
            <ArrowLeftRight size={32} color="#2563eb" />
            <div>
              <h2>Self Transfer</h2>
              <p>Move money between your own cash and bank accounts without changing income or expense totals.</p>
            </div>
          </div>
          <div style={{ textAlign: "right", background: "#eff6ff", padding: "10px 15px", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
            <small style={{ color: "#1d4ed8", fontWeight: "bold", display: "block" }}>TRANSFER VOUCHER</small>
            <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#1e40af" }}>{form.voucherNo}</span>
          </div>
        </div>

        <div className="form-grid">
          <div className="section-title full-width">
            <Landmark size={18} /> Account Movement
          </div>

          <div className="input-group">
            <label>From Account *</label>
            <select name="fromAccount" value={form.fromAccount} onChange={handleChange} style={{ background: "#fef2f2", borderColor: "#fecaca" }}>
              <option value="">-- Select Source Account --</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.accountName}>
                  {account.accountName}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>To Account *</label>
            <select name="toAccount" value={form.toAccount} onChange={handleChange} style={{ background: "#ecfdf5", borderColor: "#bbf7d0" }}>
              <option value="">-- Select Destination Account --</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.accountName}>
                  {account.accountName}
                </option>
              ))}
            </select>
          </div>

          <div className="section-title full-width mt-4">
            <IndianRupee size={18} /> Transfer Details
          </div>

          <div className="input-group">
            <label>Transfer Date *</label>
            <input name="date" type="date" value={form.date} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Amount (Rs) *</label>
            <input name="amount" type="number" placeholder="e.g. 25000" value={form.amount} onChange={handleChange} style={{ borderColor: "#2563eb", borderWidth: "2px" }} />
          </div>

          <div className="input-group">
            <label>Reference / UTR No.</label>
            <input name="referenceNo" placeholder="Optional bank reference" value={form.referenceNo} onChange={handleChange} />
          </div>

          <div className="input-group full-width">
            <label>Notes</label>
            <input name="notes" placeholder="e.g. Cash deposited to SBI current account" value={form.notes} onChange={handleChange} />
          </div>

          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleSave} disabled={isSubmitting} style={{ background: "#2563eb" }}>
              {isSubmitting ? "Saving Transfer..." : "Record Self Transfer"} <ReceiptText size={18} style={{ marginLeft: "8px" }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SelfTransfer;
