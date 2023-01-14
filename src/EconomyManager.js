const { Collection } = require("discord.js");
const { Users } = require("./db-objects.js");

const numeral = require("numeral");
numeral.defaultFormat("$0,0.00");

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
    const userPromise = this.addBalance(id, -amount);
    const recipientPromise = this.addBalance(recipientId, amount);

    const [user, recipient] = await Promise.all([userPromise, recipientPromise]);

    return { userBalance: user.balance, recipientBalance: recipient.balance };
  }

  validateAmount(id, amount) {
    if (amount <= 0) {
      return false;
    }

    const balance = this.getBalance(id);

    if (amount > balance) {
      return false;
    }

    return true;
  }

  static getNumber(inputAmount, id = null) {
    if (String(inputAmount).toLowerCase() === "all") {
      const balance = this.getBalance(id);
      return { formattedAmount: this.formatNumber(balance), amount: balance };
    }

    const number = numeral(inputAmount);

    const formatted = number.format();
    const value = numeral(formatted).value();

    return { formatted, value };
  }
}

module.exports = EconomyManager;
