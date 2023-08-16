import { Sequelize, DataTypes, Model } from "sequelize";

export class UserModel extends Model {
  declare user_id: string;
  declare balance: number;
  declare last_daily: number;
  declare daily_streak: number;
  declare total_daily: number;
  declare highest_streak: number;
}

export default (sequelize: Sequelize) => {
  return sequelize.define<UserModel>(
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
