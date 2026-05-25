import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import {
  ArrowDownLeft,
  Building2,
  IndianRupee,
  Calendar,
  Landmark,
  Link2,
} from "lucide-react";
import { buildPartyBalanceMap } from "../utils/finance";
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css";

const buildReceiptNumber = () => `RV-${Math.floor(10000 + Math.random() * 90000)}`;
const sanitizeDecimalInput = (value) => value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

const decimalInputProps = {
  type: "text",
  inputMode: "decimal",
  pattern: "[0-9]*[.]?[0-9]*",
};

function PaymentIn() {
  const [parties, setParties] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    voucherNo: buildReceiptNumber(),
    date: new Date().toISOString().split("T")[0],
    partyId: "",
    partyName: "",
    bookingId: "",
    amount: "",
    paymentAccount: "",
    referenceNo: "",
    notes: "",
    type: "IN",
    category: "Party Receipt",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [partySnap, accountSnap, bookingSnap, transactionSnap] = await Promise.all([
          getDocs(collection(db, "parties")),
          getDocs(collection(db, "accounts")),
          getDocs(collection(db, "bookings")),
          getDocs(collection(db, "transactions")),
        ]);

        const partyData = partySnap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setParties(partyData);
        setAccounts(accountSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setBookings(bookingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setTransactions(transactionSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching payment data:", error);
      }
    };

    fetchData();
  }, []);

  const partyBalanceMap = buildPartyBalanceMap(parties, bookings, transactions);
  const selectedPartySummary = form.partyId ? partyBalanceMap[form.partyId] : null;
  const outstandingBookings = selectedPartySummary?.outstandingBookings || [];
  const selectedBooking =
    outstandingBookings.find((booking) => booking.id === form.bookingId) || null;

  const totalPendingAmount = Math.max(selectedPartySummary?.currentBalance || 0, 0);
  const linkedPendingAmount = selectedBooking?.outstandingAmount || 0;

  const handlePartyChange = (event) => {
    const partyId = event.target.value;
    const selectedParty = parties.find((party) => party.id === partyId);
    const summary = partyBalanceMap[partyId];
    const defaultBookingId =
      summary?.outstandingBookings?.length === 1 ? summary.outstandingBookings[0].id : "";

    setForm((prev) => ({
      ...prev,
      partyId,
      partyName: selectedParty?.name || "",
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
    if (!form.partyId || !form.amount || !form.paymentAccount) {
      return alert("Please select a Party, Amount, and Receiving Account.");
    }

    const amount = Number(form.amount);
    if (amount <= 0) {
      return alert("Please enter a valid receipt amount.");
    }

    const allowedAmount = selectedBooking
      ? linkedPendingAmount
      : totalPendingAmount;

    if (allowedAmount > 0 && amount > allowedAmount) {
      return alert(`Receipt exceeds pending amount of Rs ${allowedAmount.toLocaleString("en-IN")}.`);
    }

    const timestamp = new Date().toISOString();
    const payload = {
      voucherNo: form.voucherNo,
      date: form.date,
      partyId: form.partyId,
      partyName: form.partyName,
      bookingId: selectedBooking?.id || "",
      bookingTrackingId: selectedBooking?.trackingId || "",
      bookingLrNumber: selectedBooking?.lrNumber || "",
      amount,
      paymentAccount: form.paymentAccount,
      referenceNo: form.referenceNo,
      notes: form.notes,
      type: "IN",
      category: "Party Receipt",
      createdAt: timestamp,
    };

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "transactions"), payload);
      setTransactions((prev) => [...prev, { id: docRef.id, ...payload }]);
      await logActivity(db, {
        action: "payment_in_created",
        module: "payments",
        summary: `received payment from ${form.partyName || "party"} voucher ${form.voucherNo}`,
        targetId: docRef.id,
        targetType: "transaction",
      });

      alert(`Payment Receipt Saved!\nVoucher: ${form.voucherNo}`);

      setForm({
        voucherNo: buildReceiptNumber(),
        date: new Date().toISOString().split("T")[0],
        partyId: "",
        partyName: "",
        bookingId: "",
        amount: "",
        paymentAccount: "",
        referenceNo: "",
        notes: "",
        type: "IN",
        category: "Party Receipt",
      });
    } catch (error) {
      console.error("Error saving payment in:", error);
      alert("Error saving payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #10b981" }}>
        <div
          className="driver-header"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div className="header-title">
            <ArrowDownLeft size={32} color="#10b981" />
            <div>
              <h2>Payment In (Receipt)</h2>
              <p>Record customer collections against live booking dues.</p>
            </div>
          </div>
          <div
            style={{
              textAlign: "right",
              background: "#f0fdf4",
              padding: "10px 15px",
              borderRadius: "8px",
              border: "1px solid #bbf7d0",
            }}
          >
            <small style={{ color: "#166534", fontWeight: "bold", display: "block" }}>
              RECEIPT VOUCHER
            </small>
            <span style={{ fontSize: "1.2rem", fontWeight: "bold", color: "#14532d" }}>
              {form.voucherNo}
            </span>
          </div>
        </div>

        <div className="form-grid">
          <div className="section-title full-width">
            <Building2 size={18} /> Payer Details
          </div>

          <div className="input-group full-width">
            <label>Received From (Party / Customer) *</label>
            <select name="partyId" value={form.partyId} onChange={handlePartyChange}>
              <option value="">-- Select Party --</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
          </div>

          {selectedPartySummary && (
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
                  Current Balance
                </span>
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                    color: selectedPartySummary.currentBalance > 0 ? "#ef4444" : "#10b981",
                  }}
                >
                  Rs {Math.abs(selectedPartySummary.currentBalance).toLocaleString("en-IN")}
                  {selectedPartySummary.currentBalance > 0 ? " to collect" : " clear/advance"}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <span style={{ color: "#64748b", fontWeight: "bold", fontSize: "0.9rem" }}>
                  Open Booking Dues
                </span>
                <div style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#0f172a" }}>
                  Rs{" "}
                  {outstandingBookings
                    .reduce((sum, booking) => sum + (booking.outstandingAmount || 0), 0)
                    .toLocaleString("en-IN")}
                </div>
              </div>
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
              disabled={!form.partyId || outstandingBookings.length === 0}
            >
              <option value="">
                {outstandingBookings.length === 0
                  ? "-- No pending booking dues --"
                  : "-- Keep as general receipt --"}
              </option>
              {outstandingBookings.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  #{booking.label} | {booking.route} | Due Rs{" "}
                  {booking.outstandingAmount.toLocaleString("en-IN")}
                </option>
              ))}
            </select>
          </div>

          {form.partyId && (
            <div
              className="full-width"
              style={{
                background: "#ecfdf5",
                padding: "10px 15px",
                borderRadius: "8px",
                border: "1px solid #bbf7d0",
                marginTop: "-10px",
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ color: "#166534", fontWeight: "bold", fontSize: "0.9rem" }}>
                {selectedBooking ? "Selected Booking Due" : "Available Pending Receipt"}
              </span>
              <span style={{ fontWeight: "bold", fontSize: "1.1rem", color: "#14532d" }}>
                Rs{" "}
                {(selectedBooking ? linkedPendingAmount : totalPendingAmount).toLocaleString(
                  "en-IN"
                )}
              </span>
            </div>
          )}

          <div className="section-title full-width mt-4">
            <IndianRupee size={18} /> Payment Information
          </div>

          <div className="input-group">
            <label>Payment Date *</label>
            <div style={{ position: "relative" }}>
              <Calendar
                size={18}
                style={{ position: "absolute", left: "10px", top: "12px", color: "#64748b" }}
              />
              <input
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                style={{ paddingLeft: "35px" }}
              />
            </div>
          </div>

          <div className="input-group">
            <label>Amount Received (Rs) *</label>
            <input
              name="amount"
              {...decimalInputProps}
              placeholder="e.g. 50000"
              value={form.amount}
              onChange={handleDecimalChange}
              style={{ borderColor: "#10b981", borderWidth: "2px" }}
            />
          </div>

          <div className="input-group">
            <label>
              <Landmark size={14} style={{ display: "inline", marginRight: "5px" }} />
              Deposited Into (Account) *
            </label>
            <select
              name="paymentAccount"
              value={form.paymentAccount}
              onChange={handleChange}
              style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}
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
            <label>Reference / UTR / Cheque No.</label>
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
              placeholder="e.g. Cleared pending amount for one trip"
              value={form.notes}
              onChange={handleChange}
            />
          </div>

          <div className="full-width mt-4">
            <button
              className="btn-submit"
              onClick={handleSave}
              disabled={isSubmitting}
              style={{ background: "#10b981" }}
            >
              {isSubmitting ? "Saving Receipt..." : "Save Payment In"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentIn;
