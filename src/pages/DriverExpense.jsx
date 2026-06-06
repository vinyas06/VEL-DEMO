import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where, or } from "firebase/firestore";
import { Send, ClipboardList, Link2, Truck, WalletCards, ArrowLeft } from "lucide-react";
import AttachmentUploader from "../components/AttachmentUploader";
import { uploadAttachments } from "../utils/attachments";
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css";

const getDriverName = (record = {}) => record.driverName || record.payeeName || record.payee || "";
const DRIVER_TRIP_EXPENSE_CATEGORIES = [
  "Petrol",
  "Fastag",
  "Hamali/Labour Loading Unloading",
  "Police Fine",
  "Check Post Police Tips",
  "Trip Allowance",
  "AdBlue",
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const buildDriverWallet = (driverName, transactions = [], submissions = []) => {
  const driverTransactions = transactions.filter((transaction) => getDriverName(transaction) === driverName);
  const givenByAdmin = driverTransactions
    .filter((transaction) => transaction.category === "Driver Advance")
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
  const approvedSpent = driverTransactions
    .filter(
      (transaction) =>
        transaction.category !== "Driver Advance" &&
        transaction.category !== "Driver Salary" &&
        transaction.deductionSource !== "driver_salary" &&
        transaction.type !== "IN" &&
        transaction.type !== "TRANSFER_IN"
    )
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
  const pendingSpent = submissions
    .filter(
      (submission) =>
        getDriverName(submission) === driverName &&
        submission.deductionSource !== "driver_salary"
    )
    .reduce((sum, submission) => sum + toNumber(submission.amount), 0);

  return {
    givenByAdmin,
    approvedSpent,
    pendingSpent,
    available: givenByAdmin - approvedSpent - pendingSpent,
  };
};

function DriverExpense() {
  const user = JSON.parse(localStorage.getItem("user"));
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [wallet, setWallet] = useState({ givenByAdmin: 0, approvedSpent: 0, pendingSpent: 0, available: 0 });
  const [submissions, setSubmissions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "Petrol",
    bookingId: "",
    trackingId: "",
    vehicleNumber: "",
    amount: "",
    deductionSource: "admin_account",
    notes: "",
  });

  useEffect(() => {
    const fetchTrips = async () => {
      if (!user?.name) {
        return;
      }

      try {
        const tripQuery = query(
          collection(db, "bookings"),
          or(where("driver", "==", user.name), where("driver2", "==", user.name))
        );
        const [tripSnap, transactionSnap, submissionSnap] = await Promise.all([
          getDocs(tripQuery),
          getDocs(collection(db, "transactions")),
          getDocs(collection(db, "driver_submissions")),
        ]);
        const tripData = tripSnap.docs
          .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const transactionData = transactionSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
        const submissionData = submissionSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
        setTrips(tripData);
        setSubmissions(submissionData);
        setWallet(buildDriverWallet(user.name, transactionData, submissionData));
      } catch (error) {
        console.error("Error fetching driver trips:", error);
      }
    };

    fetchTrips();
  }, [user?.name]);

  const handleTripChange = (event) => {
    const bookingId = event.target.value;
    const selectedTrip = trips.find((trip) => trip.id === bookingId);

    setForm((prev) => ({
      ...prev,
      bookingId,
      trackingId: selectedTrip?.trackingId || "",
      vehicleNumber: selectedTrip?.vehicle || prev.vehicleNumber,
    }));
  };

  const handleSend = async () => {
    if (!form.amount) {
      return alert("Please enter Amount.");
    }
    if (!form.bookingId) {
      return alert("Please select the trip for this expense.");
    }

    setIsSubmitting(true);
    try {
      const recordKey = `${user?.name || "driver"}-${form.trackingId || form.bookingId}-${Date.now()}`;
      const attachments = await uploadAttachments(attachmentFiles, "driver-expenses", recordKey);
      const payload = {
        ...form,
        driverName: user?.name || "Unknown Driver",
        amount: Number(form.amount),
        deductionSource: form.deductionSource,
        status: "Pending Approval",
        createdAt: new Date().toISOString(),
        attachments,
      };
      const docRef = await addDoc(collection(db, "driver_submissions"), payload);
      await logActivity(db, {
        action: "driver_expense_submitted",
        module: "driver_expenses",
        summary: `${user?.name || "Driver"} submitted ${form.category} expense Rs ${Number(form.amount).toLocaleString("en-IN")}`,
        targetId: docRef.id,
        targetType: "driver_submission",
      });
      const updatedSubmissions = [...submissions, { id: docRef.id, ...payload }];
      setSubmissions(updatedSubmissions);
      if (form.deductionSource !== "driver_salary") {
        setWallet((prev) => ({
          ...prev,
          pendingSpent: prev.pendingSpent + Number(form.amount),
          available: prev.givenByAdmin - prev.approvedSpent - (prev.pendingSpent + Number(form.amount)),
        }));
      }

      alert("Expense sent for Admin Approval!");
      setForm({
        date: new Date().toISOString().split("T")[0],
        category: "Petrol",
        bookingId: "",
        trackingId: "",
        vehicleNumber: "",
        amount: "",
        deductionSource: "admin_account",
        notes: "",
      });
      setAttachmentFiles([]);
    } catch (error) {
      console.error("Error submitting driver expense:", error);
      alert("Error submitting expense.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card">
        <div className="driver-header">
          <div className="header-title">
            <ClipboardList size={28} className="text-blue" />
            <div>
                <h2>Submit Trip Expense</h2>
                <p>Send trip-related expenses to Admin for approval.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/driver-dashboard")}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              borderRadius: "8px",
              padding: "0.65rem 0.9rem",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              fontWeight: "800",
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={18} /> Back
          </button>
        </div>

        <div
          className="full-width"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          {[
            ["Given", wallet.givenByAdmin, "#0f766e"],
            ["Approved Spent", wallet.approvedSpent, "#b91c1c"],
            ["Pending", wallet.pendingSpent, "#b45309"],
            ["Available", wallet.available, wallet.available < 0 ? "#b91c1c" : "#166534"],
          ].map(([label, value, color]) => (
            <div key={label} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px" }}>
              <span style={{ color: "#64748b", fontSize: "0.76rem", fontWeight: "800", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                <WalletCards size={14} /> {label}
              </span>
              <strong style={{ display: "block", color, fontSize: "1.1rem", marginTop: "5px" }}>
                Rs {toNumber(value).toLocaleString("en-IN")}
              </strong>
            </div>
          ))}
        </div>

        <div className="form-grid">
          <div className="input-group">
            <label>Expense Type</label>
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
                {DRIVER_TRIP_EXPENSE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
            </select>
          </div>

          <div className="input-group">
            <label>
              <Link2 size={14} style={{ display: "inline", marginRight: "5px" }} />
              Linked Trip *
            </label>
            <select value={form.bookingId} onChange={handleTripChange}>
              <option value="">-- Select Trip --</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  #{trip.trackingId || trip.id} | {trip.from || "-"} to {trip.to || "-"}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Vehicle Number</label>
            <input
              placeholder="e.g. KA19 AB 1234"
              value={form.vehicleNumber}
              onChange={(event) => setForm({ ...form, vehicleNumber: event.target.value })}
            />
          </div>

          <div className="input-group">
            <label>Amount (Rs)</label>
            <input
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </div>

          <div className="input-group">
            <label>Deduct From</label>
            <select
              value={form.deductionSource}
              onChange={(event) => setForm({ ...form, deductionSource: event.target.value })}
            >
              <option value="admin_account">Use My Advance / Company Account</option>
              <option value="driver_salary">Deduct From My Commission</option>
            </select>
          </div>

          {form.trackingId && (
            <div
              className="input-group full-width"
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "12px 14px",
              }}
            >
              <label style={{ marginBottom: "6px" }}>
                <Truck size={14} style={{ display: "inline", marginRight: "5px" }} />
                Linked Tracking ID
              </label>
              <div style={{ fontWeight: "bold", color: "#1d4ed8" }}>#{form.trackingId}</div>
            </div>
          )}

          <div className="input-group full-width">
            <label>Notes / Details</label>
            <input
              placeholder="e.g. 50 Liters Diesel at HP Pump"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>

          <AttachmentUploader
            files={attachmentFiles}
            onFilesChange={setAttachmentFiles}
            label="Expense Bill / Photo"
            hint="Take a bill photo or choose an image/PDF before submitting."
          />

          <button className="btn-submit full-width" onClick={handleSend} disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Submit to Admin"}{" "}
            <Send size={18} style={{ marginLeft: "10px" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DriverExpense;
