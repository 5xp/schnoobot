import { Sequelize } from "sequelize";
import CasinoLogsModel from "./models/CasinoLogs";
import UsersModel from "./models/Users";

const sequelize = new Sequelize("database", "username", "password", {
  host: "localhost",
  dialect: "sqlite",
  logging: false,
  storage: "database.sqlite",
});

const Users = UsersModel(sequelize);
const CasinoLogs = CasinoLogsModel(sequelize);

Users.hasMany(CasinoLogs, { foreignKey: "user_id", as: "casino_logs" });
CasinoLogs.belongsTo(Users, { foreignKey: "user_id", targetKey: "user_id", as: "user" });

export { CasinoLogs, Users };
