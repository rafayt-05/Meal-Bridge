const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    provider: { type: DataTypes.STRING },
    providerId: { type: DataTypes.STRING },

    email: { type: DataTypes.STRING, unique: true },
    name: { type: DataTypes.STRING },
    password: { type: DataTypes.STRING },

    phone: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    lat: { type: DataTypes.FLOAT },
    lng: { type: DataTypes.FLOAT },

    role: {
      type: DataTypes.ENUM('donor', 'ngo', 'admin'),
      defaultValue: 'donor'
    }
  });

  return User;
};
