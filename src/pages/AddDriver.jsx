import { useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { UserPlus, ShieldCheck, HeartPulse, FileText, IndianRupee } from "lucide-react";
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css";

const buildInitialForm = () => ({
  driverLoginId: `DRV-${Math.floor(1000 + Math.random() * 9000)}`,
  name: "",
  phone: "",
  password: "",
  licenseNumber: "",
  licenseExpiry: "",
  aadhaarNumber: "",
  bloodGroup: "",
  emergencyContact: "",
  experience: "",
  address: "",
  salaryType: "fixed",
  salary: "",
  commissionRate: "",
  status: "active",
});

function AddDriver() {
  const [form, setForm] = useState(buildInitialForm());

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async () => {
    if (!form.driverLoginId || !form.name || !form.phone || !form.password) {
      return alert("Driver ID, Name, Phone, and Password are required for Driver Login.");
    }
    if (form.phone.length < 10) {
      return alert("Please enter a valid 10-digit phone number.");
    }

    setIsSubmitting(true);

    try {
      const docRef = await addDoc(collection(db, "drivers"), {
        ...form,
        salary: Number(form.salary) || 0,
        commissionRate: Number(form.commissionRate) || 0,
        createdAt: new Date().toISOString(),
      });
      await logActivity(db, {
        action: "driver_created",
        module: "drivers",
        summary: `Created driver profile for ${form.name}`,
        targetId: docRef.id,
        targetType: "driver",
      });

      alert("Driver Profile Created Successfully.");

      setForm(buildInitialForm());
    } catch (error) {
      console.error("Error adding driver:", error);
      alert("Error saving to database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />

      <div className="admin-form-card">
        <div className="driver-header">
          <div className="header-title">
            <UserPlus size={28} className="text-blue" />
            <div>
              <h2>Onboard New Driver</h2>
              <p>Create a driver profile and generate login credentials.</p>
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div className="section-title full-width">
            <ShieldCheck size={18} /> Account & Contact details
          </div>

          <div className="input-group">
            <label>Driver Login ID *</label>
            <input
              name="driverLoginId"
              placeholder="e.g., DRV-2045"
              value={form.driverLoginId}
              onChange={handleChange}
            />
          </div>

          <div className="input-group">
            <label>Full Name *</label>
            <input name="name" placeholder="e.g., Ramesh Kumar" value={form.name} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Phone Number *</label>
            <input name="phone" type="tel" placeholder="10-digit number" value={form.phone} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Password *</label>
            <input name="password" type="text" placeholder="Create a password" value={form.password} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Current Status</label>
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active (Ready for duty)</option>
              <option value="inactive">Inactive (On leave/Suspended)</option>
            </select>
          </div>

          <div className="section-title full-width mt-4">
            <FileText size={18} /> Compliance & Documents
          </div>

          <div className="input-group">
            <label>License Number</label>
            <input name="licenseNumber" placeholder="e.g., KA-01-2010-0000000" value={form.licenseNumber} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>License Expiry Date</label>
            <input name="licenseExpiry" type="date" value={form.licenseExpiry} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Aadhaar / Gov ID Number</label>
            <input name="aadhaarNumber" placeholder="12-digit ID" value={form.aadhaarNumber} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Driving Experience (Years)</label>
            <input name="experience" type="number" placeholder="e.g., 5" value={form.experience} onChange={handleChange} />
          </div>

          <div className="section-title full-width mt-4">
            <HeartPulse size={18} /> Safety & HR
          </div>

          <div className="input-group">
            <label>Emergency Contact Number</label>
            <input name="emergencyContact" placeholder="Family member's phone" value={form.emergencyContact} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Blood Group</label>
            <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange}>
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
          </div>

          <div className="input-group full-width">
            <label>Home Address</label>
            <input name="address" placeholder="Full residential address" value={form.address} onChange={handleChange} />
          </div>

          <div className="section-title full-width mt-4">
            <IndianRupee size={18} /> Compensation
          </div>

          <div className="input-group full-width">
            <label>Salary Type</label>
            <select name="salaryType" value={form.salaryType} onChange={handleChange}>
              <option value="fixed">Fixed Monthly Salary</option>
              <option value="commission">Commission % on Monthly Booking Amount</option>
              <option value="fixed_commission">Fixed Salary + Commission %</option>
            </select>
          </div>

          {form.salaryType !== "commission" && (
            <div className="input-group">
              <label>Fixed Monthly Salary (Rs)</label>
              <input name="salary" type="number" placeholder="e.g., 20000" value={form.salary} onChange={handleChange} />
            </div>
          )}

          {form.salaryType !== "fixed" && (
            <div className="input-group">
              <label>Commission Rate (%)</label>
              <input name="commissionRate" type="number" placeholder="e.g., 5" value={form.commissionRate} onChange={handleChange} />
            </div>
          )}

          {form.salaryType === "fixed" && (
            <div className="input-group">
              <label>Commission Rate (%)</label>
              <input value="Not applicable" disabled />
            </div>
          )}

          {form.salaryType === "commission" && (
            <div className="input-group">
              <label>Fixed Monthly Salary (Rs)</label>
              <input value="Not applicable" disabled />
            </div>
          )}

          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleAdd} disabled={isSubmitting}>
              {isSubmitting ? "Creating Profile..." : "Onboard Driver"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddDriver;
