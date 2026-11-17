process.env.PORT = '5002';
const app = require('./index');
const { db } = require('./db/database');
const { forecastDemand } = require('./ai/demandForecasting');
const { matchDonorsForRequest } = require('./ai/donorMatching');

async function runTests() {
  console.log('================================================================');
  console.log('       RAKTSETU COMPREHENSIVE ONBOARDING & SECURITY SUITE       ');
  console.log('================================================================\n');

  // Wait 1 second for express server to bind port
  await new Promise(r => setTimeout(r, 1000));

  const BASE_URL = `http://127.0.0.1:5002`;

  let passedTests = 0;
  let totalTests = 18;

  function assert(condition, message, extra) {
    if (!condition) {
      console.error(`  ❌ FAILED: ${message}`, extra ? extra : '');
      throw new Error(message);
    }
    console.log(`  ✅ PASSED: ${message}`);
  }

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: Public visitor submits donor registration
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 1: Public Visitor Submits Donor Registration ---');
    const testMobile = '9988776655';
    // Clean test mobile if previously run
    db.prepare("DELETE FROM notifications WHERE application_id IN (SELECT id FROM donor_applications WHERE replace(replace(replace(mobile, ' ', ''), '+', ''), '-', '') LIKE '%9988776655%')").run();
    db.prepare("DELETE FROM donor_accounts WHERE mobile LIKE '%9988776655%' OR replace(replace(replace(mobile, ' ', ''), '+', ''), '-', '') LIKE '%9988776655%'").run();
    db.prepare("DELETE FROM donor_applications WHERE mobile LIKE '%9988776655%' OR replace(replace(replace(mobile, ' ', ''), '+', ''), '-', '') LIKE '%9988776655%'").run();
    db.prepare("DELETE FROM donors WHERE mobile LIKE '%9988776655%' OR replace(replace(replace(mobile, ' ', ''), '+', ''), '-', '') LIKE '%9988776655%'").run();

    const regPayload = {
      fullName: 'Ananya Deshmukh',
      dob: '1996-08-15',
      gender: 'Female',
      mobile: testMobile,
      email: 'ananya.test@example.com',
      bloodGroup: 'B+',
      address: 'Flat 402, Green Park Avenue',
      city: 'Mumbai',
      pincode: '400012',
      preferredHospitalId: 1,
      consentContact: true
    };

    const regRes = await fetch(`${BASE_URL}/api/applications/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload)
    });
    const regData = await regRes.json();
    assert(regRes.status === 201, 'Registration returns HTTP 201 Created', { status: regRes.status, data: regData });
    assert(regData.success === true, 'Response contains success: true');
    assert(Boolean(regData.applicationId), `Generated Application ID: ${regData.applicationId}`);
    assert(regData.status === 'PENDING_APPROVAL', 'Initial status is PENDING_APPROVAL');
    const testAppId = regData.applicationId;
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 2: Application saved with PENDING_APPROVAL in database
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 2: Application Saved in Database with PENDING_APPROVAL ---');
    const savedApp = db.prepare('SELECT * FROM donor_applications WHERE application_id = ?').get(testAppId);
    assert(Boolean(savedApp), 'Application found in database');
    assert(savedApp.status === 'PENDING_APPROVAL', 'Status in database is PENDING_APPROVAL');
    assert(savedApp.full_name === 'Ananya Deshmukh', 'Donor name matches submitted application');
    assert(Boolean(savedApp.activation_otp), 'Activation OTP generated and stored');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 3: Pending applicant cannot log in
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Pending Applicant Cannot Log In ---');
    const loginPendingRes = await fetch(`${BASE_URL}/api/auth/donor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testMobile, password: 'Password@123' })
    });
    const loginPendingData = await loginPendingRes.json();
    assert(loginPendingRes.status === 403, 'Pending applicant login rejected with HTTP 403 Forbidden');
    assert(loginPendingData.registrationStatus === 'PENDING_APPROVAL', 'Response indicates PENDING_APPROVAL');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 4: Pending applicant cannot activate account
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 4: Pending Applicant Cannot Activate Account ---');
    const reqCodeRes = await fetch(`${BASE_URL}/api/auth/donor/request-activation-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: testAppId, mobile: testMobile })
    });
    const reqCodeData = await reqCodeRes.json();
    assert(reqCodeRes.status === 403, 'Requesting activation code for pending application returns HTTP 403 Forbidden');
    assert(reqCodeData.error.includes('PENDING APPROVAL'), 'Error clarifies approval is required first');

    const activatePendingRes = await fetch(`${BASE_URL}/api/auth/donor/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: testAppId,
        mobile: testMobile,
        activationCode: savedApp.activation_otp,
        password: 'SecurePassword@123'
      })
    });
    assert(activatePendingRes.status === 403, 'Activating pending application directly returns HTTP 403');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 5: Hospital staff can view pending applications
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 5: Hospital Staff Can View Pending Applications ---');
    // Login as hospital first
    const hospLoginRes = await fetch(`${BASE_URL}/api/auth/hospital/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'metro.bloodbank@raktsetu.org', password: 'hospital123' })
    });
    const hospLoginData = await hospLoginRes.json();
    assert(hospLoginRes.status === 200, 'Hospital login successful with HTTP 200');
    assert(Boolean(hospLoginData.token), 'Hospital session token received');
    const hospToken = hospLoginData.token;

    // Fetch applications
    const appsListRes = await fetch(`${BASE_URL}/api/hospital/applications?status=PENDING_APPROVAL`, {
      headers: { 'Authorization': `Bearer ${hospToken}` }
    });
    const appsListData = await appsListRes.json();
    assert(appsListRes.status === 200, 'Fetching hospital applications returns HTTP 200');
    const targetApp = appsListData.applications.find(a => a.application_id === testAppId);
    assert(Boolean(targetApp), `Submitted application ${testAppId} present in pending applications list`);
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 6: Unauthorised user cannot approve application
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 6: Unauthorised User Cannot Approve Application ---');
    const unauthApproveRes = await fetch(`${BASE_URL}/api/hospital/applications/${targetApp.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    assert(unauthApproveRes.status === 401, 'Unauthenticated approval rejected with HTTP 401 Unauthorized');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 7: Hospital staff can approve application
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 7: Hospital Staff Can Approve Application ---');
    const approveRes = await fetch(`${BASE_URL}/api/hospital/applications/${targetApp.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hospToken}`
      },
      body: JSON.stringify({ notes: 'Verified ID proof and contact information.' })
    });
    const approveData = await approveRes.json();
    assert(approveRes.status === 200, 'Hospital approval returns HTTP 200');
    assert(approveData.success === true, 'Approval marked successful');

    const appAfterApproval = db.prepare('SELECT * FROM donor_applications WHERE id = ?').get(targetApp.id);
    assert(appAfterApproval.status === 'APPROVED', 'Application status updated to APPROVED');
    assert(Boolean(appAfterApproval.reviewed_at), 'Reviewed timestamp recorded');
    assert(Boolean(appAfterApproval.donor_id), 'Donor profile created with ID: ' + appAfterApproval.donor_id);

    const newDonor = db.prepare('SELECT * FROM donors WHERE id = ?').get(appAfterApproval.donor_id);
    assert(newDonor.registration_status === 'APPROVED', 'Donor registration_status is APPROVED');
    assert(newDonor.account_status === 'NOT_ACTIVATED', 'Donor account_status is initially NOT_ACTIVATED');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 8: Approved donor completes activation with OTP and password
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 8: Approved Donor Completes First-Time Activation ---');
    // Request activation code
    const otpReqRes = await fetch(`${BASE_URL}/api/auth/donor/request-activation-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: testAppId, mobile: testMobile })
    });
    const otpReqData = await otpReqRes.json();
    assert(otpReqRes.status === 200, 'Request activation code for approved application returns HTTP 200');
    assert(Boolean(otpReqData.activationCode), 'Demo activation code / OTP returned: ' + otpReqData.activationCode);

    // Complete activation
    const newPassword = 'DonorStrongPassword@2026';
    const activateRes = await fetch(`${BASE_URL}/api/auth/donor/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        applicationId: testAppId,
        mobile: testMobile,
        otp: otpReqData.activationCode,
        password: newPassword
      })
    });
    const activateData = await activateRes.json();
    assert(activateRes.status === 200, 'Activation returns HTTP 200');
    assert(activateData.success === true, 'Activation succeeded');

    const donorAfterActivation = db.prepare('SELECT * FROM donors WHERE id = ?').get(appAfterApproval.donor_id);
    assert(donorAfterActivation.account_status === 'ACTIVE', 'Donor account_status is now ACTIVE');
    const donorAccount = db.prepare('SELECT * FROM donor_accounts WHERE donor_id = ?').get(appAfterApproval.donor_id);
    assert(Boolean(donorAccount), 'Donor account record created');
    assert(Boolean(donorAccount.password_salt), 'Salt stored in donor_accounts');
    assert(Boolean(donorAccount.password_hash), 'PBKDF2 password hash stored in donor_accounts');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 9: Activated donor can log in with valid password
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 9: Activated Donor Logs In With Valid Password ---');
    const donorLoginRes = await fetch(`${BASE_URL}/api/auth/donor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testMobile, password: newPassword })
    });
    const donorLoginData = await donorLoginRes.json();
    assert(donorLoginRes.status === 200, 'Donor login successful with HTTP 200');
    assert(donorLoginData.userType === 'DONOR', 'User type returned is DONOR');
    assert(Boolean(donorLoginData.token), 'Donor session token received');
    assert(donorLoginData.donor.id === appAfterApproval.donor_id, 'Donor profile matches activated applicant');
    const donorToken = donorLoginData.token;
    const testDonorId = donorLoginData.donor.id;
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 10: Incorrect password is rejected
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 10: Incorrect Password Rejected ---');
    const wrongPassRes = await fetch(`${BASE_URL}/api/auth/donor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testMobile, password: 'WrongPasswordXYZ' })
    });
    assert(wrongPassRes.status === 401, 'Wrong password rejected with HTTP 401 Unauthorized');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 11: Rejected applicant cannot activate account
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 11: Rejected Applicant Cannot Activate Account ---');
    const rejReqRes = await fetch(`${BASE_URL}/api/auth/donor/request-activation-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: 'DEMO-APP-REJECTED', mobile: '9811166677' })
    });
    const rejReqData = await rejReqRes.json();
    assert(rejReqRes.status === 403, 'Requesting activation code for rejected application returns HTTP 403 Forbidden');
    assert(rejReqData.error.includes('REJECTED'), 'Error indicates application was rejected');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 12: Donor cannot access another donor's records
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 12: Donor Cannot Access Another Donor Records ---');
    const otherDonorId = testDonorId === 1 ? 2 : 1;
    const crossAccessRes = await fetch(`${BASE_URL}/api/donor/${otherDonorId}`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    assert(crossAccessRes.status === 403, 'Cross-donor profile access blocked with HTTP 403 Forbidden');

    const ownAccessRes = await fetch(`${BASE_URL}/api/donor/${testDonorId}`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    assert(ownAccessRes.status === 200, 'Own profile access succeeds with HTTP 200');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 13: Donor cannot access hospital routes
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 13: Donor Cannot Access Hospital Routes ---');
    const donorToHospRes = await fetch(`${BASE_URL}/api/hospital/applications`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    assert(donorToHospRes.status === 403, 'Donor token accessing hospital route blocked with HTTP 403 Forbidden');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 14: Unauthenticated user cannot access protected dashboard endpoints
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 14: Unauthenticated Access to Dashboards Blocked ---');
    const unauthHosp = await fetch(`${BASE_URL}/api/hospital/1/dashboard-summary`);
    assert(unauthHosp.status === 401, 'Unauthenticated hospital dashboard returns HTTP 401');

    const unauthDonor = await fetch(`${BASE_URL}/api/donor/1`);
    assert(unauthDonor.status === 401, 'Unauthenticated donor profile returns HTTP 401');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 15: Logout properly invalidates session token
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 15: Logout Properly Invalidates Session Token ---');
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    assert(logoutRes.status === 200, 'Logout request returns HTTP 200');

    // Attempt to access again with invalidated token
    const afterLogoutRes = await fetch(`${BASE_URL}/api/donor/${testDonorId}`, {
      headers: { 'Authorization': `Bearer ${donorToken}` }
    });
    assert(afterLogoutRes.status === 401, 'Subsequent request with logged-out token returns HTTP 401 Unauthorized');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 16: Registration approval does NOT approve medical screening
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 16: Registration Approval Does Not Approve Medical Screening ---');
    const donorRecord = db.prepare('SELECT registration_status, account_status, medical_screening_status FROM donors WHERE id = ?').get(testDonorId);
    assert(donorRecord.registration_status === 'APPROVED', 'registration_status is APPROVED');
    assert(donorRecord.account_status === 'ACTIVE', 'account_status is ACTIVE');
    assert(
      donorRecord.medical_screening_status === 'PENDING_SCREENING',
      'medical_screening_status remains PENDING_SCREENING (Strict medical separation confirmed)'
    );
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 17: Existing AI Demand Forecasting & Smart Matching Continue Working
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 17: AI Demand Forecasting & Smart Matching Continue Working ---');
    const forecast = forecastDemand(1, 'O-', 'Packed Red Blood Cells (PRBC)');
    assert(Boolean(forecast && forecast.bloodGroup === 'O-'), 'AI Forecast engine executes successfully');
    assert(typeof forecast.projectedShortage === 'number', 'Forecast outputs numeric shortage');
    assert(Boolean(forecast.modelMetrics && forecast.modelMetrics.algorithm), 'Model metrics include algorithm specification');

    const matchResult = matchDonorsForRequest({
      hospitalId: 1,
      bloodGroup: 'B+',
      component: 'Packed Red Blood Cells (PRBC)',
      radiusKm: 30,
      urgency: 'HIGH'
    });
    assert(matchResult.compatibleGroups.includes('B+'), 'Donor matching identifies compatible blood groups');
    assert(Array.isArray(matchResult.rankedDonors), 'Ranked donors returned as array');
    passedTests++;

    // -------------------------------------------------------------------------
    // SCENARIO 18: Data persistence verified in SQLite
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 18: SQLite Persistence Verified ---');
    const persistedApp = db.prepare('SELECT application_id, status FROM donor_applications WHERE application_id = ?').get(testAppId);
    assert(persistedApp.status === 'APPROVED', 'Application state persisted in SQLite disk file');
    const persistedAcc = db.prepare('SELECT id FROM donor_accounts WHERE donor_id = ?').get(testDonorId);
    assert(Boolean(persistedAcc), 'Donor account record persisted in SQLite disk file');
    passedTests++;

    console.log('\n================================================================');
    console.log(`>>> ALL ${passedTests}/${totalTests} SCENARIOS VERIFIED SUCCESSFULLY! <<<`);
    console.log('================================================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST SUITE RUN TERMINATED WITH ERROR:', error);
    process.exit(1);
  }
}

runTests();
