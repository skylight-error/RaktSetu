const { db } = require('../db/database');

/**
 * Component-specific blood compatibility tables
 */
const RBC_COMPATIBILITY = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] // Universal RBC recipient
};

const PLASMA_COMPATIBILITY = {
  // For plasma, AB is universal donor, O is universal recipient
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A-', 'A+', 'AB-', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B-', 'B+', 'AB-', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB-', 'AB+']
};

/**
 * Haversine formula: calculates great-circle distance between two points in km
 */
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 5.0; // fallback default
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Intelligent Matcher & Ranker
 */
function matchDonorsForRequest({
  hospitalId = 1,
  bloodGroup = 'O-',
  component = 'Packed Red Blood Cells (PRBC)',
  radiusKm = 25,
  urgency = 'CRITICAL'
}) {
  // 1. Fetch hospital details
  const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(hospitalId);
  if (!hospital) {
    throw new Error('Hospital not found');
  }

  // 2. Determine compatible donor blood groups
  let compatibleGroups = [];
  if (component.includes('Plasma')) {
    compatibleGroups = PLASMA_COMPATIBILITY[bloodGroup] || [bloodGroup];
  } else {
    compatibleGroups = RBC_COMPATIBILITY[bloodGroup] || [bloodGroup];
  }

  // 3. Query all candidates who satisfy core safety & medical prerequisites
  // - Approved screening
  // - Currently valid screening date
  // - Not unavailable
  // - Reached next eligible donation date
  // - Consented to contact
  const allDonors = db.prepare(`
    SELECT * FROM donors
    WHERE screening_status = 'APPROVED'
      AND consent_contact = 1
      AND (screening_valid_until IS NULL OR screening_valid_until >= date('now'))
      AND (weekly_availability IN ('AVAILABLE', 'MAYBE'))
      AND (next_eligible_date IS NULL OR next_eligible_date <= date('now'))
  `).all();

  const candidates = [];
  const today = new Date();

  for (const donor of allDonors) {
    // Check blood group compatibility
    if (!compatibleGroups.includes(donor.blood_group)) {
      continue;
    }

    // Calculate distance to requesting hospital
    const distanceKm = calculateHaversineDistance(
      hospital.latitude,
      hospital.longitude,
      donor.latitude,
      donor.longitude
    );

    // Apply distance radius filter
    if (distanceKm > radiusKm) {
      continue;
    }

    // 4. Calculate Explainable Multi-Criteria Priority Score (0 to 100)
    let score = 0;
    const reasons = [];

    // Blood compatibility bonus
    if (donor.blood_group === bloodGroup) {
      score += 35;
      reasons.push(`Exact blood group match (${donor.blood_group})`);
    } else {
      score += 25;
      reasons.push(`Clinically compatible cross-donor (${donor.blood_group} for ${bloodGroup} ${component})`);
    }

    // Proximity factor (up to 30 pts)
    const proximityScore = Math.max(0, Math.round(30 * (1 - distanceKm / radiusKm)));
    score += proximityScore;
    reasons.push(`Approx. ${distanceKm} km from ${hospital.name}`);

    // Weekly availability factor (up to 20 pts)
    if (donor.weekly_availability === 'AVAILABLE') {
      score += 20;
      reasons.push('Confirmed available this week ("Yes, I\'m available")');
    } else if (donor.weekly_availability === 'MAYBE') {
      score += 10;
      reasons.push('Tentatively available ("Maybe, contact me first")');
    }

    // Screening validity & freshness factor (up to 15 pts)
    if (donor.screening_valid_until) {
      score += 15;
      reasons.push(`Screening approved by hospital medical staff (valid until ${donor.screening_valid_until})`);
    } else {
      score += 5;
    }

    // Donation interval factor
    if (donor.last_donation_date) {
      const lastDonDate = new Date(donor.last_donation_date);
      const daysSince = Math.round((today - lastDonDate) / (1000 * 60 * 60 * 24));
      if (daysSince > 90) {
        reasons.push(`Healthy rest interval (${daysSince} days since last donation)`);
      }
    } else {
      reasons.push('First-time verified donor with full baseline eligibility');
    }

    // Build consolidated human-readable explanation
    const explanation = `Prioritised because donor has valid medical screening approval, is located approx ${distanceKm} km away, is ${donor.weekly_availability.toLowerCase()} this week, and has ${reasons[0].toLowerCase()}.`;

    candidates.push({
      donorId: donor.id,
      fullName: donor.full_name,
      bloodGroup: donor.blood_group,
      age: donor.age,
      gender: donor.gender,
      mobile: donor.mobile,
      email: donor.email,
      address: donor.address,
      city: donor.city,
      pincode: donor.pincode,
      weeklyAvailability: donor.weekly_availability,
      screeningStatus: donor.screening_status,
      screeningValidUntil: donor.screening_valid_until,
      lastDonationDate: donor.last_donation_date,
      nextEligibleDate: donor.next_eligible_date,
      distanceKm,
      priorityScore: Math.min(100, score),
      reasons,
      explanation
    });
  }

  // 5. Sort candidates by Priority Score descending
  candidates.sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    hospitalId,
    hospitalName: hospital.name,
    requiredBloodGroup: bloodGroup,
    component,
    urgency,
    radiusKm,
    compatibleGroups,
    totalMatchingDonors: candidates.length,
    rankedDonors: candidates,
    matchingRuleSummary: [
      `Component: ${component} (Compatibility pool: ${compatibleGroups.join(', ')})`,
      'Screening: Verified hospital approval (validity active)',
      'Availability: Active response for current week (AVAILABLE / MAYBE)',
      'Donation interval: Met mandated recovery period',
      `Search radius: ${radiusKm} km from hospital coordinates`
    ]
  };
}

module.exports = {
  matchDonorsForRequest,
  calculateHaversineDistance,
  RBC_COMPATIBILITY,
  PLASMA_COMPATIBILITY
};
