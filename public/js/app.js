/**
 * RaktSetu — Main Application Controller & Reactive UI
 * Secure Donor Registration, Hospital Approval, Account Activation & Auth System
 */

const AppState = {
  currentView: 'landing', // 'landing', 'donor-login', 'hospital-login', 'track-status', 'hospital', 'donor'
  currentHospitalTab: 'dashboard', // 'dashboard', 'applications', 'donors', 'inventory', 'requests', 'ai'
  activeHospital: null,
  activeDonor: null,
  userType: 'PUBLIC', // 'PUBLIC', 'DONOR', 'HOSPITAL'
  demoAccounts: { hospitals: [], donors: [], demoApplications: [] },
  activeModal: null,
  selectedDonorForAction: null,
  selectedRequestForAction: null,
  activeMatchingResults: null,
  activationData: { applicationId: '', mobile: '', otp: '' }
};

// ============================================================================
// INITIALIZATION & SESSION RESTORATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  await restoreAuthSession();
  await loadDemoAccounts();
  renderApp();
});

async function restoreAuthSession() {
  try {
    const session = await API.getAuthSession();
    if (session && session.authenticated) {
      AppState.userType = session.userType;
      if (session.userType === 'DONOR') {
        AppState.activeDonor = session.user;
        AppState.currentView = 'donor';
      } else if (session.userType === 'HOSPITAL') {
        AppState.activeHospital = session.user;
        AppState.currentView = 'hospital';
      }
    } else {
      AppState.userType = 'PUBLIC';
      AppState.activeDonor = null;
      AppState.activeHospital = null;
    }
  } catch (err) {
    console.error('Failed to restore auth session:', err);
    AppState.userType = 'PUBLIC';
  }
}

