import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { db } from "../firebase";
import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore"; 
import { isAdminRole } from "../utils/portalAuth";
import { getCurrentMonthRange, isRecordInDateRange } from "../utils/dateRange";
// 🔥 Upgraded to a powerful BarChart instead of a basic PieChart
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { MapPin, Fuel, Wifi, AlertTriangle, Loader2, Database } from "lucide-react";
import "./Dashboard.css"; 

import cashIcon from "../assets/cshin hand.jpeg";
import revenueIcon from "../assets/rev.jpeg";
import expenseIcon from "../assets/toex.jpeg";
import tripIcon from "../assets/trip.jpeg";

const DogLoader = () => (
  <div style={{
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(248, 250, 252, 0.6)", 
    backdropFilter: "blur(15px)", 
    zIndex: 99999,
    display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
    transition: "opacity 0.5s ease-out"
  }}>
    <img 
      src="\src\assets\vt_smooth_loader.gif" 
      alt="Thinking Dog" 
      style={{ width: "180px", marginBottom: "20px", borderRadius: "50%", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}
    />
    <h2 style={{ margin: 0, color: "#0f172a", fontSize: "1.5rem", letterSpacing: "1px", textAlign: "center", padding: "0 20px", fontWeight: "700" }}>
      Syncing Command Center...
    </h2>
  </div>
);

const FALLBACK_DIESEL_PRICES = [
  { state: "Karnataka", price: 87.94 },
  { state: "Maharashtra", price: 92.53 },
  { state: "Delhi", price: 87.62 },
  { state: "Tamil Nadu", price: 92.76 },
  { state: "Telangana", price: 97.82 },
  { state: "Kerala", price: 96.52 }
];

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  
  const [showOverlayLoader, setShowOverlayLoader] = useState(true);

  const cachedStats = sessionStorage.getItem("dashboard_stats");
  const [stats, setStats] = useState(
    cachedStats ? JSON.parse(cachedStats) : { totalProfit: 0, totalExpense: 0, cashInHand: 0, activeTrips: 0, graphData: [] }
  );

  const cachedFuel = localStorage.getItem("dashboard_fuel");
  const cachedFuelStatus = localStorage.getItem("dashboard_fuel_status");
  
  const [fuelData, setFuelData] = useState(cachedFuel ? JSON.parse(cachedFuel) : FALLBACK_DIESEL_PRICES);
  const [apiStatus, setApiStatus] = useState(cachedFuelStatus || "Checking Database..."); 
  const [selectedState, setSelectedState] = useState("Karnataka");

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (!storedUser || !isAdminRole(storedUser.role)) {
      navigate("/login");
      return; 
    }
    setUser(storedUser);

    const loaderTimer = setTimeout(() => {
      setShowOverlayLoader(false);
    }, 2000);

    const fetchFirebaseData = async () => {
      try {
        const [trxSnap, bookingsSnap] = await Promise.all([
          getDocs(collection(db, "transactions")),
          getDocs(collection(db, "bookings"))
        ]);

        const { fromDate, toDate } = getCurrentMonthRange();
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const currentMonthShort = today.toLocaleString('default', { month: 'short' });
        
        // 🔥 Setup the blank days for the Bar Chart
        let dailyData = [];
        for (let i = 1; i <= daysInMonth; i++) {
          dailyData.push({ day: `${i} ${currentMonthShort}`, Income: 0, Expense: 0 });
        }

        const transactions = trxSnap.docs.map(d => d.data());
        const monthTransactions = transactions.filter((t) => isRecordInDateRange(t, ["date", "createdAt"], fromDate, toDate));
        
        let totalIn = 0;
        let totalOut = 0;

        monthTransactions.forEach(trx => {
          const amt = Number(trx.amount) || 0;
          if (trx.type === "IN") totalIn += amt;
          else totalOut += amt; 
          
          // 🔥 Plot the daily graph data
          const dateVal = trx.date || trx.createdAt;
          if (dateVal) {
            const trxDate = new Date(dateVal);
            if (trxDate.getMonth() === today.getMonth() && trxDate.getFullYear() === today.getFullYear()) {
              const dayIndex = trxDate.getDate() - 1;
              if (dayIndex >= 0 && dayIndex < daysInMonth) {
                if (trx.type === "IN") dailyData[dayIndex].Income += amt;
                else dailyData[dayIndex].Expense += amt;
              }
            }
          }
        });

        const bookings = bookingsSnap.docs.map(d => d.data());
        const monthBookings = bookings.filter((b) => isRecordInDateRange(b, ["loadingDate", "createdAt"], fromDate, toDate));
        
        const activeStatuses = ["Moving Towards Load", "Loading", "In Transit", "Delay", "Reached Destination", "Unloading"];
        const activeTripsCount = monthBookings.filter(b => activeStatuses.includes(b.status)).length;

        const newStats = {
          totalProfit: totalIn,
          totalExpense: totalOut,
          cashInHand: totalIn - totalOut,
          activeTrips: activeTripsCount,
          graphData: dailyData // Saving the chart data
        };

        setStats(newStats);
        sessionStorage.setItem("dashboard_stats", JSON.stringify(newStats));

      } catch (error) {
        console.error("Error fetching Firebase data:", error);
      }
    };

    const fetchFuelDataWithDB = async () => {
      const todayStr = new Date().toDateString();
      const fuelDocRef = doc(db, "system_settings", "fuel_prices");
      
      let dbHasTodayData = false;

      try {
        const fuelSnap = await getDoc(fuelDocRef);
        if (fuelSnap.exists()) {
          const dbData = fuelSnap.data();
          if (dbData.prices && dbData.prices.length > 0) {
            setFuelData(dbData.prices);
            setSelectedState(dbData.prices[0].state);
            if (dbData.lastFetchDate === todayStr) {
              setApiStatus("Live Data (From DB)");
              dbHasTodayData = true; 
            } else {
              setApiStatus("Showing Yesterday's DB Data. Fetching today's...");
            }
          }
        }
      } catch (e) {
        console.error("Error reading fuel from DB:", e);
      }

      if (!dbHasTodayData) {
        try {
          const targetUrl = 'https://www.goodreturns.in/diesel-price.html';
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
          
          const fuelRes = await fetch(proxyUrl);
          
          if (fuelRes.ok) {
            const htmlString = await fuelRes.text();
            const parser = new DOMParser();
            const docParsed = parser.parseFromString(htmlString, "text/html");
            
            const rows = docParsed.querySelectorAll("table tr");
            let scrapedPrices = [];

            rows.forEach(row => {
              const columns = row.querySelectorAll("td");
              if (columns.length >= 2) {
                const stateName = columns[0].innerText.trim();
                const priceText = columns[1].innerText.replace(/[^0-9.]/g, "").trim();
                if (stateName.length > 2 && priceText && parseFloat(priceText) > 60 && parseFloat(priceText) < 130) {
                  scrapedPrices.push({ state: stateName, price: parseFloat(priceText).toFixed(2) });
                }
              }
            });

            const uniquePrices = Array.from(new Set(scrapedPrices.map(a => a.state)))
              .map(state => scrapedPrices.find(a => a.state === state));

            if (uniquePrices.length > 5) {
              let karnataka = uniquePrices.find(s => s.state.toLowerCase().includes("karnataka"));
              let others = uniquePrices.filter(s => !s.state.toLowerCase().includes("karnataka"));
              
              let finalTop10 = [];
              if (karnataka) {
                karnataka.state = "Karnataka"; 
                finalTop10.push(karnataka);
              }
              finalTop10 = [...finalTop10, ...others].slice(0, 10);

              setFuelData(finalTop10);
              setSelectedState(finalTop10[0].state);
              setApiStatus("Live Scraped");
              
              await setDoc(fuelDocRef, {
                prices: finalTop10,
                lastFetchDate: todayStr,
                updatedAt: new Date().toISOString()
              });
              
              localStorage.setItem("dashboard_fuel", JSON.stringify(finalTop10));
              localStorage.setItem("dashboard_fuel_date", todayStr);
              localStorage.setItem("dashboard_fuel_status", "Live Scraped");

            } else {
              throw new Error("Scraper couldn't find valid table data.");
            }
          } else {
            throw new Error(`Proxy connection failed. Status: ${fuelRes.status}`);
          }
        } catch (scrapeError) {
          console.warn("Live Web Scrape blocked or failed.", scrapeError.message);
          setApiStatus((prev) => prev.includes("Yesterday") ? "Offline (Showing DB Data)" : "Failed to load fuel data");
        }
      }
    };

    fetchFirebaseData();
    fetchFuelDataWithDB();

    return () => clearTimeout(loaderTimer);
  }, [navigate]); 

  return (
    <>
      {showOverlayLoader && <DogLoader />}
      
      <div className="dashboard-page">
        <Navbar />
        
        <div className="dashboard-container">
          
          <div className="dashboard-header">
            <h1>Command Center</h1>
            <p>Welcome back, {user?.name || user?.email}. Showing current month data.</p>
          </div>

          {/* TOP STAT CARDS */}
          <div className="stats-grid">
            <StatCard title="Net Cash in Hand" value={`₹${stats.cashInHand.toLocaleString('en-IN')}`} icon={cashIcon} bgColor="#eff6ff" textColor="#1e40af" />
            <StatCard title="Total Revenue (IN)" value={`₹${stats.totalProfit.toLocaleString('en-IN')}`} icon={revenueIcon} bgColor="#ecfdf5" textColor="#166534" />
            <StatCard title="Total Expenses (OUT)" value={`₹${stats.totalExpense.toLocaleString('en-IN')}`} icon={expenseIcon} bgColor="#fef2f2" textColor="#991b1b" />
            <StatCard title="Active Live Trips" value={stats.activeTrips} icon={tripIcon} bgColor="#fffbeb" textColor="#92400e" />
          </div>

          <div className="bottom-grid">
            
            {/* 🔥 NEW DAILY BAR CHART */}
            <div className="chart-section" style={{ minHeight: "350px" }}>
              <h2 className="section-title">Current Month Trends</h2>
              <div className="chart-wrapper" style={{ height: "300px", marginTop: "15px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.graphData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} minTickGap={20} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#64748b' }} 
                      tickFormatter={(value) => value >= 1000 ? `₹${(value/1000)}k` : `₹${value}`} 
                    />
                    <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      formatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '13px', paddingTop: '15px' }}/>
                    <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* FUEL PRICES */}
            <div className="chart-section">
              <div className="fuel-header">
                <h2 className="section-title fuel-title">
                  <Fuel size={20} color="#f59e0b" /> Daily Diesel Prices
                  {apiStatus.includes("Fetching") && <span className="fallback-badge" style={{background: "#e0e7ff", color: "#3730a3"}}><Loader2 size={12} className="animate-spin" style={{marginRight:"4px"}}/> Fetching...</span>}
                  {apiStatus.includes("Live") && <span className="live-badge"><Wifi size={12}/> {apiStatus}</span>}
                  {apiStatus.includes("DB Data") && <span className="fallback-badge" title="Showing latest saved DB Data"><Database size={12}/> {apiStatus}</span>}
                  {apiStatus === "Failed to load fuel data" && <span className="fallback-badge"><AlertTriangle size={12}/> Offline</span>}
                </h2>
                
                {fuelData.length > 0 && (
                  <select 
                    className="fuel-dropdown"
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                  >
                    {fuelData.map((item, idx) => (
                      <option key={idx} value={item.state}>{item.state}</option>
                    ))}
                  </select>
                )}
              </div>

              {fuelData.length > 0 ? (
                <>
                  <div className="selected-fuel-box">
                    <div>
                      <small>SELECTED REGION</small>
                      <strong><MapPin size={16} /> {selectedState}</strong>
                    </div>
                    <div className="fuel-price-big">
                      ₹{fuelData.find(d => d.state === selectedState)?.price || "0.00"} <span>/ Ltr</span>
                    </div>
                  </div>

                  <div>
                    <p className="top-10-title">Top 10 State Overview</p>
                    <div className="fuel-list" style={{ maxHeight: "200px", overflowY: "auto" }}>
                      {fuelData.slice(0, 10).map((item, idx) => {
                        const isTop = idx === 0;
                        return (
                          <div key={idx} className={`fuel-list-item ${isTop ? "highlighted" : ""}`}>
                            <span className="fuel-state-name">{item.state} {isTop && "📌"}</span>
                            <strong className="fuel-state-price">₹{item.price}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                  <Database size={32} style={{ opacity: 0.5, marginBottom: "10px" }} />
                  <p>No fuel data found in the database. Attempting to scrape live data...</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({ title, value, icon, bgColor, textColor }) {
  return (
    <div className="stat-card" style={{ borderLeft: `5px solid ${textColor}` }}>
      <div className="stat-info">
        <p className="stat-title" style={{ color: textColor, fontSize: '0.9rem', margin: '0 0 0.5rem 0', fontWeight: '600' }}>{title}</p>
        <p className="stat-value" style={{ color: textColor }}>{value}</p>
      </div>
      <div className="stat-icon" style={{ backgroundColor: bgColor }}>
        <img src={icon} alt={title} title={title} />
      </div>
    </div>
  );
}

export default Dashboard;