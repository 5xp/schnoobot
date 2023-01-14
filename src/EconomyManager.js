const { Collection } = require("discord.js");
const { Users } = require("./db-objects.js");

class EconomyManager {
  users = new Collection();

  constructor() {
    this.init();
  }

  async init() {
    const users = await Users.findAll();

    for (const user of users) {
      this.users.set(user.user_id, user);
    }
  }

  async addBalance(id, amount) {
    const user = this.users.get(id);

    if (user) {
      user.balance += Number(amount);

      return user.save();
    }

    const newUser = await Users.create({ user_id: id, balance: amount });
    this.users.set(id, newUser);

    return newUser;
  }

  getBalance(id) {
    const user = this.users.get(id);
    return user ? user.balance : 0;
  }

  async setBalance(id, amount) {
    const user = this.users.get(id);

    if (user) {
      user.balance = Number(amount);

      return user.save();
    }

    const newUser = await Users.create({ user_id: id, balance: amount });
    this.users.set(id, newUser);

    return newUser;
  }

  async transferBalance(id, amount, recipientId) {
    this.addBalance(id, -amount);
    this.addBalance(recipientId, amount);
  }
}

module.exports = EconomyManager;
