import { useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { Users, Contact, FileText, IndianRupee } from "lucide-react";
import { logActivity } from "../utils/activityLog";
import "./AddParty.css"; 

function AddCommissionAgent() {
  const [form, setForm] = useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    gst: "",
    panNumber: "", 
    commissionRate: "", 
    balance: "", 
    status: "active",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleAdd = async () => {
    if (!form.name || !form.phone) return alert("❌ Agency Name and Phone are required.");

    setIsSubmitting(true);
    try {
      // 🔥 SAVES TO "agents" COLLECTION
      const docRef = await addDoc(collection(db, "agents"), {
        ...form,
        commissionRate: Number(form.commissionRate) || 0,
        balance: Number(form.balance) || 0,
        createdAt: new Date().toISOString(),
      });
      await logActivity(db, {
        action: "agent_created",
        module: "agents",
        summary: `Registered commission agent ${form.name}`,
        targetId: docRef.id,
        targetType: "agent",
      });

      alert("Commission Agent Registered Successfully! ✅");
      
      setForm({
        name: "", contactPerson: "", phone: "", email: "", address: "",
        gst: "", panNumber: "", commissionRate: "", balance: "", status: "active",
      });
    } catch {
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
            <Users size={28} className="text-blue" />
            <div>
              <h2>Onboard Commission Agent</h2>
              <p>Register a new broker/transport agent to your network.</p>
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div className="section-title full-width">
            <Users size={18} /> Agency Details
          </div>

          <div className="input-group">
            <label>Agency / Transport Name *</label>
            <input name="name" placeholder="e.g., Sharma Transport Agency" value={form.name} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Contact Person *</label>
            <input name="contactPerson" placeholder="Owner or Manager Name" value={form.contactPerson} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Phone Number *</label>
            <input name="phone" type="tel" placeholder="10-digit number" value={form.phone} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Email Address</label>
            <input name="email" type="email" placeholder="For ledgers & invoices" value={form.email} onChange={handleChange} />
          </div>

          <div className="input-group full-width">
            <label>Office Address</label>
            <input name="address" placeholder="Full office address" value={form.address} onChange={handleChange} />
          </div>

          <div className="section-title full-width mt-4">
            <FileText size={18} /> Compliance & Commission
          </div>

          <div className="input-group">
            <label>PAN Number (For TDS) *</label>
            <input name="panNumber" placeholder="10-character PAN" value={form.panNumber} onChange={handleChange} style={{textTransform: 'uppercase'}} />
          </div>

          <div className="input-group">
            <label>GST Number</label>
            <input name="gst" placeholder="15-character GSTIN" value={form.gst} onChange={handleChange} style={{textTransform: 'uppercase'}} />
          </div>

          <div className="input-group">
            <label>Standard Commission Rate (%)</label>
            <input name="commissionRate" type="number" placeholder="e.g., 2" value={form.commissionRate} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Opening Pending Commission (₹)</label>
            <input name="balance" type="number" placeholder="Amount you owe them currently" value={form.balance} onChange={handleChange} />
          </div>

          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleAdd} disabled={isSubmitting}>
              {isSubmitting ? "Registering..." : "Register Agent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddCommissionAgent;
