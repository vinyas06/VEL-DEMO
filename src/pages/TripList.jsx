import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { Calendar, MapPin, Truck, User } from "lucide-react";
import { getCurrentMonthValue, getRecordDateInput } from "../utils/dateRange";
import "./BookingList.css";

function TripList() {
  const [trips, setTrips] = useState([]);
  const [filterMonth, setFilterMonth] = useState(getCurrentMonthValue());

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDocs(collection(db, "trips"));

      setTrips(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    };

    fetch();
  }, []);

  const filteredTrips = trips.filter((trip) => {
    const dateValue = getRecordDateInput(trip, ["date", "startDate", "createdAt", "updatedAt"]);
    return !filterMonth || dateValue.startsWith(filterMonth);
  });

  return (
    <div className="list-page-bg">
      <Navbar />
      <div className="admin-content">
        <div className="list-container" style={{ maxWidth: "1180px" }}>
          <div className="list-header" style={{ marginBottom: "1rem" }}>
            <div>
              <h2>Trip List</h2>
              <p>Review created trip records. Current month is selected by default.</p>
            </div>
            <div className="search-box" style={{ minWidth: "240px" }}>
              <Calendar size={18} className="search-icon" />
              <input type="month" value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} />
            </div>
          </div>

          <div className="bookings-grid">
            {filteredTrips.length === 0 ? (
              <div className="empty-state">No trips have been recorded yet.</div>
            ) : (
              filteredTrips.map((trip) => (
                <div className="booking-card" key={trip.id}>
                  <div className="card-top">
                    <div className="card-top-left">
                      <span className="tracking-id">#{trip.id.slice(0, 6).toUpperCase()}</span>
                      <span
                        className="status-badge"
                        style={{
                          background: trip.status === "Completed" ? "#dcfce7" : "#dbeafe",
                          color: trip.status === "Completed" ? "#166534" : "#1d4ed8",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "0.8rem",
                          fontWeight: "bold",
                        }}
                      >
                        {trip.status || "Open"}
                      </span>
                    </div>
                  </div>

                  <div className="route-info">
                    <div className="location">
                      <MapPin size={16} className="text-blue" />
                      <span>{trip.from || "Start location not set"}</span>
                    </div>
                    <div className="route-line"></div>
                    <div className="location">
                      <MapPin size={16} className="text-green" />
                      <span>{trip.to || "Destination not set"}</span>
                    </div>
                  </div>

                  <div className="details-grid">
                    <div className="detail-item">
                      <User size={16} />
                      <div>
                        <small>Driver</small>
                        <p>{trip.driverName || "-"}</p>
                      </div>
                    </div>
                    <div className="detail-item">
                      <Truck size={16} />
                      <div>
                        <small>Vehicle</small>
                        <p>{trip.vehicleNumber || trip.vehicle || "-"}</p>
                      </div>
                    </div>
                    <div className="detail-item">
                      <Truck size={16} />
                      <div>
                        <small>Start Odometer</small>
                        <p>{trip.odoStart || "-"}</p>
                      </div>
                    </div>
                    <div className="detail-item">
                      <Truck size={16} />
                      <div>
                        <small>End Odometer</small>
                        <p>{trip.odoEnd || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TripList;
