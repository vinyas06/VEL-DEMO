import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

// --- Auth ---
import Login from "./pages/Login";

// --- Dashboards & Settings ---
import Dashboard from "./pages/Dashboard";
import DriverDashboard from "./pages/DriverDashboard";
import Settings from "./pages/Settings";
import UserApprovals from "./pages/UserApprovals";
import DataTools from "./pages/DataTools";

// --- Fleet Management ---
import AddVehicle from "./pages/AddVehicle";
import VehicleList from "./pages/VehicleList";
import AddDriver from "./pages/AddDriver";
import DriverList from "./pages/DriverList";
import DocumentAlerts from "./pages/DocumentAlerts";
import PendingApprovals from "./pages/PendingApprovals";
import ActivityTracker from "./pages/ActivityTracker"; 

// --- Network (Parties & Agents) ---
import AddParty from "./pages/AddParty";
import PartyList from "./pages/PartyList";
import PartyLedger from "./pages/PartyLedger";
import AddCommissionAgent from "./pages/AddCommissionAgent";
import CommissionAgents from "./pages/CommissionAgents";

// --- Bookings & Trips ---
import NewEstimate from "./pages/NewEstimate";
import EstimateList from "./pages/EstimateList";
import NewBooking from "./pages/NewBooking";
import BookingList from "./pages/BookingList";
import Trips from "./pages/Trips";
import TrackBooking from "./pages/TrackBooking"; 
import OdometerLogs from "./pages/OdometerLogs";

// --- Financials & Accounting ---
import Accounts from "./pages/Accounts";
import AddAccount from "./pages/AddAccount";
import Transactions from "./pages/Transactions";
import TripwisePayments from "./pages/TripwisePayments";
import PaymentIn from "./pages/PaymentIn";
import PaymentOut from "./pages/PaymentOut";
import AddExpense from "./pages/AddExpense";
import Loans from "./pages/Loans";
import DriverSalaryLedger from "./pages/DriverSalaryLedger";
import DriverAdvances from "./pages/DriverAdvances";
import SelfTransfer from "./pages/SelfTransfer";
import FamilyCreditDebit from "./pages/FamilyCreditDebit";
import ConsolidatedBill from "./pages/ConsolidatedBill";

import Reports from "./pages/Reports";
import DriverExpense from "./pages/DriverExpense";
import ExpenseApprovals from "./pages/ExpenseApprovals";
import { isMainAdminUser } from "./utils/portalAuth";
import "./darkMode.css";

// --- BULLETPROOF SECURITY WRAPPERS ---
const ProtectedAdmin = ({ children }) => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const validRoles = ["main_admin", "admin", "staff", "operations"];
  
  if (!user || !validRoles.includes(user?.role)) {
    // If data is invalid, kill it to prevent loops
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }
  return children;
};

const ProtectedMainAdmin = ({ children }) => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  
  if (!isMainAdminUser(user)) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const ProtectedDriver = ({ children }) => {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!user || user.role !== "driver") {
    localStorage.removeItem("user");
    return <Navigate to="/login" replace />;
  }
  return children;
};

