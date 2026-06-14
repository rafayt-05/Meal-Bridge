const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function sanitizeUser(u){
  const o = u.toJSON ? u.toJSON() : u;
  delete o.password;
  return o;
}

function signToken(user){
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

// Register: email + password + role + optional location
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, address, lat, lng } = req.body;
    if(!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password and role are required' });
    if(!['donor','ngo'].includes(role)) return res.status(400).json({ error: 'role must be donor or ngo' });

    const existing = await User.findOne({ where: { email } });
    if(existing) return res.status(409).json({ error: 'Email is already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, password: hash, role,
      phone: phone || null,
      address: address || null,
      lat: typeof lat === 'number' ? lat : (lat ? parseFloat(lat) : null),
      lng: typeof lng === 'number' ? lng : (lng ? parseFloat(lng) : null)
    });

    const token = signToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email || !password) return res.status(400).json({ error: 'email and password required' });
    const user = await User.findOne({ where: { email } });
    if(!user || !user.password) return res.status(401).json({ error: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.password);
    if(!ok) return res.status(401).json({ error: 'Invalid email or password' });
    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Returns current user from token
router.get('/me', async (req, res) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if(!user) return res.status(401).json({ error: 'Invalid token' });
    res.json({ user: sanitizeUser(user) });
  } catch(err){
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Update profile (e.g. set location later)
router.patch('/me', async (req, res) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(payload.id);
    if(!user) return res.status(401).json({ error: 'Invalid token' });
    const fields = ['name','phone','address','lat','lng'];
    fields.forEach(f => { if(req.body[f] !== undefined) user[f] = req.body[f]; });
    await user.save();
    res.json({ user: sanitizeUser(user) });
  } catch(err){
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
