import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
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
    const fetchData = async () => {
      try {
        const [driverSnap, bookingSnap, transactionSnap, submissionSnap] = await Promise.all([
          getDocs(collection(db, "drivers")),
          getDocs(collection(db, "bookings")),
          getDocs(collection(db, "transactions")),
          getDocs(collection(db, "driver_submissions")),
        ]);
        setDrivers(
          driverSnap.docs
            .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        );
        setBookings(bookingSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
        setTransactions(transactionSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
        setSubmissions(submissionSnap.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() })));
      } catch (error) {
        console.error("Error loading driver salary ledger:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
        (selectedDriver === "All" || getDriverRecordName(transaction) === selectedDriver)
    )
    .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
  const pendingDriverSubmissions = submissions
    .filter(
      (submission) =>
        getRecordMonthKey(submission) === selectedMonth &&
        getDriverRecordName(submission) &&
        (selectedDriver === "All" || getDriverRecordName(submission) === selectedDriver)
    )
    .map((submission) => ({ ...submission, pendingSubmission: true }))
    .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
  const driverTransactionRows = [...driverTransactions, ...pendingDriverSubmissions].sort(
    (a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0)
  );

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
                          <td style={{ padding: "1rem" }}>{transaction.date || "-"}</td>
                          <td style={{ padding: "1rem", fontWeight: "800" }}>{getDriverRecordName(transaction)}</td>
                          <td style={{ padding: "1rem" }}>
                            <strong>{transaction.category || "Driver Submission"}</strong>
                            {transaction.pendingSubmission && <small style={{ display: "block", color: "#b45309" }}>Pending Approval</small>}
                            {transaction.voucherNo && <small style={{ display: "block", color: "#94a3b8" }}>{transaction.voucherNo}</small>}
                          </td>
                          <td style={{ padding: "1rem" }}>{transaction.paymentAccount || transaction.deductionSource || "-"}</td>
                          <td style={{ padding: "1rem", color: "#b45309", fontWeight: "900" }}>Rs {formatMoney(transaction.amount)}</td>
                          <td style={{ padding: "1rem", fontWeight: "800" }}>
                            {transaction.salaryBalanceAfter === "" || transaction.salaryBalanceAfter == null
                              ? "-"
                              : `Rs ${formatMoney(transaction.salaryBalanceAfter)}`}
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
