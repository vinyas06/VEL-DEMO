import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { Truck, FileCheck, Wrench, ShieldAlert } from "lucide-react";
import { logActivity } from "../utils/activityLog";
import "./AddVehicle.css"; // 🔥 Your new premium CSS

function AddVehicle() {
  const [form, setForm] = useState({
    number: "",
    makeModel: "", // New: e.g., Tata Signa, Ashok Leyland
    type: "",      // e.g., Open, Container, Trailer
    capacity: "",
    owner: "",
    driver: "",
    chassisNumber: "", // New: Asset tracking
    engineNumber: "",  // New: Asset tracking
    insuranceExpiry: "", // New: Compliance
    fitnessExpiry: "",   // New: Compliance
    permitExpiry: "",    // New: Compliance
    pucExpiry: "",       // New: Compliance
    status: "active",
  });

  const [drivers, setDrivers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const snap = await getDocs(collection(db, "drivers"));
        // Fetch only active drivers
        const activeDrivers = snap.docs
          .map(d => d.data())
          .filter(d => d.status !== "inactive");
        setDrivers(activeDrivers.map(d => d.name));
      } catch (error) {
        console.error("Error fetching drivers:", error);
      }
    };
    fetchDrivers();
  }, []);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleAdd = async () => {
    // 🧠 Smart Validation
    if (!form.number) return alert("❌ Vehicle Registration Number is mandatory.");
    if (!form.type) return alert("❌ Please specify the Vehicle Type.");
    if (!form.capacity) return alert("❌ Please enter the Vehicle Capacity.");

    setIsSubmitting(true);

    try {
      const docRef = await addDoc(collection(db, "vehicles"), {
        ...form,
        number: form.number.toUpperCase(), // Standardize vehicle plates
        createdAt: new Date().toISOString(),
      });
      await logActivity(db, {
        action: "vehicle_created",
        module: "vehicles",
        summary: `Registered vehicle ${form.number.toUpperCase()}`,
        targetId: docRef.id,
        targetType: "vehicle",
      });

      alert("Vehicle Added Successfully! ✅");
      
      // 🧹 Clear the form
      setForm({
        number: "", makeModel: "", type: "", capacity: "", owner: "", driver: "",
        chassisNumber: "", engineNumber: "", insuranceExpiry: "", fitnessExpiry: "",
        permitExpiry: "", pucExpiry: "", status: "active"
      });
    } catch (error) {
      console.error("Error adding vehicle:", error);
      alert("Error saving to database.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      
      <div className="admin-form-card">
        <div className="vehicle-header">
          <div className="header-title">
            <Truck size={28} className="text-blue" />
            <div>
              <h2>Register New Vehicle</h2>
              <p>Add a new truck to your fleet and track its compliance.</p>
            </div>
          </div>
        </div>

        <div className="form-grid">
          
          {/* --- SECTION 1: BASIC DETAILS --- */}
          <div className="section-title full-width">
            <Wrench size={18} /> Asset Specifications
          </div>

          <div className="input-group">
            <label>Registration Number *</label>
            <input name="number" placeholder="e.g., MH-12-AB-1234" value={form.number} onChange={handleChange} style={{textTransform: 'uppercase'}}/>
          </div>

          <div className="input-group">
            <label>Make & Model</label>
            <input name="makeModel" placeholder="e.g., Tata Signa 4225.T" value={form.makeModel} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Body Type *</label>
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="">Select Body Type...</option>
              <option value="Open Half Mixture">Open Half Mixture</option>
              <option value="Container">Closed Container</option>
              <option value="Trailer">Flatbed Trailer</option>
              <option value="Tanker">Liquid Tanker</option>
              <option value="Tipper">Tipper / Dumper</option>
            </select>
          </div>

          <div className="input-group">
            <label>Payload Capacity (Tons) *</label>
            <input name="capacity" type="number" placeholder="e.g., 22" value={form.capacity} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Chassis Number</label>
            <input name="chassisNumber" placeholder="17-character VIN" value={form.chassisNumber} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Engine Number</label>
            <input name="engineNumber" placeholder="Engine serial no." value={form.engineNumber} onChange={handleChange} />
          </div>

          {/* --- SECTION 2: OWNERSHIP & ASSIGNMENT --- */}
          <div className="section-title full-width mt-4">
            <ShieldAlert size={18} /> Ownership & Assignment
          </div>

          <div className="input-group">
            <label>Owner Name (If Attached/Market)</label>
            <input name="owner" placeholder="Company or Individual Name" value={form.owner} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Assign Default Driver</label>
            <select name="driver" value={form.driver} onChange={handleChange}>
              <option value="">Unassigned (Select Driver)</option>
              {drivers.map((d, i) => <option key={i} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="input-group full-width">
            <label>Current Status</label>
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="active">Active (On Road)</option>
              <option value="maintenance">In Maintenance / Garage</option>
              <option value="sold">Sold / Decommissioned</option>
            </select>
          </div>

          {/* --- SECTION 3: COMPLIANCE EXPIRIES --- */}
          <div className="section-title full-width mt-4">
            <FileCheck size={18} /> RTO Compliance & Expiries
          </div>

          <div className="input-group">
            <label>Insurance Expiry</label>
            <input name="insuranceExpiry" type="date" value={form.insuranceExpiry} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Fitness Certificate Expiry</label>
            <input name="fitnessExpiry" type="date" value={form.fitnessExpiry} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>National Permit Expiry</label>
            <input name="permitExpiry" type="date" value={form.permitExpiry} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>PUC (Pollution) Expiry</label>
            <input name="pucExpiry" type="date" value={form.pucExpiry} onChange={handleChange} />
          </div>

          {/* SUBMIT BUTTON */}
          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleAdd} disabled={isSubmitting}>
              {isSubmitting ? "Registering Vehicle..." : "Register Vehicle"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default AddVehicle;