// --- AUTO LOGOUT WRAPPER ---
const AutoLogoutWrapper = ({ children }) => {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(120); 
  const navigate = useNavigate();
  const location = useLocation();
  
  const inactivityTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const isPublicRoute = location.pathname === "/login" || location.pathname === "/track";
  const user = localStorage.getItem("user");

  const INACTIVITY_TIME = 3 * 60 * 1000; 
  const COUNTDOWN_TIME = 120; 

  const handleLogout = () => {
    localStorage.removeItem("user");
    setShowWarning(false);
    navigate("/login");
  };

  const resetInactivityTimer = () => {
    if (showWarning || isPublicRoute || !user) return; 

    clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(COUNTDOWN_TIME);
    }, INACTIVITY_TIME);
  };

  const stayLoggedIn = () => {
    setShowWarning(false);
    resetInactivityTimer();
  };

  useEffect(() => {
    if (isPublicRoute || !user) {
      clearTimeout(inactivityTimerRef.current);
      clearInterval(countdownIntervalRef.current);
      return;
    }

    const events = ["mousemove", "mousedown", "keypress", "scroll", "touchstart"];
    events.forEach(event => window.addEventListener(event, resetInactivityTimer));

    resetInactivityTimer(); 

    return () => {
      events.forEach(event => window.removeEventListener(event, resetInactivityTimer));
      clearTimeout(inactivityTimerRef.current);
      clearInterval(countdownIntervalRef.current);
    };
  }, [showWarning, isPublicRoute, user]);

  useEffect(() => {
    if (showWarning) {
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            handleLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(countdownIntervalRef.current);
    }

    return () => clearInterval(countdownIntervalRef.current);
  }, [showWarning]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <>
      {children}
      {showWarning && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", textAlign: "center", maxWidth: "400px", width: "90%" }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#1e293b", fontSize: "1.5rem" }}>Are you still there?</h3>
            <p style={{ color: "#475569", marginBottom: "15px" }}>You have been inactive for 3 minutes.</p>
            <p style={{ color: "#ef4444", fontWeight: "bold", fontSize: "1.2rem", background: "#fef2f2", padding: "10px", borderRadius: "8px" }}>
              Auto-logout in {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "25px" }}>
              <button onClick={stayLoggedIn} style={{ flex: 1, background: "#2563eb", color: "white", padding: "12px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem" }}>Stay Logged In</button>
              <button onClick={handleLogout} style={{ flex: 1, background: "#ef4444", color: "white", padding: "12px", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", fontSize: "1rem" }}>Logout Now</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function App() {
  return (
    <Router>
      <AutoLogoutWrapper>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/track" element={<TrackBooking />} /> 

          <Route path="/driver-dashboard" element={<ProtectedDriver><DriverDashboard /></ProtectedDriver>} />
          <Route path="/driver-expense" element={<ProtectedDriver><DriverExpense /></ProtectedDriver>} />

          <Route path="/" element={<ProtectedAdmin><Dashboard /></ProtectedAdmin>} />
          <Route path="/settings" element={<ProtectedAdmin><Settings /></ProtectedAdmin>} />
          <Route path="/data-tools" element={<ProtectedAdmin><DataTools /></ProtectedAdmin>} />
          <Route path="/user-approvals" element={<ProtectedMainAdmin><UserApprovals /></ProtectedMainAdmin>} />

          <Route path="/add-vehicle" element={<ProtectedAdmin><AddVehicle /></ProtectedAdmin>} />
          <Route path="/vehicle-list" element={<ProtectedAdmin><VehicleList /></ProtectedAdmin>} />
          <Route path="/add-driver" element={<ProtectedAdmin><AddDriver /></ProtectedAdmin>} />
          <Route path="/driver-list" element={<ProtectedAdmin><DriverList /></ProtectedAdmin>} />
          <Route path="/alerts" element={<ProtectedAdmin><DocumentAlerts /></ProtectedAdmin>} />

          <Route path="/add-party" element={<ProtectedAdmin><AddParty /></ProtectedAdmin>} />
          <Route path="/party-list" element={<ProtectedAdmin><PartyList /></ProtectedAdmin>} />
          <Route path="/party-ledger" element={<ProtectedAdmin><PartyLedger /></ProtectedAdmin>} />
          <Route path="/add-agent" element={<ProtectedAdmin><AddCommissionAgent /></ProtectedAdmin>} />
          <Route path="/commission-agents" element={<ProtectedAdmin><CommissionAgents /></ProtectedAdmin>} />

          <Route path="/new-estimate" element={<ProtectedAdmin><NewEstimate /></ProtectedAdmin>} />
          <Route path="/estimate-list" element={<ProtectedAdmin><EstimateList /></ProtectedAdmin>} />
          <Route path="/new-booking" element={<ProtectedAdmin><NewBooking /></ProtectedAdmin>} />
          <Route path="/booking-list" element={<ProtectedAdmin><BookingList /></ProtectedAdmin>} />
          <Route path="/trips" element={<ProtectedAdmin><Trips /></ProtectedAdmin>} />
          <Route path="/odo-logs" element={<ProtectedAdmin><OdometerLogs /></ProtectedAdmin>} />

          <Route path="/accounts" element={<ProtectedAdmin><Accounts /></ProtectedAdmin>} />
          <Route path="/add-account" element={<ProtectedAdmin><AddAccount /></ProtectedAdmin>} />
          <Route path="/transactions" element={<ProtectedAdmin><Transactions /></ProtectedAdmin>} />
          <Route path="/tripwise-payments" element={<ProtectedAdmin><TripwisePayments /></ProtectedAdmin>} />
          <Route path="/payment-in" element={<ProtectedAdmin><PaymentIn /></ProtectedAdmin>} />
          <Route path="/payment-out" element={<ProtectedAdmin><PaymentOut /></ProtectedAdmin>} />
          <Route path="/add-expense" element={<ProtectedAdmin><AddExpense /></ProtectedAdmin>} />
          <Route path="/loans" element={<ProtectedAdmin><Loans /></ProtectedAdmin>} />
          <Route path="/driver-salary-ledger" element={<ProtectedAdmin><DriverSalaryLedger /></ProtectedAdmin>} />
          <Route path="/driver-advances" element={<ProtectedAdmin><DriverAdvances /></ProtectedAdmin>} />
          <Route path="/self-transfer" element={<ProtectedAdmin><SelfTransfer /></ProtectedAdmin>} />
          <Route path="/family-credit-debit" element={<ProtectedAdmin><FamilyCreditDebit /></ProtectedAdmin>} />
          <Route path="/approve-expenses" element={<ProtectedAdmin><ExpenseApprovals /></ProtectedAdmin>} />
        
          <Route path="/approvals" element={<ProtectedMainAdmin><PendingApprovals /></ProtectedMainAdmin>} />
          <Route path="/activity-logs" element={<ProtectedMainAdmin><ActivityTracker /></ProtectedMainAdmin>} />
          
          <Route path="/consolidated-bill" element={<ProtectedAdmin><ConsolidatedBill /></ProtectedAdmin>} />
          <Route path="/reports" element={<ProtectedAdmin><Reports /></ProtectedAdmin>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AutoLogoutWrapper>
    </Router>
  );
}

export default App;
