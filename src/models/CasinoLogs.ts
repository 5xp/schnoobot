import { DataTypes, Model, Sequelize } from "sequelize";

export class CasinoLogModel extends Model {
  declare user_id: string;
  declare game: string;
  declare net_gain: number;
  declare timestamp: Date;
}

export default (sequelize: Sequelize) => {
  return sequelize.define<CasinoLogModel>(
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
