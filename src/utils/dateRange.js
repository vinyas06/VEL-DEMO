export const FINANCIAL_YEAR_STORAGE_KEY = "selectedFinancialYear";

const pad2 = (value) => String(value).padStart(2, "0");

export const toDateInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
};

export const getMonthRange = (monthValue = getCurrentMonthValue()) => {
  const [year, month] = String(monthValue).split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    fromDate: toDateInputValue(start),
    toDate: toDateInputValue(end),
    monthValue: `${year}-${pad2(month)}`,
  };
};

export const getCurrentMonthRange = () => getMonthRange(getCurrentMonthValue());

export const parseRecordDate = (record = {}, fields = []) => {
  for (const field of fields) {
    const value = record[field];
    if (!value) continue;

    if (typeof value === "object" && typeof value.toDate === "function") {
      return value.toDate();
    }

    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

export const getRecordDateInput = (record = {}, fields = []) => {
  const parsed = parseRecordDate(record, fields);
  return parsed ? toDateInputValue(parsed) : "";
};

export const isDateInRange = (dateValue, fromDate, toDate) => {
  if (!dateValue) return false;
  if (fromDate && dateValue < fromDate) return false;
  if (toDate && dateValue > toDate) return false;
  return true;
};

export const isRecordInDateRange = (record, fields, fromDate, toDate) =>
  isDateInRange(getRecordDateInput(record, fields), fromDate, toDate);

export const getFinancialYearOptions = (span = 4) => {
  const now = new Date();
  const currentStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  return Array.from({ length: span }, (_, index) => {
    const startYear = currentStartYear - index;
    const endYear = startYear + 1;
    return {
      value: `${startYear}-${String(endYear).slice(-2)}`,
      label: `FY ${startYear}-${String(endYear).slice(-2)}`,
      fromDate: `${startYear}-04-01`,
      toDate: `${endYear}-03-31`,
    };
  });
};

export const getSelectedFinancialYear = () => {
  const options = getFinancialYearOptions();
  const stored = localStorage.getItem(FINANCIAL_YEAR_STORAGE_KEY);
  return options.find((option) => option.value === stored) || options[0];
};

export const setSelectedFinancialYear = (value) => {
  localStorage.setItem(FINANCIAL_YEAR_STORAGE_KEY, value);
  window.dispatchEvent(new CustomEvent("financial-year-change", { detail: value }));
};
