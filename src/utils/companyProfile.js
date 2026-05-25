import { doc, getDoc } from "firebase/firestore";

export const DEFAULT_COMPANY_PROFILE = {
  companyName: "Veerashaiva Express Logistics",
  tagline: "Enterprise Fleet & Freight Management",
  phone: "",
  email: "",
  address: "",
  gstNumber: "",
  panNumber: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  ifscCode: "",
  termsAndConditions:
    "1. Goods transported at owner's risk.\n2. Demurrage applies after 24hrs.\n3. Subject to local jurisdiction.",
};

export const fetchCompanyProfile = async (db) => {
  const snapshot = await getDoc(doc(db, "settings", "company_profile"));
  return snapshot.exists()
    ? { ...DEFAULT_COMPANY_PROFILE, ...snapshot.data() }
    : DEFAULT_COMPANY_PROFILE;
};

export const getCompanyAddressLine = (profile = DEFAULT_COMPANY_PROFILE) => {
  const parts = [profile.address, profile.phone ? `Ph: ${profile.phone}` : "", profile.email]
    .filter(Boolean)
    .join(" | ");

  return parts || "Address not set";
};

export const getTermsList = (profile = DEFAULT_COMPANY_PROFILE) =>
  String(profile.termsAndConditions || DEFAULT_COMPANY_PROFILE.termsAndConditions)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
