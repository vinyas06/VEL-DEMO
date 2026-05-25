import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import TruckLoader from "../components/TruckLoader";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  Calendar,
  ClipboardList,
  Filter,
  IndianRupee,
  Landmark,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import "./BookingList.css";
import "./TripwisePayments.css";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const currency = (value) => `Rs ${toNumber(value).toLocaleString("en-IN")}`;

const getBookingKeys = (booking = {}) =>
  [booking.id, booking.trackingId, booking.lrNumber].filter(Boolean).map(normalizeKey);

const getTransactionBookingKeys = (transaction = {}) =>
  [
    transaction.bookingId,
    transaction.linkedBookingId,
    transaction.bookingTrackingId,
    transaction.trackingId,
    transaction.tripId,
    transaction.bookingLrNumber,
    transaction.lrNumber,
  ]
    .filter(Boolean)
    .map(normalizeKey);

const transactionMatchesBooking = (transaction, booking) => {
  const bookingKeys = new Set(getBookingKeys(booking));
  const transactionKeys = getTransactionBookingKeys(transaction);

  if (transactionKeys.some((key) => bookingKeys.has(key))) {
    return true;
  }

  const voucherNo = normalizeKey(transaction.voucherNo);
  const referenceNo = normalizeKey(transaction.referenceNo);
  const trackingId = normalizeKey(booking.trackingId);
  const lrNumber = normalizeKey(booking.lrNumber);

  return (
    (trackingId && (voucherNo.includes(trackingId) || referenceNo.includes(trackingId))) ||
    (lrNumber && referenceNo.includes(lrNumber))
  );
};

const getTransactionDate = (transaction = {}) => transaction.date || transaction.createdAt || "";

const buildPaymentSummary = (booking, transactions) => {
  const paymentTransactions = transactions.filter(
    (transaction) => transaction.type === "IN" && transactionMatchesBooking(transaction, booking)
  );

  const recordedAdvance = toNumber(booking.advance);
  const advanceTransactions = paymentTransactions.filter(
    (transaction) => transaction.category === "Trip Advance"
  );
  const nonAdvanceTransactions = paymentTransactions.filter(
    (transaction) => transaction.category !== "Trip Advance"
  );

  const transactionAdvanceTotal = advanceTransactions.reduce(
    (sum, transaction) => sum + toNumber(transaction.amount),
    0
  );
  const advanceReceived = transactionAdvanceTotal || recordedAdvance;
  const receiptReceived = nonAdvanceTransactions.reduce(
    (sum, transaction) => sum + toNumber(transaction.amount),
    0
  );
  const totalReceived = advanceReceived + receiptReceived;

  const accountMap = new Map();
  paymentTransactions.forEach((transaction) => {
    const accountName = transaction.paymentAccount || transaction.paymentMode || "Not selected";
    accountMap.set(accountName, (accountMap.get(accountName) || 0) + toNumber(transaction.amount));
  });

  if (!advanceTransactions.length && recordedAdvance > 0) {
    const fallbackAccount = booking.advanceAccount || "Advance account not recorded";
    accountMap.set(fallbackAccount, (accountMap.get(fallbackAccount) || 0) + recordedAdvance);
  }

  return {
    advanceReceived,
    receiptReceived,
    totalReceived,
    balance: toNumber(booking.freight) - totalReceived,
    accounts: Array.from(accountMap, ([name, amount]) => ({ name, amount })),
    transactions: paymentTransactions.sort(
      (a, b) => new Date(getTransactionDate(b)) - new Date(getTransactionDate(a))
    ),
  };
};