async function loadDemoAccounts() {
  try {
    const data = await API.getDemoAccounts();
    AppState.demoAccounts = data;
  } catch (err) {
    console.error('Failed to load demo accounts metadata', err);
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
  setTimeout(() => toast.remove(), 4500);
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
        <span>Secure Donor Onboarding & Auth Demonstration</span>
      </div>
      <div class="demo-shortcuts">
        <span style="color:#94a3b8; margin-right:4px;">Evaluation Shortcuts:</span>
        <button class="demo-btn" onclick="demoLoginHospital(1)">🏥 Login Metro</button>
        <button class="demo-btn" onclick="demoLoginDonor(1)">🩸 Login Rahul</button>
        <button class="demo-btn" style="background:#0f766e;" onclick="openAdminPortalModal()">🏛️ Admin Review</button>
        <button class="demo-btn" style="background:#2563eb;" onclick="openHospitalRegisterModal()">+ Register Hospital</button>
        <button class="demo-btn" style="background:#0284c7;" onclick="openHospitalActivationModal('sunrise.blood@demo.org')">⚡ Hospital Activation</button>
        <button class="demo-btn" onclick="navigateTo('track-status')">📋 Track Status</button>
        <button class="demo-btn" style="background:#7c3aed;" onclick="openActivationModal('DEMO-APP-APPROVED', '9811144455')">🚀 Donor Activation</button>
        <button class="demo-btn" onclick="openDonorRegisterModal()">+ Register Donor</button>
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

      ${AppState.userType === 'DONOR' && AppState.activeDonor ? `
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="user-badge" style="background:var(--primary-red-light); color:var(--primary-red); border:1px solid var(--primary-red-border);">
            <span class="blood-badge" style="width:22px; height:22px; font-size:10px;">${AppState.activeDonor.bloodGroup || '🩸'}</span>
            <span>${AppState.activeDonor.fullName || 'Donor'}</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="handleLogout()">
            ${Icons.logOut(15)} Logout
          </button>
        </div>
      ` : AppState.userType === 'HOSPITAL' && AppState.activeHospital ? `
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="user-badge" style="background:#f1f5f9; color:var(--navy-dark); border:1px solid var(--border-color);">
            ${Icons.hospital(14)}
            <span>${AppState.activeHospital.name}</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="handleLogout()">
            ${Icons.logOut(15)} Logout
          </button>
        </div>
      ` : AppState.userType === 'ADMIN' && AppState.adminUser ? `
        <div style="display:flex; align-items:center; gap:12px;">
          <div class="user-badge" style="background:#f0fdfa; color:#0f766e; border:1px solid #99f6e4;">
            ${Icons.shield(14, '#0f766e')}
            <span>${AppState.adminUser.fullName || 'Administrator'}</span>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="handleLogout()">
            ${Icons.logOut(15)} Logout
          </button>
        </div>
      ` : ''}
    </nav>

    <!-- Main View Container -->
    <main class="main-wrapper" id="mainView">
  `;

  if (AppState.currentView === 'landing') {
    html += renderLandingPage();
  } else if (AppState.currentView === 'donor-login') {
    html += renderDonorLoginPage();
  } else if (AppState.currentView === 'hospital-login') {
    html += renderHospitalLoginPage();
  } else if (AppState.currentView === 'track-status') {
    html += renderStatusTrackerPage();
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
  // Navigation Guards (Requirement 8 & 9)
  if (view === 'donor' && AppState.userType !== 'DONOR') {
    showToast('Please log in with your donor account to access the dashboard.');
    AppState.currentView = 'donor-login';
  } else if (view === 'hospital' && AppState.userType !== 'HOSPITAL') {
    showToast('Please log in with hospital credentials to access the hospital portal.');
    AppState.currentView = 'hospital-login';
  } else {
    AppState.currentView = view;
  }

  renderApp();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleLogout() {
  try {
    await API.logout();
    AppState.userType = 'PUBLIC';
    AppState.activeDonor = null;
    AppState.activeHospital = null;
    showToast('Logged out successfully.');
    navigateTo('landing');
  } catch (err) {
    showToast('Error logging out: ' + err.message, 'error');
  }
}

// Demo quick-logins for presentations
async function demoLoginHospital(hospitalId) {
  try {
    const email = hospitalId === 2 ? 'citylife.bank@raktsetu.org' : 'metro.bloodbank@raktsetu.org';
    const res = await API.hospitalLogin(email, 'hospital123');
    AppState.activeHospital = res.hospital;
    AppState.userType = 'HOSPITAL';
    AppState.currentView = 'hospital';
    renderApp();
    showToast(`Authenticated as ${res.hospital.name}`);
  } catch (err) {
    showToast('Hospital login failed: ' + err.message, 'error');
  }
}

async function demoLoginDonor(donorId) {
  try {
    const mobile = donorId === 2 ? '+91 98765 43211' : '+91 98765 43210';
    const res = await API.donorLogin(mobile, 'donor123');
    AppState.activeDonor = res.donor;
    AppState.userType = 'DONOR';
    AppState.currentView = 'donor';
    renderApp();
    showToast(`Authenticated as ${res.donor.fullName} (${res.donor.bloodGroup})`);
  } catch (err) {
    showToast('Donor login failed: ' + err.message, 'error');
  }
}

// ============================================================================
// 1. PUBLIC LANDING PAGE VIEW (Requirement 2)
// ============================================================================
function renderLandingPage() {
  return `
    <div class="landing-hero" style="background:#ffffff; border-radius:var(--radius-lg); padding:44px 36px; border:1px solid var(--border-color); margin-bottom:28px; box-shadow:var(--shadow-md);">
      <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:36px; align-items:center;">
        <div>
          <div style="display:inline-flex; align-items:center; gap:8px; padding:4px 12px; background:var(--primary-red-light); color:var(--primary-red); border-radius:9999px; font-weight:700; font-size:12px; margin-bottom:16px;">
            ${Icons.sparkles(16, '#dc2626')} VERIFIED HEALTHCARE BLOOD DONATION NETWORK
          </div>
          <h1 style="font-size:38px; font-weight:800; color:var(--navy-dark); line-height:1.2; margin-bottom:16px;">
            Connecting Blood Needs with the Right Donors.
          </h1>
          <p style="font-size:16px; color:var(--text-muted); line-height:1.6; margin-bottom:24px;">
            An intelligent platform helping hospitals coordinate potential donors, monitor blood inventory, anticipate critical shortages using machine learning, and bridge emergency demand.
          </p>
          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <button class="btn btn-primary btn-lg" onclick="navigateTo('donor-login')">
              ${Icons.user(18)} Donor Portal Login
            </button>
            <button class="btn btn-secondary btn-lg" onclick="navigateTo('hospital-login')">
              ${Icons.hospital(18)} Hospital Portal Login
            </button>
            <button class="btn btn-secondary btn-lg" style="color:var(--primary-red); border-color:var(--primary-red);" onclick="openDonorRegisterModal()">
              ${Icons.bloodDrop(18)} Register as a Donor
            </button>
          </div>
          <div style="margin-top:20px; font-size:12px; color:var(--text-light); display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
            <span>✓ Verified Hospital Approval</span>
            <span>✓ Secure Password-Protected Accounts</span>
            <span>✓ Genuine ML Demand Forecasting</span>
          </div>
        </div>

        <!-- Healthcare Bridge Visual Motif -->
        <div style="background:var(--bg-subtle); border-radius:var(--radius-lg); padding:24px; border:1px solid var(--border-color); text-align:center;">
          <div style="position:relative; width:100%; height:180px; display:flex; align-items:center; justify-content:space-around;">
            <div style="background:#ffffff; border:2px solid var(--border-color); border-radius:var(--radius-md); padding:14px; box-shadow:var(--shadow-sm); z-index:2;">
              ${Icons.hospital(32, '#0f172a')}
              <div style="font-size:12px; font-weight:700; margin-top:4px;">Hospitals</div>
              <div style="font-size:10px; color:var(--text-muted);">Review & Needs</div>
            </div>

            <div style="background:var(--primary-red-light); border:2px dashed var(--blood-accent); border-radius:50%; width:76px; height:76px; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:2; box-shadow:0 0 15px rgba(220,38,38,0.2);">
              ${Icons.bloodDrop(26, '#dc2626')}
              <span style="font-size:9px; font-weight:800; color:var(--primary-red);">RAKTSETU</span>
            </div>

            <div style="background:#ffffff; border:2px solid var(--border-color); border-radius:var(--radius-md); padding:14px; box-shadow:var(--shadow-sm); z-index:2;">
              ${Icons.users(32, '#dc2626')}
              <div style="font-size:12px; font-weight:700; margin-top:4px;">Donors</div>
              <div style="font-size:10px; color:var(--text-muted);">Verified Standby</div>
            </div>
          </div>
          <div style="background:#ffffff; border-radius:var(--radius-sm); padding:10px; margin-top:12px; font-size:12px; color:var(--navy-slate); font-weight:600; border:1px solid var(--border-color);">
            “Every Drop Matters. Every Connection Saves Lives.”
          </div>
        </div>
      </div>
    </div>

    <!-- Onboarding & Approval Instructions (Requirement 2 & 10) -->
    <div class="card" style="margin-bottom:28px;">
      <div class="card-header">
        <h2 class="card-title">${Icons.shieldCheck(20, '#059669')} Complete Donor Onboarding & Verification Workflow</h2>
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
        <div style="background:var(--bg-subtle); padding:16px; border-radius:var(--radius-sm); border-top:3px solid var(--navy-dark);">
          <div style="font-size:16px; font-weight:800; color:var(--navy-dark);">Step 1: Apply</div>
          <div style="font-weight:700; font-size:13px; margin:4px 0;">Submit Application</div>
          <p style="font-size:12px; color:var(--text-muted);">Fill the registration application. A unique Application ID is generated with status <strong>PENDING APPROVAL</strong>.</p>
        </div>
        <div style="background:var(--bg-subtle); padding:16px; border-radius:var(--radius-sm); border-top:3px solid var(--status-amber);">
          <div style="font-size:16px; font-weight:800; color:var(--status-amber);">Step 2: Verification</div>
          <div style="font-weight:700; font-size:13px; margin:4px 0;">Hospital Staff Review</div>
          <p style="font-size:12px; color:var(--text-muted);">Authorised hospital staff review your application details, verify jurisdiction, and approve your registration.</p>
        </div>
        <div style="background:var(--bg-subtle); padding:16px; border-radius:var(--radius-sm); border-top:3px solid #7c3aed);">
          <div style="font-size:16px; font-weight:800; color:#7c3aed;">Step 3: Activation</div>
          <div style="font-weight:700; font-size:13px; margin:4px 0;">Set Account Password</div>
          <p style="font-size:12px; color:var(--text-muted);">Once approved, verify using your OTP to create a secure password and activate your active donor login.</p>
        </div>
        <div style="background:var(--bg-subtle); padding:16px; border-radius:var(--radius-sm); border-top:3px solid var(--primary-red);">
          <div style="font-size:16px; font-weight:800; color:var(--primary-red);">Step 4: Clinical Fitness</div>
          <div style="font-weight:700; font-size:13px; margin:4px 0;">Pre-Donation Screening</div>
          <p style="font-size:12px; color:var(--text-muted);">Physical medical checkup (Hb, vitals, vein health) is scheduled by hospital medical staff before actual donation.</p>
        </div>
      </div>
    </div>

    <!-- AI & Product Principles -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div class="card">
        <h3 class="card-title" style="margin-bottom:12px;">
          ${Icons.sparkles(18, '#7c3aed')} AI & Machine Learning Features
        </h3>
        <ul style="font-size:13px; color:var(--navy-slate); line-height:1.7; padding-left:18px;">
          <li><strong>Demand Forecasting Model:</strong> Multivariate Ridge regularized time-series regression trained on 180 days of historical demand.</li>
          <li><strong>Explainable Shortage Risk:</strong> 7-day future projections comparing usable inventory against scheduled collections.</li>
          <li><strong>Intelligent Donor Prioritisation:</strong> Multi-criteria ranker combining component compatibility, rest intervals, and geodesic distance.</li>
        </ul>
      </div>

      <div class="card" style="border-left:4px solid var(--primary-red);">
        <h3 class="card-title" style="margin-bottom:12px; color:var(--primary-red);">
          ${Icons.shieldCheck(18, '#991b1b')} Important Healthcare Distinction
        </h3>
        <p style="font-size:13px; color:var(--navy-slate); line-height:1.6;">
          <strong>Registration Approval ≠ Medical Fitness:</strong> Approval of a registration application permits account activation and coordination. Only qualified clinical medical staff can determine physical fitness to donate blood.
        </p>
        <p style="font-size:12px; color:var(--text-muted); margin-top:8px;">
          RaktSetu is a decision-support aid and does not bypass blood compatibility cross-matching.
        </p>
      </div>
    </div>
  `;
}

// ============================================================================
// 2. DONOR LOGIN VIEW (Requirement 7)
// ============================================================================
function renderDonorLoginPage() {
  return `
    <div class="auth-wrapper" style="max-width:500px;">
      <div class="auth-card">
        <div style="text-align:center; margin-bottom:24px;">
          <div style="display:inline-block; margin-bottom:8px;">${Icons.bloodDrop(36, '#dc2626')}</div>
          <h2 style="font-size:22px; font-weight:800; color:var(--navy-dark);">Donor Portal Login</h2>
          <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">
            Sign in to update your weekly availability and view appointments.
          </p>
        </div>

        <form onsubmit="handleDonorLoginSubmit(event)" id="donorLoginForm">
          <div class="form-group">
            <label class="form-label">Registered Mobile Number or Email *</label>
            <input type="text" name="identifier" id="donorLoginIdentifier" class="form-control" required placeholder="+91 98765 43210 or email" />
          </div>

          <div class="form-group">
            <label class="form-label">Account Password *</label>
            <input type="password" name="password" id="donorLoginPassword" class="form-control" required placeholder="Enter your password" />
          </div>

          <div id="donorLoginError" style="display:none; background:#fff1f2; border:1px solid #fecdd3; border-radius:var(--radius-sm); padding:10px 12px; font-size:12px; color:#991b1b; margin-bottom:16px;"></div>

          <button type="submit" class="btn btn-primary btn-lg" style="width:100%; margin-top:8px;">
            Log In to Donor Portal
          </button>
        </form>

        <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border-color); font-size:13px; display:flex; flex-direction:column; gap:10px; text-align:center;">
          <div>
            Haven't registered yet?
            <a href="javascript:void(0)" onclick="openDonorRegisterModal()" style="color:var(--primary-red); font-weight:700; text-decoration:none; margin-left:4px;">
              Register to Be a Donor
            </a>
          </div>
          <div>
            Want to check your registration review status?
            <a href="javascript:void(0)" onclick="navigateTo('track-status')" style="color:var(--navy-dark); font-weight:700; text-decoration:none; margin-left:4px;">
              Track Registration Status →
            </a>
          </div>
        </div>

        <!-- Quick Demo Credentials Box for Evaluation -->
        <div class="demo-helper-box" style="margin-top:18px;">
          <div>💡 <strong>Demo Donor Login:</strong> Mobile: <code>+91 98765 43210</code> • Password: <code>donor123</code></div>
          <button type="button" class="btn btn-secondary btn-sm" onclick="fillDemoDonorCredentials()">
            Auto-Fill
          </button>
        </div>
      </div>
    </div>
  `;
}

function fillDemoDonorCredentials() {
  document.getElementById('donorLoginIdentifier').value = '+91 98765 43210';
  document.getElementById('donorLoginPassword').value = 'donor123';
}

async function handleDonorLoginSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const identifier = form.identifier.value.trim();
  const password = form.password.value;
  const errorBox = document.getElementById('donorLoginError');

  errorBox.style.display = 'none';

  try {
    const res = await API.donorLogin(identifier, password);
    AppState.activeDonor = res.donor;
    AppState.userType = 'DONOR';
    AppState.currentView = 'donor';
    showToast(`Welcome back, ${res.donor.fullName}!`);
    renderApp();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
  }
}

// ============================================================================
// 3. HOSPITAL LOGIN VIEW (Requirement 9)
// ============================================================================
function renderHospitalLoginPage() {
  return `
    <div class="auth-wrapper" style="max-width:520px;">
      <div class="auth-card">
        <div style="text-align:center; margin-bottom:24px;">
          <div style="display:inline-block; margin-bottom:8px;">${Icons.hospital(36, '#0f172a')}</div>
          <h2 style="font-size:22px; font-weight:800; color:var(--navy-dark);">Hospital Staff Portal</h2>
          <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">
            Authorized blood centre staff login for inventory, donor review & matching.
          </p>
        </div>

        <form onsubmit="handleHospitalLoginSubmit(event)">
          <div class="form-group">
            <label class="form-label">Official Hospital Email Address *</label>
            <input type="email" name="email" id="hospitalLoginEmail" class="form-control" required placeholder="metro.bloodbank@raktsetu.org" />
          </div>

          <div class="form-group">
            <label class="form-label">Staff Password *</label>
            <input type="password" name="password" id="hospitalLoginPassword" class="form-control" required placeholder="Enter hospital password" />
          </div>

          <div id="hospitalLoginError" style="display:none; background:#fff1f2; border:1px solid #fecdd3; border-radius:var(--radius-sm); padding:10px 12px; font-size:12px; color:#991b1b; margin-bottom:16px;"></div>

          <button type="submit" class="btn btn-primary btn-lg" style="width:100%; margin-top:8px;">
            Log In as Hospital Staff
          </button>
        </form>

        <div style="margin-top:20px; padding-top:16px; border-top:1px solid var(--border-color); text-align:center; font-size:13px;">
          <div>
            Need to onboard your healthcare facility?
            <a href="javascript:void(0)" onclick="openHospitalRegisterModal()" style="color:var(--primary-red); font-weight:700; text-decoration:none; margin-left:4px;">
              Register Your Hospital
            </a>
          </div>
        </div>

        <!-- Quick Demo Credentials Box for Evaluation -->
        <div class="demo-helper-box" style="margin-top:20px;">
          <div style="font-size:12px; font-weight:700; color:var(--navy-dark); margin-bottom:8px;">
            💡 Quick Demo Credentials for Evaluation:
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:6px;">
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;" onclick="fillDemoHosp('metro.bloodbank@raktsetu.org', 'hospital123')">
              🏥 Metro General (Active)
            </button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;" onclick="fillDemoHosp('citylife.bank@raktsetu.org', 'hospital123')">
              🏥 City Life (Active)
            </button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:11px; color:#ea580c;" onclick="fillDemoHosp('apex.hospital@demo.org', 'hospital123')">
              ⏳ Apex (Pending Approval)
            </button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:11px; color:#7c3aed;" onclick="fillDemoHosp('sunrise.blood@demo.org', 'hospital123')">
              ⚡ Sunrise (Approved, Inactive)
            </button>
            <button type="button" class="btn btn-secondary btn-sm" style="font-size:11px; color:#dc2626;" onclick="fillDemoHosp('greenvalley@demo.org', 'hospital123')">
              ❌ Green Valley (Rejected)
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function fillDemoHosp(email, pass) {
  const emailInput = document.getElementById('hospitalLoginEmail');
  const passInput = document.getElementById('hospitalLoginPassword');
  if (emailInput) emailInput.value = email;
  if (passInput) passInput.value = pass;
}

function fillDemoHospitalCredentials() {
  fillDemoHosp('metro.bloodbank@raktsetu.org', 'hospital123');
}

async function handleHospitalLoginSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  const errorBox = document.getElementById('hospitalLoginError');

  errorBox.style.display = 'none';

  try {
    const res = await API.hospitalLogin(email, password);
    AppState.activeHospital = res.hospital;
    AppState.userType = 'HOSPITAL';
    AppState.currentView = 'hospital';
    showToast(`Authenticated as ${res.hospital.name}`);
    renderApp();
  } catch (err) {
    let msg = err.message;
    if (msg.includes('NOT ACTIVATED') || msg.includes('APPROVED')) {
      errorBox.innerHTML = `
        ${msg}
        <div style="margin-top:8px;">
          <button type="button" class="btn btn-primary btn-sm" onclick="openHospitalActivationModal('${email}')">
            Activate Account Now
          </button>
        </div>
      `;
    } else {
      errorBox.textContent = msg;
    }
    errorBox.style.display = 'block';
  }
}

