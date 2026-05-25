import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore"; 
import { Settings as SettingsIcon, Building, FileText, Landmark, Save } from "lucide-react"; 
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css"; // Reusing your existing premium form CSS

const settingsRef = doc(db, "settings", "company_profile");

function Settings() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Master Company State
  const [form, setForm] = useState({
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
    termsAndConditions: "1. Goods transported at owner's risk.\n2. Demurrage applies after 24hrs.\n3. Subject to local jurisdiction."
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
          setForm(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      // setDoc will create the document if it doesn't exist, or update it if it does
      await setDoc(settingsRef, {
        ...form,
        updatedAt: new Date().toISOString()
      });
      await logActivity(db, {
        action: "settings_updated",
        module: "settings",
        summary: "updated company profile settings",
        targetId: "company_profile",
        targetType: "settings",
      });
      alert("Company Profile Updated Successfully! ✅");
    } catch {
      alert("Error saving settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="page-bg"><Navbar /><div style={{padding: "3rem", textAlign: "center"}}>Loading Settings...</div></div>;

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #475569" }}>
        
        <div className="driver-header" style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          <SettingsIcon size={32} color="#475569" />
          <div>
            <h2>Master System Settings</h2>
            <p>Manage your company profile, invoice details, and bank information.</p>
          </div>
        </div>

        <div className="form-grid">
          
          {/* SECTION 1: BASIC INFO */}
          <div className="section-title full-width">
            <Building size={18} /> Company Details (Appears on Invoices)
          </div>

          <div className="input-group full-width">
            <label>Company Name *</label>
            <input name="companyName" value={form.companyName} onChange={handleChange} style={{ fontWeight: "bold" }} />
          </div>

          <div className="input-group full-width">
            <label>Tagline / Slogan</label>
            <input name="tagline" value={form.tagline} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Primary Phone Number</label>
            <input name="phone" value={form.phone} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Support Email Address</label>
            <input name="email" value={form.email} onChange={handleChange} />
          </div>

          <div className="input-group full-width">
            <label>Head Office Address</label>
            <textarea 
              name="address" 
              value={form.address} 
              onChange={handleChange} 
              rows="3"
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontFamily: "inherit" }}
            />
          </div>

          {/* SECTION 2: TAX & COMPLIANCE */}
          <div className="section-title full-width mt-4">
            <FileText size={18} /> Tax & Compliance
          </div>

          <div className="input-group">
            <label>GSTIN Number</label>
            <input name="gstNumber" value={form.gstNumber} onChange={handleChange} style={{ textTransform: "uppercase" }} />
          </div>

          <div className="input-group">
            <label>PAN Number</label>
            <input name="panNumber" value={form.panNumber} onChange={handleChange} style={{ textTransform: "uppercase" }} />
          </div>

          {/* SECTION 3: BANK DETAILS */}
          <div className="section-title full-width mt-4">
            <Landmark size={18} /> Default Bank Details (For Consolidated Billing)
          </div>

          <div className="input-group">
            <label>Bank Name</label>
            <input name="bankName" value={form.bankName} onChange={handleChange} placeholder="e.g. HDFC Bank" />
          </div>

          <div className="input-group">
            <label>Account Name</label>
            <input name="accountName" value={form.accountName} onChange={handleChange} placeholder="e.g. VR Logistics Current A/c" />
          </div>

          <div className="input-group">
            <label>Account Number</label>
            <input name="accountNumber" value={form.accountNumber} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>IFSC Code</label>
            <input name="ifscCode" value={form.ifscCode} onChange={handleChange} style={{ textTransform: "uppercase" }} />
          </div>

          {/* SECTION 4: INVOICE SETTINGS */}
          <div className="section-title full-width mt-4">
            <FileText size={18} /> Default Invoice Settings
          </div>

          <div className="input-group full-width">
            <label>Default Terms & Conditions (Line by Line)</label>
            <textarea 
              name="termsAndConditions" 
              value={form.termsAndConditions} 
              onChange={handleChange} 
              rows="4"
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontFamily: "inherit" }}
            />
          </div>

          {/* SUBMIT */}
          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleSave} disabled={isSubmitting} style={{ background: "#0f172a", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
              <Save size={20} /> {isSubmitting ? "Saving Configuration..." : "Save Master Settings"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Settings;
