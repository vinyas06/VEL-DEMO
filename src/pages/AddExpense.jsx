import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { TrendingDown, IndianRupee, Wrench, Landmark, Route, Truck, User, Building2 } from "lucide-react";
import AttachmentUploader from "../components/AttachmentUploader";
import { uploadAttachments } from "../utils/attachments";
import { getDriverCarryForwardToMonth, getDriverMonthSummary } from "../utils/driverSalary";
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css";

const EXPENSE_CATEGORIES = [
  { value: "Petrol", label: "Petrol / Diesel", target: "trip" },
  { value: "Fastag", label: "FASTag / Toll", target: "trip" },
  { value: "Office Expense", label: "Office Expense", target: "office" },
  { value: "Hamali/Labour Loading Unloading", label: "Hamali / Labour Loading-Unloading", target: "trip" },
  { value: "Police Fine", label: "Police Fine", target: "trip" },
  { value: "Check Post Police Tips", label: "Check Post / Police Tips", target: "trip" },
  { value: "Loan EMI", label: "Loan EMI", target: "loan" },
  { value: "Driver Salary", label: "Driver Salary", target: "driver" },
  { value: "Trip Allowance", label: "Trip Allowance", target: "trip" },
  { value: "Vehicle Maintenance", label: "Vehicle Maintenance", target: "vehicle" },
  { value: "AdBlue", label: "AdBlue", target: "trip" },
];

const buildExpenseVoucher = () => `EXP-${Math.floor(10000 + Math.random() * 90000)}`;