// ============================================================================
// 4. DONOR APPLICATION STATUS TRACKING VIEW (Requirement 4)
// ============================================================================
function renderStatusTrackerPage() {
  return `
    <div class="auth-wrapper" style="max-width:540px;">
      <div class="auth-card">
        <div style="text-align:center; margin-bottom:20px;">
          <h2 style="font-size:22px; font-weight:800; color:var(--navy-dark);">Check Registration Status</h2>
          <p style="font-size:13px; color:var(--text-muted); margin-top:4px;">
            Enter your Application ID and registered mobile number to check hospital verification status.
          </p>
        </div>

        <form onsubmit="handleCheckStatusSubmit(event)">
          <div class="form-group">
            <label class="form-label">Application ID *</label>
            <input type="text" id="trackAppIdInput" name="applicationId" class="form-control" required placeholder="e.g. DEMO-APP-PENDING or RS-APP-..." />
          </div>

          <div class="form-group">
            <label class="form-label">Registered Mobile Number *</label>
            <input type="tel" id="trackMobileInput" name="mobile" class="form-control" required placeholder="e.g. 9811122233" />
          </div>

          <button type="submit" class="btn btn-primary" style="width:100%; margin-top:6px;">
            Check Status
          </button>
        </form>

        <!-- Evaluation Quick Tests -->
        <div style="margin-top:16px; padding:12px; background:var(--bg-subtle); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
          <div style="font-size:11px; font-weight:700; color:var(--navy-slate); margin-bottom:8px;">QUICK DEMO SCENARIO TESTS:</div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="fillStatusTrackerDemo('DEMO-APP-PENDING', '9811122233')">
              ⏳ Check Pending Application (Vikram Joshi)
            </button>
            <button class="btn btn-secondary btn-sm" onclick="fillStatusTrackerDemo('DEMO-APP-APPROVED', '9811144455')">
              ✅ Check Approved Application (Divya Nair)
            </button>
            <button class="btn btn-secondary btn-sm" onclick="fillStatusTrackerDemo('DEMO-APP-REJECTED', '9811166677')">
              ❌ Check Rejected Application (Karan Singhal)
            </button>
          </div>
        </div>

        <!-- Result Container -->
        <div id="statusTrackerResult" style="margin-top:20px;"></div>

        <div style="margin-top:20px; text-align:center; padding-top:14px; border-top:1px solid var(--border-color);">
          <a href="javascript:void(0)" onclick="navigateTo('donor-login')" style="color:var(--navy-slate); font-size:13px; font-weight:600; text-decoration:none;">
            ← Return to Donor Login
          </a>
        </div>
      </div>
    </div>
  `;
}

function fillStatusTrackerDemo(appId, mobile) {
  document.getElementById('trackAppIdInput').value = appId;
  document.getElementById('trackMobileInput').value = mobile;
}

async function handleCheckStatusSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const appId = form.applicationId.value.trim();
  const mobile = form.mobile.value.trim();
  const resultContainer = document.getElementById('statusTrackerResult');

  resultContainer.innerHTML = `<div style="text-align:center; padding:16px; color:var(--text-muted);">Verifying registration records...</div>`;

  try {
    const data = await API.checkApplicationStatus(appId, mobile);
    renderStatusTrackerResult(data);
  } catch (err) {
    resultContainer.innerHTML = `
      <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:var(--radius-sm); padding:12px; font-size:12px; color:#991b1b;">
        ${err.message}
      </div>
    `;
  }
}

