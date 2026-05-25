import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FileText, Download, Building2, Phone, Calendar } from "lucide-react";
import { getCurrentMonthValue } from "../utils/dateRange";
import "./Finance.css"; // Ensure you have this file for styling

function PartyLedger() {
  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [ledgerData, setLedgerData] = useState([]);
  const [summary, setSummary] = useState({ totalDebit: 0, totalCredit: 0, netBalance: 0, balType: "" });
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(getCurrentMonthValue());

  useEffect(() => {
    const fetchParties = async () => {
      const snap = await getDocs(collection(db, "parties"));
      // Sort alphabetically for easier selection
      const partyList = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name));
      setParties(partyList);
    };
    fetchParties();
  }, []);

  const handleFetchLedger = async (partyId) => {
    if (!partyId) {
      setSelectedParty(null);
      setLedgerData([]);
      return;
    }
    
    setLoading(true);
    const party = parties.find(p => p.id === partyId);
    setSelectedParty(party);

    try {
      const entries = [];

      // 1. ADD OPENING BALANCE
      const openingBal = Number(party.balance) || 0;
      entries.push({
        id: "opening_bal",
        date: "Opening",
        timestamp: 0, // Forces it to the top
        description: "Opening Balance",
        debit: openingBal > 0 ? openingBal : 0, // Positive balance means they owe us (Dr)
        credit: openingBal < 0 ? Math.abs(openingBal) : 0, // Negative means we owe them (Cr)
      });

      // 2. FETCH TRANSACTIONS (Money IN and OUT)
      // Payments received from this party
      const qIn = query(collection(db, "transactions"), where("party", "==", party.name));
      const snapIn = await getDocs(qIn);
      snapIn.docs.forEach(d => {
        const t = d.data();
        entries.push({
          id: d.id,
          date: t.date,
          timestamp: new Date(t.createdAt).getTime(),
          description: `Payment Received (${t.paymentMode}) - Ref: ${t.referenceNo || 'N/A'}`,
          debit: 0,
          credit: Number(t.amount) || 0 // Money in reduces their debt
        });
      });

      // Payments made to this party (e.g., broker payout)
      const qOut = query(collection(db, "transactions"), where("payee", "==", party.name));
      const snapOut = await getDocs(qOut);
      snapOut.docs.forEach(d => {
        const t = d.data();
        entries.push({
          id: d.id,
          date: t.date,
          timestamp: new Date(t.createdAt).getTime(),
          description: `Payment Paid (${t.paymentMode}) - Ref: ${t.referenceNo || 'N/A'}`,
          debit: Number(t.amount) || 0, // Money out increases what they owe us (or decreases what we owe them)
          credit: 0
        });
      });

      // 3. FETCH BOOKINGS (Freight & Commissions)
      // Trips billed to this party
      const qBookParty = query(collection(db, "bookings"), where("party", "==", party.name));
      const snapBookParty = await getDocs(qBookParty);
      snapBookParty.docs.forEach(d => {
        const b = d.data();
        const ts = new Date(b.createdAt).getTime();
        
        // Add Freight Charge
        if (Number(b.freight) > 0) {
          entries.push({
            id: d.id + "_freight",
            date: b.loadingDate,
            timestamp: ts,
            description: `Freight Bill: ${b.from} to ${b.to} (LR: ${b.lrNumber})`,
            debit: Number(b.freight), // Freight increases their debt to us
            credit: 0
          });
        }
        
        // Add Advance Paid by them
        if (Number(b.advance) > 0) {
          entries.push({
            id: d.id + "_adv",
            date: b.loadingDate,
            timestamp: ts + 1, // Order slightly after freight
            description: `Advance Received (LR: ${b.lrNumber})`,
            debit: 0,
            credit: Number(b.advance) // Advance reduces their debt
          });
        }
      });

      // Trips where they acted as the Agent/Broker
      const qBookAgent = query(collection(db, "bookings"), where("agent", "==", party.name));
      const snapBookAgent = await getDocs(qBookAgent);
      snapBookAgent.docs.forEach(d => {
        const b = d.data();
        if (Number(b.commission) > 0) {
          entries.push({
            id: d.id + "_comm",
            date: b.loadingDate,
            timestamp: new Date(b.createdAt).getTime(),
            description: `Commission Earned (LR: ${b.lrNumber})`,
            debit: 0,
            credit: Number(b.commission) // Commission increases what WE owe THEM
          });
        }
      });

      const visibleEntries = entries.filter((entry) => {
        if (entry.id === "opening_bal") return true;
        return !filterMonth || String(entry.date || "").startsWith(filterMonth);
      });

      // 4. SORT AND CALCULATE RUNNING BALANCE
      visibleEntries.sort((a, b) => a.timestamp - b.timestamp);

      let runningBalance = 0;
      let totDr = 0;
      let totCr = 0;

      const finalizedLedger = visibleEntries.map(e => {
        totDr += e.debit;
        totCr += e.credit;
        runningBalance = runningBalance + e.debit - e.credit;
        
        return {
          ...e,
          balanceAmount: Math.abs(runningBalance),
          balanceType: runningBalance >= 0 ? "Dr" : "Cr" // Dr = They owe you | Cr = You owe them
        };
      });

      setLedgerData(finalizedLedger);
      setSummary({
        totalDebit: totDr,
        totalCredit: totCr,
        netBalance: Math.abs(runningBalance),
        balType: runningBalance >= 0 ? "Dr" : "Cr"
      });

    } catch (err) {
      console.error(err);
      alert("Error generating ledger statement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedParty?.id) {
      handleFetchLedger(selectedParty.id);
    }
  }, [filterMonth]);

  return (
    <div className="finance-bg" style={{ backgroundColor: "#f8fafc", minHeight: "100vh", paddingBottom: "3rem" }}>
      <Navbar />
      <div className="ledger-container" style={{ maxWidth: "1100px", margin: "2rem auto", padding: "0 1.5rem" }}>
        
        <div className="ledger-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <FileText size={32} color="#2563eb" />
            <div>
              <h2 style={{ margin: 0, color: "#1e293b" }}>Account Statement (Ledger)</h2>
              <p style={{ margin: "5px 0 0 0", color: "#64748b" }}>Live Dr/Cr statement for Parties and Agents.</p>
            </div>
          </div>
          <select 
            onChange={(e) => handleFetchLedger(e.target.value)}
            style={{ padding: "0.8rem", borderRadius: "8px", border: "1px solid #cbd5e1", minWidth: "250px", fontSize: "1rem" }}
          >
            <option value="">-- Select a Party / Agent --</option>
            {parties.map(p => <option key={p.id} value={p.id}>{p.name} ({p.partyType === "broker" ? "Agent" : "Party"})</option>)}
          </select>
          <div className="search-box" style={{ minWidth: "240px", background: "white" }}>
            <Calendar size={18} className="search-icon" />
            <input type="month" value={filterMonth} onChange={(event) => setFilterMonth(event.target.value)} />
          </div>
        </div>

        {loading ? <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>Generating Professional Ledger...</div> : 
          selectedParty && (
            <div className="ledger-card" style={{ background: "white", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
              
              {/* LEDGER SUMMARY HEADER */}
              <div style={{ padding: "1.5rem", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h3 style={{ margin: "0 0 10px 0", fontSize: "1.5rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <Building2 size={20} color="#3b82f6"/> {selectedParty.name}
                  </h3>
                  <div style={{ color: "#475569", fontSize: "0.9rem", display: "flex", gap: "15px" }}>
                    <span><strong>GST:</strong> {selectedParty.gst || "Unregistered"}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Phone size={14}/> {selectedParty.phone}</span>
                  </div>
                </div>

                <div style={{ textAlign: "right", background: summary.balType === "Dr" ? "#eff6ff" : "#fef2f2", padding: "15px 20px", borderRadius: "8px", border: `1px solid ${summary.balType === "Dr" ? "#bfdbfe" : "#fecaca"}` }}>
                  <small style={{ color: summary.balType === "Dr" ? "#1e40af" : "#991b1b", fontWeight: "bold" }}>
                    CLOSING NET BALANCE
                  </small>
                  <div style={{ fontSize: "1.8rem", fontWeight: "bold", color: summary.balType === "Dr" ? "#2563eb" : "#ef4444" }}>
                    ₹ {summary.netBalance.toLocaleString('en-IN')} <span style={{ fontSize: "1rem" }}>{summary.balType}</span>
                  </div>
                  <small style={{ color: "#64748b" }}>
                    {summary.balType === "Dr" ? "(They owe you money)" : "(You owe them money)"}
                  </small>
                </div>
              </div>

              {/* LEDGER TABLE */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#475569", fontSize: "0.85rem", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ padding: "1rem" }}>Date</th>
                      <th style={{ padding: "1rem" }}>Particulars / Description</th>
                      <th style={{ padding: "1rem", textAlign: "right", color: "#166534" }}>Debit (Dr)</th>
                      <th style={{ padding: "1rem", textAlign: "right", color: "#991b1b" }}>Credit (Cr)</th>
                      <th style={{ padding: "1rem", textAlign: "right", background: "#f1f5f9" }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.map((item, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", fontSize: "0.95rem" }}>
                        <td style={{ padding: "1rem", color: "#64748b", whiteSpace: "nowrap" }}>{item.date}</td>
                        <td style={{ padding: "1rem", color: "#1e293b", fontWeight: "500" }}>{item.description}</td>
                        
                        <td style={{ padding: "1rem", textAlign: "right", color: item.debit > 0 ? "#166534" : "#cbd5e1" }}>
                          {item.debit > 0 ? `₹${item.debit.toLocaleString('en-IN')}` : "-"}
                        </td>
                        
                        <td style={{ padding: "1rem", textAlign: "right", color: item.credit > 0 ? "#991b1b" : "#cbd5e1" }}>
                          {item.credit > 0 ? `₹${item.credit.toLocaleString('en-IN')}` : "-"}
                        </td>
                        
                        <td style={{ padding: "1rem", textAlign: "right", fontWeight: "bold", background: "#f8fafc", color: "#0f172a" }}>
                          ₹{item.balanceAmount.toLocaleString('en-IN')} <span style={{ fontSize: "0.8rem", color: item.balanceType === "Dr" ? "#2563eb" : "#ef4444" }}>{item.balanceType}</span>
                        </td>
                      </tr>
                    ))}
                    {ledgerData.length === 0 && <tr><td colSpan="5" style={{textAlign:"center", padding:"3rem", color:"#94a3b8"}}>No ledger entries found for this party.</td></tr>}
                  </tbody>
                  {/* TOTALS FOOTER */}
                  {ledgerData.length > 0 && (
                    <tfoot>
                      <tr style={{ background: "#f1f5f9", fontWeight: "bold", borderTop: "2px solid #cbd5e1" }}>
                        <td colSpan="2" style={{ padding: "1rem", textAlign: "right", color: "#475569" }}>TOTALS:</td>
                        <td style={{ padding: "1rem", textAlign: "right", color: "#166534" }}>₹{summary.totalDebit.toLocaleString('en-IN')}</td>
                        <td style={{ padding: "1rem", textAlign: "right", color: "#991b1b" }}>₹{summary.totalCredit.toLocaleString('en-IN')}</td>
                        <td style={{ padding: "1rem", background: "#e2e8f0" }}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )
        }
      </div>
    </div>
  );
}

export default PartyLedger;
