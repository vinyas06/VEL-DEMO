import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import {
  ArrowUpRight,
  IndianRupee,
  Landmark,
  Users,
  Link2,
} from "lucide-react";
import AttachmentUploader from "../components/AttachmentUploader";
import { uploadAttachments } from "../utils/attachments";
import { buildAgentBalanceMap, buildPartyBalanceMap } from "../utils/finance";
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css";

const buildVoucherNumber = () => `PV-${Math.floor(10000 + Math.random() * 90000)}`;
const sanitizeDecimalInput = (value) => value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

const decimalInputProps = {
  type: "text",
  inputMode: "decimal",
  pattern: "[0-9]*[.]?[0-9]*",
};

function PaymentOut() {
  const [parties, setParties] = useState([]);
  const [agents, setAgents] = useState([]);
  const [payees, setPayees] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);

  const [form, setForm] = useState({
    voucherNo: buildVoucherNumber(),
    date: new Date().toISOString().split("T")[0],
    category: "Commission Agent",
    payeeId: "",
    payeeName: "",
    bookingId: "",
    amount: "",
    paymentAccount: "",
    referenceNo: "",
    notes: "",
    type: "OUT",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [partySnap, agentSnap, accountSnap, bookingSnap, transactionSnap] =
          await Promise.all([
            getDocs(collection(db, "parties")),
            getDocs(collection(db, "agents")),
            getDocs(collection(db, "accounts")),
            getDocs(collection(db, "bookings")),
            getDocs(collection(db, "transactions")),
          ]);

        const partyData = partySnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        const agentData = agentSnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setParties(partyData);
        setAgents(agentData);
        setAccounts(accountSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setBookings(bookingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setTransactions(transactionSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching payout data:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const source = form.category === "Commission Agent" ? agents : parties;
    setPayees(source);
    setForm((prev) => ({
      ...prev,
      payeeId: "",
      payeeName: "",
      bookingId: "",
    }));
  }, [agents, parties, form.category]);

  const partyBalanceMap = buildPartyBalanceMap(parties, bookings, transactions);
  const agentBalanceMap = buildAgentBalanceMap(agents, bookings, transactions);

  const selectedSummary = (() => {
    if (!form.payeeId) {
      return null;
    }

    return form.category === "Commission Agent"
      ? agentBalanceMap[form.payeeId]
      : partyBalanceMap[form.payeeId];
  })();

  const outstandingBookings =
    form.category === "Commission Agent"
      ? selectedSummary?.outstandingBookings || []
      : [];

  const selectedBooking =
    outstandingBookings.find((booking) => booking.id === form.bookingId) || null;

  const payableAmount =
    form.category === "Commission Agent"
      ? Math.max(selectedSummary?.currentBalance || 0, 0)
      : Math.max(-(selectedSummary?.currentBalance || 0), 0);

  const linkedPayableAmount = selectedBooking?.outstandingAmount || 0;

  const handlePayeeChange = (event) => {
    const payeeId = event.target.value;
    const selectedPayee = payees.find((payee) => payee.id === payeeId);
    const summary =
      form.category === "Commission Agent"
        ? agentBalanceMap[payeeId]
        : partyBalanceMap[payeeId];
    const defaultBookingId =
      form.category === "Commission Agent" && summary?.outstandingBookings?.length === 1
        ? summary.outstandingBookings[0].id
        : "";

    setForm((prev) => ({
      ...prev,
      payeeId,
      payeeName: selectedPayee?.name || "",
      bookingId: defaultBookingId,
    }));
  };

  const handleChange = (event) => {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };
  const handleDecimalChange = (event) => {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: sanitizeDecimalInput(event.target.value),
    }));
  };

  const handleSave = async () => {
    if (!form.payeeId || !form.amount || !form.paymentAccount) {
      return alert("Please select a Payee, Amount, and Payment Account.");
    }

    const amount = Number(form.amount);
    if (amount <= 0) {
      return alert("Please enter a valid payment amount.");
    }

    const allowedAmount = selectedBooking ? linkedPayableAmount : payableAmount;
    if (allowedAmount > 0 && amount > allowedAmount) {
      return alert(`Payment exceeds pending payable of Rs ${allowedAmount.toLocaleString("en-IN")}.`);
    }

    const timestamp = new Date().toISOString();
    setIsSubmitting(true);
    let attachments = [];
    try {
      attachments = await uploadAttachments(attachmentFiles, "payment-out", form.voucherNo);
    } catch (error) {
      console.error("Error uploading payment attachments:", error);
      setIsSubmitting(false);
      return alert("Could not upload selected image/file. Please try again.");
    }

    const payload = {
      voucherNo: form.voucherNo,
      date: form.date,
      category: form.category,
      payeeId: form.payeeId,
      payeeName: form.payeeName,
      bookingId: selectedBooking?.id || "",
      bookingTrackingId: selectedBooking?.trackingId || "",
      bookingLrNumber: selectedBooking?.lrNumber || "",
      amount,
      paymentAccount: form.paymentAccount,
      referenceNo: form.referenceNo,
      notes: form.notes,
      type: "OUT",
      createdAt: timestamp,
      attachments,
    };

    try {
      const docRef = await addDoc(collection(db, "transactions"), payload);
      setTransactions((prev) => [...prev, { id: docRef.id, ...payload }]);
      await logActivity(db, {
        action: "payment_out_created",
        module: "payments",
        summary: `paid ${form.payeeName || "payee"} voucher ${form.voucherNo}`,
        targetId: docRef.id,
        targetType: "transaction",
      });

      alert(`Payment Voucher Saved!\nVoucher: ${form.voucherNo}`);

      setForm({
        voucherNo: buildVoucherNumber(),
        date: new Date().toISOString().split("T")[0],
        category: form.category,
        payeeId: "",
        payeeName: "",
        bookingId: "",
        amount: "",
        paymentAccount: "",
        referenceNo: "",
        notes: "",
        type: "OUT",
      });
      setAttachmentFiles([]);
    } catch (error) {
      console.error("Error saving payment out:", error);
      alert("Error saving payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #ef4444" }}>
        <div
          className="driver-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div className="header-title">
            <ArrowUpRight size={32} color="#ef4444" />
            <div>
              <h2>Payment Out</h2>
              <p>Record live payouts to agents and other payable accounts.</p>
            </div>
          </div>
          <div
            style={{
              textAlign: "right",
              background: "#fef2f2",
              padding: "10px 15px",
              borderRadius: "8px",
              border: "1px solid #fecaca",
            }}
          >
            <small style={{ color: "#b91c1c", fontWeight: "bold", display: "block" }}>
              PAYMENT VOUCHER
            </small>
            <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#7f1d1d" }}>
              {form.voucherNo}
            </span>
          </div>
        </div>

        <div className="form-grid">
          <div className="section-title full-width">
            <Users size={18} /> Payee Selection
          </div>

          <div className="input-group">
            <label>Payee Category *</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              style={{ background: "#fff1f2", borderColor: "#fecdd3" }}
            >
              <option value="Commission Agent">Broker / Commission Agent</option>
              <option value="Direct Party / Vendor">Direct Party / Vendor</option>
            </select>
          </div>

          <div className="input-group">
            <label>Paid To *</label>
            <select name="payeeId" value={form.payeeId} onChange={handlePayeeChange}>
              <option value="">-- Select Payee --</option>
              {payees.map((payee) => (
                <option key={payee.id} value={payee.id}>
                  {payee.name}
                </option>
              ))}
            </select>
          </div>

          {selectedSummary && (
            <div
              className="full-width"
              style={{
                background: "#f8fafc",
                padding: "12px 15px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                marginTop: "-10px",
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <span style={{ color: "#64748b", fontWeight: "bold", fontSize: "0.9rem" }}>
                  Current Position
                </span>
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                    color: payableAmount > 0 ? "#ef4444" : "#10b981",
                  }}
                >
                  {payableAmount > 0
                    ? `Rs ${payableAmount.toLocaleString("en-IN")} to pay`
                    : form.category === "Commission Agent"
                      ? "No pending payout"
                      : `Receivable balance Rs ${Math.max(
                          selectedSummary.currentBalance || 0,
                          0
                        ).toLocaleString("en-IN")}`}
                </div>
              </div>

              {form.category === "Commission Agent" && (
                <div style={{ textAlign: "right" }}>
                  <span style={{ color: "#64748b", fontWeight: "bold", fontSize: "0.9rem" }}>
                    Open Commission Dues
                  </span>
                  <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#0f172a" }}>
                    Rs{" "}
                    {outstandingBookings
                      .reduce((sum, booking) => sum + (booking.outstandingAmount || 0), 0)
                      .toLocaleString("en-IN")}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="input-group full-width">
            <label>
              <Link2 size={14} style={{ display: "inline", marginRight: "5px" }} />
              Link With Booking / LR
            </label>
            <select
              name="bookingId"
              value={form.bookingId}
              onChange={handleChange}
              disabled={form.category !== "Commission Agent" || outstandingBookings.length === 0}
            >
              <option value="">
                {form.category !== "Commission Agent"
                  ? "-- Booking link used for commission dues --"
                  : outstandingBookings.length === 0
                    ? "-- No pending booking dues --"
                    : "-- Keep as general payout --"}
              </option>
              {outstandingBookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  #{booking.label} | {booking.route} | Due Rs{" "}
                  {booking.outstandingAmount.toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          </div>

          {form.payeeId && (
            <div
              className="full-width"
              style={{
                background: "#fef2f2",
                padding: "10px 15px",
                borderRadius: "8px",
                border: "1px solid #fecaca",
                marginTop: "-10px",
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: "#991b1b", fontWeight: "bold", fontSize: "0.9rem" }}>
                {selectedBooking ? "Selected Booking Payable" : "Available Payable Amount"}
              </span>
              <span style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#7f1d1d" }}>
                Rs{" "}
                {(selectedBooking ? linkedPayableAmount : payableAmount).toLocaleString("en-IN")}
              </span>
            </div>
          )}

          <div className="section-title full-width mt-4">
            <IndianRupee size={18} /> Payment Information
          </div>

          <div className="input-group">
            <label>Payment Date *</label>
            <input name="date" type="date" value={form.date} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Amount Paid (Rs) *</label>
            <input
              name="amount"
              {...decimalInputProps}
              placeholder="e.g. 15000"
              value={form.amount}
              onChange={handleDecimalChange}
              style={{ borderColor: "#ef4444", borderWidth: "2px" }}
            />
          </div>

          <div className="input-group">
            <label>
              <Landmark size={14} style={{ display: "inline", marginRight: "5px" }} />
              Paid From (Account) *
            </label>
            <select
              name="paymentAccount"
              value={form.paymentAccount}
              onChange={handleChange}
              style={{ background: "#fef2f2", borderColor: "#fecaca" }}
            >
              <option value="">-- Select Bank or Cash --</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.accountName}>
                  {account.accountName}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Reference / UTR No.</label>
            <input
              name="referenceNo"
              placeholder="Transaction ID"
              value={form.referenceNo}
              onChange={handleChange}
            />
          </div>

          <div className="input-group full-width">
            <label>Notes / Remarks</label>
            <input
              name="notes"
              placeholder="e.g. Clearing pending broker commission"
              value={form.notes}
              onChange={handleChange}
            />
          </div>

          <AttachmentUploader
            files={attachmentFiles}
            onFilesChange={setAttachmentFiles}
            label="Payment Proof"
            hint="Use camera for receipt/cash proof or choose voucher image/PDF."
          />

          <div className="full-width mt-4">
            <button
              className="btn-submit"
              onClick={handleSave}
              disabled={isSubmitting}
              style={{ background: "#ef4444" }}
            >
              {isSubmitting ? "Saving Voucher..." : "Save Payment Out"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentOut;
