const bcrypt = require('bcryptjs');
const { NGO, User } = require('./models');

const DEMO_NGOS = [
  { name: 'Edhi Foundation',          address: 'Mithadar, Karachi',                 lat: 24.8568, lng: 67.0090, contact_email: 'info@edhi.org',     contact_phone: '+92 21 32710066', description: 'Largest welfare organisation in Pakistan. Operates ambulances, shelters and food drives.' },
  { name: 'Saylani Welfare Trust',    address: 'Bahadurabad, Karachi',              lat: 24.8775, lng: 67.0795, contact_email: 'info@saylaniwelfare.com', contact_phone: '+92 21 111 729 526', description: 'Runs a daily langar serving free hot meals to thousands across the country.' },
  { name: 'JDC Foundation',           address: 'PECHS Block 2, Karachi',            lat: 24.8676, lng: 67.0698, contact_email: 'help@jdcwelfare.org', contact_phone: '+92 21 34556789', description: 'Free ambulances, ration drives and orphan support.' },
  { name: 'Alkhidmat Foundation',     address: 'Gulshan-e-Iqbal, Karachi',          lat: 24.9204, lng: 67.0972, contact_email: 'info@alkhidmat.org', contact_phone: '+92 21 111 760 760', description: 'Nationwide network distributing food and running orphanages.' },
  { name: 'Chhipa Welfare',           address: 'Kharadar, Karachi',                  lat: 24.8466, lng: 67.0014, contact_email: 'info@chhipa.org',    contact_phone: '+92 21 111 244 772', description: 'Food banks, ambulance service and burial services for the unclaimed.' },
  { name: 'Robin Hood Army Karachi',  address: 'DHA Phase 5, Karachi',              lat: 24.8016, lng: 67.0626, contact_email: 'karachi@robinhoodarmy.com', contact_phone: '+92 300 1234567', description: 'Volunteer movement that takes surplus food from restaurants to the less fortunate.' }
];

async function seedIfEmpty(){
  const count = await NGO.count();
  if(count === 0){
    await NGO.bulkCreate(DEMO_NGOS.map(n => ({ ...n, verified: true })));
    console.log(`  Seeded ${DEMO_NGOS.length} demo NGOs`);
  }

  // Create a demo donor + demo NGO account so the reviewer can try the app instantly.
  const demoDonorEmail = 'donor@example.com';
  const demoNgoEmail = 'ngo@example.com';
  const demoDonor = await User.findOne({ where: { email: demoDonorEmail } });
  if(!demoDonor){
    const pw = await bcrypt.hash('demo1234', 10);
    await User.create({
      name: 'Demo Donor', email: demoDonorEmail, password: pw, role: 'donor',
      address: 'Bhitai Road 38, Karachi', lat: 24.8607, lng: 67.0011, phone: '+92 300 0000001'
    });
    console.log('  Seeded demo donor → donor@example.com / demo1234');
  }
  const demoNgo = await User.findOne({ where: { email: demoNgoEmail } });
  if(!demoNgo){
    const pw = await bcrypt.hash('demo1234', 10);
    await User.create({
      name: 'Saylani Volunteer', email: demoNgoEmail, password: pw, role: 'ngo',
      address: 'Bahadurabad, Karachi', lat: 24.8775, lng: 67.0795, phone: '+92 300 0000002'
    });
    console.log('  Seeded demo NGO   → ngo@example.com   / demo1234');
  }
}

module.exports = { seedIfEmpty, DEMO_NGOS };

// Run seed standalone: `npm run seed`
if(require.main === module){
  const { sequelize } = require('./models');
  (async () => {
    await sequelize.sync();
    await seedIfEmpty();
    process.exit(0);
  })();
}
