/**
 * RaktSetu Central Client API Wrapper
 * Supports Bearer token authentication & HTTP-only cookies
 */
const API = {
  baseUrl: '/api',

  getToken() {
    return localStorage.getItem('raktsetu_token') || null;
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('raktsetu_token', token);
    } else {
      localStorage.removeItem('raktsetu_token');
    }
  },

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      credentials: 'include',
      headers,
      ...options
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}`);
    }
    return data;
  },

  // Auth endpoints (Requirement 6, 7, 8, 9)
  donorLogin: async (identifier, password) => {
    const res = await API.request('/auth/donor/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    if (res.token) API.setToken(res.token);
    return res;
  },

  hospitalLogin: async (email, password) => {
    const res = await API.request('/auth/hospital/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.token) API.setToken(res.token);
    return res;
  },

  getAuthSession: () => API.request('/auth/me'),

  logout: async () => {
    try {
      await API.request('/auth/logout', { method: 'POST' });
    } finally {
      API.setToken(null);
    }
  },

  getDemoAccounts: () => API.request('/auth/demo-accounts'),

  // Application Endpoints (Requirement 3 & 4)
  submitDonorApplication: (payload) => API.request('/applications/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  checkApplicationStatus: (applicationId, mobile) => API.request('/applications/status', {
    method: 'POST',
    body: JSON.stringify({ applicationId, mobile })
  }),

  // Account Activation Endpoints (Requirement 6)
  requestActivationCode: (applicationId, mobile) => API.request('/auth/donor/request-activation-code', {
    method: 'POST',
    body: JSON.stringify({ applicationId, mobile })
  }),

  activateDonorAccount: (payload) => API.request('/auth/donor/activate', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Hospital Endpoints (Requirement 5)
  getHospitalSummary: (hospitalId) => API.request(`/hospital/${hospitalId}/dashboard-summary`),
  getHospitalApplications: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return API.request(`/hospital/applications?${qs}`);
  },
  approveDonorApplication: (applicationId, staffName) => API.request(`/hospital/applications/${applicationId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ staffName })
  }),
  rejectDonorApplication: (applicationId, rejectionReason, staffName) => API.request(`/hospital/applications/${applicationId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason, staffName })
  }),
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
    const token = API.getToken();
    const res = await fetch('/api/hospital/excel/preview', {
      method: 'POST',
      credentials: 'include',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },
  confirmExcelImport: (validRows, hospitalId) => API.request('/hospital/excel/confirm-import', { method: 'POST', body: JSON.stringify({ validRows, hospitalId }) }),
  downloadExcelTemplateUrl: (format = 'xlsx') => `/api/hospital/excel/template?format=${format}`,

  // Donor Protected Endpoints (Requirement 8)
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
