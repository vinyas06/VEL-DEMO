export const toMoneyNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getDriverRecordName = (record = {}) =>
  record.driverName || record.payeeName || record.payee || record.targetName || "";

export const getRecordMonthKey = (record = {}) =>
  String(record.loadingDate || record.date || record.createdAt || "").slice(0, 7);

export const getDriverMonthSummary = (
  driver = {},
  month,
  bookings = [],
  transactions = [],
  submissions = []
) => {
  const driverName = driver.name || "";
  const salaryType = driver.salaryType || "fixed";
  const commissionRate = salaryType === "fixed" ? 0 : toMoneyNumber(driver.commissionRate);
  const fixedSalary = salaryType === "commission" ? 0 : toMoneyNumber(driver.salary);
  const driverTrips = bookings.filter(
    (booking) =>
      getRecordMonthKey(booking) === month &&
      (booking.driver === driverName || booking.driver2 === driverName)
  );
  const bookingAmount = driverTrips.reduce(
    (sum, booking) => sum + toMoneyNumber(booking.freight),
    0
  );
  const commissionEarned = bookingAmount * (commissionRate / 100);
  const grossPayable = fixedSalary + commissionEarned;
  const approvedDeductions = transactions
    .filter(
      (transaction) =>
        getRecordMonthKey(transaction) === month &&
        getDriverRecordName(transaction) === driverName &&
        transaction.deductionSource === "driver_salary"
    )
    .reduce((sum, transaction) => sum + toMoneyNumber(transaction.amount), 0);
  const pendingDeductions = submissions
    .filter(
      (submission) =>
        getRecordMonthKey(submission) === month &&
        getDriverRecordName(submission) === driverName &&
        submission.deductionSource === "driver_salary"
    )
    .reduce((sum, submission) => sum + toMoneyNumber(submission.amount), 0);
  const paidSalary = transactions
    .filter(
      (transaction) =>
        getRecordMonthKey(transaction) === month &&
        getDriverRecordName(transaction) === driverName &&
        transaction.category === "Driver Salary"
    )
    .reduce((sum, transaction) => sum + toMoneyNumber(transaction.amount), 0);
  const netPayable = grossPayable - approvedDeductions - pendingDeductions;

  return {
    driverName,
    month,
    salaryType,
    fixedSalary,
    commissionRate,
    tripCount: driverTrips.length,
    bookingAmount,
    commissionEarned,
    grossPayable,
    approvedDeductions,
    pendingDeductions,
    totalDeductions: approvedDeductions + pendingDeductions,
    paidSalary,
    remainingThisMonth: netPayable - paidSalary,
    netPayable,
  };
};

export const getDriverCarryForwardToMonth = (
  driver = {},
  throughMonth,
  bookings = [],
  transactions = [],
  submissions = []
) => {
  const months = new Set();
  bookings.forEach((booking) => months.add(getRecordMonthKey(booking)));
  transactions.forEach((transaction) => months.add(getRecordMonthKey(transaction)));
  submissions.forEach((submission) => months.add(getRecordMonthKey(submission)));

  return [...months]
    .filter((month) => month && month <= throughMonth)
    .sort()
    .reduce((sum, month) => {
      const summary = getDriverMonthSummary(driver, month, bookings, transactions, submissions);
      return sum + summary.remainingThisMonth;
    }, 0);
};
