import { createElement, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Briefcase, ClipboardList, FileBarChart, FileText, Landmark, LayoutDashboard,
  LogOut, MapPin, Menu, PieChart, ReceiptIndianRupee, Settings as SettingsIcon, ShieldCheck, Truck, Users, Wallet, X,
  ChevronDown, ChevronRight, Activity, DatabaseBackup
} from "lucide-react";
import logo from "../assets/vel-logo-transparent.png";
import { getCompanyByKey, isMainAdminUser } from "../utils/portalAuth";
import "./Navbar.css";

// 🔥 BULLETPROOF MAIN ADMIN CHECK: Catches old and new local storage data formats
const getAdminSections = (user) => [
  {
    title: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/reports", label: "Reports", icon: FileBarChart },
      // 🔥 This will now reliably show both User Approvals AND Activity Logs!
      ...(isMainAdminUser(user)
        ? [
            { to: "/approvals", label: "User Approvals", icon: ShieldCheck },
            { to: "/activity-logs", label: "Activity Tracker", icon: Activity } 
          ]
        : []),
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
  {
    title: "Bookings",
    items: [
      { to: "/new-estimate", label: "New Estimate", icon: FileText },
      { to: "/estimate-list", label: "Estimate List", icon: ClipboardList },
      { to: "/new-booking", label: "New Booking", icon: Briefcase },
      { to: "/booking-list", label: "Booking List", icon: ClipboardList },
      { to: "/trips", label: "Live Trips", icon: MapPin },
      { to: "/odo-logs", label: "Odometer Logs", icon: Truck },
    ],
  },
  {
    title: "Fleet",
    items: [
      { to: "/vehicle-list", label: "Vehicle List", icon: Truck },
      { to: "/add-vehicle", label: "Add Vehicle", icon: Truck },
      { to: "/driver-list", label: "Driver List", icon: Users },
      { to: "/add-driver", label: "Add Driver", icon: Users },
      { to: "/alerts", label: "Document Alerts", icon: FileText },
    ],
  },
  {
    title: "Network",
    items: [
      { to: "/party-list", label: "Party List", icon: Users },
      { to: "/add-party", label: "Add Party", icon: Users },
      { to: "/party-ledger", label: "Party Ledger", icon: Wallet },
      { to: "/commission-agents", label: "Commission Agents", icon: Users },
      { to: "/add-agent", label: "Add Agent", icon: Users },
    ],
  },
  {
    title: "Accounts",
    items: [
      { to: "/accounts", label: "Financial Overview", icon: PieChart },
      { to: "/tripwise-payments", label: "Tripwise Receipts", icon: ReceiptIndianRupee },
      { to: "/transactions", label: "Transactions", icon: Wallet },
      { to: "/payment-in", label: "Payment In", icon: Landmark },
      { to: "/payment-out", label: "Payment Out", icon: Landmark },
      { to: "/add-expense", label: "Add Expense", icon: Wallet },
      { to: "/approve-expenses", label: "Approve Expenses", icon: ClipboardList },
      { to: "/consolidated-bill", label: "Consolidated Bill", icon: FileText },
      { to: "/add-account", label: "Add Account", icon: Landmark },
    ],
  },
  {
    title: "Data Tools",
    items: [
      { to: "/data-tools", label: "FY & Backup", icon: DatabaseBackup },
    ],
  },
];

function Navbar() {
  const [isOpen, setIsOpen] = useState(() => window.innerWidth > 1100);
  const [expandedSections, setExpandedSections] = useState({ Overview: true }); 
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem("user") || "{}"); 
  const company = getCompanyByKey(user?.companyKey);
  const adminSections = getAdminSections(user);

  const getActiveSectionTitle = (pathname) =>
    adminSections.find((section) =>
      section.items.some((item) => item.to === pathname)
    )?.title || "Overview";

  // Clock Sync
  useEffect(() => {
    const updateClock = () => setCurrentTime(new Date());
    updateClock();
    const intervalId = window.setInterval(updateClock, 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Sync Layout for Desktop Sidebar Pushing
  useEffect(() => {
    const syncAdminLayout = () => {
      const shouldOffsetContent = user?.role !== "driver" && isOpen && window.innerWidth > 1100;
      document.body.classList.toggle("admin-sidebar-open", shouldOffsetContent);
      document.body.style.setProperty("--admin-sidebar-width", shouldOffsetContent ? "320px" : "0px");
    };

    syncAdminLayout();
    window.addEventListener("resize", syncAdminLayout);

    return () => {
      window.removeEventListener("resize", syncAdminLayout);
      document.body.classList.remove("admin-sidebar-open");
      document.body.style.setProperty("--admin-sidebar-width", "0px");
    };
  }, [isOpen, user?.role]);

  // Mobile/Android specific sizing fixes
  useEffect(() => {
    const collapseSidebarOnMobile = () => {
      if (window.innerWidth <= 1100) {
        setIsOpen(false);
      }
    };
    collapseSidebarOnMobile();
    window.addEventListener("resize", collapseSidebarOnMobile);
    return () => window.removeEventListener("resize", collapseSidebarOnMobile);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user");
    window.location.href = "/login";
  };

  const handleMenuToggle = () => setIsOpen((previous) => !previous);

  const handleMenuLinkClick = (sectionTitle) => {
    setExpandedSections({ [sectionTitle]: true });
    if (window.innerWidth <= 1100) {
      setIsOpen(false);
    }
  };

  const toggleSection = (title) => {
    setExpandedSections((prev) => {
      return prev[title] ? {} : { [title]: true };
    });
  };

  const isActive = (path) => (location.pathname === path ? "active-link" : "");
  const activeSectionTitle = getActiveSectionTitle(location.pathname);
  const formattedDate = currentTime.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const formattedTime = currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  if (user?.role === "driver") {
    return (
      <nav className="erp-navbar driver-navbar">
        <div className="nav-container">
          <div className="nav-brand" onClick={() => navigate("/driver-dashboard")} style={{ cursor: "pointer" }}>
            <Truck className="brand-icon" />
            <span>Driver Portal</span>
          </div>
          <div className="nav-status">
            <div className="nav-clock-chip">
              <span>{formattedDate}</span>
              <strong>{formattedTime}</strong>
            </div>
            <div className="nav-user-meta">
              <span className="user-badge">Driver</span>
              <span className="user-email">{user?.email || "Logged in"}</span>
            </div>
            <Link to="/driver-expense" className="top-action-link">
              <ClipboardList size={18} /> Submit Expense
            </Link>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <>
      <nav className={`erp-navbar ${isOpen ? "admin-nav-open" : "admin-nav-closed"}`}>
        <div className="nav-container">
          <div className="nav-leading">
            <button className="menu-toggle-btn" onClick={handleMenuToggle} title={isOpen ? "Close menu" : "Open menu"}>
              {isOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="nav-brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              <img src={logo} alt="VR Logo" className="navbar-custom-logo" />
              <div className="brand-copy">
                <span className="brand-title">{company?.shortName || "VR"} Fleet</span>
                <span className="brand-subtitle">{company?.name || "Logistics"}</span>
              </div>
            </div>
          </div>
          <div className="nav-status">
            <div className="nav-clock-chip">
              <span>{formattedDate}</span>
              <strong>{formattedTime}</strong>
            </div>
            <div className="nav-user-meta">
              <span className="user-badge">{isMainAdminUser(user) ? "Main Admin" : "Portal User"}</span>
              <span className="user-email">{user?.email || "Logged in"}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      <aside className={`right-sidebar ${isOpen ? "open" : "closed"}`}>
        <div className="sidebar-header">
          <div>
            <p className="sidebar-label">Navigation</p>
            <h2>Quick Access</h2>
          </div>
          <button className="sidebar-close" onClick={handleMenuToggle} title="Close menu">
            <X size={18} />
          </button>
        </div>
        
        <div className="sidebar-sections">
          {adminSections.map((section) => {
            const isExpanded = expandedSections[section.title] || section.title === activeSectionTitle;

            return (
              <div key={section.title} className="sidebar-section">
                <div 
                  className="sidebar-section-header" 
                  onClick={() => toggleSection(section.title)}
                >
                  <p className="sidebar-section-title">{section.title}</p>
                  {isExpanded ? (
                    <ChevronDown size={16} className="dropdown-icon" />
                  ) : (
                    <ChevronRight size={16} className="dropdown-icon" />
                  )}
                </div>

                <div className={`sidebar-links ${isExpanded ? "expanded" : "collapsed"}`}>
                  {section.items.map(({ to, label, icon }) => (
                    <Link key={to} to={to} className={`sidebar-link ${isActive(to)}`} onClick={() => handleMenuLinkClick(section.title)}>
                      {createElement(icon, { size: 18 })} <span>{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Backdrop for Mobile */}
      {isOpen && <button className="sidebar-backdrop" onClick={handleMenuToggle} aria-label="Close menu" />}
    </>
  );
}

export default Navbar;
