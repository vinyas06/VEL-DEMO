import { useEffect, useState } from "react";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { PORTAL_USERS_COLLECTION } from "../utils/portalAuth";
import { ACTIVITY_LOGS_COLLECTION, logActivity } from "../utils/activityLog";
import "./BookingList.css";

function UserApprovals() {
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const currentUser = JSON.parse(localStorage.getItem("user")) || {};

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const userSnapshot = await getDocs(collection(db, PORTAL_USERS_COLLECTION));

      const data = userSnapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

      setUsers(data);
    } catch (error) {
      console.error("Error fetching portal users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const activityQuery = query(
      collection(db, ACTIVITY_LOGS_COLLECTION),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    return onSnapshot(activityQuery, (snapshot) => {
      setActivities(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });
  }, []);

  const handleStatusChange = async (user, status) => {
    setSavingId(user.id);
    try {
      await updateDoc(doc(db, PORTAL_USERS_COLLECTION, user.id), {
        status,
        role: user.role || user.requestedRole || "staff",
        updatedAt: new Date().toISOString(),
        reviewedAt: new Date().toISOString(),
        reviewedBy: currentUser.email || "main-admin",
      });
      await logActivity(db, {
        action: status === "approved" ? "user_approved" : "user_rejected",
        module: "user_approvals",
        summary: `${status} user ${user.username || user.email}`,
        targetId: user.id,
        targetType: "portal_user",
      });
      await fetchUsers();
    } catch (error) {
      console.error("Error updating user approval:", error);
      alert("Unable to update approval status.");
    } finally {
      setSavingId("");
    }
  };

  const handleRoleChange = async (user, role) => {
    setSavingId(user.id);
    try {
      await updateDoc(doc(db, PORTAL_USERS_COLLECTION, user.id), {
        role,
        updatedAt: new Date().toISOString(),
      });
      await logActivity(db, {
        action: "user_role_changed",
        module: "user_approvals",
        summary: `role changed for ${user.username || user.email} to ${role}`,
        targetId: user.id,
        targetType: "portal_user",
      });
      setUsers((previous) =>
        previous.map((item) => (item.id === user.id ? { ...item, role } : item))
      );
    } catch (error) {
      console.error("Error updating user role:", error);
      alert("Unable to update role.");
    } finally {
      setSavingId("");
    }
  };

  const pendingUsers = users.filter((user) => user.status === "pending");
  const activeUsers = users.filter((user) => user.status !== "pending");

  return (
    <div className="list-page-bg">
      <Navbar />
      <div className="admin-content">
        <div className="list-container" style={{ maxWidth: "1280px" }}>
          <div className="list-header" style={{ marginBottom: "1rem" }}>
            <div>
              <h2>User Approvals</h2>
              <p>Approve or reject secondary admin and team access requests.</p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <SummaryCard title="Pending" value={pendingUsers.length} icon={<Clock3 size={18} color="#b45309" />} note="Waiting for main admin review" />
            <SummaryCard title="Approved" value={users.filter((user) => user.status === "approved").length} icon={<CheckCircle2 size={18} color="#166534" />} note="Can login with user ID and password" />
            <SummaryCard title="Rejected" value={users.filter((user) => user.status === "rejected").length} icon={<XCircle size={18} color="#991b1b" />} note="Blocked until reviewed again" />
          </div>

          <SectionCard title="Pending Requests">
            {loading ? (
              <div className="loading-state">Loading requests...</div>
            ) : pendingUsers.length === 0 ? (
              <div className="empty-state">No pending user approval requests.</div>
            ) : (
              <ApprovalTable users={pendingUsers} savingId={savingId} onApprove={(user) => handleStatusChange(user, "approved")} onReject={(user) => handleStatusChange(user, "rejected")} onRoleChange={handleRoleChange} />
            )}
          </SectionCard>

          <SectionCard title="Reviewed Users">
            {loading ? (
              <div className="loading-state">Loading users...</div>
            ) : activeUsers.length === 0 ? (
              <div className="empty-state">No reviewed users yet.</div>
            ) : (
              <ApprovalTable users={activeUsers} savingId={savingId} onApprove={(user) => handleStatusChange(user, "approved")} onReject={(user) => handleStatusChange(user, "rejected")} onRoleChange={handleRoleChange} />
            )}
          </SectionCard>

          <SectionCard title="Approved User Activity">
            {loading ? (
              <div className="loading-state">Loading activity...</div>
            ) : activities.length === 0 ? (
              <div className="empty-state">No activity logs yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "980px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
                      <th style={{ padding: "0.85rem" }}>Time</th>
                      <th style={{ padding: "0.85rem" }}>User</th>
                      <th style={{ padding: "0.85rem" }}>Role</th>
                      <th style={{ padding: "0.85rem" }}>Module</th>
                      <th style={{ padding: "0.85rem" }}>Action</th>
                      <th style={{ padding: "0.85rem" }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((activity) => (
                      <tr key={activity.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "0.85rem" }}>{activity.createdAt ? new Date(activity.createdAt).toLocaleString("en-IN") : "-"}</td>
                        <td style={{ padding: "0.85rem" }}>
                          <div style={{ fontWeight: "700", color: "#0f172a" }}>{activity.actorName || "-"}</div>
                          <div style={{ color: "#64748b", fontSize: "0.9rem" }}>{activity.actorEmail || "-"}</div>
                        </td>
                        <td style={{ padding: "0.85rem" }}>{activity.actorRole || "-"}</td>
                        <td style={{ padding: "0.85rem" }}>{activity.module || "-"}</td>
                        <td style={{ padding: "0.85rem" }}>{activity.action || "-"}</td>
                        <td style={{ padding: "0.85rem" }}>{activity.summary || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon, note }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "1rem 1.15rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#475569", fontWeight: "700", textTransform: "uppercase", fontSize: "0.8rem" }}>{title}</span>
        {icon}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: "800", color: "#0f172a", marginTop: "0.6rem" }}>{value}</div>
      <div style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "0.35rem" }}>{note}</div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "18px", padding: "1rem", marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
        <ShieldCheck size={18} color="#2563eb" />
        <h3 style={{ margin: 0, color: "#0f172a" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ApprovalTable({ users, savingId, onApprove, onReject, onRoleChange }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "900px" }}>
        <thead>
          <tr style={{ background: "#f8fafc", color: "#475569", textAlign: "left" }}>
            <th style={{ padding: "0.85rem" }}>User</th>
            <th style={{ padding: "0.85rem" }}>Company</th>
            <th style={{ padding: "0.85rem" }}>Requested Role</th>
            <th style={{ padding: "0.85rem" }}>Status</th>
            <th style={{ padding: "0.85rem" }}>Requested On</th>
            <th style={{ padding: "0.85rem" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} style={{ borderTop: "1px solid #e2e8f0" }}>
              <td style={{ padding: "0.85rem" }}>
                <div style={{ fontWeight: "700", color: "#0f172a" }}>{user.name || "Unnamed"}</div>
                <div style={{ color: "#64748b", fontSize: "0.9rem" }}>{user.email}</div>
                <div style={{ color: "#1d4ed8", fontSize: "0.85rem", marginTop: "0.2rem" }}>ID: {user.username || "-"}</div>
              </td>
              <td style={{ padding: "0.85rem", color: "#334155" }}>{user.companyName || "-"}</td>
              <td style={{ padding: "0.85rem" }}>
                <select value={user.role || user.requestedRole || "staff"} onChange={(event) => onRoleChange(user, event.target.value)} disabled={savingId === user.id} style={{ padding: "0.55rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="operations">Operations</option>
                </select>
              </td>
              <td style={{ padding: "0.85rem" }}>
                <span
                  style={{
                    display: "inline-flex",
                    padding: "0.25rem 0.6rem",
                    borderRadius: "999px",
                    background: user.status === "approved" ? "#dcfce7" : user.status === "rejected" ? "#fee2e2" : "#fef3c7",
                    color: user.status === "approved" ? "#166534" : user.status === "rejected" ? "#991b1b" : "#92400e",
                    fontWeight: "700",
                    fontSize: "0.8rem",
                  }}
                >
                  {user.status || "pending"}
                </span>
              </td>
              <td style={{ padding: "0.85rem", color: "#475569" }}>{user.createdAt ? new Date(user.createdAt).toLocaleString("en-IN") : "-"}</td>
              <td style={{ padding: "0.85rem" }}>
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                  <button onClick={() => onApprove(user)} disabled={savingId === user.id} style={{ padding: "0.55rem 0.85rem", borderRadius: "8px", border: "none", background: "#16a34a", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}>
                    Approve
                  </button>
                  <button onClick={() => onReject(user)} disabled={savingId === user.id} style={{ padding: "0.55rem 0.85rem", borderRadius: "8px", border: "none", background: "#dc2626", color: "#ffffff", fontWeight: "700", cursor: "pointer" }}>
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UserApprovals;
