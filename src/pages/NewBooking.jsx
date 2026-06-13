import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, doc } from "firebase/firestore"; 
import { Briefcase, MapPin, Truck, Navigation, Box, Users, FileText, Landmark } from "lucide-react"; 
import AttachmentUploader from "../components/AttachmentUploader";
import { uploadAttachments } from "../utils/attachments";
import { logActivity } from "../utils/activityLog";
import { sendCustomerNotification } from "../utils/portalAuth"; 
import "./AddDriver.css"; 

const generateLrNumber = () => `LR-${Math.floor(10000 + Math.random() * 90000)}`;
const generate6DigitId = () => Math.floor(100000 + Math.random() * 900000).toString();
const sanitizeDecimalInput = (value) => value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
const getNextLrNumber = (bookings = []) => {
  const numericLrs = bookings
    .map((booking) => String(booking.lrNumber || "").trim())
    .filter((lrNumber) => /^\d+$/.test(lrNumber));

  if (numericLrs.length === 0) {
    return "001";
  }

  const latest = numericLrs.reduce(
    (best, lrNumber) => {
      const value = Number(lrNumber);
      return value > best.value ? { value, width: lrNumber.length } : best;
    },
    { value: 0, width: 3 }
  );

  return String(latest.value + 1).padStart(latest.width, "0");
};

const decimalInputProps = {
  type: "text",
  inputMode: "decimal",
  pattern: "[0-9]*[.]?[0-9]*",
};

