const express = require('express');
const { NGO } = require('../models');

const router = express.Router();

function toRad(d){ return d * Math.PI / 180; }
function haversine(lat1, lng1, lat2, lng2){
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// List NGOs. If ?lat&lng provided, return sorted by distance with distanceKm field.
router.get('/', async (req, res) => {
  const ngos = await NGO.findAll();
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  if(!Number.isNaN(lat) && !Number.isNaN(lng)){
    const decorated = ngos
      .map(n => ({ ...n.toJSON(), distanceKm: Number(haversine(lat, lng, n.lat, n.lng).toFixed(2)) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return res.json(decorated);
  }
  res.json(ngos);
});

router.post('/', async (req, res) => {
  const ngo = await NGO.create(req.body);
  res.json(ngo);
});

router.post('/:id/verify', async (req, res) => {
  const ngo = await NGO.findByPk(req.params.id);
  if (!ngo) return res.status(404).json({ error: 'Not found' });
  ngo.verified = true;
  await ngo.save();
  res.json(ngo);
});

module.exports = router;
