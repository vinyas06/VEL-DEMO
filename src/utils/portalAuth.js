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
// 🔥 NEW: Array of specific Main Admins
const buildEnvMainAdmin = () => {
  const username = normalizeLoginId(import.meta.env.VITE_MAIN_ADMIN_USERNAME || "");
  const password = import.meta.env.VITE_MAIN_ADMIN_PASSWORD || "";
  const email = normalizeEmail(import.meta.env.VITE_MAIN_ADMIN_EMAIL || "");

  if (!username || !password) {
    return null;
  }

  return {
    username,
    password,
    name: "Main Admin",
    email,
  };
};

// Main admins supported by env configuration plus existing local credentials.
export const MAIN_ADMINS = [
  buildEnvMainAdmin(),
  {
    username: "vinyas06",
    password: import.meta.env.VITE_VINYAS_PASSWORD || "vinyas@123", 
    name: "Vinyas",
    email: "vinyassharana06@gmail.com"
  },
  {
    username: "shera75",
    password: import.meta.env.VITE_SHERA_PASSWORD || "shera@123", 
    name: "Shera Mohandas Kolalagiri",
    email: "mohandassharana06@gmail.com"
  }
].filter(Boolean);

export const MAIN_ADMIN_COMPANY_KEY =
  (import.meta.env.VITE_MAIN_ADMIN_COMPANY || DEFAULT_COMPANY_KEY).trim().toLowerCase();

export const EMAILJS_CONFIG = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || "service_a6calsj",
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || "template_j6wca4f", 
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "Sdse_3EftZpcPBPYC",
};

export const EMAILJS_READY =
  Boolean(EMAILJS_CONFIG.serviceId) &&
  Boolean(EMAILJS_CONFIG.publicKey);

export const getCompanyByKey = (key = DEFAULT_COMPANY_KEY) =>
  COMPANIES.find((company) => company.key === key) || COMPANIES[0];

export const buildPortalUserDocId = (companyKey, email) =>
  `${String(companyKey || DEFAULT_COMPANY_KEY).trim().toLowerCase()}__${normalizeEmail(email)}`;

export const buildOtpDocId = buildPortalUserDocId;

export const isAdminRole = (role = "") => ADMIN_ROLES.includes(role);


// 🔥 NEW: Function checks the array instead of a single hardcoded admin
export const getMainAdminCredential = ({ companyKey, username, password }) => {
  const normalizedLogin = normalizeLoginId(username);
  const admin = MAIN_ADMINS.find(
    (admin) => admin.username === normalizedLogin && admin.password === password
  );
  
  if (admin && String(companyKey || "").trim().toLowerCase() === MAIN_ADMIN_COMPANY_KEY) {
    return admin;
  }
  return null;
};

export const isMainAdminUser = (user) => {
  if (!user) return false;

  const normalizedLogin = normalizeLoginId(user.loginId || user.username || "");
  const normalizedEmail = normalizeEmail(user.email || "");

  return (
    user.role === "main_admin" ||
    user.roleLabel === "Main Admin" ||
    MAIN_ADMINS.some(
      (admin) =>
        admin.username === normalizedLogin ||
        (admin.email && normalizeEmail(admin.email) === normalizedEmail)
    )
  );
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

export const sendOtpEmail = async ({
  toEmail,
  passcode,
  companyName,
  userName,
  expiryMinutes = 10,
}) => {
  if (!EMAILJS_READY) {
    throw new Error("Email OTP is not configured.");
  }

  const payload = {
    service_id: EMAILJS_CONFIG.serviceId,
    template_id: EMAILJS_CONFIG.templateId, 
    user_id: EMAILJS_CONFIG.publicKey,
    template_params: {
      email: toEmail,
      passcode,
      time: `${expiryMinutes} minutes`,
      company_name: companyName,
      user_name: userName || "Team User",
    },
  };

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to send OTP email.");
  }
};

export const sendCustomerNotification = async ({ 
  toEmail, 
  customerName, 
  trackingId,
  lrNumber,
  loadingDate,
  vehicle,
  fromLocation,
  toLocation,
  material,
  weight,
  paymentMode,
  freight,
  advance
}) => {
  if (!EMAILJS_READY || !toEmail) return; 

  const balanceDue = Number(freight || 0) - Number(advance || 0);

  const payload = {
    service_id: EMAILJS_CONFIG.serviceId,
    template_id: "template_pinwrjf",
    user_id: EMAILJS_CONFIG.publicKey,
    template_params: {
      to_email: toEmail,          
      customer_email: toEmail,    
      customer_name: customerName,
      tracking_id: trackingId,
      lr_number: lrNumber || "Pending",
      loading_date: loadingDate,
      vehicle: vehicle,
      from_location: fromLocation,
      to_location: toLocation,
      material: material || "General Goods",
      weight: weight || "N/A",
      payment_mode: paymentMode,
      freight: Number(freight || 0).toLocaleString('en-IN'),
      advance: Number(advance || 0).toLocaleString('en-IN'),
      balance: balanceDue.toLocaleString('en-IN')
    },
  };

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
       console.error("Failed to send customer notification:", await response.text());
    } else {
       console.log(`✅ Professional Booking Bill sent to ${toEmail}`);
    }
  } catch (error) {
    console.error("Failed to send customer notification:", error);
  }
};