function renderStatusTrackerResult(data) {
  const container = document.getElementById('statusTrackerResult');
  if (!container) return;

  const isPending = data.status === 'PENDING_APPROVAL';
  const isApproved = data.status === 'APPROVED';
  const isRejected = data.status === 'REJECTED';

  container.innerHTML = `
    <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:18px; box-shadow:var(--shadow-sm);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-size:11px; font-weight:700; color:var(--text-muted);">APPLICATION ID</span>
        <strong style="font-size:13px; color:var(--navy-dark);">${data.applicationId}</strong>
      </div>

      <!-- Visual Progress Timeline -->
      <div class="status-timeline">
        <div class="timeline-step completed">
          <div class="step-circle">✓</div>
          <div class="step-label">Submitted</div>
          <div class="step-desc">${data.submittedAt ? data.submittedAt.slice(0, 10) : 'Done'}</div>
        </div>
        <div class="timeline-step ${isApproved ? 'completed' : isRejected ? 'rejected' : 'active'}">
          <div class="step-circle">${isApproved ? '✓' : isRejected ? '✕' : '⏳'}</div>
          <div class="step-label">Hospital Review</div>
          <div class="step-desc">${data.status}</div>
        </div>
        <div class="timeline-step ${data.isActivated ? 'completed' : isApproved ? 'active' : ''}">
          <div class="step-circle">${data.isActivated ? '✓' : '3'}</div>
          <div class="step-label">Account Activation</div>
          <div class="step-desc">${data.isActivated ? 'Active' : isApproved ? 'Ready' : 'Pending'}</div>
        </div>
      </div>

      <div style="margin-top:14px; padding:12px; background:${isApproved ? '#f0fdf4' : isRejected ? '#fff1f2' : 'var(--bg-subtle)'}; border:1px solid ${isApproved ? '#bbf7d0' : isRejected ? '#fecdd3' : 'var(--border-color)'}; border-radius:var(--radius-sm);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="font-size:13px; color:var(--navy-dark);">${data.applicantName} (${data.bloodGroup})</strong>
          <span class="status-badge ${data.statusBadgeClass}">${data.status}</span>
        </div>
        <p style="font-size:12px; color:var(--navy-slate); line-height:1.5;">${data.statusMessage}</p>

        ${isRejected && data.rejectionReason ? `
          <div style="margin-top:6px; font-size:11px; color:#991b1b; font-weight:600;">
            Reason: ${data.rejectionReason}
          </div>
        ` : ''}

        ${data.reviewedByStaffName ? `
          <div style="font-size:11px; color:var(--text-muted); margin-top:6px;">
            Reviewed by: ${data.reviewedByStaffName} ${data.reviewedAt ? `on ${data.reviewedAt.slice(0, 10)}` : ''}
          </div>
        ` : ''}
      </div>

      ${data.canActivate ? `
        <div style="margin-top:16px;">
          <button class="btn btn-primary" style="width:100%;" onclick="openActivationModal('${data.applicationId}', '${data.maskedMobile}')">
            ${Icons.sparkles(16, '#ffffff')} Activate My Account Now
          </button>
        </div>
      ` : data.isActivated ? `
        <div style="margin-top:16px;">
          <button class="btn btn-secondary" style="width:100%;" onclick="navigateTo('donor-login')">
            Proceed to Donor Login →
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================================================
// 5. FIRST-TIME ACCOUNT ACTIVATION MODAL (Requirement 6)
// ============================================================================
function openActivationModal(defaultAppId = '', defaultMobile = '') {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" style="max-width:520px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${Icons.sparkles(18, '#7c3aed')} First-Time Donor Account Activation
          </h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>

        <div class="modal-body" id="activationModalBody">
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
            Enter your approved Application ID and registered mobile number to verify your identity and set your account password.
          </p>

          <form onsubmit="handleActivationCodeRequest(event)">
            <div class="form-group">
              <label class="form-label">Application ID *</label>
              <input type="text" id="actAppId" class="form-control" required value="${defaultAppId}" placeholder="e.g. DEMO-APP-APPROVED" />
            </div>

            <div class="form-group">
              <label class="form-label">Registered Mobile Number *</label>
              <input type="tel" id="actMobile" class="form-control" required value="${defaultMobile}" placeholder="e.g. 9811144455" />
            </div>

            <div id="actRequestError" style="display:none; background:#fff1f2; border:1px solid #fecdd3; border-radius:var(--radius-sm); padding:10px; font-size:12px; color:#991b1b; margin-bottom:12px;"></div>

            <button type="submit" class="btn btn-primary" style="width:100%;">
              Send Verification Code / OTP
            </button>
          </form>

          <div id="activationStep2Section" style="margin-top:20px; display:none;"></div>
        </div>
      </div>
    </div>
  `;
}

async function handleActivationCodeRequest(e) {
  e.preventDefault();
  const appId = document.getElementById('actAppId').value.trim();
  const mobile = document.getElementById('actMobile').value.trim();
  const errorBox = document.getElementById('actRequestError');
  const step2 = document.getElementById('activationStep2Section');

  errorBox.style.display = 'none';

  try {
    const res = await API.requestActivationCode(appId, mobile);
    AppState.activationData = { applicationId: appId, mobile, otp: res.demoActivationOtp };
    renderActivationStep2(res);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
  }
}

function renderActivationStep2(res) {
  const step2 = document.getElementById('activationStep2Section');
  if (!step2) return;

  step2.style.display = 'block';
  step2.innerHTML = `
    <div style="border-top:2px dashed var(--border-color); padding-top:16px;">
      <!-- Clearly labeled demo verification notice -->
      <div style="background:#fef3c7; border:1px solid #fcd34d; border-radius:var(--radius-sm); padding:10px 12px; font-size:12px; color:#92400e; margin-bottom:14px;">
        <strong>${res.demoOtpNotice}</strong><br/>
        Simulated 6-digit OTP code for testing: <strong style="font-size:15px; letter-spacing:2px; color:var(--navy-dark);">${res.demoActivationOtp}</strong>
      </div>

      <form onsubmit="handleFinalAccountActivation(event)">
        <div class="form-group">
          <label class="form-label">6-Digit Verification Code (OTP) *</label>
          <input type="text" id="actOtpCode" class="form-control" required value="${res.demoActivationOtp || ''}" placeholder="Enter 6-digit OTP" />
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Create Password (min 6 chars) *</label>
            <input type="password" id="actNewPass" class="form-control" required placeholder="Choose a password" />
          </div>
          <div class="form-group">
            <label class="form-label">Confirm Password *</label>
            <input type="password" id="actConfirmPass" class="form-control" required placeholder="Confirm password" />
          </div>
        </div>

        <div id="actFinalError" style="display:none; background:#fff1f2; border:1px solid #fecdd3; border-radius:var(--radius-sm); padding:10px; font-size:12px; color:#991b1b; margin-bottom:12px;"></div>

        <button type="submit" class="btn btn-success" style="width:100%;">
          Complete Activation & Create Account
        </button>
      </form>
    </div>
  `;
}

async function handleFinalAccountActivation(e) {
  e.preventDefault();
  const otp = document.getElementById('actOtpCode').value.trim();
  const password = document.getElementById('actNewPass').value;
  const confirmPassword = document.getElementById('actConfirmPass').value;
  const errorBox = document.getElementById('actFinalError');

  errorBox.style.display = 'none';

  if (password.length < 6) {
    errorBox.textContent = 'Password must be at least 6 characters.';
    errorBox.style.display = 'block';
    return;
  }

  if (password !== confirmPassword) {
    errorBox.textContent = 'Passwords do not match.';
    errorBox.style.display = 'block';
    return;
  }

  try {
    const res = await API.activateDonorAccount({
      applicationId: AppState.activationData.applicationId,
      mobile: AppState.activationData.mobile,
      activationCode: otp,
      password,
      confirmPassword
    });

    closeModal();
    showToast(res.message);
    navigateTo('donor-login');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
  }
}

// ============================================================================
// 5B. HOSPITAL REGISTRATION MODAL (Requirement 2)
// ============================================================================
function openHospitalRegisterModal() {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" style="max-width:640px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${Icons.hospital(20, '#0284c7')} Register Your Hospital or Blood Centre
          </h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>

        <form onsubmit="handleHospitalRegisterSubmit(event)">
          <div class="modal-body">
            <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:var(--radius-sm); padding:12px; font-size:12px; color:#1e40af; line-height:1.5; margin-bottom:16px;">
              “Hospital facilities and blood banks must be verified and approved by a RaktSetu platform administrator before account activation and dashboard access are granted.”
            </div>

            <div class="form-group">
              <label class="form-label">Hospital / Blood Centre Official Name *</label>
              <input type="text" name="name" id="regHospName" class="form-control" required placeholder="e.g. Lilavati Hospital & Research Centre" />
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Official Email Address *</label>
                <input type="email" name="email" id="regHospEmail" class="form-control" required placeholder="bloodbank@lilavati.org" />
              </div>
              <div class="form-group">
                <label class="form-label">Official Contact Number *</label>
                <input type="tel" name="phone" id="regHospPhone" class="form-control" required placeholder="+91 98200 12345" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Complete Facility Address *</label>
              <input type="text" name="address" id="regHospAddress" class="form-control" required placeholder="A-791, Bandra Reclamation, Bandra West" />
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">City *</label>
                <input type="text" name="city" id="regHospCity" class="form-control" required value="Mumbai" />
              </div>
              <div class="form-group">
                <label class="form-label">PIN Code *</label>
                <input type="text" name="pincode" id="regHospPincode" class="form-control" required placeholder="400050" />
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label">Staff Password *</label>
                <input type="password" name="password" id="regHospPass" class="form-control" required placeholder="Min 6 characters" />
              </div>
              <div class="form-group">
                <label class="form-label">Confirm Password *</label>
                <input type="password" name="confirmPassword" id="regHospConfirmPass" class="form-control" required placeholder="Re-enter password" />
              </div>
            </div>

            <div id="hospRegError" style="display:none; background:#fff1f2; border:1px solid #fecdd3; border-radius:var(--radius-sm); padding:10px; font-size:12px; color:#991b1b; margin-top:8px;"></div>
          </div>

          <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="fillDemoHospitalRegistration()">
              Auto-Fill Sample Data
            </button>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btnSubmitHospReg">Submit Application</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}

function fillDemoHospitalRegistration() {
  const rand = Math.floor(100 + Math.random() * 900);
  document.getElementById('regHospName').value = `Fortis Memorial Blood Centre ${rand}`;
  document.getElementById('regHospEmail').value = `fortis.centre${rand}@raktsetu.org`;
  document.getElementById('regHospPhone').value = `+91 98200 ${rand}11`;
  document.getElementById('regHospAddress').value = `Mulund Goregaon Link Road, Mulund West`;
  document.getElementById('regHospCity').value = 'Mumbai';
  document.getElementById('regHospPincode').value = '400080';
  document.getElementById('regHospPass').value = 'hospital123';
  document.getElementById('regHospConfirmPass').value = 'hospital123';
}

async function handleHospitalRegisterSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const errorBox = document.getElementById('hospRegError');
  const btn = document.getElementById('btnSubmitHospReg');

  errorBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const payload = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    address: form.address.value.trim(),
    city: form.city.value.trim(),
    pincode: form.pincode.value.trim(),
    password: form.password.value,
    confirmPassword: form.confirmPassword.value
  };

  try {
    const res = await API.submitHospitalRegistration(payload);
    const container = document.getElementById('modalContainer');
    container.innerHTML = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal-box" style="max-width:540px; text-align:center;" onclick="event.stopPropagation()">
          <div class="modal-body" style="padding:32px 24px;">
            <div style="font-size:44px; margin-bottom:12px;">🏥✅</div>
            <h3 style="font-size:20px; font-weight:800; color:var(--navy-dark); margin-bottom:8px;">
              Hospital Registration Submitted
            </h3>
            <p style="font-size:13px; color:var(--text-muted); line-height:1.5; margin-bottom:20px;">
              Your hospital registration application has been received and logged in the database.
            </p>

            <div style="background:var(--bg-subtle); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:16px; margin-bottom:20px; text-align:left;">
              <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Application Tracking ID:</div>
              <div style="font-size:18px; font-weight:800; color:var(--primary-red); font-family:monospace;">${res.applicationId}</div>
              <div style="margin-top:10px; font-size:12px; color:var(--navy-dark);">
                Status: <span class="badge warning" style="font-size:11px;">PENDING APPROVAL</span>
              </div>
            </div>

            <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:var(--radius-sm); padding:12px; font-size:12px; color:#92400e; text-align:left; margin-bottom:24px;">
              ⚠️ <strong>Next Steps:</strong> An authorised RaktSetu administrator must review facility credentials before account activation. You cannot log in until approved.
            </div>

            <div style="display:flex; justify-content:center; gap:12px;">
              <button class="btn btn-secondary" onclick="closeModal()">Close</button>
              <button class="btn btn-primary" onclick="closeModal(); openAdminPortalModal();">
                🏛️ Review in Admin Portal
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    showToast('Hospital application submitted successfully!');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Submit Application';
  }
}

// ============================================================================
// 5C. HOSPITAL ACTIVATION MODAL (Requirement 4)
// ============================================================================
function openHospitalActivationModal(defaultEmail = '') {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" style="max-width:520px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${Icons.sparkles(18, '#0284c7')} First-Time Hospital Account Activation
          </h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>

        <div class="modal-body">
          <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
            Enter your approved hospital official email address or Application ID to verify your facility and complete activation.
          </p>

          <form onsubmit="handleHospitalActivationCodeRequest(event)">
            <div class="form-group">
              <label class="form-label">Official Hospital Email or Application ID *</label>
              <input type="text" id="hospActLookup" class="form-control" required value="${defaultEmail}" placeholder="e.g. sunrise.blood@demo.org or RS-HOSP-DEMO-APPROVED" />
            </div>

            <div id="hospActRequestError" style="display:none; background:#fff1f2; border:1px solid #fecdd3; border-radius:var(--radius-sm); padding:10px; font-size:12px; color:#991b1b; margin-bottom:12px;"></div>

            <button type="submit" class="btn btn-primary" id="btnHospActReq" style="width:100%;">
              Verify & Request Activation Code
            </button>
          </form>

          <div id="hospActivationStep2" style="margin-top:20px; display:none;"></div>
        </div>
      </div>
    </div>
  `;
}

async function handleHospitalActivationCodeRequest(e) {
  e.preventDefault();
  const lookup = document.getElementById('hospActLookup').value.trim();
  const errorBox = document.getElementById('hospActRequestError');
  const btn = document.getElementById('btnHospActReq');

  errorBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const res = await API.requestHospitalActivationCode(lookup);
    AppState.hospActivationData = { lookup, otp: res.demoActivationOtp, hospitalName: res.hospitalName };
    renderHospitalActivationStep2(res);
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Verify & Request Activation Code';
  }
}

