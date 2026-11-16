const http = require('node:http');
const { forecastDemand } = require('./ai/demandForecasting');
const { matchDonorsForRequest } = require('./ai/donorMatching');
const { db } = require('./db/database');
const app = require('./index');

console.log('--- 1. Testing SQLite Database & Counts ---');
const hospitals = db.prepare('SELECT COUNT(*) as c FROM hospitals').get().c;
const donors = db.prepare('SELECT COUNT(*) as c FROM donors').get().c;
const inventory = db.prepare('SELECT COUNT(*) as c FROM inventory').get().c;
const demand = db.prepare('SELECT COUNT(*) as c FROM historical_demand').get().c;
console.log(`Hospitals: ${hospitals}, Donors: ${donors}, Inventory: ${inventory}, Historical Demand records: ${demand}`);

console.log('--- 2. Testing AI Demand Forecasting Engine ---');
const forecast = forecastDemand(1, 'O-', 'Packed Red Blood Cells (PRBC)');
console.log(`Blood Group: ${forecast.bloodGroup}`);
console.log(`Usable Inventory: ${forecast.usableInventory}`);
console.log(`7-Day Predicted Demand: ${forecast.totalProjectedDemand}`);
console.log(`Projected Shortage: ${forecast.projectedShortage}`);
console.log(`Assessed Risk Level: ${forecast.riskLevel}`);
console.log(`Model Algorithm: ${forecast.modelMetrics.algorithm}`);
console.log(`Model R^2: ${forecast.modelMetrics.r2Score}, MAE: ${forecast.modelMetrics.maeUnits}`);

console.log('--- 3. Testing Intelligent Donor Matching Engine ---');
const matching = matchDonorsForRequest({
  hospitalId: 1,
  bloodGroup: 'O-',
  component: 'Packed Red Blood Cells (PRBC)',
  radiusKm: 25,
  urgency: 'CRITICAL'
});
console.log(`Compatible groups: ${matching.compatibleGroups.join(', ')}`);
console.log(`Candidates found within ${matching.radiusKm}km: ${matching.totalMatchingDonors}`);
if (matching.rankedDonors.length > 0) {
  const top = matching.rankedDonors[0];
  console.log(`Top Candidate: ${top.fullName} (${top.bloodGroup})`);
  console.log(`Priority Score: ${top.priorityScore}/100, Distance: ~${top.distanceKm} km`);
  console.log(`Reasoning: ${top.explanation}`);
}

console.log('--- 4. Testing End-to-End Server Launch ---');
const server = app.listen(5000, () => {
  console.log('Express test server listening on port 5000');
});

setTimeout(async () => {
  const testFetch = (path) => new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:5000${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });

  try {
    const resHtml = await testFetch('/');
    console.log(`Frontend HTML check: HTTP ${resHtml.status}, contains 'RaktSetu': ${resHtml.body.includes('RaktSetu')}`);

    const resSum = await testFetch('/api/hospital/1/dashboard-summary');
    const sumData = JSON.parse(resSum.body);
    console.log(`API Summary check: HTTP ${resSum.status}, total blood units: ${sumData.metrics.totalBloodUnits}`);

    const resDemo = await testFetch('/api/auth/demo-accounts');
    const demoData = JSON.parse(resDemo.body);
    console.log(`Demo accounts: ${demoData.hospitals.length} hospitals, ${demoData.donors.length} donors loaded.`);

    console.log('====================================================');
    console.log('>>> ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY <<<');
    console.log('====================================================');
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('Test fetch failed:', err);
    server.close();
    process.exit(1);
  }
}, 500);
