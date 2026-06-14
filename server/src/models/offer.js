const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Offer = sequelize.define('Offer', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    userId: { type: DataTypes.INTEGER, allowNull: false },

    itemName: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
    category: { type: DataTypes.STRING }, // cooked / raw / packaged / bakery / produce

    pickup: DataTypes.STRING,
    address: DataTypes.STRING,

    lat: DataTypes.FLOAT,
    lng: DataTypes.FLOAT,

    expiry: DataTypes.DATE,
    photo: DataTypes.STRING, // URL or data URI

    acceptedBy: { type: DataTypes.INTEGER, allowNull: true }, // NGO user id
    acceptedAt: DataTypes.DATE,

    status: {
      type: DataTypes.ENUM('open', 'accepted', 'collected', 'cancelled'),
      defaultValue: 'open'
    }
  });

  return Offer;
};