function renderHospitalActivationStep2(res) {
  const step2 = document.getElementById('hospActivationStep2');
  if (!step2) return;

  step2.style.display = 'block';
  step2.innerHTML = `
    <div style="border-top:1px solid var(--border-color); padding-top:16px;">
      <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:var(--radius-sm); padding:12px; margin-bottom:16px; font-size:12px; color:#065f46;">
        <div><strong>Facility Identified:</strong> ${res.hospitalName}</div>
        <div style="margin-top:4px;">${res.demoOtpNotice}</div>
        <div style="margin-top:6px; font-size:14px; font-weight:800; color:#047857; letter-spacing:2px;">
          Demo Activation OTP: <code>${res.demoActivationOtp || res.activationCode}</code>
        </div>
      </div>

      <form onsubmit="handleHospitalFinalActivation(event)">
        <div class="form-group">
          <label class="form-label">Enter 6-Digit Activation Code *</label>
          <input type="text" id="hospActOtp" class="form-control" required maxlength="6" value="${res.demoActivationOtp || ''}" placeholder="123456" style="font-size:16px; letter-spacing:4px; text-align:center; font-weight:800;" />
        </div>

        <div class="form-group">
          <label class="form-label">Update Password (Optional - leave blank to keep existing)</label>
          <input type="password" id="hospActNewPass" class="form-control" placeholder="New staff password (optional)" />
        </div>

        <div id="hospActFinalError" style="display:none; background:#fff1f2; border:1px solid #fecdd3; border-radius:var(--radius-sm); padding:10px; font-size:12px; color:#991b1b; margin-bottom:12px;"></div>

        <button type="submit" class="btn btn-primary" id="btnHospFinalAct" style="width:100%;">
          Complete Hospital Activation
        </button>
      </form>
    </div>
  `;
}

async function handleHospitalFinalActivation(e) {
  e.preventDefault();
  const otp = document.getElementById('hospActOtp').value.trim();
  const newPass = document.getElementById('hospActNewPass').value;
  const errorBox = document.getElementById('hospActFinalError');
  const btn = document.getElementById('btnHospFinalAct');

  errorBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Activating...';

  try {
    const res = await API.activateHospitalAccount({
      email: AppState.hospActivationData.lookup,
      activationCode: otp,
      password: newPass || undefined
    });

    closeModal();
    showToast(res.message);
    navigateTo('hospital-login');
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Complete Hospital Activation';
  }
}

