import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Calendar, IndianRupee, Users } from "lucide-react";
import {
  getDriverCarryForwardToMonth,
  getDriverMonthSummary,
  getDriverRecordName,
  getRecordMonthKey,
} from "../utils/driverSalary";
import { getCurrentMonthValue } from "../utils/dateRange";
import "./BookingList.css";

const formatMoney = (value) =>
  Math.round(Number(value || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 });

function DriverSalaryLedger() {
  const [drivers, setDrivers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [selectedDriver, setSelectedDriver] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubDrivers = onSnapshot(collection(db, "drivers"), (snap) => {
      setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
      setLoading(false);
    });
    const unsubBookings = onSnapshot(collection(db, "bookings"), (snap) => {
      setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubTransactions = onSnapshot(collection(db, "transactions"), (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubSubmissions = onSnapshot(collection(db, "driver_submissions"), (snap) => {
      setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubDrivers();
      unsubBookings();
      unsubTransactions();
      unsubSubmissions();
    };
  }, []);

  const rows = useMemo(() => {
    return drivers
      .filter((driver) => selectedDriver === "All" || driver.name === selectedDriver)
      .map((driver) => {
        const monthSummary = getDriverMonthSummary(driver, selectedMonth, bookings, transactions, submissions);
        const carryForward = getDriverCarryForwardToMonth(driver, selectedMonth, bookings, transactions, submissions);
        const previousCarryForward = carryForward - monthSummary.remainingThisMonth;

        return {
          driver,
          ...monthSummary,
          previousCarryForward,
          carryForward,
        };
      });
  }, [bookings, drivers, selectedDriver, selectedMonth, submissions, transactions]);

  const totals = rows.reduce(
    (sum, row) => ({
      grossPayable: sum.grossPayable + row.grossPayable,
      commissionEarned: sum.commissionEarned + row.commissionEarned,
      paidSalary: sum.paidSalary + row.paidSalary,
      carryForward: sum.carryForward + row.carryForward,
    }),
    { grossPayable: 0, commissionEarned: 0, paidSalary: 0, carryForward: 0 }
  );

  const driverTransactions = transactions
    .filter(
      (transaction) =>
        getRecordMonthKey(transaction) === selectedMonth &&
        getDriverRecordName(transaction) &&
        (selectedDriver === "All" || getDriverRecordName(transaction) === selectedDriver) &&
        (transaction.deductionSource === "driver_salary" || transaction.category === "Driver Salary")
    )
    .map(t => ({ ...t, isBooking: false }));
  
  const driverBookings = bookings
    .filter(
      (booking) =>
        getRecordMonthKey(booking) === selectedMonth &&
        (booking.driver || booking.driver2) &&
        (selectedDriver === "All" || booking.driver === selectedDriver || booking.driver2 === selectedDriver)
    )
    .map(b => ({ ...b, isBooking: true, amount: b.freight, category: "Trip Commission" }));

  const pendingDriverSubmissions = submissions
    .filter(
      (submission) =>
        getRecordMonthKey(submission) === selectedMonth &&
        getDriverRecordName(submission) &&
        (selectedDriver === "All" || getDriverRecordName(submission) === selectedDriver) &&
        submission.deductionSource === "driver_salary"
    )
    .map((submission) => ({ ...submission, isBooking: false, pendingSubmission: true }));

  let driverTransactionRows = [...driverTransactions, ...driverBookings, ...pendingDriverSubmissions].sort(
    (a, b) => new Date(a.createdAt || a.date || a.loadingDate || 0) - new Date(b.createdAt || b.date || b.loadingDate || 0)
  );

  // Calculate dynamic running balance for the selected driver
  if (selectedDriver !== "All") {
    const driverObj = drivers.find(d => d.name === selectedDriver) || {};
    const commissionRate = driverObj.salaryType === "fixed" ? 0 : Number(driverObj.commissionRate || 0);
    const prevCarryForward = (rows.find(r => r.driverName === selectedDriver)?.previousCarryForward) || 0;
    
    let currentBalance = prevCarryForward;
    driverTransactionRows = driverTransactionRows.map(row => {
      if (row.isBooking) {
        const earned = Number(row.freight || 0) * (commissionRate / 100);
        currentBalance += earned;
        return { ...row, dynamicBalance: currentBalance, calculatedEarned: earned };
      } else if (row.deductionSource === "driver_salary" || row.category === "Driver Salary") {
        currentBalance -= Number(row.amount || 0);
        return { ...row, dynamicBalance: currentBalance };
      }
      return { ...row, dynamicBalance: currentBalance };
    });
  }

  // Reverse so newest is at the top
  driverTransactionRows.reverse();

  return (
    <div className="list-page-bg">
      <Navbar />
      <div className="list-container">
        <div className="list-header">
          <div>
            <h2>Driver Salary Ledger</h2>
            <p>Monthwise commission, salary paid, and carry-forward balance for every driver.</p>
          </div>
          <div style={{ display: "grid", gap: "10px", minWidth: "260px" }}>
            <div className="search-box">
              <Calendar size={18} className="search-icon" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                style={{ paddingLeft: "2.5rem" }}
              />
            </div>
            <div className="search-box">
              <Users size={18} className="search-icon" />
              <select
                value={selectedDriver}
                onChange={(event) => setSelectedDriver(event.target.value)}
                style={{ width: "100%", padding: "0.8rem 1rem 0.8rem 2.5rem", border: "1px solid #cbd5e1", borderRadius: "8px" }}
              >
                <option value="All">All Drivers</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.name}>{driver.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bookings-grid" style={{ marginBottom: "1.5rem" }}>
          {[
            ["Gross Salary", totals.grossPayable, "#1d4ed8"],
            ["Commission", totals.commissionEarned, "#0f766e"],
            ["Paid This Month", totals.paidSalary, "#b45309"],
            ["Carry Forward", totals.carryForward, totals.carryForward < 0 ? "#b91c1c" : "#166534"],
          ].map(([label, value, color]) => (
            <div key={label} className="booking-card" style={{ padding: "1rem" }}>
              <small style={{ color: "#64748b", fontWeight: "800", textTransform: "uppercase" }}>{label}</small>
              <strong style={{ color, fontSize: "1.45rem", marginTop: "0.25rem" }}>
                Rs {formatMoney(value)}
              </strong>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="loading-state">Loading driver salary ledger...</div>
        ) : (
          <>
            <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1020px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.82rem", textTransform: "uppercase" }}>
                    <th style={{ padding: "1rem" }}>Driver</th>
                    <th style={{ padding: "1rem" }}>Trips</th>
                    <th style={{ padding: "1rem" }}>Fixed</th>
                    <th style={{ padding: "1rem" }}>Commission</th>
                    <th style={{ padding: "1rem" }}>Deductions</th>
                    <th style={{ padding: "1rem" }}>Prev. Carry</th>
                    <th style={{ padding: "1rem" }}>Paid</th>
                    <th style={{ padding: "1rem" }}>Carry Next</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.driver.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "1rem", fontWeight: "900", color: "#1e293b" }}>{row.driverName}</td>
                      <td style={{ padding: "1rem" }}>{row.tripCount}</td>
                      <td style={{ padding: "1rem" }}>Rs {formatMoney(row.fixedSalary)}</td>
                      <td style={{ padding: "1rem" }}>Rs {formatMoney(row.commissionEarned)}</td>
                      <td style={{ padding: "1rem", color: "#b91c1c" }}>Rs {formatMoney(row.totalDeductions)}</td>
                      <td style={{ padding: "1rem" }}>Rs {formatMoney(row.previousCarryForward)}</td>
                      <td style={{ padding: "1rem", color: "#b45309", fontWeight: "800" }}>Rs {formatMoney(row.paidSalary)}</td>
                      <td style={{ padding: "1rem", color: row.carryForward < 0 ? "#b91c1c" : "#166534", fontWeight: "900" }}>
                        Rs {formatMoney(row.carryForward)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <h3 style={{ color: "#1e293b", marginBottom: "0.8rem" }}>All Driver Transactions This Month</h3>
              <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "760px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9", color: "#475569", fontSize: "0.82rem", textTransform: "uppercase" }}>
                      <th style={{ padding: "1rem" }}>Date</th>
                      <th style={{ padding: "1rem" }}>Driver</th>
                      <th style={{ padding: "1rem" }}>Category</th>
                      <th style={{ padding: "1rem" }}>Account / Source</th>
                      <th style={{ padding: "1rem" }}>Amount</th>
                      <th style={{ padding: "1rem" }}>Remaining After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverTransactionRows.length === 0 ? (
                      <tr><td colSpan="6" style={{ padding: "1.5rem", textAlign: "center", color: "#64748b" }}>No driver transactions recorded for this month.</td></tr>
                    ) : (
                      driverTransactionRows.map((transaction) => (
                        <tr key={transaction.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "1rem" }}>{transaction.date || transaction.loadingDate || "-"}</td>
                          <td style={{ padding: "1rem", fontWeight: "800" }}>{transaction.isBooking ? transaction.driver || transaction.driver2 : getDriverRecordName(transaction)}</td>
                          <td style={{ padding: "1rem" }}>
                            <strong>{transaction.category || "Driver Submission"}</strong>
                            {transaction.isBooking && <small style={{ display: "block", color: "#166534" }}>Trip: {transaction.trackingId}</small>}
                            {transaction.pendingSubmission && <small style={{ display: "block", color: "#b45309" }}>Pending Approval</small>}
                            {transaction.voucherNo && <small style={{ display: "block", color: "#94a3b8" }}>{transaction.voucherNo}</small>}
                          </td>
                          <td style={{ padding: "1rem" }}>{transaction.isBooking ? "Trip Completion" : transaction.paymentAccount || transaction.deductionSource || "-"}</td>
                          <td style={{ padding: "1rem", color: transaction.isBooking ? "#166534" : "#b45309", fontWeight: "900" }}>
                            {transaction.isBooking ? `+ Rs ${formatMoney(transaction.calculatedEarned || 0)}` : `- Rs ${formatMoney(transaction.amount)}`}
                          </td>
                          <td style={{ padding: "1rem", fontWeight: "800" }}>
                            {selectedDriver === "All" || (!transaction.isBooking && transaction.deductionSource !== "driver_salary" && transaction.category !== "Driver Salary")
                              ? "-"
                              : `Rs ${formatMoney(transaction.dynamicBalance)}`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DriverSalaryLedger;
