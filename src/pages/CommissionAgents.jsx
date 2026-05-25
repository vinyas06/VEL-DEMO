import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { Users, Phone, MapPin, FileText, Search } from "lucide-react";
import { buildAgentBalanceMap } from "../utils/finance";
import "./BookingList.css"; 

function CommissionAgents() {
  const [agents, setAgents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        // 🔥 Fetches exclusively from the "agents" collection
        const [agentSnap, bookingSnap, transactionSnap] = await Promise.all([
          getDocs(collection(db, "agents")),
          getDocs(collection(db, "bookings")),
          getDocs(collection(db, "transactions")),
        ]);

        const data = agentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => a.name.localeCompare(b.name));
        setAgents(data);
        setBookings(bookingSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTransactions(transactionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching agents:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.phone.includes(searchTerm)
  );
  const agentBalanceMap = buildAgentBalanceMap(agents, bookings, transactions);
  const getCurrentBalance = (agent) =>
    agentBalanceMap[agent.id]?.currentBalance ?? (Number(agent.balance) || 0);

  return (
    <div className="list-page-bg">
      <Navbar />
      <div className="list-container">
        
        <div className="list-header">
          <div>
            <h2>Commission Agents</h2>
            <p>Directory of transport brokers and their pending payables.</p>
          </div>
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search by name or phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? <div className="loading-state">Loading Agents...</div> : (
          <div className="bookings-grid">
            {filteredAgents.length === 0 ? <div className="empty-state">No agents found.</div> : 
              filteredAgents.map(a => (
                <div className="booking-card" key={a.id}>
                  
                  <div className="card-top">
                    <div className="card-top-left">
                      <span className="tracking-id" style={{fontSize: '1.1rem'}}><Users size={18} style={{marginRight: '5px'}}/> {a.name}</span>
                    </div>
                    <span className="status-badge active">Broker</span>
                  </div>

                  <div className="details-grid" style={{marginBottom: '0'}}>
                    <div className="detail-item">
                      <Phone size={16} />
                      <div>
                        <small>Contact</small>
                        <p>{a.contactPerson || "Owner"} - {a.phone}</p>
                      </div>
                    </div>
                    <div className="detail-item">
                      <FileText size={16} />
                      <div>
                        <small>PAN / Comm %</small>
                        <p>{a.panNumber || "N/A"} ({a.commissionRate ? `${a.commissionRate}%` : 'Standard'})</p>
                      </div>
                    </div>
                  </div>

                  <div className="card-footer" style={{marginTop: '1rem', background: '#fef2f2', padding: '10px', borderRadius: '8px'}}>
                    <div className="financial-summary" style={{color: '#991b1b'}}>
                      <span>Pending Commission:</span>
                      <strong>₹ {getCurrentBalance(a) || 0}</strong>
                    </div>
                  </div>

                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}

export default CommissionAgents;
