const Sequelize = require("sequelize");

const sequelize = new Sequelize("database", "username", "password", {
  host: "localhost",
  dialect: "sqlite",
  logging: false,
  storage: "database.sqlite",
});

const Users = require("./models/Users.js")(sequelize, Sequelize.DataTypes);
const CasinoLogs = require("./models/CasinoLogs.js")(sequelize, Sequelize.DataTypes);

Users.hasMany(CasinoLogs, { foreignKey: "user_id", as: "casino_logs" });
CasinoLogs.belongsTo(Users, { foreignKey: "user_id", targetKey: "user_id", as: "user" });

module.exports = { Users, CasinoLogs };
