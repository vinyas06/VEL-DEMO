import { useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { Building2, Contact, CreditCard, FileText } from "lucide-react";
import { logActivity } from "../utils/activityLog";
import "./AddParty.css"; 

function AddParty() {
  const [form, setForm] = useState({
    name: "",
    partyType: "direct", // Default to Direct Client
    contactPerson: "",   
    phone: "",
    email: "",           
    address: "",
    gst: "",
    balance: "",
    creditLimit: "",     
    status: "active",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleAdd = async () => {
    if (!form.name) return alert("❌ Party/Company Name is mandatory.");
    if (!form.phone) return alert("❌ Please enter a contact phone number.");

    setIsSubmitting(true);

    try {
      // 🔥 Always saves to 'parties'
      const docRef = await addDoc(collection(db, "parties"), {
        ...form,
        balance: Number(form.balance) || 0, 
        creditLimit: Number(form.creditLimit) || 0,
        createdAt: new Date().toISOString(),
      });
      await logActivity(db, {
        action: "party_created",
        module: "parties",
        summary: `Registered party ${form.name}`,
        targetId: docRef.id,
        targetType: "party",
      });

      alert("Party Added Successfully! ✅");
      
      setForm({
        name: "", partyType: "direct", contactPerson: "", phone: "", email: "",
        address: "", gst: "", balance: "", creditLimit: "", status: "active",
      });
    } catch (error) {
      console.error("Error adding party:", error);
      alert("Error saving to database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      
      <div className="admin-form-card">
        <div className="party-header">
          <div className="header-title">
            <Building2 size={28} className="text-blue" />
            <div>
              <h2>Onboard New Party</h2>
              <p>Register a new direct client or vendor to your network.</p>
            </div>
          </div>
        </div>

        <div className="form-grid">
          
          <div className="section-title full-width">
            <Building2 size={18} /> Company Details
          </div>

          <div className="input-group">
            <label>Party / Company Name *</label>
            <input name="name" placeholder="e.g., Tata Steel Ltd." value={form.name} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Party Type</label>
            <select name="partyType" value={form.partyType} onChange={handleChange}>
              <option value="direct">Direct Client</option>
              <option value="transporter">Other Transporter</option>
            </select>
          </div>

          <div className="input-group full-width">
            <label>Billing / Office Address</label>
            <input name="address" placeholder="Full company address" value={form.address} onChange={handleChange} />
          </div>

          <div className="section-title full-width mt-4">
            <Contact size={18} /> Contact Person
          </div>

          <div className="input-group">
            <label>Contact Person Name</label>
            <input name="contactPerson" placeholder="e.g., Rahul Sharma" value={form.contactPerson} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Phone Number *</label>
            <input name="phone" type="tel" placeholder="10-digit number" value={form.phone} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Email Address</label>
            <input name="email" type="email" placeholder="For invoices & updates" value={form.email} onChange={handleChange} />
          </div>

          <div className="section-title full-width mt-4">
            <FileText size={18} /> Financial & Tax Information
          </div>

          <div className="input-group">
            <label>GST Number</label>
            <input name="gst" placeholder="15-character GSTIN" value={form.gst} onChange={handleChange} style={{textTransform: 'uppercase'}} />
          </div>

          <div className="input-group">
            <label>Opening Balance (₹)</label>
            <input name="balance" type="number" placeholder="Existing debt (if any)" value={form.balance} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Maximum Credit Limit (₹)</label>
            <input name="creditLimit" type="number" placeholder="e.g., 500000" value={form.creditLimit} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Account Status</label>
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active</option>
              <option value="blacklisted">Blacklisted / Hold</option>
            </select>
          </div>

          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleAdd} disabled={isSubmitting}>
              {isSubmitting ? "Registering Party..." : "Register Party"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default AddParty;
