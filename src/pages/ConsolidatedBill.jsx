import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { FileText, Search, Printer, Building, Calendar as CalendarIcon } from "lucide-react";
import { fetchCompanyProfile, getCompanyAddressLine } from "../utils/companyProfile";
import { getCurrentMonthRange } from "../utils/dateRange";
import "./BookingList.css"; 

function ConsolidatedBill() {
  const currentMonthRange = getCurrentMonthRange();
  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState("");
  const [startDate, setStartDate] = useState(currentMonthRange.fromDate);
  const [endDate, setEndDate] = useState(currentMonthRange.toDate);
  const [bookings, setBookings] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch Parties and Company Settings on load
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const pSnap = await getDocs(collection(db, "parties"));
        setParties(pSnap.docs.map(d => d.data().name));

        setSettings(await fetchCompanyProfile(db));
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    fetchInitialData();
  }, []);

  const handleGenerate = async () => {
    if (!selectedParty || !startDate || !endDate) {
      return alert("Please select a party and date range.");
    }
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "bookings"));
      const allBookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter by Party and Date Range
      const filtered = allBookings.filter(b => 
        b.party === selectedParty &&
        b.loadingDate >= startDate &&
        b.loadingDate <= endDate
      );
      
      // Sort by date
      filtered.sort((a, b) => new Date(a.loadingDate) - new Date(b.loadingDate));
      setBookings(filtered);
    } catch {
      alert("Error generating bill.");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  // Calculations
  const totalFreight = bookings.reduce((sum, b) => sum + (Number(b.freight) || 0), 0);
  const totalAdvance = bookings.reduce((sum, b) => sum + (Number(b.advance) || 0), 0);
  const netBalance = totalFreight - totalAdvance;

  return (
    <div className="page-bg">
      <div className="hide-on-print"><Navbar /></div>
      
      <div className="list-container hide-on-print">
        <div className="list-header" style={{ marginBottom: "1rem" }}>
          <div>
            <h2>Consolidated Billing</h2>
            <p>Generate master invoices. Current month is selected by default.</p>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="filter-bar">
          <div className="filter-group">
            <div className="date-filter">
              <label><Building size={14}/> Select Party:</label>
              <select value={selectedParty} onChange={(e) => setSelectedParty(e.target.value)} style={{ padding: "0.6rem", border: "1px solid #cbd5e1", borderRadius: "8px", width: "200px" }}>
                <option value="">-- Choose Party --</option>
                {parties.map((p, i) => <option key={i} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="date-filter">
              <label><CalendarIcon size={14}/> Start Date:</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="date-filter">
              <label><CalendarIcon size={14}/> End Date:</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <button className="btn-submit" onClick={handleGenerate} disabled={loading} style={{ padding: "0.6rem 1.2rem", background: "#2563eb", marginTop: "22px" }}>
              <Search size={16} style={{ display: "inline", marginRight: "5px" }} />
              {loading ? "Searching..." : "Generate"}
            </button>
          </div>
        </div>

        {bookings.length > 0 && (
          <div style={{ textAlign: "right", marginBottom: "10px" }}>
            <button onClick={handlePrint} style={{ background: "#166534", color: "white", padding: "10px 20px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
              <Printer size={18} /> Print Master Invoice
            </button>
          </div>
        )}
      </div>

      {/* 🔥 THE PRINTABLE MASTER INVOICE */}
      {bookings.length > 0 && (
        <div id="printable-lr" className="lr-paper" style={{ background: "white", padding: "30px", color: "black", fontFamily: "Arial, sans-serif", border: "2px solid #000", maxWidth: "900px", margin: "20px auto" }}>
          
          {/* Header (Pulls from Settings) */}
          <div style={{ textAlign: "center", borderBottom: "3px solid #000", paddingBottom: "15px", marginBottom: "20px" }}>
            <h1 style={{ margin: "0 0 5px 0", fontSize: "28px", textTransform: "uppercase" }}>{settings?.companyName || "Veerashaiva Express Logistics"}</h1>
            <p style={{ margin: "2px 0", fontSize: "14px", fontWeight: "bold" }}>{settings?.tagline || "Enterprise Fleet & Freight Management"}</p>
            <p style={{ margin: "2px 0", fontSize: "12px" }}>{getCompanyAddressLine(settings || undefined)}</p>
            <p style={{ margin: "2px 0", fontSize: "12px", fontWeight: "bold" }}>GSTIN: {settings?.gstNumber || "N/A"} | PAN: {settings?.panNumber || "N/A"}</p>
          </div>

          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h2 style={{ margin: 0, fontSize: "20px", display: "inline-block", border: "2px solid #000", padding: "5px 15px", background: "#f1f5f9" }}>CONSOLIDATED FREIGHT INVOICE</h2>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px", fontSize: "14px" }}>
            <div>
              <p style={{ margin: "5px 0" }}><strong>Billed To:</strong> {selectedParty}</p>
              <p style={{ margin: "5px 0" }}><strong>Billing Period:</strong> {startDate} to {endDate}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "5px 0" }}><strong>Invoice Date:</strong> {new Date().toISOString().split('T')[0]}</p>
              <p style={{ margin: "5px 0" }}><strong>Total Trips:</strong> {bookings.length}</p>
            </div>
          </div>

          {/* Master Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: "20px", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                <th style={{ border: "1px solid #000", padding: "8px" }}>Date</th>
                <th style={{ border: "1px solid #000", padding: "8px" }}>LR No.</th>
                <th style={{ border: "1px solid #000", padding: "8px" }}>Vehicle</th>
                <th style={{ border: "1px solid #000", padding: "8px" }}>Destination</th>
                <th style={{ border: "1px solid #000", padding: "8px", textAlign: "right" }}>Freight (₹)</th>
                <th style={{ border: "1px solid #000", padding: "8px", textAlign: "right" }}>Advance (₹)</th>
                <th style={{ border: "1px solid #000", padding: "8px", textAlign: "right" }}>Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b, index) => (
                <tr key={index}>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>{b.loadingDate}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>{b.lrNumber}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>{b.vehicle}</td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>{b.to}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{b.freight}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right" }}>{b.advance}</td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "right", fontWeight: "bold" }}>{(Number(b.freight) || 0) - (Number(b.advance) || 0)}</td>
                </tr>
              ))}
              {/* Grand Totals */}
              <tr style={{ background: "#f1f5f9", fontWeight: "bold" }}>
                <td colSpan="4" style={{ border: "1px solid #000", padding: "8px", textAlign: "right" }}>GRAND TOTAL:</td>
                <td style={{ border: "1px solid #000", padding: "8px", textAlign: "right" }}>₹{totalFreight}</td>
                <td style={{ border: "1px solid #000", padding: "8px", textAlign: "right" }}>₹{totalAdvance}</td>
                <td style={{ border: "1px solid #000", padding: "8px", textAlign: "right", fontSize: "14px" }}>₹{netBalance}</td>
              </tr>
            </tbody>
          </table>

          {/* Bank Details & Signature Row */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "30px", fontSize: "12px" }}>
            <div style={{ border: "1px solid #000", padding: "10px", width: "45%", background: "#fafafa" }}>
              <p style={{ margin: "0 0 5px 0", fontWeight: "bold" }}>Bank Details for Payment:</p>
              <p style={{ margin: "2px 0" }}>Bank: <strong>{settings?.bankName || "Not Set"}</strong></p>
              <p style={{ margin: "2px 0" }}>Account Name: <strong>{settings?.accountName || "Not Set"}</strong></p>
              <p style={{ margin: "2px 0" }}>Account No: <strong>{settings?.accountNumber || "Not Set"}</strong></p>
              <p style={{ margin: "2px 0" }}>IFSC Code: <strong>{settings?.ifscCode || "Not Set"}</strong></p>
            </div>
            
            <div style={{ width: "30%", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ borderTop: "1px solid #000", paddingTop: "5px", fontWeight: "bold" }}>
                Authorised Signatory
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default ConsolidatedBill;
