import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { Send, ClipboardList, Link2, Truck } from "lucide-react";
import "./AddDriver.css";

function DriverExpense() {
  const user = JSON.parse(localStorage.getItem("user"));
  const [trips, setTrips] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "Fuel",
    bookingId: "",
    trackingId: "",
    vehicleNumber: "",
    amount: "",
    notes: "",
  });

  useEffect(() => {
    const fetchTrips = async () => {
      if (!user?.name) {
        return;
      }

      try {
        const tripQuery = query(collection(db, "bookings"), where("driver", "==", user.name));
        const tripSnap = await getDocs(tripQuery);
        const tripData = tripSnap.docs
          .map((docItem) => ({ id: docItem.id, ...docItem.data() }))
          .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        setTrips(tripData);
      } catch (error) {
        console.error("Error fetching driver trips:", error);
      }
    };

    fetchTrips();
  }, [user?.name]);

  const handleTripChange = (event) => {
    const bookingId = event.target.value;
    const selectedTrip = trips.find((trip) => trip.id === bookingId);

    setForm((prev) => ({
      ...prev,
      bookingId,
      trackingId: selectedTrip?.trackingId || "",
      vehicleNumber: selectedTrip?.vehicle || prev.vehicleNumber,
    }));
  };

  const handleSend = async () => {
    if (!form.amount || !form.vehicleNumber) {
      return alert("Please enter Amount and Vehicle Number");
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "driver_submissions"), {
        ...form,
        driverName: user?.name || "Unknown Driver",
        amount: Number(form.amount),
        status: "Pending Approval",
        createdAt: new Date().toISOString(),
      });

      alert("Expense sent for Admin Approval!");
      setForm({
        date: new Date().toISOString().split("T")[0],
        category: "Fuel",
        bookingId: "",
        trackingId: "",
        vehicleNumber: "",
        amount: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error submitting driver expense:", error);
      alert("Error submitting expense.");
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
            <ClipboardList size={28} className="text-blue" />
            <div>
              <h2>Submit Trip Expense</h2>
              <p>Send Fuel, Toll, or Batta bills to Admin for approval.</p>
            </div>
          </div>
        </div>

        <div className="form-grid">
          <div className="input-group">
            <label>Expense Type</label>
            <select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              <option value="Fuel">Fuel / Diesel</option>
              <option value="Toll">Toll / Fastag</option>
              <option value="Driver Batta">Driver Batta</option>
              <option value="Repair">Emergency Repair</option>
            </select>
          </div>

          <div className="input-group">
            <label>
              <Link2 size={14} style={{ display: "inline", marginRight: "5px" }} />
              Linked Trip (Optional)
            </label>
            <select value={form.bookingId} onChange={handleTripChange}>
              <option value="">-- Select Trip --</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  #{trip.trackingId || trip.id} | {trip.from || "-"} to {trip.to || "-"}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Vehicle Number</label>
            <input
              placeholder="e.g. KA19 AB 1234"
              value={form.vehicleNumber}
              onChange={(event) => setForm({ ...form, vehicleNumber: event.target.value })}
            />
          </div>

          <div className="input-group">
            <label>Amount (Rs)</label>
            <input
              type="number"
              placeholder="0.00"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </div>

          {form.trackingId && (
            <div
              className="input-group full-width"
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "12px 14px",
              }}
            >
              <label style={{ marginBottom: "6px" }}>
                <Truck size={14} style={{ display: "inline", marginRight: "5px" }} />
                Linked Tracking ID
              </label>
              <div style={{ fontWeight: "bold", color: "#1d4ed8" }}>#{form.trackingId}</div>
            </div>
          )}

          <div className="input-group full-width">
            <label>Notes / Details</label>
            <input
              placeholder="e.g. 50 Liters Diesel at HP Pump"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>

          <button className="btn-submit full-width" onClick={handleSend} disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Submit to Admin"}{" "}
            <Send size={18} style={{ marginLeft: "10px" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default DriverExpense;
