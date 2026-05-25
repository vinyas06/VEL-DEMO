import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { UserCheck, UserX, ShieldAlert, CheckCircle, Edit, Save, X, Key, Mail, ShieldCheck, User } from "lucide-react";
import { PORTAL_USERS_COLLECTION, hashValue } from "../utils/portalAuth";
import { logActivity } from "../utils/activityLog";

function PendingApprovals() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Edit State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "", username: "", email: "", role: "", newPassword: ""
  });

  const fetchUsers = async () => {
    try {
      const snapshot = await getDocs(collection(db, PORTAL_USERS_COLLECTION));
      const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const pendingUsers = users.filter(u => u.status === "pending");
  const approvedUsers = users.filter(u => u.status === "approved");

  const handleApprove = async (userId, userName) => {
    if (!window.confirm(`APPROVE ${userName}? They will get full secondary access.`)) return;
    try {
      await updateDoc(doc(db, PORTAL_USERS_COLLECTION, userId), {
        status: "approved",
        updatedAt: new Date().toISOString()
      });
      await logActivity(db, { action: "user_approved", module: "auth", summary: `Approved access for ${userName}`, targetId: userId });
      alert(`${userName} has been approved! ✅`);
      fetchUsers();
    } catch (error) {
      alert("Error approving user.");
    }
  };

  const handleDelete = async (userId, userName, status) => {
    if (!window.confirm(`Are you sure you want to DELETE ${userName}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, PORTAL_USERS_COLLECTION, userId));
      await logActivity(db, { action: "user_deleted", module: "auth", summary: `Deleted ${status} user ${userName}`, targetId: userId });
      alert(`${userName} has been removed. ❌`);
      fetchUsers();
    } catch (error) {
      alert("Error deleting user.");
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role || user.requestedRole,
      newPassword: "" // Intentionally blank. Only fill if changing.
    });
  };

  const handleSaveEdit = async () => {
    try {
      const updateData = {
        name: editForm.name,
        username: editForm.username.toLowerCase(),
        email: editForm.email.toLowerCase(),
        role: editForm.role,
        updatedAt: new Date().toISOString()
      };

      // If they typed a new password, hash it and update it!
      if (editForm.newPassword.trim()) {
        updateData.passwordHash = await hashValue(editForm.newPassword);
      }

      await updateDoc(doc(db, PORTAL_USERS_COLLECTION, editingUser.id), updateData);
      
      await logActivity(db, { 
        action: "user_edited", 
        module: "auth", 
        summary: `Edited details/credentials for ${editForm.name}`, 
        targetId: editingUser.id 
      });

      alert("User details updated successfully! ✅");
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      alert("Failed to update user.");
      console.error(error);
    }
  };

  return (
    <div className="dashboard-page">
      <Navbar />
      <div className="dashboard-container">
        
        {/* PAGE HEADER */}
        <div style={{ marginBottom: "25px" }}>
          <h1 style={{ margin: "0 0 5px 0", color: "#0f172a", fontSize: "2rem" }}>User Management</h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: "1.1rem" }}>
            Approve new registrations and manage active secondary admins.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>Loading system users...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>

            {/* PENDING APPROVALS SECTION */}
            <div style={{ background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
              <h2 style={{ margin: "0 0 20px 0", color: "#d97706", display: "flex", alignItems: "center", gap: "8px", fontSize: "1.2rem" }}>
                <ShieldAlert size={20}/> Action Required: Pending Requests ({pendingUsers.length})
              </h2>
              
              {pendingUsers.length === 0 ? (
                <div style={{ padding: "30px", background: "#f8fafc", borderRadius: "8px", textAlign: "center", color: "#64748b" }}>
                  <CheckCircle size={32} color="#10b981" style={{ margin: "0 auto 10px auto" }} />
                  <p style={{ margin: 0 }}>No pending user registrations.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {pendingUsers.map(user => (
                    <div key={user.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef3c7", padding: "15px", borderRadius: "8px" }}>
                      <div>
                        <h3 style={{ margin: "0 0 4px 0", color: "#0f172a" }}>{user.name}</h3>
                        <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
                          ID: {user.username} | Email: {user.email} | Requested Role: {user.requestedRole}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button onClick={() => handleDelete(user.id, user.name, "pending")} style={{ background: "white", color: "#991b1b", border: "1px solid #fca5a5", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Reject</button>
                        <button onClick={() => handleApprove(user.id, user.name)} style={{ background: "#10b981", color: "white", border: "none", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Approve Access</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ACTIVE USERS SECTION */}
            <div style={{ background: "white", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)" }}>
              <h2 style={{ margin: "0 0 20px 0", color: "#2563eb", display: "flex", alignItems: "center", gap: "8px", fontSize: "1.2rem" }}>
                <UserCheck size={20}/> Active Secondary Admins ({approvedUsers.length})
              </h2>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "15px" }}>
                {approvedUsers.map(user => (
                  <div key={user.id} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "15px", background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                      <div>
                        <h3 style={{ margin: "0 0 2px 0", color: "#0f172a" }}>{user.name}</h3>
                        <span style={{ fontSize: "0.8rem", background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold", textTransform: "uppercase" }}>{user.role}</span>
                      </div>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button onClick={() => openEditModal(user)} style={{ background: "#e0e7ff", border: "none", padding: "6px", borderRadius: "4px", color: "#4338ca", cursor: "pointer" }} title="Edit User">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(user.id, user.name, "active")} style={{ background: "#fee2e2", border: "none", padding: "6px", borderRadius: "4px", color: "#b91c1c", cursor: "pointer" }} title="Delete User">
                          <UserX size={16} />
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#475569" }}>
                      <p style={{ margin: "4px 0" }}><strong>ID:</strong> {user.username}</p>
                      <p style={{ margin: "4px 0" }}><strong>Email:</strong> {user.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* EDIT USER MODAL */}
        {editingUser && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "white", padding: "30px", borderRadius: "12px", width: "100%", maxWidth: "500px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h2 style={{ margin: 0, fontSize: "1.5rem" }}>Edit User Details</h2>
                <button onClick={() => setEditingUser(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={24} color="#64748b" /></button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", color: "#475569", marginBottom: "5px", fontWeight: "bold" }}><User size={14}/> Full Name</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }} />
                </div>
                
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", color: "#475569", marginBottom: "5px", fontWeight: "bold" }}><ShieldCheck size={14}/> Login ID</label>
                  <input type="text" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }} />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", color: "#475569", marginBottom: "5px", fontWeight: "bold" }}><Mail size={14}/> Email Address</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }} />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", color: "#475569", marginBottom: "5px", fontWeight: "bold" }}><ShieldCheck size={14}/> Access Role</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} style={{ width: "100%", padding: "10px", border: "1px solid #cbd5e1", borderRadius: "6px", boxSizing: "border-box" }}>
                    <option value="admin">Secondary Admin</option>
                    <option value="staff">Office Staff</option>
                    <option value="operations">Operations Team</option>
                  </select>
                </div>

                <div style={{ background: "#fff1f2", padding: "15px", borderRadius: "8px", border: "1px solid #fecdd3", marginTop: "10px" }}>
                  <label style={{ display: "block", fontSize: "0.9rem", color: "#be123c", marginBottom: "5px", fontWeight: "bold" }}><Key size={14}/> Change Password (Optional)</label>
                  <input type="text" placeholder="Leave blank to keep current password" value={editForm.newPassword} onChange={e => setEditForm({...editForm, newPassword: e.target.value})} style={{ width: "100%", padding: "10px", border: "1px solid #fda4af", borderRadius: "6px", boxSizing: "border-box" }} />
                  <small style={{ color: "#e11d48", display: "block", marginTop: "5px" }}>Entering text here will permanently overwrite their existing password.</small>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
                <button onClick={() => setEditingUser(null)} style={{ flex: 1, padding: "12px", background: "white", border: "1px solid #cbd5e1", borderRadius: "6px", fontWeight: "bold", color: "#475569", cursor: "pointer" }}>Cancel</button>
                <button onClick={handleSaveEdit} style={{ flex: 1, padding: "12px", background: "#2563eb", border: "none", borderRadius: "6px", fontWeight: "bold", color: "white", cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}><Save size={18}/> Save Changes</button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default PendingApprovals;