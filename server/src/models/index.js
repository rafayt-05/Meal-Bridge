const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '..', '..', 'db', 'database.sqlite'),
  logging: false,
});

const User = require('./user')(sequelize);
const NGO = require('./ngo')(sequelize);
const Offer = require('./offer')(sequelize);

module.exports = { sequelize, User, NGO, Offer };
