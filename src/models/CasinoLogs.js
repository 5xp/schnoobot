module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    "casino_logs",
    {
      user_id: DataTypes.STRING,
      game: DataTypes.STRING,
      net_gain: {
        type: DataTypes.DECIMAL,
        allowNull: false,
      },
    },
    {
      timestamps: true,
      createdAt: "timestamp",
    },
  );
};
