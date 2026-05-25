const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getTimestamp = (record = {}) => {
  const candidates = [record.createdAt, record.date, record.loadingDate];

  for (const value of candidates) {
    if (!value) continue;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const getBookingKeys = (booking = {}) =>
  [booking.id, booking.trackingId, booking.lrNumber]
    .filter(Boolean)
    .map(normalizeKey);

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
  const transactionKeys = getTransactionBookingKeys(transaction);
  if (!transactionKeys.length) {
    return false;
  }

  const bookingKeys = new Set(getBookingKeys(booking));
  return transactionKeys.some((key) => bookingKeys.has(key));
};

const allocateAmountsToBookings = (bookings, transactions) => {
  const allocatedBookings = bookings
    .map((booking) => ({
      ...booking,
      appliedAmount: 0,
      outstandingAmount: toNumber(booking.baseAmount),
    }))
    .sort((a, b) => getTimestamp(a) - getTimestamp(b));

  const sortedTransactions = [...transactions].sort((a, b) => getTimestamp(a) - getTimestamp(b));
  let unappliedAmount = 0;

  sortedTransactions.forEach((transaction) => {
    let remaining = toNumber(transaction.amount);
    if (remaining <= 0) {
      return;
    }

    const linkedBooking = allocatedBookings.find((booking) =>
      transactionMatchesBooking(transaction, booking)
    );

    if (linkedBooking) {
      const available = Math.max(toNumber(linkedBooking.baseAmount) - linkedBooking.appliedAmount, 0);
      const applied = Math.min(available, remaining);
      linkedBooking.appliedAmount += applied;
      linkedBooking.outstandingAmount = Math.max(
        toNumber(linkedBooking.baseAmount) - linkedBooking.appliedAmount,
        0
      );
      remaining -= applied;
    }

    if (remaining > 0) {
      for (const booking of allocatedBookings) {
        const available = Math.max(toNumber(booking.baseAmount) - booking.appliedAmount, 0);
        if (available <= 0) {
          continue;
        }

        const applied = Math.min(available, remaining);
        booking.appliedAmount += applied;
        booking.outstandingAmount = Math.max(toNumber(booking.baseAmount) - booking.appliedAmount, 0);
        remaining -= applied;

        if (remaining <= 0) {
          break;
        }
      }
    }

    if (remaining > 0) {
      unappliedAmount += remaining;
    }
  });

  return {
    bookings: allocatedBookings,
    unappliedAmount,
  };
};

const getPartyReceiptName = (transaction = {}) =>
  transaction.partyName || transaction.party || "";

const getPayeeName = (transaction = {}) =>
  transaction.payeeName || transaction.payee || "";

const buildBookingLabel = (booking = {}) =>
  booking.trackingId || booking.lrNumber || booking.id || "Booking";

const buildBookingDisplay = (booking = {}) => ({
  id: booking.id,
  trackingId: booking.trackingId || "",
  lrNumber: booking.lrNumber || "",
  loadingDate: booking.loadingDate || "",
  route: `${booking.from || "-"} to ${booking.to || "-"}`,
  label: buildBookingLabel(booking),
});

export const getPartyFinancialSummary = (party, bookings = [], transactions = []) => {
  if (!party?.name) {
    return {
      openingBalance: 0,
      bookingCharges: 0,
      totalReceived: 0,
      totalPaidOut: 0,
      currentBalance: 0,
      outstandingBookings: [],
      unappliedReceipts: 0,
    };
  }

  const partyBookings = bookings
    .filter((booking) => booking.party === party.name)
    .map((booking) => {
      const netDue = toNumber(booking.freight) - toNumber(booking.advance);
      return {
        ...buildBookingDisplay(booking),
        baseAmount: netDue,
        createdAt: booking.createdAt,
      };
    });

  const partyReceipts = transactions.filter(
    (transaction) =>
      transaction.type === "IN" &&
      getPartyReceiptName(transaction) === party.name &&
      transaction.category !== "Trip Advance"
  );

  const partyPayouts = transactions.filter(
    (transaction) =>
      transaction.type !== "IN" &&
      getPayeeName(transaction) === party.name
  );

  const positiveBookings = partyBookings.filter((booking) => toNumber(booking.baseAmount) > 0);
  const allocatedReceipts = allocateAmountsToBookings(positiveBookings, partyReceipts);
  const outstandingMap = new Map(
    allocatedReceipts.bookings.map((booking) => [booking.id, booking])
  );

  const enrichedBookings = partyBookings.map((booking) => {
    const matchedBooking = outstandingMap.get(booking.id);
    return {
      ...booking,
      appliedAmount: matchedBooking?.appliedAmount || 0,
      outstandingAmount:
        toNumber(booking.baseAmount) > 0 ? matchedBooking?.outstandingAmount || 0 : 0,
    };
  });

  const openingBalance = toNumber(party.balance);
  const bookingCharges = partyBookings.reduce((sum, booking) => sum + toNumber(booking.baseAmount), 0);
  const totalReceived = partyReceipts.reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
  const totalPaidOut = partyPayouts.reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

  return {
    openingBalance,
    bookingCharges,
    totalReceived,
    totalPaidOut,
    currentBalance: openingBalance + bookingCharges + totalPaidOut - totalReceived,
    outstandingBookings: enrichedBookings.filter(
      (booking) => toNumber(booking.outstandingAmount) > 0
    ),
    unappliedReceipts: allocatedReceipts.unappliedAmount,
  };
};

export const getAgentFinancialSummary = (agent, bookings = [], transactions = []) => {
  if (!agent?.name) {
    return {
      openingBalance: 0,
      commissionRaised: 0,
      totalPaid: 0,
      currentBalance: 0,
      outstandingBookings: [],
      unappliedPayments: 0,
    };
  }

  const commissionBookings = bookings
    .filter((booking) => booking.agent === agent.name)
    .map((booking) => ({
      ...buildBookingDisplay(booking),
      baseAmount: toNumber(booking.commission),
      createdAt: booking.createdAt,
    }))
    .filter((booking) => toNumber(booking.baseAmount) > 0);

  const agentPayments = transactions.filter(
    (transaction) =>
      transaction.type !== "IN" &&
      getPayeeName(transaction) === agent.name
  );

  const allocatedPayments = allocateAmountsToBookings(commissionBookings, agentPayments);

  const openingBalance = toNumber(agent.balance);
  const commissionRaised = commissionBookings.reduce(
    (sum, booking) => sum + toNumber(booking.baseAmount),
    0
  );
  const totalPaid = agentPayments.reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

  return {
    openingBalance,
    commissionRaised,
    totalPaid,
    currentBalance: openingBalance + commissionRaised - totalPaid,
    outstandingBookings: allocatedPayments.bookings.filter(
      (booking) => toNumber(booking.outstandingAmount) > 0
    ),
    unappliedPayments: allocatedPayments.unappliedAmount,
  };
};

export const buildPartyBalanceMap = (parties = [], bookings = [], transactions = []) => {
  const result = {};

  parties.forEach((party) => {
    result[party.id] = getPartyFinancialSummary(party, bookings, transactions);
  });

  return result;
};

export const buildAgentBalanceMap = (agents = [], bookings = [], transactions = []) => {
  const result = {};

  agents.forEach((agent) => {
    result[agent.id] = getAgentFinancialSummary(agent, bookings, transactions);
  });

  return result;
};

export const getAccountFinancialSummary = (accounts = [], transactions = []) => {
  const clonedAccounts = accounts.map((account) => ({
    ...account,
    liveBalance: toNumber(account.openingBalance),
  }));

  let totalIn = 0;
  let totalOut = 0;

  transactions.forEach((transaction) => {
    const accountName = transaction.paymentAccount || transaction.accountName || "";
    if (!accountName) {
      return;
    }

    const targetAccount = clonedAccounts.find(
      (account) => account.accountName === accountName
    );

    if (!targetAccount) {
      return;
    }

    const amount = toNumber(transaction.amount);
    if (transaction.type === "IN") {
      targetAccount.liveBalance += amount;
      totalIn += amount;
      return;
    }

    targetAccount.liveBalance -= amount;
    totalOut += amount;
  });

  const cashAccounts = clonedAccounts.filter((account) =>
    String(account.accountType || "").includes("Cash")
  );
  const bankAccounts = clonedAccounts.filter((account) =>
    String(account.accountType || "").includes("Bank")
  );

  return {
    cashAccounts,
    bankAccounts,
    totalCash: cashAccounts.reduce((sum, account) => sum + toNumber(account.liveBalance), 0),
    totalBank: bankAccounts.reduce((sum, account) => sum + toNumber(account.liveBalance), 0),
    totalIn,
    totalOut,
  };
};
