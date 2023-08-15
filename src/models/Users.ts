import { Sequelize, DataTypes } from "sequelize";

export default (sequelize: Sequelize) => {
  return sequelize.define(
    "users",
    {
      user_id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      balance: {
        type: DataTypes.DECIMAL,
        defaultValue: 0,
        allowNull: false,
      },
      last_daily: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      daily_streak: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      total_daily: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      highest_streak: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
    },
    {
      timestamps: false,
    },
  );
};
