// This utility handles all secure communications with the Express Backend
export const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "https://vel-backend-5l0o.onrender.com";

/**
 * Make an authenticated fetch request to the backend API.
 * Automatically attaches the JWT token from the session.
 */
export const fetchWithAuth = async (endpoint, options = {}) => {
  const userStr = localStorage.getItem("user");
  const token = userStr ? JSON.parse(userStr).token : null;
  
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { error: await response.text() };
    }
    throw new Error(errorData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
};

export const api = {
  login: (credentials) => fetchWithAuth('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials)
  }),
  registerRequest: (payload) => fetchWithAuth('/api/auth/register-request', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  sendOtpEmail: (payload) => fetchWithAuth('/api/notifications/send-otp', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  sendCustomerNotification: (payload) => fetchWithAuth('/api/notifications/send-customer-bill', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getDriverDashboard: () => fetchWithAuth('/api/driver/dashboard-data'),
  getPartySummary: (partyName) => fetchWithAuth(`/api/calculations/party/${encodeURIComponent(partyName)}`),
  getDriverSalarySummary: (driverName, month) => fetchWithAuth(`/api/calculations/driver-salary/${encodeURIComponent(driverName)}/${encodeURIComponent(month)}`)
};
