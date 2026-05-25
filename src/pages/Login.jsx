import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { ArrowRight, Building2, Database, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { db } from "../firebase";
import vitLogo from "../assets/VIT.png";
// Removed: import { VITLogo } from "./VITLogo"; 
import {
  buildOtpDocId,
  buildPortalUserDocId,
  COMPANIES,
  DEFAULT_COMPANY_KEY,
  generateOtpCode,
  getCompanyByKey,
  hashValue,
  getMainAdminCredential,
  PORTAL_OTPS_COLLECTION,
  PORTAL_USERS_COLLECTION,
  sendOtpEmail,
} from "../utils/portalAuth";
import { logActivity } from "../utils/activityLog";
import "./login.css";

const ROLE_OPTIONS = [
  { value: "admin", label: "Secondary Admin" },
  { value: "staff", label: "Office Staff" },
  { value: "operations", label: "Operations Team" },
];

const ROLE_LABELS = Object.fromEntries(
  ROLE_OPTIONS.map((role) => [role.value, role.label])
);

const emptyRegisterForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  requestedRole: "admin",
  otp: "",
};

function Login() {
  const navigate = useNavigate();
  const [selectedCompanyKey, setSelectedCompanyKey] = useState(DEFAULT_COMPANY_KEY);

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");

  const [showRegister, setShowRegister] = useState(false);
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
  const [registerOtpSent, setRegisterOtpSent] = useState(false);
  const [registerOtpHash, setRegisterOtpHash] = useState("");
  const [registerOtpExpiry, setRegisterOtpExpiry] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCompany = useMemo(
    () => getCompanyByKey(selectedCompanyKey),
    [selectedCompanyKey]
  );

  useEffect(() => {
    try {
      const userString = localStorage.getItem("user");
      if (!userString) return;

      const user = JSON.parse(userString);
      if (!user || !user.role) {
        localStorage.removeItem("user");
        return;
      }

      const loopCheck = sessionStorage.getItem("loopGuard");
      if (loopCheck && parseInt(loopCheck) > 3) {
        localStorage.removeItem("user");
        sessionStorage.removeItem("loopGuard");
        return;
      }
      sessionStorage.setItem("loopGuard", (parseInt(loopCheck) || 0) + 1);
      setTimeout(() => sessionStorage.removeItem("loopGuard"), 2000);

      if (user.role === "driver") {
        navigate("/driver-dashboard", { replace: true });
      } else if (["main_admin", "admin", "staff", "operations"].includes(user.role)) {
        navigate("/", { replace: true });
      } else {
        localStorage.removeItem("user");
      }
    } catch {
      localStorage.removeItem("user");
    }
  }, [navigate]);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const redirectAfterLogin = (userData, redirectTo) => {
    localStorage.setItem("user", JSON.stringify(userData));
    navigate(redirectTo, { replace: true });

    logActivity(db, {
      actorEmail: userData.email || "",
      actorName: userData.name || userData.email || userData.loginId,
      actorRole: userData.role,
      actorCompanyKey: userData.companyKey,
      action: "login",
      module: "auth",
      summary: `${userData.roleLabel || userData.role} login successful`,
      targetId: userData.email || userData.driverId || userData.loginId || "",
      targetType: "session",
    }).catch((activityError) => {
      console.error("Unable to log login activity:", activityError);
    });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    clearMessages();
    setIsLoading(true);

    try {
      if (!selectedCompany.active) {
        throw new Error(`${selectedCompany.name} is not active yet.`);
      }

      const safeLoginId = loginId.trim();
      if (!safeLoginId || !password) {
        throw new Error("Enter user ID and password.");
      }

      const mainAdminUser = getMainAdminCredential({
        companyKey: selectedCompanyKey,
        username: safeLoginId,
        password,
      });

      if (mainAdminUser) {
        redirectAfterLogin(
          {
            loginId: mainAdminUser.username,
            email: mainAdminUser.email,
            name: mainAdminUser.name,
            role: "main_admin",
            roleLabel: "Main Admin",
            companyKey: selectedCompany.key,
            companyName: selectedCompany.name,
          },
          "/"
        );
        return;
      }

      const portalUsersSnap = await getDocs(collection(db, PORTAL_USERS_COLLECTION));
      const portalUsers = portalUsersSnap.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
      const portalUser = portalUsers.find(
        (item) =>
          item.companyKey === selectedCompanyKey &&
          String(item.username || "").trim().toLowerCase() === safeLoginId.toLowerCase()
      );

      if (portalUser) {
        if (!portalUser.passwordHash)
          throw new Error("Account configuration error. Please contact the main admin.");

        const passwordHash = await hashValue(password);
        if (passwordHash !== portalUser.passwordHash)
          throw new Error("Invalid user ID or password.");
        if (portalUser.status !== "approved") {
          throw new Error(
            portalUser.status === "pending"
              ? "Your registration is waiting for main admin approval."
              : "This user is not approved to login."
          );
        }

        redirectAfterLogin(
          {
            loginId: portalUser.username,
            email: portalUser.email,
            name: portalUser.name,
            role: portalUser.role || portalUser.requestedRole || "admin",
            roleLabel:
              ROLE_LABELS[portalUser.role || portalUser.requestedRole] || "Secondary Admin",
            companyKey: portalUser.companyKey,
            companyName: portalUser.companyName,
          },
          "/"
        );
        return;
      }

      const driversSnap = await getDocs(collection(db, "drivers"));
      const drivers = driversSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
      const driver = drivers.find(
        (item) =>
          String(item.driverLoginId || item.phone || "").trim() === safeLoginId &&
          item.password === password
      );

      if (driver) {
        if (driver.status === "inactive")
          throw new Error("Your driver account is inactive. Please contact the admin.");

        redirectAfterLogin(
          {
            loginId: driver.driverLoginId || driver.phone,
            role: "driver",
            roleLabel: "Driver",
            driverId: driver.id,
            name: driver.name,
            email: driver.email || "",
            companyKey: selectedCompany.key,
            companyName: selectedCompany.name,
          },
          "/driver-dashboard"
        );
        return;
      }

      throw new Error("Invalid user ID or password.");
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRegisterOtp = async (event) => {
    event.preventDefault();
    clearMessages();
    setIsLoading(true);

    try {
      const safeEmail = registerForm.email.trim().toLowerCase();
      const safeUsername = registerForm.username.trim().toLowerCase();

      if (!registerForm.name.trim() || !safeEmail || !safeUsername || !registerForm.password) {
        throw new Error("Name, user ID, email, and password are required.");
      }

      if (registerForm.password !== registerForm.confirmPassword) {
        throw new Error("Password and confirm password do not match.");
      }

      const existingUsers = await getDocs(collection(db, PORTAL_USERS_COLLECTION));
      const allUsers = existingUsers.docs.map((item) => item.data());
      const usernameTaken = allUsers.some(
        (item) =>
          item.companyKey === selectedCompanyKey &&
          String(item.username || "").trim().toLowerCase() === safeUsername
      );

      if (usernameTaken) throw new Error("This user ID is already in use.");

      const otpCode = generateOtpCode();
      const otpHash = await hashValue(otpCode);
      const expiry = Date.now() + 10 * 60 * 1000;

      await sendOtpEmail({
        toEmail: safeEmail,
        passcode: otpCode,
        companyName: selectedCompany.name,
        userName: registerForm.name.trim(),
      });

      setRegisterOtpSent(true);
      setRegisterOtpHash(otpHash);
      setRegisterOtpExpiry(expiry);
      setSuccess("OTP sent to your email. Verify it to submit your registration.");
    } catch (otpError) {
      setError(otpError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    clearMessages();
    setIsLoading(true);

    try {
      const safeEmail = registerForm.email.trim().toLowerCase();
      const safeUsername = registerForm.username.trim().toLowerCase();

      if (!registerOtpSent) throw new Error("Send OTP first.");
      if (Date.now() > registerOtpExpiry) throw new Error("OTP expired. Please send a new OTP.");

      const enteredOtpHash = await hashValue(registerForm.otp.trim());
      if (enteredOtpHash !== registerOtpHash) throw new Error("Invalid OTP.");

      const passwordHash = await hashValue(registerForm.password);

      await setDoc(
        doc(
          db,
          PORTAL_USERS_COLLECTION,
          buildPortalUserDocId(selectedCompanyKey, safeEmail)
        ),
        {
          name: registerForm.name.trim(),
          username: safeUsername,
          email: safeEmail,
          passwordHash,
          companyKey: selectedCompany.key,
          companyName: selectedCompany.name,
          requestedRole: registerForm.requestedRole,
          role: registerForm.requestedRole,
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      );

      await setDoc(
        doc(db, PORTAL_OTPS_COLLECTION, buildOtpDocId(selectedCompanyKey, safeEmail)),
        {
          email: safeEmail,
          username: safeUsername,
          companyKey: selectedCompany.key,
          verifiedAt: new Date().toISOString(),
          registrationOtpUsed: true,
        },
        { merge: true }
      );

      setSuccess("Registration submitted. Wait for main admin approval before login.");
      setRegisterForm(emptyRegisterForm);
      setRegisterOtpSent(false);
      setRegisterOtpHash("");
      setRegisterOtpExpiry(0);
      setShowRegister(false);
      setLoginId(safeUsername);
      setPassword("");
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`login-wrapper ${showRegister ? "registration-mode" : ""}`}>

      {/* ═══ BRAND SIDE (Left) ═══ */}
      <div className="login-brand-side">
        <div className="brand-content">

          {/* New Image Logo Implementation */}
          <div className="brand-logo-wrapper">
            <img src={vitLogo} alt="VIT Logo" className="vit-logo" />
            <div className="brand-logo-text">
              <strong>Veerashaiva</strong>
              <span>Infotech Technology</span>
            </div>
          </div>

          <h1>Secured.<br /><em>Unified.</em><br />Access.</h1>
          <p className="brand-subtitle">
            Role-based infrastructure control across all VIT enterprise modules. Select your designated workspace to begin.
          </p>

          <div className="brand-target-box">
            <div>
              <p>Active Module</p>
              <h3>{selectedCompany.name}</h3>
            </div>
            <span>{selectedCompany.shortName}</span>
          </div>

        </div>
      </div>

      {/* ═══ FORM SIDE (Right) ═══ */}
      <div className="login-form-side">
        <div className="login-card">

          {/* Card logo header */}
          

          <div className="login-header">
            <h2>{showRegister ? "System Registration" : "Welcome Back"}</h2>
            <p>
              {showRegister
                ? "Register for system access. Requires admin approval."
                : "Select your module and sign in with your credentials."}
            </p>
          </div>

          {error && <div className="login-error">{error}</div>}
          {success && <div className="login-success">{success}</div>}

          {/* Software selector */}
          <div className="input-container module-selector">
            <label>Select Workspace</label>
            <div className="input-wrapper">
              <Building2 size={16} className="input-icon" />
              <select
                value={selectedCompanyKey}
                onChange={(e) => setSelectedCompanyKey(e.target.value)}
                className="login-select"
              >
                {COMPANIES.map((company) => (
                  <option
                    key={company.key}
                    value={company.key}
                    disabled={!company.active}
                  >
                    {company.name}
                    {!company.active ? " (Offline)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!showRegister ? (
            <>
              {!selectedCompany.active && (
                <div className="login-warning">
                  {selectedCompany.name} is currently offline or in development.
                </div>
              )}

              <form onSubmit={handleLogin} className="login-form">
                <div className="input-container">
                  <label>User ID</label>
                  <div className="input-wrapper">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder="Enter your user ID"
                      required
                    />
                  </div>
                </div>

                <div className="input-container">
                  <label>Password</label>
                  <div className="input-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="login-btn"
                  disabled={isLoading || !selectedCompany.active}
                >
                  {isLoading ? "Authenticating..." : "Secure Login"}
                  <ArrowRight size={16} />
                </button>
              </form>

              <button
                type="button"
                className="login-text-btn"
                onClick={() => {
                  clearMessages();
                  setShowRegister(true);
                }}
              >
                Request New Staff Access
              </button>
            </>
          ) : (
            <form onSubmit={handleRegister} className="login-form">
              <div className="input-container">
                <label>Full Name</label>
                <div className="input-wrapper">
                  <User size={16} className="input-icon" />
                  <input
                    type="text"
                    value={registerForm.name}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Enter full name"
                    required
                  />
                </div>
              </div>

              <div className="input-grid-two">
                <div className="input-container">
                  <label>Create User ID</label>
                  <div className="input-wrapper">
                    <ShieldCheck size={16} className="input-icon" />
                    <input
                      type="text"
                      value={registerForm.username}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          username: e.target.value,
                        }))
                      }
                      placeholder="manager123"
                      required
                    />
                  </div>
                </div>
                <div className="input-container">
                  <label>Role</label>
                  <div className="input-wrapper">
                    <Database size={16} className="input-icon" />
                    <select
                      value={registerForm.requestedRole}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          requestedRole: e.target.value,
                        }))
                      }
                      className="login-select"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="input-container">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="valid.email@example.com"
                    required
                  />
                </div>
              </div>

              <div className="input-grid-two">
                <div className="input-container">
                  <label>Password</label>
                  <div className="input-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder="Password"
                      required
                    />
                  </div>
                </div>
                <div className="input-container">
                  <label>Confirm</label>
                  <div className="input-wrapper">
                    <Lock size={16} className="input-icon" />
                    <input
                      type="password"
                      value={registerForm.confirmPassword}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                      placeholder="Confirm"
                      required
                    />
                  </div>
                </div>
              </div>

              {registerOtpSent && (
                <div className="input-container">
                  <label>6-Digit OTP</label>
                  <div className="input-wrapper">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="text"
                      value={registerForm.otp}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({ ...prev, otp: e.target.value }))
                      }
                      placeholder="Check your email"
                      required
                    />
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                  type="button"
                  className="login-btn login-btn-secondary"
                  onClick={handleSendRegisterOtp}
                  disabled={isLoading || !selectedCompany.active}
                >
                  {isLoading
                    ? "Sending..."
                    : registerOtpSent
                    ? "Resend Email OTP"
                    : "Send OTP to Email"}
                </button>

                <button
                  type="submit"
                  className="login-btn"
                  disabled={isLoading || !registerOtpSent || !selectedCompany.active}
                >
                  {isLoading ? "Submitting..." : "Submit Registration"}
                  <ArrowRight size={16} />
                </button>
              </div>

              <button
                type="button"
                className="login-text-btn"
                onClick={() => {
                  clearMessages();
                  setShowRegister(false);
                  setRegisterForm(emptyRegisterForm);
                  setRegisterOtpSent(false);
                  setRegisterOtpHash("");
                  setRegisterOtpExpiry(0);
                }}
              >
                ← Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;