// ============================================================================
// 5D. ADMINISTRATOR REVIEW PORTAL MODAL (Requirement 3)
// ============================================================================
async function openAdminPortalModal() {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  if (AppState.userType === 'ADMIN' && AppState.adminUser) {
    renderAdminPortalContent();
  } else {
    container.innerHTML = `
      <div class="modal-overlay" onclick="closeModal(event)">
        <div class="modal-box" style="max-width:440px;" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
              ${Icons.shield(18, '#0f766e')} RaktSetu Administrator Portal
            </h3>
            <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
          </div>

          <form onsubmit="handleAdminLoginSubmit(event)">
            <div class="modal-body">
              <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">
                Platform administrators review, verify, and approve hospital healthcare facility registrations.
              </p>

              <div class="form-group">
                <label class="form-label">Administrator Email / Username *</label>
                <input type="text" id="adminLoginUser" class="form-control" required placeholder="admin@raktsetu.org" />
              </div>

              <div class="form-group">
                <label class="form-label">Admin Password *</label>
                <input type="password" id="adminLoginPass" class="form-control" required placeholder="Enter password" />
              </div>

              <div id="adminLoginError" style="display:none; background:#fff1f2; border:1px solid #fecdd3; border-radius:var(--radius-sm); padding:10px; font-size:12px; color:#991b1b; margin-bottom:12px;"></div>

              <button type="submit" class="btn btn-primary" id="btnAdminLogin" style="width:100%; background:#0f766e; border-color:#0f766e;">
                Authenticate as Administrator
              </button>

              <div class="demo-helper-box" style="margin-top:16px;">
                <div>💡 <strong>Admin Credentials:</strong> User: <code>admin@raktsetu.org</code> • Pass: <code>admin123</code></div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="fillAdminCredentials()">Auto-Fill</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
  }
}

function fillAdminCredentials() {
  document.getElementById('adminLoginUser').value = 'admin@raktsetu.org';
  document.getElementById('adminLoginPass').value = 'admin123';
}

async function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('adminLoginUser').value.trim();
  const password = document.getElementById('adminLoginPass').value;
  const errorBox = document.getElementById('adminLoginError');
  const btn = document.getElementById('btnAdminLogin');

  errorBox.style.display = 'none';
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const res = await API.adminLogin(username, password);
    AppState.userType = 'ADMIN';
    AppState.adminUser = res.admin;
    showToast(`Authenticated as Administrator ${res.admin.fullName}`);
    renderAdminPortalContent();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Authenticate as Administrator';
  }
}

async function renderAdminPortalContent(currentStatus = 'ALL') {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" style="max-width:880px;" onclick="event.stopPropagation()">
        <div class="modal-header" style="background:#f8fafc;">
          <div>
            <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
              ${Icons.shield(18, '#0f766e')} Hospital Registrations & Facility Approvals
            </h3>
            <span style="font-size:12px; color:var(--text-muted);">
              Logged in as: <strong>${AppState.adminUser?.fullName || 'Platform Administrator'}</strong> (${AppState.adminUser?.email || ''})
            </span>
          </div>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>

        <div class="modal-body" style="padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
            <div class="tab-pills">
              <button class="pill-btn ${currentStatus === 'ALL' ? 'active' : ''}" onclick="renderAdminPortalContent('ALL')">All Applications</button>
              <button class="pill-btn ${currentStatus === 'PENDING_APPROVAL' ? 'active' : ''}" onclick="renderAdminPortalContent('PENDING_APPROVAL')">Pending Review</button>
              <button class="pill-btn ${currentStatus === 'APPROVED' ? 'active' : ''}" onclick="renderAdminPortalContent('APPROVED')">Approved</button>
              <button class="pill-btn ${currentStatus === 'REJECTED' ? 'active' : ''}" onclick="renderAdminPortalContent('REJECTED')">Rejected</button>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="renderAdminPortalContent('${currentStatus}')">Refresh</button>
          </div>

          <div id="adminHospitalTableContainer" style="overflow-x:auto;">
            <div style="text-align:center; padding:30px; color:var(--text-muted);">Loading applications...</div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const res = await API.getAdminHospitalApplications({ status: currentStatus });
    const tableContainer = document.getElementById('adminHospitalTableContainer');
    if (!tableContainer) return;

    if (!res.applications || res.applications.length === 0) {
      tableContainer.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted);">
          No hospital applications found matching current filter.
        </div>
      `;
      return;
    }

    let rowsHtml = res.applications.map(h => {
      const isPending = h.registration_status === 'PENDING_APPROVAL';
      const isApproved = h.registration_status === 'APPROVED';
      const isRejected = h.registration_status === 'REJECTED';

      const statusBadge = isPending
        ? `<span class="badge warning">PENDING APPROVAL</span>`
        : isApproved
          ? `<span class="badge success">APPROVED</span>`
          : `<span class="badge critical">REJECTED</span>`;

      return `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--navy-dark);">${h.name}</div>
            <div style="font-size:11px; font-family:monospace; color:var(--primary-red);">${h.application_id || '#' + h.id}</div>
          </td>
          <td style="font-size:12px;">
            <div>${h.email}</div>
            <div style="color:var(--text-muted);">${h.phone}</div>
          </td>
          <td style="font-size:12px;">
            <div>${h.city} (${h.pincode})</div>
            <div style="color:var(--text-muted); font-size:11px;">${h.address}</div>
          </td>
          <td style="font-size:12px; color:var(--text-muted);">${h.created_at ? h.created_at.split(' ')[0] : 'Recently'}</td>
          <td>
            ${statusBadge}
            <div style="font-size:10px; color:var(--text-muted); margin-top:2px;">
              Acc: <strong>${h.account_status}</strong>
            </div>
            ${h.rejection_reason ? `<div style="font-size:10px; color:#dc2626; margin-top:2px;">Reason: ${h.rejection_reason}</div>` : ''}
          </td>
          <td>
            ${isPending ? `
              <div style="display:flex; gap:6px;">
                <button class="btn btn-sm btn-primary" style="background:#059669; border-color:#059669; font-size:11px; padding:4px 8px;" onclick="handleAdminApproveHospital(${h.id}, '${currentStatus}')">
                  Approve
                </button>
                <button class="btn btn-sm btn-secondary" style="color:#dc2626; font-size:11px; padding:4px 8px;" onclick="handleAdminRejectHospital(${h.id}, '${currentStatus}')">
                  Reject
                </button>
              </div>
            ` : `
              <span style="font-size:11px; color:var(--text-muted);">
                ${h.reviewed_at ? 'Reviewed ' + h.reviewed_at.split(' ')[0] : 'Processed'}
              </span>
            `}
          </td>
        </tr>
      `;
    }).join('');

    tableContainer.innerHTML = `
      <table class="data-table" style="width:100%; font-size:13px;">
        <thead>
          <tr>
            <th>Hospital Name & ID</th>
            <th>Contact Details</th>
            <th>Location</th>
            <th>Application Date</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  } catch (err) {
    const tableContainer = document.getElementById('adminHospitalTableContainer');
    if (tableContainer) {
      tableContainer.innerHTML = `<div style="color:#dc2626; padding:20px;">Failed to load applications: ${err.message}</div>`;
    }
  }
}

async function handleAdminApproveHospital(id, currentStatus) {
  if (!confirm('Are you sure you want to approve this hospital facility for account activation?')) return;
  try {
    const res = await API.adminApproveHospital(id, 'Facility licensing credentials verified by administrator.');
    showToast(res.message);
    renderAdminPortalContent(currentStatus);
  } catch (err) {
    alert('Approval failed: ' + err.message);
  }
}

async function handleAdminRejectHospital(id, currentStatus) {
  const reason = prompt('Please enter the administrative reason for rejecting this hospital application:', 'Facility licensing accreditation documentation could not be verified.');
  if (!reason || !reason.trim()) return;

  try {
    const res = await API.adminRejectHospital(id, reason.trim());
    showToast(res.message);
    renderAdminPortalContent(currentStatus);
  } catch (err) {
    alert('Rejection failed: ' + err.message);
  }
}

// ============================================================================
// 6. HOSPITAL PORTAL VIEW (Requirement 5 & 9)
// ============================================================================
function renderHospitalPortal() {
  const h = AppState.activeHospital || { name: 'Hospital Portal' };

  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div>
        <h2 style="font-size:22px; font-weight:800; color:var(--navy-dark);">${h.name}</h2>
        <p style="font-size:12px; color:var(--text-muted);">
          Hospital Portal & Blood Centre Operations • Authorized Staff Access
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

    <!-- Portal Navigation Tabs (With Applications Tab - Requirement 5) -->
    <div class="portal-tabs">
      <button class="tab-btn ${AppState.currentHospitalTab === 'dashboard' ? 'active' : ''}" onclick="switchHospitalTab('dashboard')">
        ${Icons.activity(16)} Dashboard Overview
      </button>
      <button class="tab-btn ${AppState.currentHospitalTab === 'applications' ? 'active' : ''}" onclick="switchHospitalTab('applications')" id="hospitalApplicationsTabBtn">
        ${Icons.shieldCheck(16)} Donor Applications
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
    const summary = await API.getHospitalSummary(AppState.activeHospital ? AppState.activeHospital.id : 1);

    if (AppState.currentHospitalTab === 'dashboard') {
      renderHospitalOverviewTab(content, summary);
    } else if (AppState.currentHospitalTab === 'applications') {
      loadHospitalApplicationsTab(content);
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
    content.innerHTML = `<div class="card" style="color:var(--status-red);">Failed to load hospital metrics: ${err.message}. Please log in again.</div>`;
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
      <div class="metric-card ${m.pendingApplications > 0 ? 'critical' : 'info'}" style="cursor:pointer;" onclick="switchHospitalTab('applications')">
        <div class="metric-title">Pending Applications</div>
        <div class="metric-value" style="color:${m.pendingApplications > 0 ? 'var(--blood-accent)' : 'inherit'};">${m.pendingApplications}</div>
        <div class="metric-sub">Awaiting hospital verification</div>
      </div>
      <div class="metric-card success" style="cursor:pointer;" onclick="switchHospitalTab('donors')">
        <div class="metric-title">Approved Donors</div>
        <div class="metric-value">${m.approvedDonors}</div>
        <div class="metric-sub">${m.totalDonors} total in registry</div>
      </div>
      <div class="metric-card warning" style="cursor:pointer;" onclick="switchHospitalTab('donors')">
        <div class="metric-title">Pending Screening</div>
        <div class="metric-value">${m.pendingScreenings}</div>
        <div class="metric-sub">Pre-donation checkups</div>
      </div>
      <div class="metric-card success" style="cursor:pointer;" onclick="switchHospitalTab('donors')">
        <div class="metric-title">Available This Week</div>
        <div class="metric-value">${m.availableThisWeek}</div>
        <div class="metric-sub">Confirmed via check-in</div>
      </div>
      <div class="metric-card ${m.nearExpiryUnits > 0 ? 'critical' : 'info'}" style="cursor:pointer;" onclick="switchHospitalTab('inventory')">
        <div class="metric-title">Near-Expiry Units</div>
        <div class="metric-value" style="color:${m.nearExpiryUnits > 0 ? 'var(--blood-accent)' : 'inherit'};">
          ${m.nearExpiryUnits}
        </div>
        <div class="metric-sub">Expiring within 72 hours</div>
      </div>
    </div>

    <!-- Charts & Tables Layout -->
    <div style="display:grid; grid-template-columns: 1.2fr 0.8fr; gap:20px; margin-bottom:20px;">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${Icons.bloodDrop(18)} Usable Stock by Blood Group</h3>
          <span style="font-size:11px; color:var(--text-muted);">Real-time inventory units</span>
        </div>
        <div id="stockBarChartContainer"></div>
      </div>

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
  `;

  setTimeout(() => {
    if (summary.stockByGroup) {
      Charts.renderBarChart('stockBarChartContainer', summary.stockByGroup);
    }
  }, 50);
}

// Tab 2: Hospital Donor Application Management (Requirement 5)
async function loadHospitalApplicationsTab(container) {
  try {
    const data = await API.getHospitalApplications();
    renderHospitalApplicationsView(container, data.applications);
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--status-red);">Failed to load donor applications: ${err.message}</div>`;
  }
}