function AddExpense() {
  const [accounts, setAccounts] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loans, setLoans] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);

  const [form, setForm] = useState({
    voucherNo: buildExpenseVoucher(),
    date: new Date().toISOString().split("T")[0],
    category: "Petrol",
    targetName: "",
    bookingId: "",
    trackingId: "",
    vehicleNumber: "",
    loanId: "",
    amount: "",
    paymentAccount: "",
    notes: "",
    type: "EXPENSE",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [accountSnap, driverSnap, bookingSnap, transactionSnap, submissionSnap, vehicleSnap, loanSnap] =
          await Promise.all([
            getDocs(collection(db, "accounts")),
            getDocs(collection(db, "drivers")),
            getDocs(collection(db, "bookings")),
            getDocs(collection(db, "transactions")),
            getDocs(collection(db, "driver_submissions")),
            getDocs(collection(db, "vehicles")),
            getDocs(collection(db, "loans")),
          ]);

        setAccounts(accountSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
        setDrivers(
          driverSnap.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
        setBookings(
          bookingSnap.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => new Date(b.loadingDate || b.createdAt || 0) - new Date(a.loadingDate || a.createdAt || 0))
        );
        setTransactions(transactionSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
        setSubmissions(submissionSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
        setVehicles(
          vehicleSnap.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => (a.number || "").localeCompare(b.number || ""))
        );
        setLoans(
          loanSnap.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => (a.loanName || "").localeCompare(b.loanName || ""))
        );
      } catch (error) {
        console.error("Error loading expense data:", error);
      }
    };

    fetchData();
  }, []);

  const selectedCategory = EXPENSE_CATEGORIES.find((category) => category.value === form.category) || EXPENSE_CATEGORIES[0];
  const latestTripOptions = bookings.slice(0, 6);
  const needsTrip = selectedCategory.target === "trip";
  const needsDriver = selectedCategory.target === "driver";
  const needsVehicle = selectedCategory.target === "vehicle";
  const needsLoan = selectedCategory.target === "loan";

  const handleCategoryChange = (event) => {
    const nextCategory = EXPENSE_CATEGORIES.find((category) => category.value === event.target.value) || EXPENSE_CATEGORIES[0];
    setForm((previous) => ({
      ...previous,
      category: nextCategory.value,
      targetName: nextCategory.target === "office" ? "Office / Admin" : "",
      bookingId: "",
      trackingId: "",
      vehicleNumber: "",
      loanId: "",
      amount: "",
    }));
  };

  const handleChange = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const handleTripChange = (event) => {
    const bookingId = event.target.value;
    const booking = bookings.find((item) => item.id === bookingId);
    setForm({
      ...form,
      bookingId,
      trackingId: booking?.trackingId || "",
      vehicleNumber: booking?.vehicle || "",
      targetName: booking ? `${booking.trackingId || booking.id} - ${booking.from || ""} to ${booking.to || ""}` : "",
    });
  };

  const handleLoanChange = (event) => {
    const loanId = event.target.value;
    const loan = loans.find((item) => item.id === loanId);
    setForm({
      ...form,
      loanId,
      targetName: loan?.loanName || "",
      amount: loan?.monthlyEmi ? String(loan.monthlyEmi) : form.amount,
    });
  };

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
      return alert("Amount, Category, and Payment Account are required.");
    }
    if (needsTrip && !form.bookingId) {
      return alert("Please select the trip for this expense.");
    }
    if (needsDriver && !form.targetName) {
      return alert("Please select the driver.");
    }
    if (needsVehicle && !form.targetName) {
      return alert("Please select the vehicle.");
    }
    if (needsLoan && !form.loanId) {
      return alert("Please select the loan.");
    }

    setIsSubmitting(true);
    try {
      const attachments = await uploadAttachments(attachmentFiles, "expenses", form.voucherNo);
      const payload = {
        ...form,
        targetName: form.targetName || (selectedCategory.target === "office" ? "Office / Admin" : ""),
        payeeName: form.category === "Driver Salary" ? form.targetName : "",
        payee: form.category === "Driver Salary" ? form.targetName : "",
        driverName: form.category === "Driver Salary" ? form.targetName : "",
        salaryMonth: form.category === "Driver Salary" ? salaryMonth : "",
        salaryBalanceBefore: form.category === "Driver Salary" ? salaryBalanceBeforePayment : "",
        salaryBalanceAfter: form.category === "Driver Salary" ? salaryBalanceAfterPayment : "",
        loanId: needsLoan ? form.loanId : "",
        amount: Number(form.amount),
        createdAt: new Date().toISOString(),
        attachments,
      };
      const docRef = await addDoc(collection(db, "transactions"), payload);
      await logActivity(db, {
        action: "expense_created",
        module: "payments",
        summary: `Recorded ${form.category} expense Rs ${Number(form.amount).toLocaleString("en-IN")}`,
        targetId: docRef.id,
        targetType: "transaction",
      });
      setTransactions((prev) => [...prev, { id: docRef.id, ...payload }]);

      alert(`Expense recorded.\nVoucher: ${form.voucherNo}`);
      setForm({
        ...form,
        voucherNo: buildExpenseVoucher(),
        targetName: "",
        bookingId: "",
        trackingId: "",
        vehicleNumber: "",
        loanId: "",
        amount: "",
        paymentAccount: "",
        notes: "",
      });
      setAttachmentFiles([]);
    } catch (error) {
      console.error("Error saving expense:", error);
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
              <p>Record trip costs, office expenses, EMI, salary, and vehicle maintenance.</p>
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
            <select name="category" value={form.category} onChange={handleCategoryChange} style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>{category.label}</option>
              ))}
            </select>
          </div>

          {needsTrip && (
            <div className="input-group">
              <label><Route size={14} style={{ display: "inline", marginRight: "5px" }} /> Trip *</label>
              <select name="bookingId" value={form.bookingId} onChange={handleTripChange}>
                <option value="">-- Select Trip --</option>
                {latestTripOptions.map((booking) => (
                  <option key={booking.id} value={booking.id}>
                    {booking.trackingId || booking.id} | {booking.vehicle || "-"} | {booking.from || "-"} to {booking.to || "-"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {needsVehicle && (
            <div className="input-group">
              <label><Truck size={14} style={{ display: "inline", marginRight: "5px" }} /> Vehicle *</label>
              <select name="targetName" value={form.targetName} onChange={handleChange}>
                <option value="">-- Select Vehicle --</option>
                {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.number}>{vehicle.number}</option>)}
              </select>
            </div>
          )}

          {needsDriver && (
            <div className="input-group">
              <label><User size={14} style={{ display: "inline", marginRight: "5px" }} /> Driver *</label>
              <select name="targetName" value={form.targetName} onChange={handleChange}>
                <option value="">-- Select Driver --</option>
                {drivers.map((driver) => <option key={driver.id} value={driver.name}>{driver.name}</option>)}
              </select>
            </div>
          )}

          {needsLoan && (
            <div className="input-group">
              <label><Landmark size={14} style={{ display: "inline", marginRight: "5px" }} /> Loan *</label>
              <select name="loanId" value={form.loanId} onChange={handleLoanChange}>
                <option value="">-- Select Loan --</option>
                {loans.map((loan) => (
                  <option key={loan.id} value={loan.id}>
                    {loan.loanName} | EMI Rs {Number(loan.monthlyEmi || 0).toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedCategory.target === "office" && (
            <div className="input-group">
              <label><Building2 size={14} style={{ display: "inline", marginRight: "5px" }} /> Applied To</label>
              <input value="Office / Admin" disabled />
            </div>
          )}

          <div className="section-title full-width mt-4">
            <IndianRupee size={18} /> Payment Information
          </div>

          <div className="input-group">
            <label>Expense Date *</label>
            <input name="date" type="date" value={form.date} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Amount (Rs) *</label>
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

          <div className="input-group full-width">
            <label><Landmark size={14} style={{ display: "inline", marginRight: "5px" }} /> Paid From (Account) *</label>
            <select name="paymentAccount" value={form.paymentAccount} onChange={handleChange} style={{ background: "#fff7ed", borderColor: "#fed7aa" }}>
              <option value="">-- Select Bank or Cash Account --</option>
              {accounts.map((account) => <option key={account.id} value={account.accountName}>{account.accountName}</option>)}
            </select>
          </div>

          <div className="input-group full-width">
            <label>Details / Description</label>
            <input name="notes" placeholder="Pump name, toll plaza, EMI note, workshop, or loading details" value={form.notes} onChange={handleChange} />
          </div>

          <AttachmentUploader
            files={attachmentFiles}
            onFilesChange={setAttachmentFiles}
            label="Expense Bill / Proof"
            hint="Use camera for fuel/toll bill or choose image/PDF."
          />

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