function NewBooking() {
  const navigate = useNavigate();
  const location = useLocation(); 
  const estimateData = location.state?.estimateData || null;

  const [parties, setParties] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [agents, setAgents] = useState([]); 
  const [accounts, setAccounts] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);

  const [form, setForm] = useState({
    trackingId: generate6DigitId(), 
    lrNumber: "", 
    party: estimateData?.party || "",
    vehicle: estimateData?.vehicle || "",
    driver: estimateData?.driver || "",
    driver2: "", // 🔥 NEW: Co-driver
    agent: estimateData?.agent || "", 
    agentNo: "",
    from: estimateData?.from || "",
    pickupPartyNo: "",
    to: estimateData?.to || "",
    deliveryPartyNo: "",
    material: estimateData?.material || "",
    weight: estimateData?.weight || "",
    loadingDate: estimateData?.loadingDate || new Date().toISOString().split('T')[0],
    freightType: estimateData?.rateType || "perKm", 
    rate: estimateData?.rate || "",
    exactDistance: estimateData?.billingDistance || "", 
    advance: estimateData?.advance || "",
    advanceAccount: "",
    freight: estimateData?.freight || 0, 
    commission: estimateData?.commission || "", 
    commissionAccount: "",
    paymentMode: estimateData?.paymentMode || "To Pay", 
  });

  const [fromOptions, setFromOptions] = useState([]);
  const [toOptions, setToOptions] = useState([]);
  const [fromCoords, setFromCoords] = useState(null);
  const [toCoords, setToCoords] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const pSnap = await getDocs(collection(db, "parties"));
        const vSnap = await getDocs(collection(db, "vehicles"));
        const dSnap = await getDocs(collection(db, "drivers"));
        const aSnap = await getDocs(collection(db, "agents")); 
        const accSnap = await getDocs(collection(db, "accounts")); 
        const bookingSnap = await getDocs(collection(db, "bookings"));

        setParties(pSnap.docs.map(d => ({ 
          id: d.id, 
          name: d.data().name, 
          email: d.data().email || "" 
        })));
        
        setVehicles(vSnap.docs.map(d => d.data().number));
        setDrivers(dSnap.docs.map(d => d.data().name));
        setAgents(aSnap.docs.map(d => ({ id: d.id, name: d.data().name, rate: d.data().commissionRate || 0, phone: d.data().phone || "" })));
        setAccounts(accSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setForm((prev) => ({
          ...prev,
          lrNumber: prev.lrNumber || getNextLrNumber(bookingSnap.docs.map(d => d.data())),
        }));
      } catch (error) {
        console.error("Error fetching data:", error);
      }
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
      // Keep typed text in place if autocomplete is temporarily unavailable.
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
            setForm(prev => ({ ...prev, exactDistance: km })); 
          }
        } catch {
          // Keep manual distance entry available if route lookup fails.
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

  useEffect(() => {
    if (form.agent && form.freight > 0) {
      const selectedAgent = agents.find(a => a.name === form.agent);
      if (selectedAgent && selectedAgent.rate > 0) {
        const commAmount = (form.freight * selectedAgent.rate) / 100;
        setForm(prev => ({ ...prev, commission: commAmount.toFixed(0) }));
      }
    } else if (!form.agent) {
      setForm(prev => ({ ...prev, commission: "", commissionAccount: "" })); 
    }
  }, [form.agent, form.freight, agents]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  
  const handleAgentChange = (e) => {
    const selectedAgentName = e.target.value;
    const selectedAgent = agents.find(a => a.name === selectedAgentName);
    setForm({ 
      ...form, 
      agent: selectedAgentName, 
      agentNo: selectedAgent ? selectedAgent.phone : "" 
    });
  };

  const handleDecimalChange = (e) => {
    setForm({ ...form, [e.target.name]: sanitizeDecimalInput(e.target.value) });
  };

  const handleSave = async () => {
    if (!form.party || !form.vehicle || !form.from || !form.to) {
      return alert("❌ Please fill Party, Vehicle, From, and To.");
    }
    if (Number(form.advance) > 0 && !form.advanceAccount) {
      return alert("❌ Please select the Bank/Cash account where the Advance was deposited.");
    }
    if (Number(form.commission) > 0 && form.agent && !form.commissionAccount) {
      return alert("❌ Please select the Bank/Cash account from where the Commission was paid.");
    }

    setIsSubmitting(true);
    try {
      const timestamp = new Date().toISOString();
      const attachments = await uploadAttachments(attachmentFiles, "bookings", form.trackingId);

      const bookingRef = await addDoc(collection(db, "bookings"), {
        trackingId: form.trackingId, 
        lrNumber: form.lrNumber || "N/A", 
        party: form.party,
        vehicle: form.vehicle,
        driver: form.driver,
        driver2: form.driver2 || "None", // 🔥 NEW
        agent: form.agent || "Direct", 
        agentNo: form.agentNo || "",
        from: form.from,
        pickupPartyNo: form.pickupPartyNo || "",
        to: form.to,
        deliveryPartyNo: form.deliveryPartyNo || "",
        material: form.material,
        weight: form.weight,
        loadingDate: form.loadingDate,
        freight: Number(form.freight) || 0,
        advance: Number(form.advance) || 0,
        commission: Number(form.commission) || 0, 
        paymentMode: form.paymentMode, 
        status: "Pending",
        createdAt: timestamp,
        billingDistance: form.exactDistance,
        rateType: form.freightType,
        convertedFromEstimateId: estimateData?.id || null,
        attachments,
      });
      
      await logActivity(db, {
        action: "booking_created",
        module: "bookings",
        summary: `created booking ${form.trackingId} for ${form.party}`,
        targetId: bookingRef.id,
        targetType: "booking",
        metadata: { trackingId: form.trackingId },
      });

      const selectedParty = parties.find(p => p.name === form.party);
      if (selectedParty && selectedParty.email) {
        await sendCustomerNotification({
          toEmail: selectedParty.email,
          customerName: selectedParty.name,
          trackingId: form.trackingId,
          lrNumber: form.lrNumber,
          loadingDate: form.loadingDate,
          vehicle: form.vehicle,
          fromLocation: form.from,
          toLocation: form.to,
          material: form.material,
          weight: form.weight,
          paymentMode: form.paymentMode,
          freight: form.freight,
          advance: form.advance
        });
      }

      if (Number(form.advance) > 0) {
        await addDoc(collection(db, "transactions"), {
          voucherNo: `ADV-${form.trackingId}`,
          date: form.loadingDate,
          partyName: form.party,
          bookingId: bookingRef.id,
          bookingTrackingId: form.trackingId,
          bookingLrNumber: form.lrNumber,
          amount: Number(form.advance),
          paymentAccount: form.advanceAccount,
          referenceNo: `LR: ${form.lrNumber || form.trackingId}`,
          notes: "Trip Advance Received",
          type: "IN",
          category: "Trip Advance",
          attachments,
        });
      }

      if (Number(form.commission) > 0 && form.commissionAccount && form.commissionAccount !== "To Be Paid Later") {
        await addDoc(collection(db, "transactions"), {
          voucherNo: `COM-${form.trackingId}`,
          date: form.loadingDate,
          payeeName: form.agent,
          bookingId: bookingRef.id,
          bookingTrackingId: form.trackingId,
          bookingLrNumber: form.lrNumber,
          amount: Number(form.commission),
          paymentAccount: form.commissionAccount,
          referenceNo: `LR: ${form.lrNumber || form.trackingId}`,
          notes: "Broker Commission Paid",
          type: "OUT",
          category: "Commission Agent",
          attachments,
        });
      }

      if (estimateData?.id) {
        await updateDoc(doc(db, "estimates", estimateData.id), { status: "Converted to Booking" });
        await logActivity(db, {
          action: "estimate_converted",
          module: "estimates",
          summary: `Converted estimate ${estimateData.estimateId || estimateData.id} to booking ${form.trackingId}`,
          targetId: estimateData.id,
          targetType: "estimate",
          metadata: { bookingId: bookingRef.id, trackingId: form.trackingId },
        });
      }

      alert(`Booking Saved Successfully! ✅\nTracking ID: ${form.trackingId}`);
      navigate("/booking-list"); 

    } catch (error) {
      console.error(error);
      alert("Error saving booking and transactions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-bg">
      <Navbar />
      <div className="admin-form-card">
        
        <div className="driver-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="header-title">
            <Briefcase size={28} className="text-blue" />
            <div>
              <h2>Create New Trip Order</h2>
              <p>Generate a professional freight order and map financials directly to accounts.</p>
            </div>
          </div>
          <div style={{ textAlign: "right", background: "#f8fafc", padding: "10px 15px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <small style={{ color: "#64748b", fontWeight: "bold", display: "block" }}>BOOKING ID</small>
            <span style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#0f172a", letterSpacing: "2px" }}>
              {form.trackingId}
            </span>
          </div>
        </div>

        <div className="form-grid">
          
          <div className="section-title full-width"><Truck size={18} /> Client, Fleet & Agent</div>

          <div className="input-group">
            <label><FileText size={14} style={{display: 'inline', marginRight: '4px'}}/> Lorry Receipt (LR) No.</label>
            <input name="lrNumber" placeholder="Enter Manual LR No." value={form.lrNumber} onChange={handleChange} style={{ borderColor: "#2563eb", borderWidth: "2px" }} />
          </div>

          <div className="input-group">
            <label>Expected Loading Date</label>
            <input name="loadingDate" type="date" value={form.loadingDate} onChange={handleChange} />
          </div>

          <div className="input-group full-width">
            <label>Customer / Party Name (Billing To) *</label>
            <select name="party" value={form.party} onChange={handleChange}>
              <option value="">-- Select Party --</option>
              {parties.map(p => <option key={p.id} value={p.name}>{p.name} {p.email ? "(Email Setup)" : ""}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label>Assign Vehicle *</label>
            <select name="vehicle" value={form.vehicle} onChange={handleChange}>
              <option value="">-- Select Truck --</option>
              {vehicles.map((v, i) => <option key={i} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label>Assign Primary Driver</label>
            <select name="driver" value={form.driver} onChange={handleChange}>
              <option value="">-- Select Driver --</option>
              {drivers.map((d, i) => <option key={i} value={d}>{d}</option>)}
            </select>
          </div>

          {/* 🔥 NEW: CO-DRIVER OPTION */}
          <div className="input-group">
            <label>Co-Driver / Driver 2 (Optional)</label>
            <select name="driver2" value={form.driver2} onChange={handleChange}>
              <option value="">-- Optional (Only 1 Driver) --</option>
              {drivers.filter(d => d !== form.driver).map((d, i) => <option key={i} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label><Users size={14} style={{display: 'inline', marginRight: '4px'}}/> Broker / Agent (Optional)</label>
            <select name="agent" value={form.agent} onChange={handleAgentChange}>
              <option value="">-- Direct Booking (No Broker) --</option>
              {agents.map(a => <option key={a.id} value={a.name}>{a.name} ({a.rate}% Comm.)</option>)}
            </select>
          </div>

          <div className="input-group">
            <label>Agent No. (Contact)</label>
            <input name="agentNo" value={form.agentNo} onChange={handleChange} placeholder="Fetched from DB" />
          </div>

          <div className="section-title full-width mt-4"><Navigation size={18} /> Route & Distance</div>

          <div className="input-group" style={{ position: "relative" }}>
            <label>From (Loading Point) *</label>
            <input placeholder="Start typing city..." value={form.from} onChange={(e) => handleLocationSearch(e.target.value, "from")} autoComplete="off" />
            {fromOptions.length > 0 && <ul className="autocomplete-list">{fromOptions.map((f, i) => <li key={i} onClick={() => handleSelectLocation(f, "from")}><MapPin size={14}/> {f.properties.formatted}</li>)}</ul>}
          </div>

          <div className="input-group">
            <label>Pickup Party No. (Contact)</label>
            <input name="pickupPartyNo" value={form.pickupPartyNo} onChange={handleChange} placeholder="e.g. 9876543210" />
          </div>

          <div className="input-group" style={{ position: "relative" }}>
            <label>To (Unloading Point) *</label>
            <input placeholder="Start typing city..." value={form.to} onChange={(e) => handleLocationSearch(e.target.value, "to")} autoComplete="off" />
            {toOptions.length > 0 && <ul className="autocomplete-list">{toOptions.map((f, i) => <li key={i} onClick={() => handleSelectLocation(f, "to")}><MapPin size={14}/> {f.properties.formatted}</li>)}</ul>}
          </div>

          <div className="input-group">
            <label>Delivery Party No. (Contact)</label>
            <input name="deliveryPartyNo" value={form.deliveryPartyNo} onChange={handleChange} placeholder="e.g. 9876543210" />
          </div>

          <div className="input-group">
            <label>Actual Billing Distance (KM) *</label>
            <input name="exactDistance" {...decimalInputProps} value={form.exactDistance} onChange={handleDecimalChange} style={{ borderColor: "#3b82f6" }} />
          </div>

          <div className="section-title full-width mt-4"><Box size={18} /> Cargo & Financials</div>

          <div className="input-group">
            <label>Material / Cargo</label>
            <input name="material" value={form.material} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Total Weight (Tons)</label>
            <input name="weight" {...decimalInputProps} value={form.weight} onChange={handleDecimalChange} />
          </div>

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

          <div className="input-group full-width">
            <label>Payment Mode</label>
            <select name="paymentMode" value={form.paymentMode} onChange={handleChange} style={{ background: "#fffbeb", borderColor: "#fde68a" }}>
              <option value="To Pay">To Pay (Receiver pays balance upon delivery)</option>
              <option value="Paid">Paid (Sender pays total / T.B.B)</option>
            </select>
          </div>

          <div className="input-group" style={{ background: "#f0fdf4", padding: "10px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
            <label>Advance Paid by Party (₹)</label>
            <input name="advance" {...decimalInputProps} placeholder="0" value={form.advance} onChange={handleDecimalChange} style={{ marginBottom: "10px" }} />
            
            <label><Landmark size={14}/> Deposited Into (Account)</label>
            <select name="advanceAccount" value={form.advanceAccount} onChange={handleChange} style={{ borderColor: "#10b981", width: "100%", padding: "8px", borderRadius: "6px" }}>
              <option value="">-- Select Bank/Cash --</option>
              {accounts.map(acc => <option key={acc.id} value={acc.accountName}>{acc.accountName}</option>)}
            </select>
          </div>

          <div className="input-group" style={{ background: "#fef2f2", padding: "10px", borderRadius: "8px", border: "1px solid #fecaca" }}>
            <label>Agent Commission (₹)</label>
            <input name="commission" {...decimalInputProps} placeholder="0" value={form.commission} onChange={handleDecimalChange} style={{ marginBottom: "10px" }} />
            
            <label><Landmark size={14}/> Paid From (Account)</label>
            <select name="commissionAccount" value={form.commissionAccount} onChange={handleChange} style={{ borderColor: "#ef4444", width: "100%", padding: "8px", borderRadius: "6px" }}>
              <option value="">-- Select Bank/Cash --</option>
              <option value="To Be Paid Later">To Be Paid Later (Pending Dues)</option>
              {accounts.map(acc => <option key={acc.id} value={acc.accountName}>{acc.accountName}</option>)}
            </select>
          </div>

          <AttachmentUploader
            files={attachmentFiles}
            onFilesChange={setAttachmentFiles}
            label="Booking Documents / Photos"
            hint="Upload LR, loading photo, invoice proof, or any booking document."
          />

          <div className="full-width mt-4">
            <button className="btn-submit" onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? "Generating Order..." : "Confirm & Save Booking"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default NewBooking;