function TripwisePayments() {
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTripId, setExpandedTripId] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    party: "All",
    account: "All",
    status: "All",
    fromDate: "",
    toDate: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingSnap, transactionSnap, accountSnap] = await Promise.all([
          getDocs(collection(db, "bookings")),
          getDocs(collection(db, "transactions")),
          getDocs(collection(db, "accounts")),
        ]);

        setBookings(bookingSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setTransactions(transactionSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setAccounts(accountSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error loading tripwise payments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const partyOptions = useMemo(
    () => Array.from(new Set(bookings.map((booking) => booking.party).filter(Boolean))).sort(),
    [bookings]
  );

  const rows = useMemo(() => {
    const searchText = normalizeKey(filters.search);
    const fromTime = filters.fromDate ? new Date(filters.fromDate).getTime() : null;
    const toTime = filters.toDate ? new Date(filters.toDate).getTime() : null;

    return bookings
      .map((booking) => {
        const payment = buildPaymentSummary(booking, transactions);
        const freight = toNumber(booking.freight);
        const balance = payment.balance;
        const paymentStatus =
          balance <= 0 && payment.totalReceived > 0
            ? "Paid"
            : payment.totalReceived > 0
              ? "Part Paid"
              : "Pending";

        return {
          ...booking,
          freight,
          payment,
          paymentStatus,
          route: `${booking.from || "-"} to ${booking.to || "-"}`,
        };
      })
      .filter((row) => {
        const rowText = normalizeKey(
          [
            row.trackingId,
            row.lrNumber,
            row.party,
            row.vehicle,
            row.driver,
            row.from,
            row.to,
            row.material,
          ].join(" ")
        );

        const loadingTime = row.loadingDate ? new Date(row.loadingDate).getTime() : 0;
        const accountMatches =
          filters.account === "All" ||
          row.payment.accounts.some((account) => account.name === filters.account);
        const statusMatches =
          filters.status === "All" ||
          (filters.status === "Balance" && row.payment.balance > 0) ||
          (filters.status === "Paid" && row.payment.balance <= 0) ||
          (filters.status === "No Payment" && row.payment.totalReceived === 0);

        return (
          (!searchText || rowText.includes(searchText)) &&
          (filters.party === "All" || row.party === filters.party) &&
          accountMatches &&
          statusMatches &&
          (!fromTime || loadingTime >= fromTime) &&
          (!toTime || loadingTime <= toTime)
        );
      })
      .sort((a, b) => new Date(b.loadingDate || b.createdAt || 0) - new Date(a.loadingDate || a.createdAt || 0));
  }, [bookings, transactions, filters]);

  const totals = rows.reduce(
    (summary, row) => ({
      freight: summary.freight + row.freight,
      received: summary.received + row.payment.totalReceived,
      balance: summary.balance + row.payment.balance,
      trips: summary.trips + 1,
    }),
    { freight: 0, received: 0, balance: 0, trips: 0 }
  );

  const updateFilter = (name, value) => {
    setFilters((previous) => ({ ...previous, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      party: "All",
      account: "All",
      status: "All",
      fromDate: "",
      toDate: "",
    });
  };

  return (
    <div className="list-page-bg">
      <Navbar />
      <div className="list-container tripwise-page">
        <div className="tripwise-header">
          <div className="tripwise-title">
            <ClipboardList size={32} color="#2563eb" />
            <div>
              <h2>Tripwise Payment Receipts</h2>
              <p>Booking-wise received amount, receiving account, and pending balance.</p>
            </div>
          </div>
        </div>

        <div className="tripwise-summary">
          <div>
            <span>Total Trips</span>
            <strong>{totals.trips}</strong>
          </div>
          <div>
            <span>Total Freight</span>
            <strong>{currency(totals.freight)}</strong>
          </div>
          <div>
            <span>Received</span>
            <strong className="text-green">{currency(totals.received)}</strong>
          </div>
          <div>
            <span>Balance</span>
            <strong className={totals.balance > 0 ? "text-red" : "text-green"}>
              {currency(totals.balance)}
            </strong>
          </div>
        </div>

        <div className="tripwise-filters">
          <div className="filter-field search-field">
            <Search size={17} />
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Search LR, booking, party, vehicle, route..."
            />
          </div>
          <div className="filter-field">
            <Filter size={17} />
            <select value={filters.party} onChange={(event) => updateFilter("party", event.target.value)}>
              <option value="All">All Parties</option>
              {partyOptions.map((party) => (
                <option key={party} value={party}>
                  {party}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <Landmark size={17} />
            <select value={filters.account} onChange={(event) => updateFilter("account", event.target.value)}>
              <option value="All">All Receiving Accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.accountName}>
                  {account.accountName}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-field">
            <IndianRupee size={17} />
            <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
              <option value="All">All Payment Status</option>
              <option value="Balance">Balance Pending</option>
              <option value="Paid">Paid / Clear</option>
              <option value="No Payment">No Payment</option>
            </select>
          </div>
          <div className="filter-field">
            <Calendar size={17} />
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => updateFilter("fromDate", event.target.value)}
            />
          </div>
          <div className="filter-field">
            <Calendar size={17} />
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => updateFilter("toDate", event.target.value)}
            />
          </div>
          <button className="clear-filter-btn" onClick={clearFilters}>
            Clear
          </button>
        </div>

        {loading ? (
          <TruckLoader text="Loading trip payments..." />
        ) : (
          <div className="trip-card-list">
            {rows.length === 0 ? (
              <div className="empty-row">No trips found for the selected filters.</div>
            ) : (
              rows.map((row) => {
                const isExpanded = expandedTripId === row.id;

                return (
                  <div className="trip-payment-card" key={row.id}>
                    <button
                      className="trip-card-main"
                      onClick={() => setExpandedTripId(isExpanded ? "" : row.id)}
                    >
                      <div className="trip-card-left">
                        <span className={`status-chip ${row.paymentStatus.toLowerCase().replace(" ", "-")}`}>
                          {row.paymentStatus}
                        </span>
                        <h3>{row.trackingId || "No Booking ID"}</h3>
                        <p>{row.party || "No party"}</p>
                        <small>LR: {row.lrNumber || "N/A"} | Date: {row.loadingDate || "N/A"}</small>
                        <small>{row.route}</small>
                        <small>
                          Vehicle: {row.vehicle || "-"} | Driver: {row.driver || "-"} | Material:{" "}
                          {row.material || "-"}
                        </small>
                      </div>

                      <div className="trip-money-grid">
                        <div>
                          <span>Total Freight</span>
                          <strong>{currency(row.freight)}</strong>
                        </div>
                        <div>
                          <span>Paid Till Now</span>
                          <strong className="text-green">{currency(row.payment.totalReceived)}</strong>
                        </div>
                        <div className={row.payment.balance > 0 ? "balance-due" : "balance-clear"}>
                          <span>Balance</span>
                          <strong>{currency(row.payment.balance)}</strong>
                        </div>
                      </div>

                      <div className="trip-expand-icon">
                        {isExpanded ? <ChevronDown size={22} /> : <ChevronRight size={22} />}
                        <span>{isExpanded ? "Hide" : "Payments"}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="trip-payment-details">
                        <div className="payment-breakup">
                          <div>
                            <span>Advance</span>
                            <strong>{currency(row.payment.advanceReceived)}</strong>
                          </div>
                          <div>
                            <span>Payment In</span>
                            <strong>{currency(row.payment.receiptReceived)}</strong>
                          </div>
                          <div>
                            <span>Receiving Account</span>
                            <strong>
                              {row.payment.accounts.length
                                ? row.payment.accounts.map((account) => account.name).join(", ")
                                : "No receipt account"}
                            </strong>
                          </div>
                        </div>

                        <div className="payment-line-list">
                          {row.payment.transactions.length === 0 ? (
                            <div className="payment-line muted-line">
                              No Payment In transaction is linked with this trip yet.
                            </div>
                          ) : (
                            row.payment.transactions.map((transaction) => (
                              <div className="payment-line" key={transaction.id}>
                                <div>
                                  <strong>{transaction.voucherNo || "Payment In"}</strong>
                                  <small>
                                    {getTransactionDate(transaction) || "No date"} |{" "}
                                    {transaction.category || "Receipt"}
                                  </small>
                                  {transaction.referenceNo && (
                                    <small>Reference: {transaction.referenceNo}</small>
                                  )}
                                  {transaction.notes && <small>Notes: {transaction.notes}</small>}
                                </div>
                                <div>
                                  <strong className="text-green">{currency(transaction.amount)}</strong>
                                  <small>{transaction.paymentAccount || "Account not selected"}</small>
                                </div>
                              </div>
                            ))
                          )}

                          {row.payment.transactions.length === 0 && row.payment.advanceReceived > 0 && (
                            <div className="payment-line">
                              <div>
                                <strong>Booking Advance</strong>
                                <small>Recorded on booking, no Payment In voucher linked</small>
                              </div>
                              <div>
                                <strong className="text-green">{currency(row.payment.advanceReceived)}</strong>
                                <small>{row.advanceAccount || "Advance account not recorded"}</small>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TripwisePayments;
