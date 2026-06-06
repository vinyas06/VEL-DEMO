import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { Calendar, CreditCard, IndianRupee, ReceiptText, Users, Wallet } from "lucide-react";
import AttachmentUploader from "../components/AttachmentUploader";
import { uploadAttachments } from "../utils/attachments";
import { logActivity } from "../utils/activityLog";
import { getAccountFinancialSummary } from "../utils/finance";
import "./AddDriver.css";
import "./BookingList.css";

const CATEGORY = "Family Credit/Debit";

const buildFamilyVoucher = () => `FAM-${Math.floor(10000 + Math.random() * 90000)}`;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getRecordDate = (record = {}) => record.date || record.createdAt || "";

const getRecordTime = (record = {}) => {
  const parsed = new Date(getRecordDate(record)).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) => `Rs ${toNumber(value).toLocaleString("en-IN")}`;

const getFamilyName = (transaction = {}) =>
  transaction.familyMemberName ||
  transaction.partyName ||
  transaction.payeeName ||
  transaction.targetName ||
  "Family";

const getFamilyEffect = (transaction = {}) =>
  transaction.type === "IN" ? toNumber(transaction.amount) : -toNumber(transaction.amount);

function FamilyCreditDebit() {
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [statementFilter, setStatementFilter] = useState({
    month: new Date().toISOString().slice(0, 7),
    familyMember: "All",
    account: "All",
  });
  const [form, setForm] = useState({
    voucherNo: buildFamilyVoucher(),
    date: new Date().toISOString().split("T")[0],
    flow: "CREDIT_FROM_FAMILY",
    familyMemberName: "",
    paymentAccount: "",
    amount: "",
    referenceNo: "",
    notes: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountSnap, transactionSnap] = await Promise.all([
          getDocs(collection(db, "accounts")),
          getDocs(collection(db, "transactions")),
        ]);

        setAccounts(accountSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
        setTransactions(transactionSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
      } catch (error) {
        console.error("Error loading family credit/debit data:", error);
      }
    };

    fetchData();
  }, []);

  const familyTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.category === CATEGORY),
    [transactions]
  );

  const familyMembers = useMemo(
    () => Array.from(new Set(familyTransactions.map(getFamilyName))).filter(Boolean).sort(),
    [familyTransactions]
  );

  const accountSummary = useMemo(
    () => getAccountFinancialSummary(accounts, transactions),
    [accounts, transactions]
  );

  const selectedAccountBalance = useMemo(() => {
    const allAccounts = [...accountSummary.cashAccounts, ...accountSummary.bankAccounts];
    return allAccounts.find((account) => account.accountName === form.paymentAccount)?.liveBalance;
  }, [accountSummary, form.paymentAccount]);

  const filteredFamilyTransactions = useMemo(() => {
    return familyTransactions
      .filter((transaction) => {
        const dateValue = getRecordDate(transaction).slice(0, 10);
        const monthMatches = !statementFilter.month || dateValue.startsWith(statementFilter.month);
        const memberMatches =
          statementFilter.familyMember === "All" ||
          getFamilyName(transaction) === statementFilter.familyMember;
        const accountMatches =
          statementFilter.account === "All" ||
          transaction.paymentAccount === statementFilter.account ||
          transaction.paymentMode === statementFilter.account;

        return monthMatches && memberMatches && accountMatches;
      })
      .sort((a, b) => getRecordTime(a) - getRecordTime(b));
  }, [familyTransactions, statementFilter]);

  const openingBalance = useMemo(() => {
    if (!statementFilter.month) return 0;

    const monthStart = `${statementFilter.month}-01`;
    return familyTransactions
      .filter((transaction) => {
        const dateValue = getRecordDate(transaction).slice(0, 10);
        const memberMatches =
          statementFilter.familyMember === "All" ||
          getFamilyName(transaction) === statementFilter.familyMember;
        const accountMatches =
          statementFilter.account === "All" ||
          transaction.paymentAccount === statementFilter.account ||
          transaction.paymentMode === statementFilter.account;

        return dateValue && dateValue < monthStart && memberMatches && accountMatches;
      })
      .reduce((sum, transaction) => sum + getFamilyEffect(transaction), 0);
  }, [familyTransactions, statementFilter]);

  const statementRows = useMemo(() => {
    let runningBalance = openingBalance;
    return filteredFamilyTransactions.map((transaction) => {
      runningBalance += getFamilyEffect(transaction);
      return { ...transaction, runningBalance };
    });
  }, [filteredFamilyTransactions, openingBalance]);

  const totals = useMemo(() => {
    const received = filteredFamilyTransactions
      .filter((transaction) => transaction.type === "IN")
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const given = filteredFamilyTransactions
      .filter((transaction) => transaction.type !== "IN")
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const closingBalance = openingBalance + received - given;

    return { received, given, closingBalance };
  }, [filteredFamilyTransactions, openingBalance]);

  const updateForm = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const updateStatementFilter = (event) => {
    setStatementFilter((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const resetForm = () => {
    setForm({
      voucherNo: buildFamilyVoucher(),
      date: new Date().toISOString().split("T")[0],
      flow: "CREDIT_FROM_FAMILY",
      familyMemberName: "",
      paymentAccount: "",
      amount: "",
      referenceNo: "",
      notes: "",
    });
  };

  const handleSave = async () => {
    if (!form.familyMemberName.trim() || !form.paymentAccount || !form.amount) {
      return alert("Family member, account, and amount are required.");
    }

    const amount = Number(form.amount);
    if (amount <= 0) {
      return alert("Please enter a valid amount.");
    }

    const isCreditFromFamily = form.flow === "CREDIT_FROM_FAMILY";
    const familyName = form.familyMemberName.trim();
    const timestamp = new Date().toISOString();
    setIsSubmitting(true);
    let attachments = [];
    try {
      attachments = await uploadAttachments(attachmentFiles, "family-credit-debit", form.voucherNo);
    } catch (error) {
      console.error("Error uploading family credit/debit attachments:", error);
      setIsSubmitting(false);
      return alert("Could not upload selected image/file. Please try again.");
    }

    const payload = {
      voucherNo: form.voucherNo,
      date: form.date,
      type: isCreditFromFamily ? "IN" : "OUT",
      category: CATEGORY,
      familyFlow: form.flow,
      familyMemberName: familyName,
      partyName: isCreditFromFamily ? familyName : "",
      payeeName: isCreditFromFamily ? "" : familyName,
      targetName: familyName,
      paymentAccount: form.paymentAccount,
      amount,
      referenceNo: form.referenceNo,
      notes:
        form.notes ||
        (isCreditFromFamily
          ? `Credit taken from ${familyName}`
          : `Debit paid/given to ${familyName}`),
      createdAt: timestamp,
      attachments,
    };

    try {
      const docRef = await addDoc(collection(db, "transactions"), payload);
      await logActivity(db, {
        action: "family_credit_debit_created",
        module: "payments",
        summary: `${isCreditFromFamily ? "Family credit received" : "Family debit paid"} Rs ${amount.toLocaleString("en-IN")} - ${familyName}`,
        targetId: docRef.id,
        targetType: "transaction",
      });

      setTransactions((prev) => [...prev, { id: docRef.id, ...payload }]);
      alert(`Family credit/debit saved.\nVoucher: ${form.voucherNo}`);
      resetForm();
      setAttachmentFiles([]);
    } catch (error) {
      console.error("Error saving family credit/debit:", error);
      alert("Error saving family credit/debit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const balanceLabel =
    totals.closingBalance > 0
      ? "Payable to family"
      : totals.closingBalance < 0
        ? "Receivable from family"
        : "Settled";

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #0f766e", maxWidth: "980px" }}>
        <div className="driver-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="header-title">
            <Users size={32} color="#0f766e" />
            <div>
              <h2>Family Credit/Debit</h2>
              <p>Record money received from family or paid/given to family against cash and bank accounts.</p>
            </div>
          </div>
          <div style={{ textAlign: "right", background: "#f0fdfa", padding: "10px 15px", borderRadius: "8px", border: "1px solid #99f6e4" }}>
            <small style={{ color: "#0f766e", fontWeight: "bold", display: "block" }}>FAMILY VOUCHER</small>
            <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#115e59" }}>{form.voucherNo}</span>
          </div>
        </div>

        <div className="form-grid">
          <div className="section-title full-width">
            <CreditCard size={18} /> Entry Details
          </div>

          <div className="input-group">
            <label>Entry Type *</label>
            <select name="flow" value={form.flow} onChange={updateForm}>
              <option value="CREDIT_FROM_FAMILY">Credit from Family (Cash/Bank In)</option>
              <option value="DEBIT_TO_FAMILY">Debit to Family (Cash/Bank Out)</option>
            </select>
          </div>

          <div className="input-group">
            <label>Date *</label>
            <input name="date" type="date" value={form.date} onChange={updateForm} />
          </div>

          <div className="input-group">
            <label>Family Member *</label>
            <input name="familyMemberName" placeholder="e.g. Father, Brother, Uncle" value={form.familyMemberName} onChange={updateForm} />
          </div>

          <div className="input-group">
            <label>Cash / Bank Account *</label>
            <select name="paymentAccount" value={form.paymentAccount} onChange={updateForm}>
              <option value="">-- Select Cash or Bank --</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.accountName}>
                  {account.accountName}
                </option>
              ))}
            </select>
          </div>

          <div className="section-title full-width mt-4">
            <IndianRupee size={18} /> Amount Information
          </div>

          <div className="input-group">
            <label>Amount (Rs) *</label>
            <input name="amount" type="number" placeholder="e.g. 50000" value={form.amount} onChange={updateForm} style={{ borderColor: "#0f766e", borderWidth: "2px" }} />
          </div>

          <div className="input-group">
            <label>Reference / UTR No.</label>
            <input name="referenceNo" placeholder="Optional reference" value={form.referenceNo} onChange={updateForm} />
          </div>

          <div className="input-group full-width">
            <label>Notes</label>
            <input name="notes" placeholder="e.g. Temporary cash support for office use" value={form.notes} onChange={updateForm} />
          </div>

          <AttachmentUploader
            files={attachmentFiles}
            onFilesChange={setAttachmentFiles}
            label="Family Credit/Debit Proof"
            hint="Upload cash note, bank transfer screenshot, or signed proof."
          />

          {form.paymentAccount && (
            <div className="full-width" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px", color: "#475569", fontWeight: "bold" }}>
                <Wallet size={18} /> Current account balance after existing entries
              </span>
              <strong style={{ color: toNumber(selectedAccountBalance) < 0 ? "#dc2626" : "#0f766e", fontSize: "1.1rem" }}>
                {selectedAccountBalance === undefined ? "Account not found" : formatCurrency(selectedAccountBalance)}
              </strong>
            </div>
          )}

          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleSave} disabled={isSubmitting} style={{ background: "#0f766e" }}>
              {isSubmitting ? "Saving Entry..." : "Save Family Credit/Debit"} <ReceiptText size={18} style={{ marginLeft: "8px" }} />
            </button>
          </div>
        </div>
      </div>

      <div className="list-container">
        <div className="list-header">
          <div>
            <h2>Family Statement</h2>
            <p>Running family credit/debit statement with opening and closing balance.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", width: "100%", maxWidth: "650px" }}>
            <div className="search-box" style={{ maxWidth: "none" }}>
              <Calendar size={18} className="search-icon" />
              <input name="month" type="month" value={statementFilter.month} onChange={updateStatementFilter} style={{ paddingLeft: "2.5rem" }} />
            </div>
            <select name="familyMember" value={statementFilter.familyMember} onChange={updateStatementFilter} style={{ padding: "0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
              <option value="All">All Family</option>
              {familyMembers.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select name="account" value={statementFilter.account} onChange={updateStatementFilter} style={{ padding: "0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
              <option value="All">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.accountName}>{account.accountName}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "1rem" }}>
          {[
            ["Opening Balance", openingBalance, "#334155"],
            ["Credit from Family", totals.received, "#16a34a"],
            ["Debit to Family", totals.given, "#dc2626"],
            [balanceLabel, Math.abs(totals.closingBalance), totals.closingBalance >= 0 ? "#0f766e" : "#b45309"],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem" }}>
              <small style={{ color: "#64748b", fontWeight: "bold", textTransform: "uppercase" }}>{label}</small>
              <div style={{ color, fontSize: "1.3rem", fontWeight: "bold", marginTop: "6px" }}>{formatCurrency(value)}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", overflow: "hidden", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", minWidth: "900px" }}>
            <thead>
              <tr style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.85rem", textTransform: "uppercase" }}>
                <th style={{ padding: "1rem" }}>Date & Voucher</th>
                <th style={{ padding: "1rem" }}>Family Member</th>
                <th style={{ padding: "1rem" }}>Account</th>
                <th style={{ padding: "1rem", color: "#166534" }}>Credit In</th>
                <th style={{ padding: "1rem", color: "#991b1b" }}>Debit Out</th>
                <th style={{ padding: "1rem" }}>Family Balance</th>
                <th style={{ padding: "1rem" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {statementRows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                    No family credit/debit entries found for this filter.
                  </td>
                </tr>
              ) : (
                [...statementRows].reverse().map((transaction) => (
                  <tr key={transaction.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "1rem" }}>
                      <strong>{transaction.date || "-"}</strong><br />
                      <small style={{ color: "#64748b", fontWeight: "600" }}>{transaction.voucherNo || "-"}</small>
                    </td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: "#1e293b" }}>{getFamilyName(transaction)}</td>
                    <td style={{ padding: "1rem", color: "#475569" }}>{transaction.paymentAccount || transaction.paymentMode || "-"}</td>
                    <td style={{ padding: "1rem", color: "#16a34a", fontWeight: "bold" }}>
                      {transaction.type === "IN" ? formatCurrency(transaction.amount) : "-"}
                    </td>
                    <td style={{ padding: "1rem", color: "#dc2626", fontWeight: "bold" }}>
                      {transaction.type !== "IN" ? formatCurrency(transaction.amount) : "-"}
                    </td>
                    <td style={{ padding: "1rem", fontWeight: "bold", color: transaction.runningBalance >= 0 ? "#0f766e" : "#b45309" }}>
                      {formatCurrency(Math.abs(transaction.runningBalance))}
                      <small style={{ display: "block", color: "#64748b", fontWeight: "600" }}>
                        {transaction.runningBalance >= 0 ? "Payable" : "Receivable"}
                      </small>
                    </td>
                    <td style={{ padding: "1rem", color: "#64748b" }}>{transaction.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FamilyCreditDebit;
