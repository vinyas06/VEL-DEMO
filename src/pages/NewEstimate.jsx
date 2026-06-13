import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs } from "firebase/firestore"; 
import { Calculator, MapPin, Navigation, Box, FileText, Truck, Users } from "lucide-react"; 
import { logActivity } from "../utils/activityLog";
import "./AddDriver.css"; // Reuse your excellent CSS

const generateEstimateId = () => `EST-${Math.floor(10000 + Math.random() * 90000)}`;
const sanitizeDecimalInput = (value) => value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

const decimalInputProps = {
  type: "text",
  inputMode: "decimal",
  pattern: "[0-9]*[.]?[0-9]*",
};

function NewEstimate() {
  const navigate = useNavigate();

  const [parties, setParties] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default validity to 7 days from today
  const defaultValidDate = new Date();
  defaultValidDate.setDate(defaultValidDate.getDate() + 7);

  const [form, setForm] = useState({
    estimateId: generateEstimateId(), 
    party: "",
    from: "",
    to: "",
    material: "",
    weight: "",
    dateRequested: new Date().toISOString().split('T')[0],
    validUntil: defaultValidDate.toISOString().split('T')[0],
    freightType: "perKm", 
    rate: "",
    exactDistance: "", 
    freight: 0, 
    notes: ""
  });

  const [fromOptions, setFromOptions] = useState([]);
  const [toOptions, setToOptions] = useState([]);
  const [fromCoords, setFromCoords] = useState(null);
  const [toCoords, setToCoords] = useState(null);
  const [approxDistance, setApproxDistance] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const pSnap = await getDocs(collection(db, "parties"));
      setParties(pSnap.docs.map(d => d.data().name));
    };
    fetchData();
  }, []);

  const handleLocationSearch = async (text, type) => {
    setForm((prev) => ({ ...prev, [type]: text }));
    if (text.length < 3) return; 
    try {
      const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${text}&limit=5&apiKey=${import.meta.env.VITE_GEOAPIFY_API_KEY || "278f06ea43474a83be95b023b58a1a39"}`);
      const data = await res.json();
      if (type === "from") setFromOptions(data.features || []);
      else setToOptions(data.features || []);
    } catch {
      // Ignore autocomplete lookup failures until the next keystroke.
    }
  };

  const handleSelectLocation = (feature, type) => {
    setForm((prev) => ({ ...prev, [type]: feature.properties.formatted }));
    const coords = { lat: feature.properties.lat, lon: feature.properties.lon };
    if (type === "from") { setFromCoords(coords); setFromOptions([]); } 
    else { setToCoords(coords); setToOptions([]); }
  };

  useEffect(() => {
    const getDistance = async () => {
      if (fromCoords && toCoords) {
        try {
          const res = await fetch(`https://apis.mappls.com/advancedmaps/v1/2690adba2b791b087866969b1fd03a3d/route_adv/driving/${fromCoords.lon},${fromCoords.lat};${toCoords.lon},${toCoords.lat}`);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const km = (data.routes[0].distance / 1000).toFixed(1);
            setApproxDistance(km);
            setForm(prev => ({ ...prev, exactDistance: km })); 
          }
        } catch {
          // Ignore route lookup failures and let users enter distance manually.
        }
      }
    };
    getDistance();
  }, [fromCoords, toCoords]);

  useEffect(() => {
    let total = 0;
    const rateVal = Number(form.rate) || 0;
    const distVal = Number(form.exactDistance) || 0;
    if (form.freightType === "perKm") total = rateVal * distVal;
    else total = rateVal; 
    setForm(prev => ({ ...prev, freight: total }));
  }, [form.freightType, form.rate, form.exactDistance]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleDecimalChange = (e) => {
    setForm({ ...form, [e.target.name]: sanitizeDecimalInput(e.target.value) });
  };

  const handleSave = async () => {
    if (!form.party || !form.from || !form.to) return alert("❌ Please fill Party, From, and To.");
    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, "estimates"), {
        ...form,
        createdAt: new Date().toISOString(),
        status: "Quoted" // Initial status
      });
      await logActivity(db, {
        action: "estimate_created",
        module: "estimates",
        summary: `Created estimate ${form.estimateId} for ${form.party}`,
        targetId: docRef.id,
        targetType: "estimate",
      });
      alert(`Estimate Saved! ✅\nID: ${form.estimateId}`);
      navigate("/estimate-list"); 
    } catch { alert("Error saving estimate."); } 
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card" style={{ borderTop: "5px solid #8b5cf6" }}>
        
        <div className="driver-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="header-title">
            <Calculator size={28} color="#8b5cf6" />
            <div>
              <h2>Create Freight Estimate</h2>
              <p>Generate a quotation for a customer before booking.</p>
            </div>
          </div>
          <div style={{ textAlign: "right", background: "#f5f3ff", padding: "10px 15px", borderRadius: "8px", border: "1px solid #ddd6fe" }}>
            <small style={{ color: "#6d28d9", fontWeight: "bold", display: "block" }}>QUOTE ID</small>
            <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#4c1d95" }}>{form.estimateId}</span>
          </div>
        </div>

        <div className="form-grid">
          
          <div className="input-group full-width">
            <label>Customer / Party Name *</label>
            <select name="party" value={form.party} onChange={handleChange}>
              <option value="">-- Select Party --</option>
              {parties.map((p, i) => <option key={i} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label>Date Requested</label>
            <input name="dateRequested" type="date" value={form.dateRequested} onChange={handleChange} />
          </div>
          <div className="input-group">
            <label>Quote Valid Until *</label>
            <input name="validUntil" type="date" value={form.validUntil} onChange={handleChange} style={{ borderColor: "#8b5cf6" }} />
          </div>

          <div className="section-title full-width mt-4"><Navigation size={18} /> Route & Distance</div>

          <div className="input-group" style={{ position: "relative" }}>
            <label>From (Loading Point) *</label>
            <input placeholder="Start typing city..." value={form.from} onChange={(e) => handleLocationSearch(e.target.value, "from")} autoComplete="off" />
            {fromOptions.length > 0 && <ul className="autocomplete-list">{fromOptions.map((f, i) => <li key={i} onClick={() => handleSelectLocation(f, "from")}><MapPin size={14}/> {f.properties.formatted}</li>)}</ul>}
          </div>

          <div className="input-group" style={{ position: "relative" }}>
            <label>To (Unloading Point) *</label>
            <input placeholder="Start typing city..." value={form.to} onChange={(e) => handleLocationSearch(e.target.value, "to")} autoComplete="off" />
            {toOptions.length > 0 && <ul className="autocomplete-list">{toOptions.map((f, i) => <li key={i} onClick={() => handleSelectLocation(f, "to")}><MapPin size={14}/> {f.properties.formatted}</li>)}</ul>}
          </div>

          <div className="input-group">
            <label>Approx Distance (KM)</label>
            <input value={approxDistance ? `${approxDistance} km` : "Calculating..."} disabled style={{ background: "#f1f5f9" }} />
          </div>
          <div className="input-group">
            <label>Billing Distance (KM) *</label>
            <input name="exactDistance" {...decimalInputProps} value={form.exactDistance} onChange={handleDecimalChange} />
          </div>

          <div className="section-title full-width mt-4"><Box size={18} /> Cargo & Financials</div>

          <div className="input-group"><label>Material / Cargo</label><input name="material" value={form.material} onChange={handleChange} /></div>
          <div className="input-group"><label>Expected Weight (Tons)</label><input name="weight" {...decimalInputProps} value={form.weight} onChange={handleDecimalChange} /></div>
          
          <div className="input-group">
            <label>Freight Calculation</label>
            <select name="freightType" value={form.freightType} onChange={handleChange}>
              <option value="perKm">Rate Per KM</option>
              <option value="lumpSum">Fixed / Lump Sum</option>
            </select>
          </div>
          <div className="input-group">
            <label>{form.freightType === "perKm" ? "Rate per KM (₹)" : "Total Fixed Freight (₹)"}</label>
            <input name="rate" {...decimalInputProps} value={form.rate} onChange={handleDecimalChange} />
          </div>

          <div className="input-group full-width" style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <label style={{ color: "#475569" }}>Total Estimated Freight</label>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#334155" }}>₹ {form.freight || 0}</div>
          </div>

          <div className="input-group full-width"><label>Additional Notes / Terms</label><input name="notes" placeholder="e.g. Rate excludes toll tax" value={form.notes} onChange={handleChange} /></div>

          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleSave} disabled={isSubmitting} style={{ background: "#8b5cf6" }}>
              {isSubmitting ? "Saving..." : "Generate Estimate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewEstimate;
