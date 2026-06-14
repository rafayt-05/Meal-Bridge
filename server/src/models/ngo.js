const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NGO = sequelize.define('NGO', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    name: DataTypes.STRING,
    description: DataTypes.TEXT,

    verified: { type: DataTypes.BOOLEAN, defaultValue: false },

    address: DataTypes.STRING,
    lat: DataTypes.FLOAT,
    lng: DataTypes.FLOAT,

    contact_email: DataTypes.STRING,
    contact_phone: DataTypes.STRING,

    image_url: DataTypes.STRING
  });

  return NGO;
};