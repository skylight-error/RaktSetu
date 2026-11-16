/**
 * RaktSetu Central Client API Wrapper
 */
const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  },

  // Auth endpoints
  hospitalLogin: (email, password) => API.request('/auth/hospital/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  hospitalRegister: (payload) => API.request('/auth/hospital/register', { method: 'POST', body: JSON.stringify(payload) }),
  donorLogin: (mobile, email) => API.request('/auth/donor/login', { method: 'POST', body: JSON.stringify({ mobile, email }) }),
  donorRegister: (payload) => API.request('/auth/donor/register', { method: 'POST', body: JSON.stringify(payload) }),
  getDemoAccounts: () => API.request('/auth/demo-accounts'),

  // Hospital endpoints
  getHospitalSummary: (hospitalId) => API.request(`/hospital/${hospitalId}/dashboard-summary`),
  getDonors: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return API.request(`/hospital/donors?${qs}`);
  },
  getDonorDetails: (donorId) => API.request(`/hospital/donors/${donorId}`),
  addDonorManual: (payload) => API.request('/hospital/donors', { method: 'POST', body: JSON.stringify(payload) }),
  scheduleScreening: (payload) => API.request('/hospital/schedule-screening', { method: 'POST', body: JSON.stringify(payload) }),
  recordScreeningDecision: (payload) => API.request('/hospital/record-screening-decision', { method: 'POST', body: JSON.stringify(payload) }),

  // Excel endpoints
  uploadExcelPreview: async (formData) => {
    const res = await fetch('/api/hospital/excel/preview', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },
  confirmExcelImport: (validRows, hospitalId) => API.request('/hospital/excel/confirm-import', { method: 'POST', body: JSON.stringify({ validRows, hospitalId }) }),
  downloadExcelTemplateUrl: (format = 'xlsx') => `/api/hospital/excel/template?format=${format}`,

  // Donor endpoints
  getDonorPortalData: (donorId) => API.request(`/donor/${donorId}`),
  updateWeeklyAvailability: (donorId, status) => API.request(`/donor/${donorId}/availability`, { method: 'POST', body: JSON.stringify({ status }) }),
  markNotificationRead: (donorId, notifId) => API.request(`/donor/${donorId}/notifications/${notifId}/read`, { method: 'POST' }),
  triggerWeeklyReminderTest: () => API.request('/donor/test/trigger-weekly-reminders', { method: 'POST' }),

  // Inventory endpoints
  getInventory: (hospitalId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return API.request(`/inventory/${hospitalId}?${qs}`);
  },
  addInventoryStock: (payload) => API.request('/inventory/add', { method: 'POST', body: JSON.stringify(payload) }),
  issueInventoryUnits: (payload) => API.request('/inventory/issue', { method: 'POST', body: JSON.stringify(payload) }),
  getInventoryTransactions: (hospitalId) => API.request(`/inventory/${hospitalId}/transactions`),

  // Requests & Matching
  getBloodRequests: (hospitalId) => API.request(`/requests/hospital/${hospitalId}`),
  createBloodRequest: (payload) => API.request('/requests/create', { method: 'POST', body: JSON.stringify(payload) }),
  matchDonorsForRequest: (requestId, radiusKm = 25) => API.request(`/requests/${requestId}/match?radiusKm=${radiusKm}`),
  contactDonorSimulation: (requestId, payload) => API.request(`/requests/${requestId}/contact-donor`, { method: 'POST', body: JSON.stringify(payload) }),
  updateRequestStatus: (requestId, status) => API.request(`/requests/${requestId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // AI Forecasting endpoints
  getDemandForecast: (hospitalId, bloodGroup, component) => {
    const qs = new URLSearchParams({ hospitalId, bloodGroup, component }).toString();
    return API.request(`/ai/forecast?${qs}`);
  },
  getShortageRiskMatrix: (hospitalId, component) => {
    const qs = new URLSearchParams({ hospitalId, component }).toString();
    return API.request(`/ai/shortage-matrix?${qs}`);
  }
};

window.API = API;
