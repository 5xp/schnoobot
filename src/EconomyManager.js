const { Collection } = require("discord.js");
const { Users, CasinoLogs } = require("./db-objects.js");
const { Op } = require("sequelize");

const numeral = require("numeral");
numeral.defaultFormat("$0,0.00");
const hoursToMs = 60 * 60 * 1000;

class EconomyManager {
  users = new Collection();

  minHoursUntilDaily = 18;
  maxHoursUntilLate = 30;
  baseReward = 1000;
  flatReward = 10;
  exponent = 1.1;
  streakReward = (streak, totalClaims) =>
    (this.baseReward + this.flatReward * totalClaims) * Math.pow(streak, this.exponent);

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

  async incrementDailyStreak(id) {
    const user = this.users.get(id);

    if (user) {
      user.daily_streak += 1;
      user.total_daily += 1;
      user.last_daily = Date.now();

      if (user.daily_streak > user.highest_streak) {
        user.highest_streak = user.daily_streak;
      }

      return user.save();
    }

    const newUser = await Users.create({
      user_id: id,
      last_daily: Date.now(),
      daily_streak: 1,
      total_daily: 1,
      highest_streak: 1,
    });

    this.users.set(id, newUser);

    return newUser;
  }

  async resetDailyStreak(id) {
    const user = this.users.get(id);

    if (user) {
      user.daily_streak = 1;
      user.total_daily += 1;
      user.last_daily = Date.now();

      return user.save();
    }

    const newUser = await Users.create({ user_id: id, last_daily: Date.now(), daily_streak: 1, total_daily: 1 });
    this.users.set(id, newUser);

    return newUser;
  }

  getDailyStatus(id) {
    const user = this.users.get(id);
    const lastDaily = user?.last_daily ?? 0;
    const streak = user?.daily_streak ?? 0;
    const totalDaily = user?.total_daily ?? 0;
    const balance = user?.balance ?? 0;

    if (lastDaily === 0) {
      return { available: true, late: false, balance, streak, totalDaily };
    }

    const availableAt = lastDaily + this.minHoursUntilDaily * hoursToMs;
    const lateAt = lastDaily + this.maxHoursUntilLate * hoursToMs;

    const isAvailable = Date.now() > availableAt;
    const isLate = Date.now() > lateAt;

    const lateBy = Date.now() - lateAt;

    if (isLate) {
      return { available: true, late: true, lateBy, balance, streak: 0, totalDaily };
    }

    if (isAvailable) {
      return { available: true, late: false, availableAt, balance, streak, totalDaily };
    }

    return { available: false, availableAt, balance, streak, totalDaily };
  }

  async rewardStreak(id) {
    const dailyStatus = this.getDailyStatus(id);
    const { streak, totalDaily, balance } = dailyStatus;

    if (!dailyStatus.available) {
      return {
        success: false,
        ...dailyStatus,
      };
    }

    if (dailyStatus.late) {
      await this.resetDailyStreak(id);

      const reward = this.streakReward(1, totalDaily);
      this.addBalance(id, reward);

      return {
        success: true,
        late: true,
        lateBy: dailyStatus.lateBy,
        streak: streak + 1,
        reward,
        balance: balance + reward,
        totalDaily: totalDaily + 1,
      };
    }

    await this.incrementDailyStreak(id);

    const reward = this.streakReward(streak + 1, totalDaily + 1);
    this.addBalance(id, reward);

    return {
      success: true,
      reward,
      streak: streak + 1,
      lateBy: dailyStatus.lateBy,
      balance: balance + reward,
      totalDaily: totalDaily + 1,
    };
  }

  async transferBalance(id, amount, recipientId) {
    const userPromise = this.addBalance(id, -amount);
    const recipientPromise = this.addBalance(recipientId, amount);

    const [user, recipient] = await Promise.all([userPromise, recipientPromise]);

    return { userBalance: user.balance, recipientBalance: recipient.balance };
  }

  addLog(id, game, net_gain) {
    return CasinoLogs.create({ user_id: id, game, net_gain });
  }

  fetchLogs(id, timeRange, game = null) {
    const filter = {
      where: {
        user_id: id,
        timestamp: {
          [Op.gte]: new Date(Date.now() - timeRange),
        },
      },
      order: [["timestamp", "DESC"]],
    };

    if (game) {
      filter.where.game = game;
    }

    return CasinoLogs.findAll(filter);
  }

  static validateAmount(amount, balance) {
    if (amount <= 0) {
      return new Error("Amount must be greater than $0.00!");
    }

    if (amount > balance) {
      return new Error(`Insufficient balance! Your balance is ${EconomyManager.getNumber(balance).formatted}.`);
    }

    return true;
  }

  static getNumber(inputAmount, balance = null) {
    if (String(inputAmount).toLowerCase() === "all") {
      inputAmount = balance;
    }

    const number = numeral(inputAmount);
    const formatted = number.format();

    return { formatted, value: number.value() };
  }
}

module.exports = EconomyManager;
