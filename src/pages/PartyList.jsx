import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Modal from "../components/Modal";
import { db } from "../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { Search, Building2, Phone, User, Edit, Eye, IndianRupee, FileText, Mail } from "lucide-react";
import { buildPartyBalanceMap } from "../utils/finance";
import "./PartyList.css";

function PartyList() {
  const [parties, setParties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchParties = async () => {
      try {
        // 🔥 Pulls exclusively from "parties"
        const [partySnap, bookingSnap, transactionSnap] = await Promise.all([
          getDocs(collection(db, "parties")),
          getDocs(collection(db, "bookings")),
          getDocs(collection(db, "transactions")),
        ]);
        const data = partySnap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setParties(data);
        setBookings(bookingSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTransactions(transactionSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching parties:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchParties();
  }, []);

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      const updatedData = { 
        ...selected, 
        balance: Number(selected.balance) || 0,
        creditLimit: Number(selected.creditLimit) || 0,
        gst: (selected.gst || "").toUpperCase()
      };
      
      await updateDoc(doc(db, "parties", selected.id), updatedData);
      setParties(parties.map(p => p.id === selected.id ? updatedData : p));
      
      alert("Party Updated Successfully! ✅");
      setSelected(null);
    } catch (error) {
      alert("Error updating party.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredParties = parties.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.phone?.includes(searchTerm)
  );

  const partyBalanceMap = buildPartyBalanceMap(parties, bookings, transactions);
  const getCurrentBalance = (party) => {
    const calculatedBalance = partyBalanceMap[party.id]?.currentBalance;
    return calculatedBalance ?? (Number(party.balance) || 0);
  };

  const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

  return (
    <div className="list-page-bg">
      <Navbar />
      
      <div className="list-container">
        <div className="list-header">
          <div>
            <h2>Client Directory</h2>
            <p>Manage your direct clients and vendors.</p>
          </div>
          
          <div className="search-box">
            <Search size={20} className="search-icon" />
            <input type="text" placeholder="Search by Company or Phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="loading-state">Loading Party Data...</div>
        ) : (
          <div className="party-grid">
            {filteredParties.length === 0 ? (
              <div className="empty-state">No parties found.</div>
            ) : (
              filteredParties.map((p) => (
                <div className="party-card" key={p.id}>
                  
                  <div className="party-card-top">
                    <div className="party-icon-wrapper">
                      <Building2 size={24} className="text-blue" />
                    </div>
                    <div className="party-basic-info">
                      <h3>{p.name || "Unknown Company"}</h3>
                      <span className={`status-badge ${p.status === 'blacklisted' ? 'blacklisted' : 'active'}`}>
                        {p.status || "Active"}
                      </span>
                    </div>
                  </div>

                  <div className="party-card-body">
                    <div className="info-row">
                      <User size={16} /> <span>{p.contactPerson || "No Contact Name"}</span>
                    </div>
                    <div className="info-row">
                      <Phone size={16} /> <span>{p.phone || "N/A"}</span>
                    </div>
                    <div className="financial-row">
                      <div className="fin-box">
                        <small>Balance</small>
                        <strong className={getCurrentBalance(p) > 0 ? "text-red" : "text-green"}>
                          {formatCurrency(getCurrentBalance(p))}
                        </strong>
                      </div>
                      <div className="fin-box">
                        <small>Credit Limit</small>
                        <strong>{formatCurrency(p.creditLimit)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="party-card-actions">
                    <button className="btn-view" onClick={() => { setSelected(p); setEdit(false); }}>
                      <Eye size={16} /> Details
                    </button>
                    <button className="btn-edit" onClick={() => { setSelected(p); setEdit(true); }}>
                      <Edit size={16} /> Edit
                    </button>
                  </div>

                </div>
              ))
            )}
          </div>
        )}

        {/* MODAL SECTION */}
        {selected && (
          <Modal onClose={() => setSelected(null)}>
            <div className="pro-modal-content">
              
              <div className="modal-header">
                <h3>{edit ? "Edit Party Profile" : "Company Profile"}</h3>
                <span className={`status-badge ${selected.status === 'blacklisted' ? 'blacklisted' : 'active'}`}>
                  {selected.status || "Active"}
                </span>
              </div>

              {edit ? (
                <div className="modal-form-grid">
                  <div className="input-group">
                    <label>Company / Party Name</label>
                    <input value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Party Type</label>
                    <select value={selected.partyType || "direct"} onChange={(e) => setSelected({ ...selected, partyType: e.target.value })}>
                      <option value="direct">Direct Client</option>
                      <option value="transporter">Other Transporter</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Contact Person</label>
                    <input value={selected.contactPerson || ""} onChange={(e) => setSelected({ ...selected, contactPerson: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Phone Number</label>
                    <input value={selected.phone} onChange={(e) => setSelected({ ...selected, phone: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Email Address</label>
                    <input type="email" value={selected.email || ""} onChange={(e) => setSelected({ ...selected, email: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>GST Number</label>
                    <input style={{textTransform: 'uppercase'}} value={selected.gst || ""} onChange={(e) => setSelected({ ...selected, gst: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Opening Balance (₹)</label>
                    <input type="number" value={selected.balance} onChange={(e) => setSelected({ ...selected, balance: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label>Credit Limit (₹)</label>
                    <input type="number" value={selected.creditLimit || ""} onChange={(e) => setSelected({ ...selected, creditLimit: e.target.value })} />
                  </div>
                  <div className="input-group full-width">
                    <label>Billing Address</label>
                    <input value={selected.address || ""} onChange={(e) => setSelected({ ...selected, address: e.target.value })} />
                  </div>
                  <div className="input-group full-width">
                    <label>Account Status</label>
                    <select value={selected.status || "active"} onChange={(e) => setSelected({ ...selected, status: e.target.value })}>
                      <option value="active">Active</option>
                      <option value="blacklisted">Blacklisted / Hold</option>
                    </select>
                  </div>
                  
                  <div className="modal-actions full-width">
                    <button className="btn-cancel" onClick={() => setSelected(null)}>Cancel</button>
                    <button className="btn-save" onClick={handleUpdate} disabled={isSaving}>
                      {isSaving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="modal-view-wrapper">
                  <div className="modal-view-grid">
                    <DetailBox label="Contact Person" value={selected.contactPerson} icon={<User size={14}/>} />
                    <DetailBox label="Phone Number" value={selected.phone} icon={<Phone size={14}/>} />
                    <DetailBox label="Email" value={selected.email} icon={<Mail size={14}/>} />
                    <DetailBox label="Party Type" value={selected.partyType?.toUpperCase()} />
                    <DetailBox label="GST Number" value={selected.gst} icon={<FileText size={14}/>} highlight={true} />
                    <div className="detail-box full-width">
                      <small>Billing Address</small>
                      <p>{selected.address || "No address provided."}</p>
                    </div>
                  </div>
                  
                  <h4 className="financial-heading"><IndianRupee size={16}/> Financial Standing</h4>
                  <div className="modal-view-grid financial-grid">
                    <div className="detail-box">
                      <small>Current Balance</small>
                      <p className={getCurrentBalance(selected) > 0 ? "text-red" : "text-green"} style={{fontSize: '1.2rem', fontWeight: 'bold'}}>
                        {formatCurrency(getCurrentBalance(selected))}
                      </p>
                    </div>
                    <div className="detail-box">
                      <small>Credit Limit</small>
                      <p style={{fontSize: '1.2rem', fontWeight: 'bold'}}>
                        {formatCurrency(selected.creditLimit)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </Modal>
        )}
      </div>
    </div>
  );
}

function DetailBox({ label, value, icon, highlight }) {
  return (
    <div className={`detail-box ${highlight ? 'box-highlight' : ''}`}>
      <small>{icon} {label}</small>
      <p>{value || "N/A"}</p>
    </div>
  );
}

export default PartyList;
