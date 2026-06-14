const express = require('express');
const { Offer, User } = require('../models');
const auth = require('../middleware/auth');
const router = express.Router();

function toRad(d){ return d * Math.PI / 180; }
function haversine(lat1, lng1, lat2, lng2){
  if([lat1,lng1,lat2,lng2].some(v => v === null || v === undefined || Number.isNaN(v))) return null;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function decorate(offers, viewer){
  const ids = [...new Set(offers.map(o => o.userId).filter(Boolean))];
  const users = ids.length ? await User.findAll({ where: { id: ids } }) : [];
  const byId = Object.fromEntries(users.map(u => [u.id, u]));
  return offers.map(o => {
    const donor = byId[o.userId];
    const distance = viewer && viewer.lat && viewer.lng && o.lat && o.lng
      ? haversine(viewer.lat, viewer.lng, o.lat, o.lng)
      : null;
    return {
      ...o.toJSON(),
      donor: donor ? { id: donor.id, name: donor.name, phone: donor.phone, address: donor.address } : null,
      distanceKm: distance != null ? Number(distance.toFixed(2)) : null
    };
  });
}

// List offers (optionally filter to mine, optionally include distance from a point)
router.get('/', async (req, res) => {
  try {
    const where = {};
    if(req.query.status) where.status = req.query.status;

    const offers = await Offer.findAll({ where, order: [['createdAt','DESC']] });

    let viewer = null;
    if(req.query.lat && req.query.lng){
      viewer = { lat: parseFloat(req.query.lat), lng: parseFloat(req.query.lng) };
    }
    const decorated = await decorate(offers, viewer);
    if(viewer) decorated.sort((a,b) => (a.distanceKm ?? 9e9) - (b.distanceKm ?? 9e9));
    res.json(decorated);
  } catch(err){
    console.error(err);
    res.status(500).json({ error: 'Could not load offers' });
  }
});

// My offers (donor)
router.get('/mine', auth, async (req, res) => {
  const offers = await Offer.findAll({ where: { userId: req.user.id }, order: [['createdAt','DESC']] });
  const decorated = await decorate(offers, null);
  res.json(decorated);
});

// Offers accepted by current NGO
router.get('/accepted', auth, async (req, res) => {
  if(req.user.role !== 'ngo') return res.status(403).json({ error: 'NGO only' });
  const offers = await Offer.findAll({ where: { acceptedBy: req.user.id }, order: [['acceptedAt','DESC']] });
  const decorated = await decorate(offers, { lat: req.user.lat, lng: req.user.lng });
  res.json(decorated);
});

router.post('/', auth, async (req, res) => {
  try {
    if(req.user.role !== 'donor' && req.user.role !== 'admin') return res.status(403).json({ error: 'Only donors can post offers' });
    const data = { ...req.body, userId: req.user.id };
    // Fallback to user's saved location
    if(data.lat == null) data.lat = req.user.lat;
    if(data.lng == null) data.lng = req.user.lng;
    if(!data.address) data.address = req.user.address;
    const offer = await Offer.create(data);
    res.status(201).json(offer);
  } catch(err){
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  const offer = await Offer.findByPk(req.params.id);
  if(!offer) return res.status(404).json({ error: 'Not found' });
  if(String(offer.userId) !== String(req.user.id) && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  await offer.destroy();
  res.json({ ok: true });
});

router.post('/:id/accept', auth, async (req, res) => {
  if(req.user.role !== 'ngo') return res.status(403).json({ error: 'Only NGOs can accept offers' });
  const offer = await Offer.findByPk(req.params.id);
  if(!offer) return res.status(404).json({ error: 'Not found' });
  if(offer.status !== 'open') return res.status(409).json({ error: 'This offer is no longer available' });
  offer.acceptedBy = req.user.id;
  offer.acceptedAt = new Date();
  offer.status = 'accepted';
  await offer.save();
  res.json(offer);
});

router.post('/:id/collected', auth, async (req, res) => {
  const offer = await Offer.findByPk(req.params.id);
  if(!offer) return res.status(404).json({ error: 'Not found' });
  if(String(offer.acceptedBy) !== String(req.user.id) && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  offer.status = 'collected';
  await offer.save();
  res.json(offer);
});

module.exports = router;