function renderHospitalApplicationsView(container, apps) {
  const pendingCount = apps.filter(a => a.status === 'PENDING_APPROVAL').length;

  container.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${Icons.shieldCheck(18, '#059669')} Donor Registration Applications
            <span style="font-size:12px; font-weight:700; padding:2px 8px; border-radius:9999px; background:#fff1f2; color:#991b1b;">
              ${pendingCount} Pending Review
            </span>
          </h3>
          <p style="font-size:12px; color:var(--text-muted); margin-top:2px;">
            Authorised hospital staff review registration details before allowing applicants to activate accounts.
          </p>
        </div>

        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <input type="text" id="appSearchInput" class="form-control" style="width:200px;" placeholder="Search name, ID, phone..." onkeyup="filterApplicationsTable()" />
          <select id="appStatusFilter" class="form-control" style="width:170px;" onchange="filterApplicationsTable()">
            <option value="ALL">All Application Statuses</option>
            <option value="PENDING_APPROVAL" selected>Pending Review (${pendingCount})</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="table-responsive">
        <table class="data-table" id="applicationsTable">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Applicant Name</th>
              <th>Group</th>
              <th>Contact (Authorised)</th>
              <th>Location</th>
              <th>Submission Date</th>
              <th>Status</th>
              <th>Actions / Review Log</th>
            </tr>
          </thead>
          <tbody>
            ${apps.length === 0 ? `
              <tr><td colspan="8" style="text-align:center; padding:20px;">No applications found.</td></tr>
            ` : apps.map(a => `
              <tr data-name="${a.full_name.toLowerCase()}" data-id="${a.application_id.toLowerCase()}" data-mobile="${a.mobile}" data-status="${a.status}">
                <td><code>${a.application_id}</code></td>
                <td>
                  <strong>${a.full_name}</strong>
                  <div style="font-size:11px; color:var(--text-muted);">${a.age}y / ${a.gender ? a.gender[0] : 'U'}</div>
                </td>
                <td><span class="blood-badge" style="width:28px; height:28px; font-size:11px;">${a.blood_group}</span></td>
                <td>
                  <div style="font-size:12px; font-weight:600;">${a.mobile}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${a.email || 'No email'}</div>
                </td>
                <td>${a.city} (${a.pincode})</td>
                <td>${a.created_at ? a.created_at.slice(0, 10) : ''}</td>
                <td>
                  <span class="status-badge ${a.status === 'APPROVED' ? 'status-approved' : a.status === 'REJECTED' ? 'status-deferred' : 'status-pending'}">
                    ${a.status}
                  </span>
                </td>
                <td>
                  ${a.status === 'PENDING_APPROVAL' ? `
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-success btn-sm" onclick="handleApproveApplication(${a.id}, '${a.full_name}', '${a.application_id}')">
                        Approve
                      </button>
                      <button class="btn btn-danger btn-sm" onclick="openRejectApplicationModal(${a.id}, '${a.full_name}', '${a.application_id}')">
                        Reject
                      </button>
                    </div>
                  ` : a.status === 'APPROVED' ? `
                    <div style="font-size:11px; color:var(--status-green);">
                      ✓ Approved by ${a.reviewed_by_staff_name || 'Staff'}<br/>
                      <span style="color:var(--text-muted);">${a.reviewed_at ? a.reviewed_at.slice(0, 10) : ''}</span>
                    </div>
                    <div style="margin-top:6px;">
                      <button class="btn btn-secondary btn-sm" style="font-size:11px; padding:3px 8px; color:var(--navy-dark);" onclick="openScheduleScreeningForApplicant(${a.id}, '${a.full_name}')" title="Schedule appointment & send SMS">
                        ${Icons.calendar(12)} Schedule & SMS
                      </button>
                    </div>
                  ` : `
                    <div style="font-size:11px; color:var(--status-red);">
                      ✕ Rejected: ${a.rejection_reason || 'Criteria not met'}<br/>
                      <span style="color:var(--text-muted);">${a.reviewed_at ? a.reviewed_at.slice(0, 10) : ''}</span>
                    </div>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Apply default filter to show pending
  filterApplicationsTable();
}

function filterApplicationsTable() {
  const query = (document.getElementById('appSearchInput') ? document.getElementById('appSearchInput').value : '').toLowerCase();
  const statusFilter = document.getElementById('appStatusFilter') ? document.getElementById('appStatusFilter').value : 'ALL';

  const rows = document.querySelectorAll('#applicationsTable tbody tr');
  rows.forEach(r => {
    const name = r.getAttribute('data-name') || '';
    const id = r.getAttribute('data-id') || '';
    const mobile = r.getAttribute('data-mobile') || '';
    const status = r.getAttribute('data-status') || '';

    const matchQuery = !query || name.includes(query) || id.includes(query) || mobile.includes(query);
    const matchStatus = statusFilter === 'ALL' || status === statusFilter;

    if (matchQuery && matchStatus) {
      r.style.display = '';
    } else {
      r.style.display = 'none';
    }
  });
}

async function handleApproveApplication(id, name, appId) {
  try {
    const res = await API.approveDonorApplication(id, AppState.activeHospital ? AppState.activeHospital.name : 'Chief Medical Officer');
    showToast(`Application ${appId} for ${name} APPROVED! Account activation permitted.`);
    loadHospitalDashboard();
  } catch (err) {
    showToast('Failed to approve application: ' + err.message, 'error');
  }
}

function openRejectApplicationModal(id, name, appId) {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" style="max-width:480px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; color:#dc2626;">Reject Donor Application</h3>
          <button style="border:none; background:none; cursor:pointer;" onclick="closeModal()">✕</button>
        </div>
        <form onsubmit="handleRejectApplicationSubmit(event, ${id}, '${appId}')">
          <div class="modal-body">
            <p style="font-size:13px; margin-bottom:12px;">
              Rejecting registration application for: <strong>${name}</strong> (<code>${appId}</code>)
            </p>
            <div class="form-group">
              <label class="form-label">Reason for Rejection *</label>
              <textarea name="rejectionReason" class="form-control" rows="3" required placeholder="State clear medical, identity, or service jurisdiction reason..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn btn-danger">Confirm Rejection</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function handleRejectApplicationSubmit(e, id, appId) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const reason = formData.get('rejectionReason');

  try {
    const res = await API.rejectDonorApplication(id, reason, AppState.activeHospital ? AppState.activeHospital.name : 'Hospital Staff');
    closeModal();
    showToast(res.message);
    loadHospitalDashboard();
  } catch (err) {
    showToast('Failed to reject application: ' + err.message, 'error');
  }
}

// Tab 3: Donor Management (Registry & Medical Screening)
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
          <select id="donorStatusFilter" class="form-control" style="width:200px;" onchange="filterDonorsTable()">
            <option value="ALL">All Medical Statuses</option>
            <option value="MEDICALLY_APPROVED">MEDICALLY APPROVED</option>
            <option value="PENDING_SCREENING">PENDING SCREENING</option>
            <option value="APPOINTMENT_SCHEDULED">APPOINTMENT SCHEDULED</option>
            <option value="TEMPORARILY_DEFERRED">TEMPORARILY DEFERRED</option>
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
        <h3 class="card-title">${Icons.users(18)} Hospital Verified Donor Registry (${donors.length} records)</h3>
        <span style="font-size:12px; color:var(--text-muted);">Authorised medical staff access only</span>
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
              <th>Registration</th>
              <th>Medical Fitness</th>
              <th>Weekly Avail.</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${donors.map(d => `
              <tr data-name="${d.full_name.toLowerCase()}" data-mobile="${d.mobile}" data-bg="${d.blood_group}" data-status="${d.medical_screening_status || d.screening_status}">
                <td>
                  <strong style="color:var(--navy-dark);">${d.full_name}</strong>
                  <div style="font-size:11px; color:var(--text-muted);">ID: #DNR-${d.id} • ${d.source || 'ONLINE'}</div>
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
                  <span class="status-badge status-approved">
                    ${d.registration_status || 'APPROVED'}
                  </span>
                </td>
                <td>
                  <span class="status-badge ${getMedicalStatusClass(d.medical_screening_status || d.screening_status)}">
                    ${d.medical_screening_status || d.screening_status}
                  </span>
                  ${d.screening_valid_until ? `<div style="font-size:10px; color:var(--text-muted); margin-top:2px;">Cleared to: ${d.screening_valid_until}</div>` : ''}
                </td>
                <td>
                  <span class="status-badge ${getAvailabilityStatusClass(d.weekly_availability)}">
                    ${d.weekly_availability}
                  </span>
                </td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-secondary btn-sm" onclick="openScheduleScreeningModal(${d.id}, '${d.full_name}')" title="Schedule pre-donation checkup">
                      ${Icons.calendar(12)} Schedule
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="openRecordDecisionModal(${d.id}, '${d.full_name}')" title="Record clinical fitness decision">
                      ${Icons.shieldCheck(12, '#ffffff')} Screen
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
    const matchStatus = statusFilter === 'ALL' || status === statusFilter || (statusFilter === 'MEDICALLY_APPROVED' && status === 'APPROVED');

    if (matchQuery && matchBg && matchStatus) {
      r.style.display = '';
    } else {
      r.style.display = 'none';
    }
  });
}

function getMedicalStatusClass(status) {
  if (status === 'APPROVED' || status === 'MEDICALLY_APPROVED') return 'status-approved';
  if (status === 'APPOINTMENT SCHEDULED' || status === 'APPOINTMENT_SCHEDULED' || status === 'PENDING SCREENING' || status === 'PENDING_SCREENING') return 'status-pending';
  if (status === 'TEMPORARILY DEFERRED' || status === 'TEMPORARILY_DEFERRED' || status === 'NOT APPROVED' || status === 'NOT_APPROVED') return 'status-deferred';
  return 'status-unconfirmed';
}

function getAvailabilityStatusClass(status) {
  if (status === 'AVAILABLE') return 'status-available';
  if (status === 'MAYBE') return 'status-maybe';
  if (status === 'UNAVAILABLE') return 'status-unavailable';
  return 'status-unconfirmed';
}

// Tab 4: Inventory
async function loadInventoryTab(container) {
  try {
    const data = await API.getInventory(AppState.activeHospital ? AppState.activeHospital.id : 1);
    renderInventoryView(container, data);
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--status-red);">Failed to load inventory: ${err.message}</div>`;
  }
}

function renderInventoryView(container, invData) {
  container.innerHTML = `
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

// Tab 5: Requests & Matching (DEMO 6)
async function loadRequestsTab(container) {
  try {
    const data = await API.getBloodRequests(AppState.activeHospital ? AppState.activeHospital.id : 1);
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
      hospitalId: AppState.activeHospital ? AppState.activeHospital.id : 1,
      notes: `Automated urgent mobilisation dispatched to ${donorName}.`
    });
    showToast(res.message);
    loadHospitalDashboard();
  } catch (err) {
    showToast('Failed to contact donor: ' + err.message, 'error');
  }
}

// Tab 6: AI Shortage Prediction (DEMO 5)
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
    const data = await API.getDemandForecast(AppState.activeHospital ? AppState.activeHospital.id : 1, bg, comp);
    renderAiForecastContent(container, data);
  } catch (err) {
    container.innerHTML = `<div class="card" style="color:var(--status-red);">Model prediction failed: ${err.message}</div>`;
  }
}

function renderAiForecastContent(container, f) {
  const m = f.modelMetrics;

  container.innerHTML = `
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

    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">${Icons.activity(18, '#dc2626')} 7-Day Demand Forecast with 90% Confidence Corridor</h3>
          <p style="font-size:11px; color:var(--text-muted);">Blue Line: Historical Demand • Red Dashed Line: ML Predicted Future Demand</p>
        </div>
        <div>
          ${Charts.getRiskBadgeHtml(f.riskLevel)}
        </div>
      </div>
      <div id="aiForecastChartSvgContainer" style="width:100%; min-height:240px;"></div>
    </div>

    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
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

  setTimeout(() => {
    Charts.renderForecastChart('aiForecastChartSvgContainer', f.dailyForecast, f.recentHistory);
  }, 50);
}

// ============================================================================
// 7. DONOR PORTAL VIEW (Requirement 8, 10, 11)
// ============================================================================
function renderDonorPortal() {
  const d = AppState.activeDonor;
  if (!d) {
    return `<div class="card" style="text-align:center; padding:40px;">No donor session active. <a href="javascript:void(0)" onclick="navigateTo('donor-login')">Please log in</a>.</div>`;
  }

  return `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
      <div style="display:flex; align-items:center; gap:14px;">
        <span class="blood-badge" style="width:48px; height:48px; font-size:18px;">${d.bloodGroup || '🩸'}</span>
        <div>
          <h2 style="font-size:22px; font-weight:800; color:var(--navy-dark);">${d.fullName}</h2>
          <p style="font-size:12px; color:var(--text-muted);">
            Active Donor • Mobile: ${d.mobile} • ${d.city || 'Mumbai'}
          </p>
        </div>
      </div>
      <div style="display:flex; gap:10px;">
        <button class="btn btn-secondary btn-sm" onclick="triggerSimulatedWeeklyPush()">
          🔔 Test Weekly Availability Push
        </button>
      </div>
    </div>

    <!-- Active Tab Dynamic Container -->
    <div id="donorDashboardContent">
      <div style="text-align:center; padding:30px; color:var(--text-muted);">Loading verified donor profile...</div>
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
    container.innerHTML = `<div class="card" style="color:var(--status-red);">Failed to load donor data: ${err.message}. Please log in again.</div>`;
  }
}

function renderDonorDashboardContent(container, data) {
  const d = data.donor;

  container.innerHTML = `
    <!-- Separate Status Indicator Badges (Requirement 10) -->
    <div class="card" style="margin-bottom:20px; background:#f8fafc;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <span style="font-size:11px; font-weight:700; color:var(--text-muted);">ACCOUNT STATUS</span>
          <div style="margin-top:2px;">
            <span class="status-badge status-approved">REGISTRATION: ${d.registrationStatus || 'APPROVED'}</span>
            <span class="status-badge status-approved" style="margin-left:6px;">ACCOUNT: ${d.accountStatus || 'ACTIVE'}</span>
            <span class="status-badge ${getMedicalStatusClass(d.medicalScreeningStatus || d.screening_status)}" style="margin-left:6px;">
              MEDICAL FITNESS: ${d.medicalScreeningStatus || d.screening_status || 'PENDING_SCREENING'}
            </span>
          </div>
        </div>
        <div style="font-size:12px; color:var(--text-muted);">
          ${d.screening_valid_until ? `Cleared for blood donation until: <strong>${d.screening_valid_until}</strong>` : 'Medical fitness screening required before donation'}
        </div>
      </div>
    </div>

    <!-- Weekly Availability Check-in Card (WORKFLOW DEMO 4 & Requirement 11) -->
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

    <!-- Appointments & Notifications Grid -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${Icons.calendar(18)} Pre-Donation Screening Appointments</h3>
        </div>
        ${data.appointments.length === 0 ? `
          <div style="font-size:12px; color:var(--text-muted); padding:20px; text-align:center;">No upcoming screening appointments scheduled. Hospital staff will schedule checkups when slots are open.</div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:10px;">
            ${data.appointments.map(a => `
              <div style="background:var(--bg-subtle); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong style="font-size:13px;">${a.hospital_name}</strong>
                  <span class="status-badge ${a.status === 'COMPLETED' ? 'status-approved' : 'status-pending'}">${a.status}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                  <div style="font-size:12px; color:var(--primary-red); font-weight:700;">
                    ${a.appointment_date} at ${a.appointment_time}
                  </div>
                  <span style="font-size:10px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:2px 6px; border-radius:4px; font-weight:600;">
                    📱 SMS Confirmed
                  </span>
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

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">${Icons.bell(18)} Notifications & Alerts (${data.unreadCount} unread)</h3>
        </div>
        ${data.notifications.length === 0 ? `
          <div style="font-size:12px; color:var(--text-muted); padding:20px; text-align:center;">No notifications yet.</div>
        ` : `
          <div style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto;">
            ${data.notifications.map(n => `
              <div style="background:${n.is_read ? 'var(--bg-subtle)' : '#fff1f2'}; padding:10px; border-radius:var(--radius-sm); border:1px solid ${n.is_read ? 'var(--border-color)' : '#fca5a5'};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <strong style="font-size:12px; color:var(--navy-dark);">${n.title}</strong>
                  <span style="font-size:10px; color:var(--text-light);">${n.created_at ? n.created_at.slice(0, 10) : ''}</span>
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
    showToast(`Weekly availability recorded: ${status}`);
    renderApp();
  } catch (err) {
    showToast('Failed to update availability: ' + err.message, 'error');
  }
}

// ============================================================================
// MODALS & REGISTRATION (Requirement 3, 5, 6, 7)
// ============================================================================

// DEMO 1: Donor Registration Application
function openDonorRegisterModal() {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 style="font-size:16px; font-weight:800; display:flex; align-items:center; gap:8px;">
            ${Icons.bloodDrop(20, '#dc2626')} Apply to Become a Blood Donor
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
            <button type="submit" class="btn btn-primary">Submit Application</button>
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
    const res = await API.submitDonorApplication(payload);
    closeModal();
    showToast(res.message);
    navigateTo('track-status');
    setTimeout(() => {
      fillStatusTrackerDemo(res.applicationId, payload.mobile);
    }, 100);
  } catch (err) {
    showToast('Registration error: ' + err.message, 'error');
  }
}

// Excel Import Modal
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
    const res = await API.confirmExcelImport(window.lastExcelValidRows, AppState.activeHospital ? AppState.activeHospital.id : 1);
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
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(API.getToken() ? { 'Authorization': `Bearer ${API.getToken()}` } : {})
      },
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

// Screening Schedule & Decision Modals
function openScheduleScreeningModal(donorId, donorName, applicationId = null) {
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
        <form onsubmit="handleScheduleScreeningSubmit(event, ${donorId || 'null'}, ${applicationId ? `'${applicationId}'` : 'null'})">
          <div class="modal-body">
            <div style="font-size:13px; margin-bottom:12px;">
              Scheduling medical checkup for: <strong>${donorName}</strong>
            </div>

            <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:var(--radius-sm); padding:10px 12px; margin-bottom:16px; font-size:12px; color:#166534; display:flex; align-items:flex-start; gap:8px;">
              <span style="font-size:14px; line-height:1;">📱</span>
              <div>
                <strong>SMS Dispatch Guaranteed:</strong> An official SMS notification containing the appointment date, time, hospital address, and preparation instructions will be automatically dispatched to the donor's mobile number via Fast2SMS / MSG91.
              </div>
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
            <button type="submit" class="btn btn-primary">Confirm & Send SMS</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function openScheduleScreeningForApplicant(appId, applicantName) {
  openScheduleScreeningModal(null, applicantName, appId);
}

async function handleScheduleScreeningSubmit(e, donorId, applicationId) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const payload = {
    donorId: donorId || undefined,
    applicationId: applicationId || undefined,
    hospitalId: AppState.activeHospital ? AppState.activeHospital.id : 1,
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
                <option value="APPROVED">MEDICALLY APPROVED (Fit for Blood Donation)</option>
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
    hospitalId: AppState.activeHospital ? AppState.activeHospital.id : 1,
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

// Add Stock Modal
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
    hospitalId: AppState.activeHospital ? AppState.activeHospital.id : 1,
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
    hospitalId: AppState.activeHospital ? AppState.activeHospital.id : 1
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

// Create Urgent Request Modal
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
    hospitalId: AppState.activeHospital ? AppState.activeHospital.id : 1,
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

// Simulated Weekly Push Notification Banner
function triggerSimulatedWeeklyPush() {
  const container = document.getElementById('modalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" onclick="closeModal(event)">
      <div class="modal-box" style="max-width:440px; border-radius:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
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
  if (AppState.activeDonor) {
    await submitWeeklyAvailability(AppState.activeDonor.id, choice);
  } else {
    showToast(`Weekly availability recorded: ${choice}`);
  }
}

function closeModal(event) {
  if (event) event.stopPropagation();
  const container = document.getElementById('modalContainer');
  if (container) container.innerHTML = '';
}
