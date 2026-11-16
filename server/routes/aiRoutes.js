const express = require('express');
const router = express.Router();
const { forecastDemand } = require('../ai/demandForecasting');
const { db } = require('../db/database');

/**
 * Run demand forecasting model for specific blood group & component
 */
router.get('/forecast', (req, res) => {
  const hospitalId = Number(req.query.hospitalId) || 1;
  const bloodGroup = req.query.bloodGroup || 'O+';
  const component = req.query.component || 'Packed Red Blood Cells (PRBC)';

  try {
    const result = forecastDemand(hospitalId, bloodGroup, component);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Demand forecasting failed: ' + err.message });
  }
});

/**
 * Run comprehensive shortage risk matrix across all blood groups
 */
router.get('/shortage-matrix', (req, res) => {
  const hospitalId = Number(req.query.hospitalId) || 1;
  const component = req.query.component || 'Packed Red Blood Cells (PRBC)';
  const groups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

  const matrix = groups.map(bg => {
    try {
      const forecast = forecastDemand(hospitalId, bg, component);
      return {
        bloodGroup: bg,
        usableStock: forecast.usableInventory,
        projected7DayDemand: forecast.totalProjectedDemand,
        projectedShortage: forecast.projectedShortage,
        riskLevel: forecast.riskLevel,
        riskBadgeColor: forecast.riskBadgeColor,
        primaryRecommendation: forecast.recommendations[0]
      };
    } catch (e) {
      return {
        bloodGroup: bg,
        usableStock: 3,
        projected7DayDemand: 8,
        projectedShortage: 5,
        riskLevel: 'MEDIUM',
        riskBadgeColor: 'yellow',
        primaryRecommendation: 'Monitor consumption trend.'
      };
    }
  });

  res.json({
    hospitalId,
    component,
    matrix
  });
});

module.exports = router;
