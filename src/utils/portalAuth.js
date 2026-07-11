import { api } from './api';

export const COMPANIES = [
  {
    key: "vel",
    name: "Veerashaiva Express Logistics",
    shortName: "VEL",
    active: true,
    tagline: "Enterprise Fleet & Freight Management",
  },
  {
    key: "vm",
    name: "Veerashaiva Mart",
    shortName: "VM",
    active: false,
    tagline: "Coming soon",
  },
];

export const ADMIN_ROLES = ["main_admin", "admin", "staff", "operations"];
export const DEFAULT_COMPANY_KEY = "vel";
export const PORTAL_USERS_COLLECTION = "portal_users";
export const PORTAL_OTPS_COLLECTION = "portal_login_otps";

export const normalizeEmail = (value = "") => value.trim().toLowerCase();
export const normalizeLoginId = (value = "") => value.trim().toLowerCase();

export const MAIN_ADMIN_COMPANY_KEY =
  (import.meta.env.VITE_MAIN_ADMIN_COMPANY || DEFAULT_COMPANY_KEY).trim().toLowerCase();

export const getCompanyByKey = (key = DEFAULT_COMPANY_KEY) =>
  COMPANIES.find((company) => company.key === key) || COMPANIES[0];

export const buildPortalUserDocId = (companyKey, email) =>
  `${String(companyKey || DEFAULT_COMPANY_KEY).trim().toLowerCase()}__${normalizeEmail(email)}`;

export const buildOtpDocId = buildPortalUserDocId;

export const isAdminRole = (role = "") => ADMIN_ROLES.includes(role);

export const isMainAdminUser = (user) => {
  if (!user) return false;
  return user.role === "main_admin" || user.roleLabel === "Main Admin";
};

export const generateOtpCode = () =>
  String(Math.floor(100000 + Math.random() * 900000));

export const hashValue = async (value) => {
  const payload = new TextEncoder().encode(String(value || ""));
  const buffer = await window.crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(buffer))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
};

export const sendOtpEmail = async (payload) => {
  await api.sendOtpEmail(payload);
};

export const sendCustomerNotification = async (payload) => {
  if (!payload.toEmail) return;
  try {
    await api.sendCustomerNotification(payload);
    console.log(`✅ Professional Booking Bill sent to ${payload.toEmail}`);
  } catch (error) {
    console.error("Failed to send customer notification:", error);
  }
};
