/**
 * RaktSetu — Main Application Controller & Reactive UI
 */

const AppState = {
  currentView: 'landing', // 'landing', 'hospital', 'donor'
  currentHospitalTab: 'dashboard', // 'dashboard', 'donors', 'inventory', 'requests', 'ai'
  activeHospital: { id: 1, name: 'Metro General Hospital & Trauma Centre' },
  activeDonor: null,
  demoAccounts: { hospitals: [], donors: [] },
  activeModal: null, // 'donorRegister', 'manualDonor', 'excelImport', 'scheduleScreening', 'recordDecision', 'addStock', 'createRequest', 'matchDonors'
  selectedDonorForAction: null,
  selectedRequestForAction: null,
  activeMatchingResults: null,
  notificationSimulationOpen: false
};

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadDemoAccounts();
  renderApp();
});

async function loadDemoAccounts() {
  try {
    const data = await API.getDemoAccounts();
    AppState.demoAccounts = data;
    if (data.donors && data.donors.length > 0) {
      AppState.activeDonor = data.donors[0];
    }
  } catch (err) {
    console.error('Failed to load demo accounts', err);
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span>${Icons.sparkles(16, '#ffffff')}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ============================================================================
// MAIN RENDER ROUTER
// ============================================================================
function renderApp() {
  const appContainer = document.getElementById('app');
  if (!appContainer) return;

  // Render Top Demo Switcher & Navbar
  let html = `
    <!-- Top Demo Presentation Bar -->
    <div class="demo-banner">
      <div style="display:flex; align-items:center;">
        <span class="demo-pill">DEMO ACCELERATOR</span>
        <span>AI & Healthcare College Project Demonstration</span>
      </div>
      <div class="demo-shortcuts">
        <span style="color:#94a3b8; margin-right:4px;">Quick Switch:</span>
        <button class="demo-btn" onclick="switchToHospital(1)">🏥 Metro Hospital</button>
        <button class="demo-btn" onclick="switchToHospital(2)">🏥 City Life Blood Bank</button>
        <button class="demo-btn" onclick="switchToDonor(1)">🩸 Rahul (Approved)</button>
        <button class="demo-btn" onclick="switchToDonor(4)">🩸 Sneha (Pending)</button>
        <button class="demo-btn" onclick="openDonorRegisterModal()">+ Register Donor</button>
        <button class="demo-btn" style="background:#b91c1c;" onclick="triggerSimulatedWeeklyPush()">🔔 Test Weekly Push</button>
      </div>
    </div>

    <!-- Navigation Header -->
    <nav class="navbar">
      <div class="brand-container" onclick="navigateTo('landing')">
        ${Icons.logo(38)}
        <div class="brand-text">
          <h1>RaktSetu</h1>
          <p>AI Blood Inventory & Donor Coordination Platform</p>
        </div>
      </div>
      <div class="nav-links">
        <button class="btn ${AppState.currentView === 'landing' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="navigateTo('landing')">
          Home
        </button>
        <button class="btn ${AppState.currentView === 'hospital' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="navigateTo('hospital')">
          ${Icons.hospital(16)} Hospital Portal
        </button>
        <button class="btn ${AppState.currentView === 'donor' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="navigateTo('donor')">
          ${Icons.user(16)} Donor Portal
        </button>
        <button class="btn btn-secondary btn-sm" style="color:var(--primary-red); border-color:var(--primary-red-border);" onclick="openDonorRegisterModal()">
          Register as Donor
        </button>
      </div>
    </nav>

    <!-- Main View Container -->
    <main class="main-wrapper" id="mainView">
  `;

  if (AppState.currentView === 'landing') {
    html += renderLandingPage();
  } else if (AppState.currentView === 'hospital') {
    html += renderHospitalPortal();
  } else if (AppState.currentView === 'donor') {
    html += renderDonorPortal();
  }

  html += `</main>`;

  // Append modal container and toast container
  html += `
    <div id="modalContainer"></div>
    <div id="toastContainer" class="toast-container"></div>
  `;

  appContainer.innerHTML = html;

  // Post-render lifecycle hooks
  if (AppState.currentView === 'hospital') {
    loadHospitalDashboard();
  } else if (AppState.currentView === 'donor') {
    loadDonorDashboard();
  }
}

function navigateTo(view) {
  AppState.currentView = view;
  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchToHospital(hospitalId) {
  const h = AppState.demoAccounts.hospitals.find(x => x.id === hospitalId) || { id: hospitalId, name: `Hospital #${hospitalId}` };
  AppState.activeHospital = h;
  AppState.currentView = 'hospital';
  renderApp();
  showToast(`Switched to ${h.name}`);
}

async function switchToDonor(donorId) {
  try {
    const data = await API.getDonorPortalData(donorId);
    AppState.activeDonor = data.donor;
    AppState.currentView = 'donor';
    renderApp();
    showToast(`Switched to Donor: ${data.donor.full_name} (${data.donor.blood_group})`);
  } catch (err) {
    showToast('Failed to switch donor', 'error');
  }
}

// ============================================================================
// 1. LANDING PAGE VIEW
// ============================================================================
function renderLandingPage() {
  return `
    <div class="landing-hero" style="background:#ffffff; border-radius:var(--radius-lg); padding:48px 36px; border:1px solid var(--border-color); margin-bottom:32px; box-shadow:var(--shadow-md);">
      <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:36px; align-items:center;">
        <div>
          <div style="display:inline-flex; align-items:center; gap:8px; padding:4px 12px; background:var(--primary-red-light); color:var(--primary-red); border-radius:9999px; font-weight:700; font-size:12px; margin-bottom:16px;">
            ${Icons.sparkles(16, '#dc2626')} AI-POWERED HEALTHCARE COLLABORATION
          </div>
          <h1 style="font-size:38px; font-weight:800; color:var(--navy-dark); line-height:1.2; margin-bottom:16px;">
            Connecting Blood Needs with the Right Donors.
          </h1>
          <p style="font-size:16px; color:var(--text-muted); line-height:1.6; margin-bottom:28px;">
            An intelligent platform helping hospitals coordinate potential donors, monitor blood inventory, anticipate critical shortages using machine learning, and bridge emergency demand.
          </p>
          <div style="display:flex; gap:14px; flex-wrap:wrap;">
            <button class="btn btn-primary btn-lg" onclick="navigateTo('hospital')">
              ${Icons.hospital(18)} Hospital Portal Login
            </button>
            <button class="btn btn-secondary btn-lg" onclick="navigateTo('donor')">
              ${Icons.user(18)} Donor Portal Login
            </button>
            <button class="btn btn-secondary btn-lg" style="color:var(--primary-red); border-color:var(--primary-red);" onclick="openDonorRegisterModal()">
              ${Icons.bloodDrop(18)} Register as a Donor
            </button>
          </div>
          <div style="margin-top:24px; font-size:12px; color:var(--text-light); display:flex; gap:16px; align-items:center;">
            <span>✓ Persistent SQLite Storage</span>
            <span>✓ Genuine ML Regression Model</span>
            <span>✓ Excel / CSV Batch Importer</span>
          </div>
        </div>

        <!-- Healthcare Bridge Visual Motif -->
        <div style="background:var(--bg-subtle); border-radius:var(--radius-lg); padding:28px; border:1px solid var(--border-color); text-align:center;">
          <div style="position:relative; width:100%; height:200px; display:flex; align-items:center; justify-content:space-around;">
            <!-- Hospital Node -->
            <div style="background:#ffffff; border:2px solid var(--border-color); border-radius:var(--radius-md); padding:16px; box-shadow:var(--shadow-sm); z-index:2;">
              ${Icons.hospital(36, '#0f172a')}
              <div style="font-size:12px; font-weight:700; margin-top:6px;">Hospitals</div>
              <div style="font-size:10px; color:var(--text-muted);">Inventory & Needs</div>
            </div>

            <!-- Central Bridge Node -->
            <div style="background:var(--primary-red-light); border:2px dashed var(--blood-accent); border-radius:50%; width:80px; height:80px; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:2; box-shadow:0 0 15px rgba(220,38,38,0.2);">
              ${Icons.bloodDrop(28, '#dc2626')}
              <span style="font-size:9px; font-weight:800; color:var(--primary-red);">RAKTSETU</span>
            </div>

            <!-- Donor Node -->
            <div style="background:#ffffff; border:2px solid var(--border-color); border-radius:var(--radius-md); padding:16px; box-shadow:var(--shadow-sm); z-index:2;">
              ${Icons.users(36, '#dc2626')}
              <div style="font-size:12px; font-weight:700; margin-top:6px;">Donors</div>
              <div style="font-size:10px; color:var(--text-muted);">Verified Standby</div>
            </div>
          </div>
          <div style="background:#ffffff; border-radius:var(--radius-sm); padding:10px; margin-top:12px; font-size:12px; color:var(--navy-slate); font-weight:600; border:1px solid var(--border-color);">
            “Every Drop Matters. Every Connection Saves Lives.”
          </div>
        </div>
      </div>
    </div>

    <!-- How RaktSetu Works Section -->
    <div class="card" style="margin-bottom:32px;">
      <div class="card-header">
        <h2 class="card-title">${Icons.activity(20, '#dc2626')} How RaktSetu Works — End-to-End Coordination Workflow</h2>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px;">
        <div style="background:var(--bg-subtle); padding:16px; border-radius:var(--radius-sm); border-top:3px solid var(--primary-red);">
          <div style="font-size:18px; font-weight:800; color:var(--primary-red);">01</div>
          <div style="font-weight:700; font-size:14px; margin:6px 0;">Register as a Donor</div>
          <p style="font-size:12px; color:var(--text-muted);">Donors self-register or hospitals import existing records from legacy spreadsheets.</p>
        </div>
        <div style="background:var(--bg-subtle); padding:16px; border-radius:var(--radius-sm); border-top:3px solid var(--primary-red);">
          <div style="font-size:18px; font-weight:800; color:var(--primary-red);">02</div>
          <div style="font-weight:700; font-size:14px; margin:6px 0;">Hospital Screening</div>
          <p style="font-size:12px; color:var(--text-muted);">Authorized medical staff schedule pre-donation health checkups and approve fitness.</p>
        </div>
        <div style="background:var(--bg-subtle); padding:16px; border-radius:var(--radius-sm); border-top:3px solid var(--primary-red);">
          <div style="font-size:18px; font-weight:800; color:var(--primary-red);">03</div>
          <div style="font-weight:700; font-size:14px; margin:6px 0;">Approved Network</div>
          <p style="font-size:12px; color:var(--text-muted);">Only donors with current valid screening entered into emergency matching pool.</p>
        </div>
        <div style="background:var(--bg-subtle); padding:16px; border-radius:var(--radius-sm); border-top:3px solid var(--primary-red);">
          <div style="font-size:18px; font-weight:800; color:var(--primary-red);">04</div>
          <div style="font-weight:700; font-size:14px; margin:6px 0;">Weekly Check-ins</div>
          <p style="font-size:12px; color:var(--text-muted);">Weekly reminders track live availability (Yes / Maybe / No) for the upcoming week.</p>
        </div>
        <div style="background:var(--bg-subtle); padding:16px; border-radius:var(--radius-sm); border-top:3px solid var(--primary-red);">
          <div style="font-size:18px; font-weight:800; color:var(--primary-red);">05</div>
          <div style="font-weight:700; font-size:14px; margin:6px 0;">Smart Mobilisation</div>
          <p style="font-size:12px; color:var(--text-muted);">Hospital requests trigger AI compatibility and proximity ranking to contact nearby donors.</p>
        </div>
        <div style="background:var(--bg-subtle); padding:16px; border-radius:var(--radius-sm); border-top:3px solid var(--primary-red);">
          <div style="font-size:18px; font-weight:800; color:var(--primary-red);">06</div>
          <div style="font-weight:700; font-size:14px; margin:6px 0;">Inventory Planning</div>
          <p style="font-size:12px; color:var(--text-muted);">Machine learning forecasts 7-day blood demand and flags shortage risks proactively.</p>
        </div>
      </div>
    </div>

    <!-- AI & Product Principle Highlights -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div class="card">
        <h3 class="card-title" style="margin-bottom:12px;">
          ${Icons.sparkles(18, '#7c3aed')} Genuine AI & Machine Learning Features
        </h3>
        <ul style="font-size:13px; color:var(--navy-slate); line-height:1.7; padding-left:18px;">
          <li><strong>Demand Forecasting Model:</strong> Multivariate Ridge regularized time-series regression trained on multi-month historical hospital consumption records.</li>
          <li><strong>Explainable Shortage Risk:</strong> 7-day future projections comparing usable inventory against scheduled collections and cyclical harmonics.</li>
          <li><strong>Smart Donor Prioritisation:</strong> Multi-criteria explainable ranker combining component compatibility, active screening validity, rest intervals, and geodesic distance.</li>
        </ul>
      </div>

      <div class="card" style="border-left:4px solid var(--primary-red);">
        <h3 class="card-title" style="margin-bottom:12px; color:var(--primary-red);">
          ${Icons.shieldCheck(18, '#991b1b')} Important Healthcare Product Principle
        </h3>
        <p style="font-size:13px; color:var(--navy-slate); line-height:1.6;">
          RaktSetu is a decision-support and donor coordination platform. It does <strong>not</strong> replace qualified blood banks, donor medical screening, laboratory testing, compatibility cross-matching, or clinical medical decisions.
        </p>
        <p style="font-size:12px; color:var(--text-muted); margin-top:10px;">
          Donor availability does not equate to clinical eligibility, and potential donors are never treated as pre-packaged blood units.
        </p>
      </div>
    </div>
  `;
}

// ============================================================================
// 2. HOSPITAL PORTAL VIEW
// ============================================================================
function renderHospitalPortal() {
  const h = AppState.activeHospital;

  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div>
        <h2 style="font-size:22px; font-weight:800; color:var(--navy-dark);">${h.name}</h2>
        <p style="font-size:12px; color:var(--text-muted);">
          Hospital Portal & Blood Centre Operations • ${h.address || 'Mumbai'}
        </p>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-secondary btn-sm" onclick="openExcelImportModal()">
          ${Icons.fileSpreadsheet(16, '#059669')} Import Excel / CSV
        </button>
        <button class="btn btn-primary btn-sm" onclick="openCreateRequestModal()">
          ${Icons.plus(16)} Create Urgent Blood Request
        </button>
      </div>
    </div>

    <!-- Portal Navigation Tabs -->
    <div class="portal-tabs">
      <button class="tab-btn ${AppState.currentHospitalTab === 'dashboard' ? 'active' : ''}" onclick="switchHospitalTab('dashboard')">
        ${Icons.activity(16)} Dashboard Overview
      </button>
      <button class="tab-btn ${AppState.currentHospitalTab === 'donors' ? 'active' : ''}" onclick="switchHospitalTab('donors')">
        ${Icons.users(16)} Donor Registry & Screening
      </button>
      <button class="tab-btn ${AppState.currentHospitalTab === 'inventory' ? 'active' : ''}" onclick="switchHospitalTab('inventory')">
        ${Icons.bloodDrop(16)} Blood Inventory & Expiry
      </button>
      <button class="tab-btn ${AppState.currentHospitalTab === 'requests' ? 'active' : ''}" onclick="switchHospitalTab('requests')">
        ${Icons.alertTriangle(16)} Urgent Requests & Matching
      </button>
      <button class="tab-btn ${AppState.currentHospitalTab === 'ai' ? 'active' : ''}" onclick="switchHospitalTab('ai')">
        ${Icons.sparkles(16, '#7c3aed')} AI Shortage Prediction
      </button>
    </div>

    <!-- Active Tab Dynamic Container -->
    <div id="hospitalTabContent">
      <div style="text-align:center; padding:40px; color:var(--text-muted);">Loading hospital data...</div>
    </div>
  `;
}

function switchHospitalTab(tab) {
  AppState.currentHospitalTab = tab;
  renderApp();
}

async function loadHospitalDashboard() {
  const content = document.getElementById('hospitalTabContent');
  if (!content) return;

  try {
    const summary = await API.getHospitalSummary(AppState.activeHospital.id);

    if (AppState.currentHospitalTab === 'dashboard') {
      renderHospitalOverviewTab(content, summary);
    } else if (AppState.currentHospitalTab === 'donors') {
      loadDonorManagementTab(content);
    } else if (AppState.currentHospitalTab === 'inventory') {
      loadInventoryTab(content);
    } else if (AppState.currentHospitalTab === 'requests') {
      loadRequestsTab(content);
    } else if (AppState.currentHospitalTab === 'ai') {
      loadAiPredictionTab(content);
    }
  } catch (err) {
    content.innerHTML = `<div class="card" style="color:var(--status-red);">Failed to load hospital metrics: ${err.message}</div>`;
  }
}

// Tab 1: Overview
function renderHospitalOverviewTab(container, summary) {
  const m = summary.metrics;

  container.innerHTML = `
    <!-- Top Summary Metrics Grid -->
    <div class="summary-grid">
      <div class="metric-card info" style="cursor:pointer;" onclick="switchHospitalTab('inventory')">
        <div class="metric-title">Total Blood Stock</div>
        <div class="metric-value">${m.totalBloodUnits} <span style="font-size:14px; font-weight:500;">units</span></div>
        <div class="metric-sub">Usable unexpired blood</div>
      </div>
      <div class="metric-card success" style="cursor:pointer;" onclick="switchHospitalTab('donors')">
        <div class="metric-title">Approved Donors</div>
        <div class="metric-value">${m.approvedDonors}</div>
        <div class="metric-sub">${m.totalDonors} total in registry</div>
      </div>
      <div class="metric-card warning" style="cursor:pointer;" onclick="switchHospitalTab('donors')">
        <div class="metric-title">Pending Screening</div>
        <div class="metric-value">${m.pendingScreenings}</div>
        <div class="metric-sub">Awaiting appointment/decision</div>
      </div>
      <div class="metric-card critical" style="cursor:pointer;" onclick="switchHospitalTab('donors')">
        <div class="metric-title">Available This Week</div>
        <div class="metric-value">${m.availableThisWeek}</div>
        <div class="metric-sub">Confirmed via weekly check-in</div>
      </div>
      <div class="metric-card ${m.nearExpiryUnits > 0 ? 'critical' : 'info'}" style="cursor:pointer;" onclick="switchHospitalTab('inventory')">
        <div class="metric-title">Near-Expiry Units</div>
        <div class="metric-value" style="color:${m.nearExpiryUnits > 0 ? 'var(--blood-accent)' : 'inherit'};">
          ${m.nearExpiryUnits}
        </div>
        <div class="metric-sub">Expiring within 72 hours</div>
      </div>
      <div class="metric-card ${m.urgentRequestsCount > 0 ? 'warning' : 'info'}" style="cursor:pointer;" onclick="switchHospitalTab('requests')">
        <div class="metric-title">Urgent Requests</div>
        <div class="metric-value">${m.urgentRequestsCount}</div>
        <div class="metric-sub">Active matching required</div>
      </div>
    </div>

    <!-- Charts & Tables Layout -->
    <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:20px; margin-bottom:20px;">
      <!-- Stock by Blood Group -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${Icons.bloodDrop(18)} Usable Stock by Blood Group</h3>
          <span style="font-size:11px; color:var(--text-muted);">Real-time inventory units</span>
        </div>
        <div id="stockBarChartContainer"></div>
      </div>

      <!-- Upcoming Screenings Card -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${Icons.calendar(18)} Upcoming Screening Appointments</h3>
          <button class="btn btn-secondary btn-sm" onclick="switchHospitalTab('donors')">View All</button>
        </div>
        ${summary.upcomingAppointments.length === 0 ? `
          <div style="font-size:13px; color:var(--text-muted); padding:20px; text-align:center;">No scheduled appointments today.</div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${summary.upcomingAppointments.map(a => `
              <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:var(--bg-subtle); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div>
                  <div style="font-weight:700; font-size:13px;">${a.full_name} <span class="blood-badge" style="width:24px; height:24px; font-size:11px;">${a.blood_group}</span></div>
                  <div style="font-size:11px; color:var(--text-muted);">${a.appointment_date} • ${a.appointment_time}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="openRecordDecisionModal(${a.donor_id}, '${a.full_name}')">
                  Screen & Decide
                </button>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>

    <!-- Recent Urgent Requests Table -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${Icons.alertTriangle(18, '#dc2626')} Active Urgent Blood Requests</h3>
        <button class="btn btn-primary btn-sm" onclick="openCreateRequestModal()">+ New Request</button>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Req ID</th>
              <th>Group & Component</th>
              <th>Units</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Required By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${summary.recentRequests.length === 0 ? `
              <tr><td colspan="7" style="text-align:center; padding:20px;">No active blood requests recorded.</td></tr>
            ` : summary.recentRequests.map(r => `
              <tr>
                <td><strong>#REQ-${r.id}</strong></td>
                <td>
                  <span class="blood-badge" style="width:26px; height:26px; font-size:11px; margin-right:6px;">${r.blood_group}</span>
                  ${r.component}
                </td>
                <td><strong>${r.quantity_needed} units</strong></td>
                <td><span class="status-badge ${r.urgency === 'CRITICAL' ? 'status-critical' : 'status-pending'}">${r.urgency}</span></td>
                <td><span class="status-badge status-unconfirmed">${r.status}</span></td>
                <td>${r.required_by}</td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="triggerSmartMatchingForRequest(${r.id})">
                    ${Icons.sparkles(14, '#ffffff')} Smart Match
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Render Bar chart after DOM injection
  setTimeout(() => {
    if (summary.stockByGroup) {
      Charts.renderBarChart('stockBarChartContainer', summary.stockByGroup);
    }
  }, 50);
}

// Tab 2: Donor Management
async function loadDonorManagementTab(container) {
  try {
    const data = await API.getDonors();
    renderDonorManagementView(container, data.donors);
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--status-red);">Failed to load donor registry: ${err.message}</div>`;
  }
}

function renderDonorManagementView(container, donors) {
  container.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <input type="text" id="donorSearchInput" class="form-control" style="width:240px;" placeholder="Search name, phone, PIN..." onkeyup="filterDonorsTable()"/>
          <select id="donorBgFilter" class="form-control" style="width:130px;" onchange="filterDonorsTable()">
            <option value="ALL">All Groups</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
          </select>
          <select id="donorStatusFilter" class="form-control" style="width:180px;" onchange="filterDonorsTable()">
            <option value="ALL">All Screening Statuses</option>
            <option value="APPROVED">APPROVED</option>
            <option value="PENDING SCREENING">PENDING SCREENING</option>
            <option value="APPOINTMENT SCHEDULED">APPOINTMENT SCHEDULED</option>
            <option value="TEMPORARILY DEFERRED">TEMPORARILY DEFERRED</option>
            <option value="PENDING VERIFICATION">PENDING VERIFICATION</option>
          </select>
        </div>
        <div style="display:flex; gap:10px;">
          <a href="${API.downloadExcelTemplateUrl('xlsx')}" class="btn btn-secondary btn-sm" download>
            ${Icons.download(14)} Template (.xlsx)
          </a>
          <button class="btn btn-secondary btn-sm" onclick="openExcelImportModal()">
            ${Icons.fileSpreadsheet(14, '#059669')} Import Excel
          </button>
          <button class="btn btn-primary btn-sm" onclick="openAddManualDonorModal()">
            ${Icons.plus(14)} Add New Donor
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${Icons.users(18)} Hospital Donor Registry (${donors.length} records)</h3>
        <span style="font-size:12px; color:var(--text-muted);">Authorised medical access</span>
      </div>
      <div class="table-responsive">
        <table class="data-table" id="donorRegistryTable">
          <thead>
            <tr>
              <th>Donor Name</th>
              <th>Group</th>
              <th>Age/Sex</th>
              <th>Contact (Authorised)</th>
              <th>Location</th>
              <th>Screening Status</th>
              <th>Weekly Avail.</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${donors.map(d => `
              <tr data-name="${d.full_name.toLowerCase()}" data-mobile="${d.mobile}" data-bg="${d.blood_group}" data-status="${d.screening_status}">
                <td>
                  <strong style="color:var(--navy-dark);">${d.full_name}</strong>
                  <div style="font-size:11px; color:var(--text-muted);">ID: #DNR-${d.id} • ${d.source || 'SELF'}</div>
                </td>
                <td><span class="blood-badge" style="width:30px; height:30px; font-size:12px;">${d.blood_group}</span></td>
                <td>${d.age}y / ${d.gender ? d.gender[0] : 'U'}</td>
                <td>
                  <div style="font-weight:600; font-size:12px;">${d.mobile}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${d.email || 'No email'}</div>
                </td>
                <td>
                  <div>${d.city}</div>
                  <div style="font-size:11px; color:var(--text-muted);">PIN: ${d.pincode}</div>
                </td>
                <td>
                  <span class="status-badge ${getScreeningStatusClass(d.screening_status)}">
                    ${d.screening_status}
                  </span>
                  ${d.screening_valid_until ? `<div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Valid to: ${d.screening_valid_until}</div>` : ''}
                </td>
                <td>
                  <span class="status-badge ${getAvailabilityStatusClass(d.weekly_availability)}">
                    ${d.weekly_availability}
                  </span>
                </td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${d.screening_status === 'PENDING SCREENING' || d.screening_status === 'PENDING VERIFICATION' ? `
                      <button class="btn btn-secondary btn-sm" onclick="openScheduleScreeningModal(${d.id}, '${d.full_name}')" title="Schedule pre-donation checkup">
                        ${Icons.calendar(12)} Schedule
                      </button>
                    ` : ''}
                    ${d.screening_status === 'APPOINTMENT SCHEDULED' || d.screening_status === 'PENDING SCREENING' ? `
                      <button class="btn btn-primary btn-sm" onclick="openRecordDecisionModal(${d.id}, '${d.full_name}')" title="Screen and approve or defer">
                        ${Icons.shieldCheck(12, '#ffffff')} Decide
                      </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="switchToDonor(${d.id})">
                      Portal
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function filterDonorsTable() {
  const query = document.getElementById('donorSearchInput').value.toLowerCase();
  const bgFilter = document.getElementById('donorBgFilter').value;
  const statusFilter = document.getElementById('donorStatusFilter').value;

  const rows = document.querySelectorAll('#donorRegistryTable tbody tr');
  rows.forEach(r => {
    const name = r.getAttribute('data-name');
    const mobile = r.getAttribute('data-mobile');
    const bg = r.getAttribute('data-bg');
    const status = r.getAttribute('data-status');

    const matchQuery = !query || name.includes(query) || mobile.includes(query);
    const matchBg = bgFilter === 'ALL' || bg === bgFilter;
    const matchStatus = statusFilter === 'ALL' || status === statusFilter;

    if (matchQuery && matchBg && matchStatus) {
      r.style.display = '';
    } else {
      r.style.display = 'none';
    }
  });
}

function getScreeningStatusClass(status) {
  if (status === 'APPROVED') return 'status-approved';
  if (status === 'APPOINTMENT SCHEDULED' || status === 'PENDING SCREENING') return 'status-pending';
  if (status === 'TEMPORARILY DEFERRED' || status === 'NOT APPROVED') return 'status-deferred';
  return 'status-unconfirmed';
}

function getAvailabilityStatusClass(status) {
  if (status === 'AVAILABLE') return 'status-available';
  if (status === 'MAYBE') return 'status-maybe';
  if (status === 'UNAVAILABLE') return 'status-unavailable';
  return 'status-unconfirmed';
}

// Tab 3: Inventory
async function loadInventoryTab(container) {
  try {
    const data = await API.getInventory(AppState.activeHospital.id);
    renderInventoryView(container, data);
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--status-red);">Failed to load inventory: ${err.message}</div>`;
  }
}

function renderInventoryView(container, invData) {
  container.innerHTML = `
    <!-- Shelf-life & Regulatory Rule Banner -->
    <div class="card" style="background:#f0fdf4; border:1px solid #bbf7d0; margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="font-weight:700; font-size:13px; color:#166534;">
            Component-Specific Shelf Life & Storage Protocol
          </div>
          <div style="font-size:12px; color:#15803d; margin-top:2px;">
            Platelets: <strong>5 Days</strong> (20-24°C Agitator) • Whole Blood: <strong>35 Days</strong> (2-6°C) • PRBC: <strong>42 Days</strong> (2-6°C) • Plasma: <strong>365 Days</strong> (-30°C)
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openAddStockModal()">
          ${Icons.plus(14)} Add Stock Intake
        </button>
      </div>
    </div>

    <!-- Inventory Stats Cards -->
    <div class="summary-grid" style="margin-bottom:20px;">
      <div class="metric-card success">
        <div class="metric-title">Usable Blood Units</div>
        <div class="metric-value">${invData.totalUsable}</div>
        <div class="metric-sub">Ready for cross-matching</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-title">Near-Expiry Units</div>
        <div class="metric-value" style="color:var(--status-amber);">${invData.totalNearExpiry}</div>
        <div class="metric-sub">Expiring within 72 hrs</div>
      </div>
      <div class="metric-card critical">
        <div class="metric-title">Expired Units</div>
        <div class="metric-value" style="color:var(--status-red);">${invData.totalExpired}</div>
        <div class="metric-sub">Quarantined (Never issued)</div>
      </div>
    </div>

    <!-- Inventory Batch Table -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">${Icons.bloodDrop(18)} Batch Inventory Records</h3>
        <span style="font-size:12px; color:var(--text-muted);">FIFO stock rotation recommended</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Unit Code</th>
              <th>Group</th>
              <th>Component</th>
              <th>Quantity</th>
              <th>Collection Date</th>
              <th>Expiry Date</th>
              <th>Days Left</th>
              <th>Storage Location</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${invData.items.map(item => `
              <tr style="${item.computedStatus === 'EXPIRED' ? 'background:#fff1f2; opacity:0.85;' : ''}">
                <td><code>${item.unit_code}</code></td>
                <td><span class="blood-badge" style="width:28px; height:28px; font-size:11px;">${item.blood_group}</span></td>
                <td><strong>${item.component}</strong></td>
                <td><strong>${item.quantity_units} unit(s)</strong></td>
                <td>${item.collection_date}</td>
                <td><strong>${item.expiry_date}</strong></td>
                <td>
                  ${item.daysUntilExpiry < 0 ? `
                    <span style="color:var(--status-red); font-weight:700;">Expired (${Math.abs(item.daysUntilExpiry)}d ago)</span>
                  ` : item.daysUntilExpiry <= 3 ? `
                    <span style="color:var(--status-amber); font-weight:700;">${item.daysUntilExpiry} days</span>
                  ` : `
                    <span>${item.daysUntilExpiry} days</span>
                  `}
                </td>
                <td style="font-size:11px; color:var(--text-muted);">${item.storage_location}</td>
                <td>
                  <span class="status-badge ${item.computedStatus === 'USABLE' ? 'status-usable' : item.computedStatus === 'NEAR_EXPIRY' ? 'status-near_expiry pulse-badge' : 'status-expired'}">
                    ${item.computedStatus}
                  </span>
                </td>
                <td>
                  ${item.computedStatus !== 'EXPIRED' && item.quantity_units > 0 ? `
                    <button class="btn btn-secondary btn-sm" onclick="openIssueStockModal(${item.id}, '${item.unit_code}', '${item.blood_group}', '${item.component}', ${item.quantity_units})">
                      Issue Unit
                    </button>
                  ` : `
                    <span style="font-size:11px; color:var(--text-light);">Non-issuable</span>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Tab 4: Requests & Matching (DEMO 6)
async function loadRequestsTab(container) {
  try {
    const data = await API.getBloodRequests(AppState.activeHospital.id);
    renderRequestsView(container, data.requests);
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--status-red);">Failed to load blood requests: ${err.message}</div>`;
  }
}

function renderRequestsView(container, requests) {
  container.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:16px; font-weight:700;">Urgent Blood Requests & Intelligent Donor Matching</h3>
          <p style="font-size:12px; color:var(--text-muted);">
            Create urgent requirements, run explainable AI donor matching, and simulate contact mobilization.
          </p>
        </div>
        <button class="btn btn-primary" onclick="openCreateRequestModal()">
          ${Icons.plus(16)} Submit New Blood Request
        </button>
      </div>
    </div>

    <!-- Active Requests Grid -->
    <div style="display:flex; flex-direction:column; gap:16px;">
      ${requests.map(req => `
        <div class="card" style="border-left:4px solid ${req.urgency === 'CRITICAL' ? 'var(--blood-accent)' : '#d97706'};">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="blood-badge" style="width:34px; height:34px; font-size:13px;">${req.blood_group}</span>
                <span style="font-size:17px; font-weight:800; color:var(--navy-dark);">${req.component}</span>
                <span class="status-badge ${req.urgency === 'CRITICAL' ? 'status-critical' : 'status-pending'}">${req.urgency}</span>
                <span class="status-badge status-unconfirmed">${req.status}</span>
              </div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">
                Request <strong>#REQ-${req.id}</strong> • Needed: <strong>${req.quantity_needed} unit(s)</strong> • Required by: <strong>${req.required_by}</strong>
              </div>
            </div>
            <div>
              <button class="btn btn-primary btn-sm" onclick="triggerSmartMatchingForRequest(${req.id})">
                ${Icons.sparkles(14, '#ffffff')} Run Smart Matching
              </button>
            </div>
          </div>

          ${req.notes ? `
            <div style="background:var(--bg-subtle); padding:8px 12px; border-radius:var(--radius-sm); font-size:12px; color:var(--navy-slate); margin-bottom:12px;">
              <strong>Clinical Context:</strong> ${req.notes}
            </div>
          ` : ''}

          <!-- Matching Results Container (injected dynamically when triggered) -->
          <div id="matchingResults_${req.id}"></div>
        </div>
      `).join('')}
    </div>
  `;
}

async function triggerSmartMatchingForRequest(requestId, radiusKm = 25) {
  const resultBox = document.getElementById(`matchingResults_${requestId}`);
  if (resultBox) {
    resultBox.innerHTML = `<div style="padding:16px; font-size:13px; color:var(--text-muted);">Running AI compatibility and proximity ranking engine (radius: ${radiusKm}km)...</div>`;
  }

  try {
    const data = await API.matchDonorsForRequest(requestId, radiusKm);
    AppState.activeMatchingResults = data;
    renderMatchingResultsInline(requestId, data);
  } catch (err) {
    if (resultBox) {
      resultBox.innerHTML = `<div style="color:var(--status-red); padding:10px;">Matching failed: ${err.message}</div>`;
    }
  }
}

function renderMatchingResultsInline(requestId, data) {
  const container = document.getElementById(`matchingResults_${requestId}`);
  if (!container) return;

  const m = data.matchResults;

  container.innerHTML = `
    <div style="border-top:1px solid var(--border-color); padding-top:16px; margin-top:12px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-size:14px; font-weight:700; color:var(--navy-dark); display:flex; align-items:center; gap:6px;">
            ${Icons.sparkles(16, '#7c3aed')} AI Donor Prioritisation Results
            <span style="font-size:12px; font-weight:600; color:var(--status-green);">(${m.totalMatchingDonors} eligible donors in pool)</span>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
            Compatible groups: <strong>${m.compatibleGroups.join(', ')}</strong> • Strict medical screening approval verified
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:11px; font-weight:700; color:var(--navy-slate);">RADIUS:</label>
          <select class="form-control" style="width:110px; padding:4px 8px; font-size:12px;" onchange="triggerSmartMatchingForRequest(${requestId}, this.value)">
            <option value="10" ${m.radiusKm === 10 ? 'selected' : ''}>10 km</option>
            <option value="25" ${m.radiusKm === 25 ? 'selected' : ''}>25 km</option>
            <option value="50" ${m.radiusKm === 50 ? 'selected' : ''}>50 km</option>
          </select>
        </div>
      </div>

      <!-- Ranked Donors List -->
      ${m.rankedDonors.length === 0 ? `
        <div style="padding:16px; background:#fffbeb; border:1px solid #fef3c7; border-radius:var(--radius-sm); font-size:12px; color:#92400e;">
          No matching donors found within ${m.radiusKm} km radius. Try expanding search radius to 50 km or reviewing deferred donor records.
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${m.rankedDonors.map((d, index) => `
            <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:26px; height:26px; background:var(--navy-dark); color:#ffffff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800;">
                  #${index + 1}
                </div>
                <span class="blood-badge" style="width:32px; height:32px; font-size:12px;">${d.bloodGroup}</span>
                <div>
                  <div style="font-weight:700; font-size:13px; color:var(--navy-dark);">
                    ${d.fullName}
                    <span style="font-size:11px; font-weight:600; color:var(--status-green); margin-left:6px;">
                      Match Score: ${d.priorityScore}/100
                    </span>
                  </div>
                  <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">
                    ${Icons.mapPin(12)} ~${d.distanceKm} km away • ${d.address}, ${d.city}
                  </div>
                  <div style="font-size:11px; color:#475569; margin-top:4px; font-style:italic;">
                    "${d.explanation}"
                  </div>
                </div>
              </div>

              <div style="display:flex; align-items:center; gap:10px;">
                <div style="text-align:right;">
                  <span class="status-badge ${getAvailabilityStatusClass(d.weeklyAvailability)}">
                    ${d.weeklyAvailability}
                  </span>
                  <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">${d.mobile}</div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="simulateContactDonor(${requestId}, ${d.donorId}, '${d.fullName}')">
                  ${Icons.phone(12)} Mobilise
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

async function simulateContactDonor(requestId, donorId, donorName) {
  try {
    const res = await API.contactDonorSimulation(requestId, {
      donorId,
      hospitalId: AppState.activeHospital.id,
      notes: `Automated urgent mobilisation dispatched to ${donorName}.`
    });
    showToast(res.message);
    loadHospitalDashboard();
  } catch (err) {
    showToast('Failed to contact donor: ' + err.message, 'error');
  }
}

// Tab 5: AI Shortage Prediction (DEMO 5)
async function loadAiPredictionTab(container) {
  container.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; color:#7c3aed; font-weight:700; font-size:12px; margin-bottom:4px;">
            ${Icons.sparkles(16, '#7c3aed')} MACHINE LEARNING DEMAND FORECASTING
          </div>
          <h3 style="font-size:18px; font-weight:800; color:var(--navy-dark);">7-Day Proactive Blood Shortage Prediction</h3>
          <p style="font-size:12px; color:var(--text-muted);">
            Trained Multivariate Ridge Regularized Regression Model using 180 days of historical hospital consumption.
          </p>
        </div>

        <div style="display:flex; gap:10px; align-items:center;">
          <select id="aiBgSelect" class="form-control" style="width:110px;">
            <option value="O+">O+</option>
            <option value="O-" selected>O-</option>
            <option value="A+">A+</option>
            <option value="B+">B+</option>
          </select>
          <select id="aiCompSelect" class="form-control" style="width:230px;">
            <option value="Packed Red Blood Cells (PRBC)" selected>Packed Red Blood Cells (PRBC)</option>
            <option value="Platelets">Platelets</option>
          </select>
          <button class="btn btn-primary" onclick="runAiForecastModel()">
            ${Icons.sparkles(16, '#ffffff')} Run Model Forecast
          </button>
        </div>
      </div>
    </div>

    <!-- AI Results Dynamic Container -->
    <div id="aiForecastResultsContainer">
      <div style="text-align:center; padding:30px; color:var(--text-muted);">Running initial forecast...</div>
    </div>
  `;

  runAiForecastModel();
}

async function runAiForecastModel() {
  const container = document.getElementById('aiForecastResultsContainer');
  if (!container) return;

  const bg = document.getElementById('aiBgSelect') ? document.getElementById('aiBgSelect').value : 'O-';
  const comp = document.getElementById('aiCompSelect') ? document.getElementById('aiCompSelect').value : 'Packed Red Blood Cells (PRBC)';

  container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--text-muted);">Loading mathematical regression model weights for ${bg} ${comp}...</div>`;

  try {
    const data = await API.getDemandForecast(AppState.activeHospital.id, bg, comp);
    renderAiForecastContent(container, data);
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--status-red);">Model prediction failed: ${err.message}</div>`;
  }
}

function renderAiForecastContent(container, f) {
  const m = f.modelMetrics;

  container.innerHTML = `
    <!-- Top Comparison Metrics Grid -->
    <div class="summary-grid" style="margin-bottom:20px;">
      <div class="metric-card info">
        <div class="metric-title">Usable Stock In Bank</div>
        <div class="metric-value">${f.usableInventory} <span style="font-size:14px; font-weight:500;">units</span></div>
        <div class="metric-sub">Verified unexpired units</div>
      </div>
      <div class="metric-card warning">
        <div class="metric-title">Expected Incoming</div>
        <div class="metric-value">+${f.expectedIncomingUnits} <span style="font-size:14px; font-weight:500;">units</span></div>
        <div class="metric-sub">From scheduled screenings</div>
      </div>
      <div class="metric-card critical">
        <div class="metric-title">7-Day Forecast Demand</div>
        <div class="metric-value">${f.totalProjectedDemand} <span style="font-size:14px; font-weight:500;">units</span></div>
        <div class="metric-sub">Predicted patient consumption</div>
      </div>
      <div class="metric-card ${f.projectedShortage > 0 ? 'critical' : 'success'}">
        <div class="metric-title">Net Shortage Threat</div>
        <div class="metric-value" style="color:${f.projectedShortage > 0 ? 'var(--blood-accent)' : 'var(--status-green)'};">
          ${f.projectedShortage > 0 ? `-${f.projectedShortage}` : '+ ' + Math.abs(f.netBalance)} <span style="font-size:14px; font-weight:500;">units</span>
        </div>
        <div class="metric-sub">${f.projectedShortage > 0 ? 'Shortfall predicted' : 'Surplus safe margin'}</div>
      </div>
    </div>

    <!-- Main Forecast Chart Card -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${Icons.activity(18, '#dc2626')} 7-Day Demand Forecast with 90% Confidence Corridor</h3>
          <p style="font-size:11px; color:var(--text-muted);">Blue Line: Recent Historical Consumption • Red Dashed Line: ML Predicted Future Demand</p>
        </div>
        <div>
          ${Charts.getRiskBadgeHtml(f.riskLevel)}
        </div>
      </div>
      <div id="aiForecastChartSvgContainer" style="width:100%; min-height:240px;"></div>
    </div>

    <!-- Explainable Factors & Clinical Recommendations -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <!-- Contributing Factors -->
      <div class="card">
        <h3 class="card-title" style="margin-bottom:12px;">
          ${Icons.sparkles(16, '#7c3aed')} Key Contributing Factors
        </h3>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${f.contributingFactors.map(fact => `
            <div style="background:var(--bg-subtle); padding:10px 12px; border-radius:var(--radius-sm); border-left:3px solid var(--navy-dark);">
              <div style="font-weight:700; font-size:12px; color:var(--navy-dark);">${fact.factor}</div>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${fact.detail}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Clinical Coordination Recommendations -->
      <div class="card">
        <h3 class="card-title" style="margin-bottom:12px; color:var(--primary-red);">
          ${Icons.shieldCheck(16, '#991b1b')} AI Coordination Recommendations
        </h3>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${f.recommendations.map(rec => `
            <div style="background:#fff1f2; padding:10px 12px; border-radius:var(--radius-sm); border:1px solid #fecdd3; font-size:12px; color:#991b1b; font-weight:600;">
              • ${rec}
            </div>
          `).join('')}
        </div>

        <div style="margin-top:16px; padding:10px; background:var(--bg-subtle); border-radius:var(--radius-sm); font-size:11px; color:var(--text-muted);">
          <strong>Model Metrics:</strong> R² = ${m.r2Score} | MAE = ${m.maeUnits} units | Training size: ${m.trainingSamples} samples
        </div>
      </div>
    </div>
  `;

  // Render SVG chart
  setTimeout(() => {
    Charts.renderForecastChart('aiForecastChartSvgContainer', f.dailyForecast, f.recentHistory);
  }, 50);
}

// ============================================================================
// 3. DONOR PORTAL VIEW (DEMO 4)
// ============================================================================
function renderDonorPortal() {
  const d = AppState.activeDonor;
  if (!d) {
    return `<div class="card" style="text-align:center; padding:40px;">No donor profile selected. Use quick switcher at top or register.</div>`;
  }

  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
      <div style="display:flex; align-items:center; gap:14px;">
        <span class="blood-badge" style="width:48px; height:48px; font-size:18px;">${d.blood_group}</span>
        <div>
          <h2 style="font-size:22px; font-weight:800; color:var(--navy-dark);">${d.full_name}</h2>
          <p style="font-size:12px; color:var(--text-muted);">
            Registered Donor • ${d.mobile} • ${d.city} (PIN: ${d.pincode})
          </p>
        </div>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-secondary btn-sm" onclick="triggerSimulatedWeeklyPush()">
          🔔 Trigger Weekly Push Notification
        </button>
      </div>
    </div>

    <!-- Active Tab Dynamic Container -->
    <div id="donorDashboardContent">
      <div style="text-align:center; padding:30px; color:var(--text-muted);">Loading donor profile...</div>
    </div>
  `;
}

async function loadDonorDashboard() {
  const container = document.getElementById('donorDashboardContent');
  if (!container || !AppState.activeDonor) return;

  try {
    const data = await API.getDonorPortalData(AppState.activeDonor.id);
    renderDonorDashboardContent(container, data);
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--status-red);">Failed to load donor data: ${err.message}</div>`;
  }
}

function renderDonorDashboardContent(container, data) {
  const d = data.donor;

  container.innerHTML = `
    <!-- Weekly Availability Check-in Card (WORKFLOW DEMO 4) -->
    <div class="availability-checkin-card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:#e11d48; margin-bottom:4px;">
            ${Icons.heart(16, '#e11d48')} WEEKLY AVAILABILITY CHECK-IN • ${data.currentWeek}
          </div>
          <h3 style="font-size:18px; font-weight:800; color:var(--navy-dark);">
            "Will you be available to help save a life next week? Tap to update your availability. 🩸"
          </h3>
          <p style="font-size:12px; color:#475569; margin-top:4px;">
            Current Recorded Response: <strong class="status-badge ${getAvailabilityStatusClass(d.weekly_availability)}">${d.weekly_availability}</strong>
          </p>
        </div>
      </div>

      <div class="availability-options">
        <button class="availability-btn ${d.weekly_availability === 'AVAILABLE' ? 'selected' : ''}" onclick="submitWeeklyAvailability(${d.id}, 'AVAILABLE')">
          ❤️ Yes, I'm available
        </button>
        <button class="availability-btn ${d.weekly_availability === 'MAYBE' ? 'selected' : ''}" onclick="submitWeeklyAvailability(${d.id}, 'MAYBE')">
          Maybe, contact me first
        </button>
        <button class="availability-btn ${d.weekly_availability === 'UNAVAILABLE' ? 'selected' : ''}" onclick="submitWeeklyAvailability(${d.id}, 'UNAVAILABLE')">
          Not available this week
        </button>
      </div>
    </div>

    <!-- Medical Screening Status Card (WORKFLOW DEMO 3) -->
    <div class="card" style="border-left:4px solid ${d.screening_status === 'APPROVED' ? 'var(--status-green)' : 'var(--status-amber)'};">
      <div class="card-header">
        <h3 class="card-title">${Icons.shieldCheck(18, d.screening_status === 'APPROVED' ? '#059669' : '#d97706')} Hospital Screening Status</h3>
        <span class="status-badge ${getScreeningStatusClass(d.screening_status)}">${d.screening_status}</span>
      </div>

      ${d.screening_status === 'PENDING SCREENING' ? `
        <div style="font-size:13px; color:var(--navy-slate); line-height:1.6;">
          Thank you for registering! Your profile is currently <strong>PENDING SCREENING</strong>. The blood centre staff will review your registration and schedule an initial medical fitness checkup.
        </div>
      ` : d.screening_status === 'APPOINTMENT SCHEDULED' ? `
        <div style="font-size:13px; color:var(--navy-slate); line-height:1.6;">
          Your screening appointment has been scheduled by hospital medical staff! Please review the appointment details below and bring a valid photo ID.
        </div>
      ` : d.screening_status === 'APPROVED' ? `
        <div style="font-size:13px; color:var(--navy-slate); line-height:1.6;">
          You are an <strong>APPROVED</strong> donor in the active network.
          ${d.screening_valid_until ? `<div style="font-size:12px; color:var(--text-muted); margin-top:4px;">Medical screening validity active until: <strong>${d.screening_valid_until}</strong></div>` : ''}
        </div>
      ` : `
        <div style="font-size:13px; color:var(--navy-slate); line-height:1.6;">
          Your current status is ${d.screening_status}. Please follow the advice of authorized clinical staff.
        </div>
      `}
    </div>

    <!-- Appointments & Notifications Grid -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <!-- Appointments -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${Icons.calendar(18)} Screening Appointments</h3>
        </div>
        ${data.appointments.length === 0 ? `
          <div style="font-size:12px; color:var(--text-muted); padding:20px; text-align:center;">No upcoming screening appointments scheduled.</div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${data.appointments.map(a => `
              <div style="background:var(--bg-subtle); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong style="font-size:13px;">${a.hospital_name}</strong>
                  <span class="status-badge ${a.status === 'COMPLETED' ? 'status-approved' : 'status-pending'}">${a.status}</span>
                </div>
                <div style="font-size:12px; color:var(--primary-red); font-weight:700; margin-top:4px;">
                  ${a.appointment_date} at ${a.appointment_time}
                </div>
                ${a.instructions ? `
                  <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">
                    Instructions: ${a.instructions}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <!-- Notifications -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${Icons.bell(18)} Hospital Alerts & Messages (${data.unreadCount} unread)</h3>
        </div>
        ${data.notifications.length === 0 ? `
          <div style="font-size:12px; color:var(--text-muted); padding:20px; text-align:center;">No notifications yet.</div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto;">
            ${data.notifications.map(n => `
              <div style="background:${n.is_read ? 'var(--bg-subtle)' : '#fff1f2'}; padding:10px; border-radius:var(--radius-sm); border:1px solid ${n.is_read ? 'var(--border-color)' : '#fca5a5'};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong style="font-size:12px; color:var(--navy-dark);">${n.title}</strong>
                  <span style="font-size:10px; color:var(--text-light);">${n.created_at.slice(0, 10)}</span>
                </div>
                <div style="font-size:11px; color:var(--navy-slate); margin-top:2px;">${n.message}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

async function submitWeeklyAvailability(donorId, status) {
  try {
    const res = await API.updateWeeklyAvailability(donorId, status);
    AppState.activeDonor.weekly_availability = status;
    showToast(`Weekly availability saved: ${status}`);
    renderApp();
  } catch (err) {
    showToast('Failed to update availability: ' + err.message, 'error');
  }
}

// ============================================================================
// MODAL WORKFLOWS (DEMO 1, 2, 3, 6, 7)
// ============================================================================

// DEMO 1: Donor Self-Registration
function openDonorRegisterModal() {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${Icons.bloodDrop(20, '#dc2626')} Donor Self-Registration
          </h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>
        <form onsubmit="handleDonorRegisterSubmit(event)">
          <div class="modal-body">
            <!-- Mandatory Healthcare Consent Disclaimer -->
            <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:var(--radius-sm); padding:12px; font-size:12px; color:#991b1b; line-height:1.5; margin-bottom:16px;">
              “Thank you for your willingness to help save lives. Registration does not mean you are medically approved to donate blood. Your eligibility will be assessed by authorised medical professionals.”
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <input type="text" name="fullName" class="form-control" required placeholder="e.g. Sameer Kapoor"/>
              </div>
              <div class="form-group">
                <label class="form-label">Date of Birth *</label>
                <input type="date" name="dob" class="form-control" required value="1998-05-15" onchange="calculateDonorAge(this)"/>
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-group">
                <label class="form-label">Age (Calculated)</label>
                <input type="number" id="regAgeField" name="age" class="form-control" readonly value="28"/>
              </div>
              <div class="form-group">
                <label class="form-label">Gender</label>
                <select name="gender" class="form-control">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Blood Group *</label>
                <select name="bloodGroup" class="form-control" required>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Mobile Number *</label>
                <input type="tel" name="mobile" class="form-control" required placeholder="+91 98200 11223"/>
              </div>
              <div class="form-group">
                <label class="form-label">Email Address</label>
                <input type="email" name="email" class="form-control" placeholder="sameer@example.com"/>
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-group">
                <label class="form-label">Address</label>
                <input type="text" name="address" class="form-control" placeholder="Apartment / Colony"/>
              </div>
              <div class="form-group">
                <label class="form-label">City</label>
                <input type="text" name="city" class="form-control" value="Mumbai"/>
              </div>
              <div class="form-group">
                <label class="form-label">PIN Code *</label>
                <input type="text" name="pincode" class="form-control" required value="400012"/>
              </div>
            </div>

            <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-top:8px;">
              <input type="checkbox" id="consentCheck" name="consentContact" checked required/>
              <label for="consentCheck" style="font-size:12px; color:var(--navy-slate);">
                I consent to be contacted by verified hospitals and blood centres for emergency requirements and screening appointments.
              </label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Complete Registration</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function calculateDonorAge(input) {
  const ageField = document.getElementById('regAgeField');
  if (!ageField || !input.value) return;
  const birthYear = new Date(input.value).getFullYear();
  if (!isNaN(birthYear)) {
    ageField.value = Math.max(18, Math.min(65, 2026 - birthYear));
  }
}

async function handleDonorRegisterSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await API.donorRegister(payload);
    closeModal();
    showToast(res.message);
    AppState.activeDonor = res.donor;
    AppState.currentView = 'donor';
    renderApp();
  } catch (err) {
    showToast('Registration error: ' + err.message, 'error');
  }
}

// DEMO 2: Excel / CSV Importer Modal
function openExcelImportModal() {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" style="max-width:760px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${Icons.fileSpreadsheet(20, '#059669')} Import Hospital Donor Records (Excel / CSV)
          </h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-body" id="excelModalBody">
          <div style="background:var(--bg-subtle); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:14px; margin-bottom:16px;">
            <div style="font-weight:700; font-size:13px;">Digitize Legacy Hospital Donor Spreadsheets</div>
            <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              Supports <code>.xlsx</code>, <code>.xls</code>, and <code>.csv</code>. Validates column headers, detects duplicate mobile records, and saves imported donors as <strong>PENDING VERIFICATION</strong>.
            </p>
            <div style="margin-top:10px;">
              <a href="${API.downloadExcelTemplateUrl('xlsx')}" class="btn btn-secondary btn-sm" download>
                ${Icons.download(14)} Download Standard Template (.xlsx)
              </a>
            </div>
          </div>

          <div style="border:2px dashed var(--border-color); border-radius:var(--radius-md); padding:28px; text-align:center; background:#ffffff;" id="dropZone">
            ${Icons.upload(32, '#64748b')}
            <div style="font-size:14px; font-weight:700; margin-top:8px;">Select or Drag & Drop Spreadsheet</div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Supported formats: .xlsx, .xls, .csv</div>
            <input type="file" id="excelFileInput" accept=".xlsx, .xls, .csv" style="display:none;" onchange="handleExcelFileSelected(this)"/>
            <button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="document.getElementById('excelFileInput').click()">
              Browse File
            </button>
          </div>

          <div id="excelPreviewSection" style="margin-top:16px;"></div>
        </div>
      </div>
    </div>
  `;
}

async function handleExcelFileSelected(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];

  const preview = document.getElementById('excelPreviewSection');
  if (preview) {
    preview.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted);">Reading file and validating columns...</div>`;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await API.uploadExcelPreview(formData);
    renderExcelAnalysisPreview(res.analysis);
  } catch (err) {
    if (preview) {
      preview.innerHTML = `<div style="color:var(--status-red); padding:10px;">Upload failed: ${err.message}</div>`;
    }
  }
}

function renderExcelAnalysisPreview(a) {
  const preview = document.getElementById('excelPreviewSection');
  if (!preview) return;

  window.lastExcelValidRows = a.validRows;
  window.lastExcelInvalidRows = [...a.invalidRows, ...a.duplicateRows];

  preview.innerHTML = `
    <!-- Summary Metrics -->
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:14px;">
      <div style="background:var(--bg-subtle); padding:10px; border-radius:var(--radius-sm); text-align:center;">
        <div style="font-size:11px; color:var(--text-muted);">Total Rows</div>
        <div style="font-size:18px; font-weight:800;">${a.totalRows}</div>
      </div>
      <div style="background:#f0fdf4; padding:10px; border-radius:var(--radius-sm); text-align:center; border:1px solid #bbf7d0;">
        <div style="font-size:11px; color:#166534;">Valid Donors</div>
        <div style="font-size:18px; font-weight:800; color:#166534;">${a.validCount}</div>
      </div>
      <div style="background:#fef3c7; padding:10px; border-radius:var(--radius-sm); text-align:center; border:1px solid #fde68a;">
        <div style="font-size:11px; color:#92400e;">Duplicates</div>
        <div style="font-size:18px; font-weight:800; color:#92400e;">${a.duplicateCount}</div>
      </div>
      <div style="background:#fff1f2; padding:10px; border-radius:var(--radius-sm); text-align:center; border:1px solid #fecdd3;">
        <div style="font-size:11px; color:#991b1b;">Invalid Rows</div>
        <div style="font-size:18px; font-weight:800; color:#991b1b;">${a.invalidCount}</div>
      </div>
    </div>

    <!-- Valid Rows Preview Table -->
    <div style="font-size:12px; font-weight:700; margin-bottom:6px;">Valid Donors Ready for Import:</div>
    <div class="table-responsive" style="max-height:160px; overflow-y:auto; margin-bottom:14px;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Row</th>
            <th>Name</th>
            <th>Mobile</th>
            <th>Blood Group</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          ${a.validRows.slice(0, 5).map(r => `
            <tr>
              <td>#${r.rowNumber}</td>
              <td>${r.fullName}</td>
              <td>${r.mobile}</td>
              <td><span class="blood-badge" style="width:24px; height:24px; font-size:10px;">${r.bloodGroup}</span></td>
              <td>${r.city} (${r.pincode})</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Action Bar -->
    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px solid var(--border-color);">
      <div>
        ${a.invalidCount > 0 || a.duplicateCount > 0 ? `
          <button class="btn btn-secondary btn-sm" onclick="downloadImportErrorReport()">
            ${Icons.download(14)} Download Error Report
          </button>
        ` : ''}
      </div>
      <button class="btn btn-primary" onclick="confirmExcelImportExecution()">
        Confirm & Save ${a.validCount} Valid Records
      </button>
    </div>
  `;
}

async function confirmExcelImportExecution() {
  if (!window.lastExcelValidRows || window.lastExcelValidRows.length === 0) {
    showToast('No valid rows to import.');
    return;
  }

  try {
    const res = await API.confirmExcelImport(window.lastExcelValidRows, AppState.activeHospital.id);
    closeModal();
    showToast(res.message);
    loadHospitalDashboard();
  } catch (err) {
    showToast('Import confirmation failed: ' + err.message, 'error');
  }
}

async function downloadImportErrorReport() {
  if (!window.lastExcelInvalidRows || window.lastExcelInvalidRows.length === 0) return;
  try {
    const res = await fetch('/api/hospital/excel/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalidRows: window.lastExcelInvalidRows })
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RaktSetu_Import_Errors.xlsx';
    a.click();
  } catch (err) {
    showToast('Failed to download error report', 'error');
  }
}

// DEMO 3: Schedule Screening Modal
function openScheduleScreeningModal(donorId, donorName) {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${Icons.calendar(18)} Schedule Screening Appointment
          </h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>
        <form onsubmit="handleScheduleScreeningSubmit(event, ${donorId})">
          <div class="modal-body">
            <div style="font-size:13px; margin-bottom:16px;">
              Scheduling medical checkup for: <strong>${donorName}</strong>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Appointment Date *</label>
                <input type="date" name="appointmentDate" class="form-control" required value="2026-11-20"/>
              </div>
              <div class="form-group">
                <label class="form-label">Appointment Time *</label>
                <input type="text" name="appointmentTime" class="form-control" required value="10:30 AM"/>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Hospital Instructions</label>
              <textarea name="instructions" class="form-control" rows="3">Please carry a government photo ID and hydrate well prior to donor hemoglobin screening.</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Confirm Appointment</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleScheduleScreeningSubmit(e, donorId) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = {
    donorId,
    hospitalId: AppState.activeHospital.id,
    appointmentDate: formData.get('appointmentDate'),
    appointmentTime: formData.get('appointmentTime'),
    instructions: formData.get('instructions')
  };

  try {
    const res = await API.scheduleScreening(payload);
    closeModal();
    showToast(res.message);
    loadHospitalDashboard();
  } catch (err) {
    showToast('Failed to schedule screening: ' + err.message, 'error');
  }
}

// DEMO 3: Record Screening Decision Modal (Approve / Defer / Reject)
function openRecordDecisionModal(donorId, donorName) {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${Icons.shieldCheck(18, '#059669')} Medical Screening Outcome Decision
          </h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>
        <form onsubmit="handleScreeningDecisionSubmit(event, ${donorId})">
          <div class="modal-body">
            <div style="font-size:13px; margin-bottom:16px;">
              Clinical evaluation for donor: <strong>${donorName}</strong>
            </div>

            <div class="form-group">
              <label class="form-label">Medical Decision Outcome *</label>
              <select name="status" class="form-control" required id="decisionSelect" onchange="toggleDeferralFields(this)">
                <option value="APPROVED">APPROVED (Fit for Blood Donation)</option>
                <option value="TEMPORARILY DEFERRED">TEMPORARILY DEFERRED (Clinical Delay)</option>
                <option value="NOT APPROVED">NOT APPROVED (Ineligible)</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Attending Medical Officer Name</label>
              <input type="text" name="staffName" class="form-control" value="Dr. Rajiv Mehta (Chief Transfusion Officer)"/>
            </div>

            <div class="form-group">
              <label class="form-label">Staff Clinical Notes</label>
              <textarea name="staffNotes" class="form-control" rows="2">Hb: 13.8 g/dL, BP: 120/80 mmHg, pulse 72. Fit for voluntary donation.</textarea>
            </div>

            <div id="deferralFields" style="display:none;">
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label">Deferral Reason</label>
                  <input type="text" name="deferralReason" class="form-control" placeholder="e.g. Recent dental extraction / low Hb"/>
                </div>
                <div class="form-group">
                  <label class="form-label">Next Eligible Review Date</label>
                  <input type="date" name="nextEligibleDate" class="form-control" value="2026-12-01"/>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Decision</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function toggleDeferralFields(select) {
  const f = document.getElementById('deferralFields');
  if (f) {
    f.style.display = select.value === 'TEMPORARILY DEFERRED' ? 'block' : 'none';
  }
}

async function handleScreeningDecisionSubmit(e, donorId) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = {
    donorId,
    hospitalId: AppState.activeHospital.id,
    status: formData.get('status'),
    staffName: formData.get('staffName'),
    staffNotes: formData.get('staffNotes'),
    deferralReason: formData.get('deferralReason'),
    nextEligibleDate: formData.get('nextEligibleDate')
  };

  try {
    const res = await API.recordScreeningDecision(payload);
    closeModal();
    showToast(res.message);
    loadHospitalDashboard();
  } catch (err) {
    showToast('Failed to record decision: ' + err.message, 'error');
  }
}

// Manual Donor Modal
function openAddManualDonorModal() {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800;">Add Donor to Hospital Registry</h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>
        <form onsubmit="handleManualDonorSubmit(event)">
          <div class="modal-body">
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Full Name *</label>
                <input type="text" name="fullName" class="form-control" required/>
              </div>
              <div class="form-group">
                <label class="form-label">Mobile Number *</label>
                <input type="tel" name="mobile" class="form-control" required/>
              </div>
            </div>
            <div class="form-grid-3">
              <div class="form-group">
                <label class="form-label">Blood Group *</label>
                <select name="bloodGroup" class="form-control" required>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">City</label>
                <input type="text" name="city" class="form-control" value="Mumbai"/>
              </div>
              <div class="form-group">
                <label class="form-label">PIN Code</label>
                <input type="text" name="pincode" class="form-control" value="400012"/>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Donor Record</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleManualDonorSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await API.addDonorManual(payload);
    closeModal();
    showToast(res.message);
    loadHospitalDashboard();
  } catch (err) {
    showToast('Failed to save donor: ' + err.message, 'error');
  }
}

// DEMO 7: Add Stock Modal
function openAddStockModal() {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800;">Add Blood Stock to Inventory</h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>
        <form onsubmit="handleAddStockSubmit(event)">
          <div class="modal-body">
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Blood Group *</label>
                <select name="bloodGroup" class="form-control" required>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Component *</label>
                <select name="component" class="form-control" required>
                  <option value="Packed Red Blood Cells (PRBC)">Packed Red Blood Cells (PRBC - 42d)</option>
                  <option value="Platelets">Platelets (5d shelf life)</option>
                  <option value="Whole Blood">Whole Blood (35d)</option>
                  <option value="Plasma">Plasma (365d)</option>
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Quantity Units *</label>
                <input type="number" name="quantityUnits" class="form-control" required value="2" min="1"/>
              </div>
              <div class="form-group">
                <label class="form-label">Collection Date</label>
                <input type="date" name="collectionDate" class="form-control" value="2026-11-16"/>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Storage Compartment</label>
              <input type="text" name="storageLocation" class="form-control" value="Refrigerator B1 (Shelf 2)"/>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Add to Inventory</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleAddStockSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = {
    hospitalId: AppState.activeHospital.id,
    bloodGroup: formData.get('bloodGroup'),
    component: formData.get('component'),
    quantityUnits: formData.get('quantityUnits'),
    collectionDate: formData.get('collectionDate'),
    storageLocation: formData.get('storageLocation')
  };

  try {
    const res = await API.addInventoryStock(payload);
    closeModal();
    showToast(res.message);
    loadHospitalDashboard();
  } catch (err) {
    showToast('Failed to add stock: ' + err.message, 'error');
  }
}

// Issue Stock Modal
function openIssueStockModal(invId, code, bg, comp, maxQty) {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800;">Issue Blood Units for Transfusion</h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>
        <form onsubmit="handleIssueStockSubmit(event, ${invId})">
          <div class="modal-body">
            <div style="font-size:13px; margin-bottom:14px;">
              Issuing from batch <code>${code}</code> (${bg} ${comp}). Available: <strong>${maxQty} units</strong>
            </div>
            <div class="form-group">
              <label class="form-label">Units to Issue *</label>
              <input type="number" name="quantity" class="form-control" required value="1" min="1" max="${maxQty}"/>
            </div>
            <div class="form-group">
              <label class="form-label">Patient / Ward Clinical Reason</label>
              <input type="text" name="reason" class="form-control" value="Emergency ICU patient surgery cross-match"/>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Authorize Issue</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleIssueStockSubmit(e, invId) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = {
    inventoryId: invId,
    quantity: formData.get('quantity'),
    reason: formData.get('reason'),
    hospitalId: AppState.activeHospital.id
  };

  try {
    const res = await API.issueInventoryUnits(payload);
    closeModal();
    showToast(res.message);
    loadHospitalDashboard();
  } catch (err) {
    showToast('Failed to issue units: ' + err.message, 'error');
  }
}

// Create Urgent Request Modal (DEMO 6)
function openCreateRequestModal() {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${Icons.alertTriangle(18, '#dc2626')} Submit Urgent Blood Request
          </h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>
        <form onsubmit="handleCreateRequestSubmit(event)">
          <div class="modal-body">
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Required Blood Group *</label>
                <select name="bloodGroup" class="form-control" required>
                  <option value="O-">O- (Universal RBC)</option>
                  <option value="O+">O+</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Component *</label>
                <select name="component" class="form-control" required>
                  <option value="Packed Red Blood Cells (PRBC)">Packed Red Blood Cells (PRBC)</option>
                  <option value="Platelets">Platelets</option>
                  <option value="Whole Blood">Whole Blood</option>
                  <option value="Plasma">Plasma</option>
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Quantity Needed (Units) *</label>
                <input type="number" name="quantityNeeded" class="form-control" required value="2" min="1"/>
              </div>
              <div class="form-group">
                <label class="form-label">Urgency Level *</label>
                <select name="urgency" class="form-control" required>
                  <option value="CRITICAL">CRITICAL (Immediate Transfusion)</option>
                  <option value="URGENT">URGENT (Within 12 Hours)</option>
                  <option value="ROUTINE">ROUTINE (Scheduled Procedure)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Required By Deadline</label>
              <input type="text" name="requiredBy" class="form-control" value="Today by 18:00 hrs"/>
            </div>

            <div class="form-group">
              <label class="form-label">Clinical Situation / Diagnosis Notes</label>
              <textarea name="notes" class="form-control" rows="2">Emergency vehicular trauma with acute internal hemorrhage in ICU.</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Submit & Start Smart Matching</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleCreateRequestSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = {
    hospitalId: AppState.activeHospital.id,
    bloodGroup: formData.get('bloodGroup'),
    component: formData.get('component'),
    quantityNeeded: formData.get('quantityNeeded'),
    urgency: formData.get('urgency'),
    requiredBy: formData.get('requiredBy'),
    notes: formData.get('notes')
  };

  try {
    const res = await API.createBloodRequest(payload);
    closeModal();
    showToast(res.message);
    AppState.currentHospitalTab = 'requests';
    renderApp();
    setTimeout(() => {
      triggerSmartMatchingForRequest(res.request.id);
    }, 200);
  } catch (err) {
    showToast('Failed to create request: ' + err.message, 'error');
  }
}

// Simulated Weekly Push Notification Banner (WORKFLOW DEMO 4)
function triggerSimulatedWeeklyPush() {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" style="max-width:440px; border-radius:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
        <!-- Simulated Mobile Lockscreen Push Card -->
        <div style="background:#0f172a; color:#ffffff; padding:16px 20px; border-top-left-radius:24px; border-top-right-radius:24px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            ${Icons.bloodDrop(18, '#dc2626')}
            <span style="font-size:12px; font-weight:700;">RAKTSETU • MOBILE PUSH NOTIFICATION</span>
          </div>
          <span style="font-size:11px; color:#94a3b8;">now</span>
        </div>

        <div style="padding:24px; background:#ffffff;">
          <div style="font-size:18px; font-weight:800; color:var(--navy-dark); margin-bottom:8px;">
            A little check-in! ❤️
          </div>
          <p style="font-size:14px; color:#475569; line-height:1.5;">
            "Will you be available to help save a life next week? Tap to update your availability. 🩸"
          </p>

          <div style="margin-top:20px; display:flex; flex-direction:column; gap:8px;">
            <button class="availability-btn" style="border-color:#fda4af; padding:10px;" onclick="handleNotificationChoice('AVAILABLE')">
              ❤️ Yes, I'm available
            </button>
            <button class="availability-btn" style="border-color:#cbd5e1; padding:10px;" onclick="handleNotificationChoice('MAYBE')">
              Maybe, contact me first
            </button>
            <button class="availability-btn" style="border-color:#cbd5e1; padding:10px;" onclick="handleNotificationChoice('UNAVAILABLE')">
              Not available this week
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function handleNotificationChoice(choice) {
  closeModal();
  if (!AppState.activeDonor) {
    showToast('Switched to donor response: ' + choice);
    return;
  }
  await submitWeeklyAvailability(AppState.activeDonor.id, choice);
}

function closeModal(event) {
  if (event) event.stopPropagation();
  const container = document.getElementById('modalContainer');
  if (container) container.innerHTML = '';
}
