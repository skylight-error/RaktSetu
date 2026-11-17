process.env.PORT = '5002';
const app = require('./index');
const { db } = require('./db/database');
const { forecastDemand } = require('./ai/demandForecasting');
const { matchDonorsForRequest } = require('./ai/donorMatching');

async function runTests() {
  console.log('================================================================');
  console.log('       RAKTSETU HOSPITAL REGISTRATION & SECURITY SUITE          ');
  console.log('================================================================\n');

  // Wait 1 second for express server to bind port
  await new Promise(r => setTimeout(r, 1000));

  const BASE_URL = `http://127.0.0.1:5002`;

  let passedTests = 0;
  const totalTests = 14;

  function assert(condition, message, extra) {
    if (!condition) {
      console.error(`  ❌ FAILED: ${message}`, extra ? extra : '');
      throw new Error(message);
    }
    console.log(`  ✅ PASSED: ${message}`);
  }

  try {
    // -------------------------------------------------------------------------
    // TEST CASE 1: New hospital can submit registration
    // -------------------------------------------------------------------------
    console.log('\n--- Case 1: New Hospital Submits Registration ---');
    const testHospEmail = 'test.heritage.hospital@raktsetu.org';
    db.prepare('DELETE FROM hospitals WHERE lower(email) = ?').run(testHospEmail);

    const regPayload = {
      name: 'Heritage Multi-Specialty Hospital',
      email: testHospEmail,
      phone: '+91 98200 88990',
      address: 'Plot 45, Sector 12, Navi Mumbai',
      city: 'Navi Mumbai',
      pincode: '400703',
      password: 'StrongHospPassword@2026',
      confirmPassword: 'StrongHospPassword@2026'
    };

    const regRes = await fetch(`${BASE_URL}/api/auth/hospital/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload)
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, 'Registration returns HTTP 201 Created', regData);
    assert(regData.success === true, 'Response contains success: true');
    assert(Boolean(regData.applicationId), `Generated Application ID: ${regData.applicationId}`);
    assert(regData.registrationStatus === 'PENDING_APPROVAL', 'Initial registration status is PENDING_APPROVAL');
    assert(regData.accountStatus === 'NOT_ACTIVATED', 'Initial account status is NOT_ACTIVATED');
    const newHospitalId = regData.hospitalId;
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 2: Duplicate hospital registration is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- Case 2: Duplicate Hospital Registration Is Rejected ---');
    const dupRes = await fetch(`${BASE_URL}/api/auth/hospital/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload)
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 400, 'Duplicate email registration rejected with HTTP 400 Bad Request');
    assert(dupData.error.includes('already exists'), 'Duplicate error explains registration exists');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 3: Pending hospital cannot log in
    // -------------------------------------------------------------------------
    console.log('\n--- Case 3: Pending Hospital Cannot Log In ---');
    const pendingLoginRes = await fetch(`${BASE_URL}/api/auth/hospital/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testHospEmail, password: 'StrongHospPassword@2026' })
    });
    const pendingLoginData = await pendingLoginRes.json();
    assert(pendingLoginRes.status === 403, 'Pending hospital login rejected with HTTP 403 Forbidden');
    assert(pendingLoginData.registrationStatus === 'PENDING_APPROVAL', 'Response indicates PENDING_APPROVAL');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 4: Administrator can approve a hospital
    // -------------------------------------------------------------------------
    console.log('\n--- Case 4: Administrator Can Approve a Hospital ---');
    // Login as Admin
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin@raktsetu.org', password: 'admin123' })
    });
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, 'Admin login succeeds with HTTP 200');
    assert(Boolean(adminLoginData.token), 'Admin session token received');
    const adminToken = adminLoginData.token;

    // Approve new hospital
    const approveRes = await fetch(`${BASE_URL}/api/admin/hospital-applications/${newHospitalId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ notes: 'Facility licensing and blood bank equipment verified.' })
    });
    const approveData = await approveRes.json();
    assert(approveRes.status === 200, 'Admin approval returns HTTP 200');
    assert(approveData.success === true, 'Hospital approval marked successful');

    const hospInDb = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(newHospitalId);
    assert(hospInDb.registration_status === 'APPROVED', 'Hospital registration_status updated to APPROVED in DB');
    assert(hospInDb.account_status === 'NOT_ACTIVATED', 'Hospital account_status remains NOT_ACTIVATED prior to activation');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 5: Rejected hospital cannot log in
    // -------------------------------------------------------------------------
    console.log('\n--- Case 5: Rejected Hospital Cannot Log In ---');
    // Pre-seeded rejected hospital: greenvalley@demo.org
    const rejLoginRes = await fetch(`${BASE_URL}/api/auth/hospital/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'greenvalley@demo.org', password: 'hospital123' })
    });
    const rejLoginData = await rejLoginRes.json();
    assert(rejLoginRes.status === 403, 'Rejected hospital login returns HTTP 403 Forbidden');
    assert(rejLoginData.registrationStatus === 'REJECTED', 'Response confirms REJECTED status');
    assert(Boolean(rejLoginData.error), 'Rejection reason returned: ' + rejLoginData.error);
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 6: Approved but inactive hospital cannot log in
    // -------------------------------------------------------------------------
    console.log('\n--- Case 6: Approved But Inactive Hospital Cannot Log In ---');
    const inactiveLoginRes = await fetch(`${BASE_URL}/api/auth/hospital/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testHospEmail, password: 'StrongHospPassword@2026' })
    });
    const inactiveLoginData = await inactiveLoginRes.json();
    assert(inactiveLoginRes.status === 403, 'Inactive approved hospital login rejected with HTTP 403');
    assert(inactiveLoginData.accountStatus === 'NOT_ACTIVATED', 'Response indicates NOT_ACTIVATED');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 7: Activated hospital can log in with valid credentials
    // -------------------------------------------------------------------------
    console.log('\n--- Case 7: Activated Hospital Logs In With Valid Credentials ---');
    // Request activation code
    const hospOtpRes = await fetch(`${BASE_URL}/api/auth/hospital/request-activation-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testHospEmail })
    });
    const hospOtpData = await hospOtpRes.json();
    assert(hospOtpRes.status === 200, 'Hospital activation code request returns HTTP 200');
    const hospOtp = hospOtpData.demoActivationOtp || hospOtpData.activationCode;
    assert(Boolean(hospOtp), 'Activation OTP generated: ' + hospOtp);

    // Complete hospital activation
    const activateRes = await fetch(`${BASE_URL}/api/auth/hospital/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testHospEmail,
        activationCode: hospOtp,
        password: 'ActivatedHospPassword@2026'
      })
    });
    const activateData = await activateRes.json();
    assert(activateRes.status === 200, 'Hospital account activation returns HTTP 200');
    assert(activateData.success === true, 'Activation succeeded');

    const hospAfterAct = db.prepare('SELECT account_status FROM hospitals WHERE id = ?').get(newHospitalId);
    assert(hospAfterAct.account_status === 'ACTIVE', 'Database confirms account_status = ACTIVE');

    // Login with new password
    const hospLoginRes = await fetch(`${BASE_URL}/api/auth/hospital/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testHospEmail, password: 'ActivatedHospPassword@2026' })
    });
    const hospLoginData = await hospLoginRes.json();
    assert(hospLoginRes.status === 200, 'Hospital login succeeds with HTTP 200');
    assert(hospLoginData.userType === 'HOSPITAL', 'userType returned is HOSPITAL');
    assert(Boolean(hospLoginData.token), 'Hospital session token issued');
    const newHospToken = hospLoginData.token;
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 8: Incorrect password is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- Case 8: Incorrect Password Rejected ---');
    const wrongPassRes = await fetch(`${BASE_URL}/api/auth/hospital/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testHospEmail, password: 'WrongPasswordABC' })
    });
    assert(wrongPassRes.status === 401, 'Incorrect password rejected with HTTP 401 Unauthorized');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 9: Hospital can access its own dashboard
    // -------------------------------------------------------------------------
    console.log('\n--- Case 9: Hospital Can Access Its Own Dashboard ---');
    const ownDashRes = await fetch(`${BASE_URL}/api/hospital/${newHospitalId}/dashboard-summary`, {
      headers: { 'Authorization': `Bearer ${newHospToken}` }
    });
    const ownDashData = await ownDashRes.json();
    assert(ownDashRes.status === 200, 'Own dashboard summary succeeds with HTTP 200');
    assert(ownDashData.hospitalId === newHospitalId, 'Dashboard data matches authenticated hospital ID');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 10: Hospital A cannot access Hospital B's records
    // -------------------------------------------------------------------------
    console.log("\n--- Case 10: Hospital A Cannot Access Hospital B's Records ---");
    // Metro Hospital is ID 1. New hospital is newHospitalId (e.g. 6).
    const crossDashRes = await fetch(`${BASE_URL}/api/hospital/1/dashboard-summary`, {
      headers: { 'Authorization': `Bearer ${newHospToken}` }
    });
    assert(crossDashRes.status === 403, 'Cross-hospital dashboard access blocked with HTTP 403 Forbidden');

    const crossInventoryRes = await fetch(`${BASE_URL}/api/inventory/1`, {
      headers: { 'Authorization': `Bearer ${newHospToken}` }
    });
    assert(crossInventoryRes.status === 403, 'Cross-hospital inventory access blocked with HTTP 403 Forbidden');

    const crossRequestsRes = await fetch(`${BASE_URL}/api/requests/hospital/1`, {
      headers: { 'Authorization': `Bearer ${newHospToken}` }
    });
    assert(crossRequestsRes.status === 403, 'Cross-hospital blood requests access blocked with HTTP 403 Forbidden');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 11: Unauthenticated users cannot access hospital APIs
    // -------------------------------------------------------------------------
    console.log('\n--- Case 11: Unauthenticated Users Cannot Access Hospital APIs ---');
    const unauthDash = await fetch(`${BASE_URL}/api/hospital/1/dashboard-summary`);
    assert(unauthDash.status === 401, 'Unauthenticated dashboard request returns HTTP 401 Unauthorized');

    const unauthInventory = await fetch(`${BASE_URL}/api/inventory/1`);
    assert(unauthInventory.status === 401, 'Unauthenticated inventory request returns HTTP 401 Unauthorized');

    const unauthRequests = await fetch(`${BASE_URL}/api/requests/hospital/1`);
    assert(unauthRequests.status === 401, 'Unauthenticated requests request returns HTTP 401 Unauthorized');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 12: Donor accounts cannot access hospital APIs
    // -------------------------------------------------------------------------
    console.log('\n--- Case 12: Donor Accounts Cannot Access Hospital APIs ---');
    // Login as Donor 1 (Rahul Sharma, +91 98765 43210, donor123)
    const donorLoginRes = await fetch(`${BASE_URL}/api/auth/donor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '9876543210', password: 'donor123' })
    });
    const donorLoginData = await donorLoginRes.json();
    assert(donorLoginRes.status === 200, 'Donor login succeeds with HTTP 200');
    const donorToken = donorLoginData.token;

    // Donor attempts to access hospital dashboard
    const donorHospDash = await fetch(`${BASE_URL}/api/hospital/1/dashboard-summary`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    assert(donorHospDash.status === 403, 'Donor token accessing hospital dashboard returns HTTP 403 Forbidden');

    // Donor attempts to access hospital inventory
    const donorHospInv = await fetch(`${BASE_URL}/api/inventory/1`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    assert(donorHospInv.status === 403, 'Donor token accessing hospital inventory returns HTTP 403 Forbidden');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 13: Logout invalidates the session
    // -------------------------------------------------------------------------
    console.log('\n--- Case 13: Logout Invalidates the Session ---');
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${newHospToken}` }
    });
    assert(logoutRes.status === 200, 'Logout request returns HTTP 200');

    // Attempt access with logged-out token
    const afterLogoutRes = await fetch(`${BASE_URL}/api/hospital/${newHospitalId}/dashboard-summary`, {
      headers: { 'Authorization': `Bearer ${newHospToken}` }
    });
    assert(afterLogoutRes.status === 401, 'Subsequent request with invalidated session returns HTTP 401 Unauthorized');
    passedTests++;

    // -------------------------------------------------------------------------
    // TEST CASE 14: Existing donor workflows continue working
    // -------------------------------------------------------------------------
    console.log('\n--- Case 14: Existing Donor Workflows Continue Working ---');
    // Verify donor profile access with valid donor token
    const donorProfileRes = await fetch(`${BASE_URL}/api/donor/1`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    const donorProfileData = await donorProfileRes.json();
    assert(donorProfileRes.status === 200, 'Donor can access own profile successfully');
    assert(donorProfileData.donor && donorProfileData.donor.id === 1, 'Donor profile matches Rahul Sharma');

    // Verify AI Demand Forecasting model execution
    const forecast = forecastDemand(1, 'O-', 'Packed Red Blood Cells (PRBC)');
    assert(Boolean(forecast && forecast.bloodGroup === 'O-'), 'AI Demand Forecasting model runs successfully');
    assert(typeof forecast.projectedShortage === 'number', 'Forecast outputs numeric shortage calculation');

    // Verify AI Smart Donor Matching execution
    const match = matchDonorsForRequest({
      hospitalId: 1,
      bloodGroup: 'O-',
      component: 'Packed Red Blood Cells (PRBC)',
      radiusKm: 25,
      urgency: 'CRITICAL'
    });
    assert(match.compatibleGroups.includes('O-'), 'Donor matching identifies compatible groups');
    assert(Array.isArray(match.rankedDonors), 'Ranked donors list returned');
    passedTests++;

    console.log('\n================================================================');
    console.log(`>>> ALL ${passedTests}/${totalTests} TEST CASES VERIFIED SUCCESSFULLY! <<<`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST RUN FAILED:', error);
    process.exit(1);
  }
}

runTests();
