import { Collection } from "discord.js";
import { Users, CasinoLogs } from "../db-objects";
import { Op } from "sequelize";
import numeral from "numeral";
import { UserModel } from "models/Users";
import { CasinoLogModel } from "models/CasinoLogs";

numeral.defaultFormat("$0,0.00");
const hoursToMs = 60 * 60 * 1000;

export default class EconomyManager {
  users = new Collection<string, UserModel>();

  minHoursUntilDaily = 18;
  maxHoursUntilLate = 36;
  baseReward = 1000;
  flatReward = 10;
  exponent = 1.1;

  streakReward(streak: number, totalClaims: number): number {
    return (this.baseReward + this.flatReward * totalClaims) * Math.pow(streak, this.exponent);
  }

  constructor() {
    this.init();
  }

  async init() {
    const users = await Users.findAll<UserModel>();

    for (const user of users) {
      this.users.set(user.user_id, user);
    }
  }

  async addBalance(id: string, amount: number): Promise<UserModel> {
    const user = this.users.get(id);

    if (user) {
      user.balance += Number(amount);

      return user.save();
    }

    const newUser = await Users.create({ user_id: id, balance: amount });
    this.users.set(id, newUser);

    return newUser;
  }

  getBalance(id: string): number {
    const user = this.users.get(id);
    return user ? user.balance : 0;
  }

  async setBalance(id: string, amount: number): Promise<UserModel> {
    const user = this.users.get(id);

    if (user) {
      user.balance = Number(amount);

      return user.save();
    }

    const newUser = await Users.create({ user_id: id, balance: amount });
    this.users.set(id, newUser);

    return newUser;
  }

  async incrementDailyStreak(id: string): Promise<UserModel> {
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

  async resetDailyStreak(id: string): Promise<UserModel> {
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

  getDailyStatus(id: string): DailyStatus {
    const user = this.users.get(id);
    const lastDaily = user?.last_daily ?? 0;
    const streak = user?.daily_streak ?? 0;
    const totalDaily = user?.total_daily ?? 0;
    const balance = user?.balance ?? 0;

    if (lastDaily === 0) {
      return { status: "available", almostLateBy: -1, balance, streak, totalDaily };
    }

    const availableAt = lastDaily + this.minHoursUntilDaily * hoursToMs;
    const lateAt = lastDaily + this.maxHoursUntilLate * hoursToMs;

    const isAvailable = Date.now() > availableAt;

    const lateBy = Date.now() - lateAt;
    const isLate = lateBy > 0;

    if (isLate) {
      return { status: "late", lateBy, balance, streak, totalDaily };
    }

    if (isAvailable) {
      return { status: "available", almostLateBy: Math.abs(lateBy), balance, streak, totalDaily };
    }

    return { status: "unavailable", availableAt, balance, streak, totalDaily };
  }

  async rewardStreak(id: string): Promise<StreakRewardResponse> {
    const dailyStatus = this.getDailyStatus(id);
    const { status, streak, totalDaily, balance } = dailyStatus;

    if (status === "unavailable") {
      return {
        reward: 0,
        ...dailyStatus,
      };
    }

    if (status === "late") {
      await this.resetDailyStreak(id);

      const reward = this.streakReward(1, totalDaily);
      this.addBalance(id, reward);

      return {
        reward,
        status,
        lateBy: dailyStatus.lateBy,
        streak: streak + 1,
        balance: balance + reward,
        totalDaily: totalDaily + 1,
      };
    }

    await this.incrementDailyStreak(id);

    const reward = this.streakReward(streak + 1, totalDaily + 1);
    this.addBalance(id, reward);

    return {
      reward,
      status,
      almostLateBy: dailyStatus.almostLateBy,
      streak: streak + 1,
      balance: balance + reward,
      totalDaily: totalDaily + 1,
    };
  }

  async transferBalance(id: string, amount: number, recipientId: string): Promise<TransferBalanceResponse> {
    const userPromise = this.addBalance(id, -amount);
    const recipientPromise = this.addBalance(recipientId, amount);

    const [user, recipient] = await Promise.all([userPromise, recipientPromise]);

    return { userBalance: user.balance, recipientBalance: recipient.balance };
  }

  addLog(id: string, game: string, net_gain: number): Promise<CasinoLogModel> {
    return CasinoLogs.create({ user_id: id, game, net_gain });
  }

  fetchLogs(id: string, timeRange: number, game?: string) {
    const filter = {
      where: {
        user_id: id,
        timestamp: {
          [Op.gte]: new Date(Date.now() - timeRange),
        },
        ...(game && { game }),
      },
      order: [["timestamp", "DESC"]] as [string, string][],
    };

    return CasinoLogs.findAll<CasinoLogModel>(filter);
  }
}

type AvailableStatus = {
  status: "available";
  almostLateBy: number;
};

type LateStatus = {
  status: "late";
  lateBy: number;
};

type UnavailableStatus = {
  status: "unavailable";
  availableAt: number;
};

type DailyStatus = {
  balance: number;
  streak: number;
  totalDaily: number;
} & (AvailableStatus | LateStatus | UnavailableStatus);

export type StreakRewardResponse = {
  reward: number;
} & DailyStatus;

type TransferBalanceResponse = {
  userBalance: number;
  recipientBalance: number;
};
