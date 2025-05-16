import { Collection } from "discord.js";
import { eq, sql } from "drizzle-orm";
import db from "./db";
import { AniListUser, aniListUsers, CasinoLog, casinoLogs, User, users } from "./schema";

const usersCache = new Collection<string, User>();
const anilistCache = new Collection<string, AniListUser>();

const hoursToMs = 60 * 60 * 1000;
const minHoursUntilDaily = 18;
const maxHoursUntilLate = 36;
const baseReward = 1000;
const flatReward = 10;
const exponent = 1.1;

export async function getBalance(userId: string) {
	const user = await getUser(userId);

	return user?.balance ? Number(user.balance) : 0;
}

export async function addBalance(userId: string, amount: number) {
	const [user] = await db
		.insert(users)
		.values({ userId, balance: amount.toString() })
		.onConflictDoUpdate({
			target: users.userId,
			set: { balance: sql`${users.balance} + ${amount}` },
		})
		.returning();

	usersCache.set(userId, user);

	return user;
}

export async function getUser(userId: string) {
	const cachedUser = usersCache.get(userId);

	if (cachedUser) {
		return cachedUser;
	}

	const [user] = await db.select().from(users).where(eq(users.userId, userId));

	if (user) {
		usersCache.set(userId, user);
		return user;
	}
}

export async function setBalance(userId: string, amount: number) {
	const [user] = await db
		.insert(users)
		.values({ userId, balance: amount.toString() })
		.onConflictDoUpdate({
			target: users.userId,
			set: { balance: amount.toString() },
		})
		.returning();

	usersCache.set(userId, user);
}

function getStreakReward(streak: number, totalDaily: number) {
	return (baseReward + flatReward * totalDaily) * Math.pow(streak, exponent);
}

type UnavailableClaimResult = {
	status: "unavailable";
	availableAt: number;
};

type LateClaimResult = {
	status: "late";
	reward: number;
	lateBy: number;
	almostLateBy: -1;
};

type AvailableClaimResult = {
	status: "available";
	reward: number;
	almostLateBy: number;
};

export type ClaimDailyResult = (UnavailableClaimResult | LateClaimResult | AvailableClaimResult) & {
	user: User;
};

export function getDailyAvailableAt(lastDaily: number) {
	return lastDaily + minHoursUntilDaily * hoursToMs;
}

export function getDailyLateAt(lastDaily: number) {
	return lastDaily + maxHoursUntilLate * hoursToMs;
}

export async function handleClaimDaily(userId: string): Promise<ClaimDailyResult> {
	const user = await getUser(userId);
	const lastDaily = user?.lastDaily ?? 0;
	const streak = user?.dailyStreak ?? 0;
	const totalDaily = user?.totalDaily ?? 0;

	const availableAt = getDailyAvailableAt(lastDaily);
	const lateAt = getDailyLateAt(lastDaily);
	const isAvailable = Date.now() >= availableAt;
	const isLate = Date.now() >= lateAt;
	const lateBy = Date.now() - lateAt;

	if (user && !isAvailable) {
		return { status: "unavailable", availableAt, user };
	}

	const newStreak = isLate ? 1 : streak + 1;
	const reward = getStreakReward(newStreak, totalDaily);

	const [affectedUser] = await db
		.insert(users)
		.values({
			userId,
			balance: reward.toString(),
			lastDaily: Date.now(),
			dailyStreak: newStreak,
			totalDaily: totalDaily + 1,
		})
		.onConflictDoUpdate({
			target: users.userId,
			set: {
				balance: sql`${users.balance} + ${reward}`,
				lastDaily: Date.now(),
				dailyStreak: newStreak,
				totalDaily: totalDaily + 1,
			},
		})
		.returning();

	usersCache.set(userId, affectedUser);

	if (isLate && lastDaily !== 0) {
		return {
			status: "late",
			reward,
			user: affectedUser,
			lateBy,
			almostLateBy: -1,
		};
	} else {
		return {
			status: "available",
			reward,
			user: affectedUser,
			almostLateBy: Math.abs(lateBy),
		};
	}
}

export async function transferBalance(id: string, targetId: string, amount: number) {
	return await db.transaction(async tx => {
		const [sourceUser] = await tx.select().from(users).where(eq(users.userId, id));

		if (!sourceUser || Number(sourceUser.balance) < amount) {
			throw new Error("Insufficient balance");
		}

		const [user] = await tx
			.update(users)
			.set({ balance: sql`${users.balance} - ${amount}` })
			.where(eq(users.userId, id))
			.returning();

		const [target] = await tx
			.insert(users)
			.values({ userId: targetId, balance: amount.toString() })
			.onConflictDoUpdate({
				target: users.userId,
				set: { balance: sql`${users.balance} + ${amount}` },
			})
			.returning();

		usersCache.set(id, user);
		usersCache.set(targetId, target);

		return { user, target };
	});
}

export async function addLog(userId: string, game: string, netGain: number): Promise<CasinoLog> {
	const [log] = await db
		.insert(casinoLogs)
		.values({ userId, game, netGain: netGain.toString(), timestamp: new Date().toISOString() })
		.returning();

	return log;
}

export async function setAniListAccessToken(userId: string, accessToken: string) {
	await db.insert(aniListUsers).values({ userId, accessToken }).onConflictDoUpdate({
		target: aniListUsers.userId,
		set: { accessToken },
	});

	anilistCache.set(userId, { userId, accessToken });
}

export async function getAniListAccessToken(userId: string) {
	const cachedUser = anilistCache.get(userId);

	if (cachedUser) {
		return cachedUser.accessToken;
	}

	const [user] = await db.select().from(aniListUsers).where(eq(aniListUsers.userId, userId));

	if (user) {
		anilistCache.set(userId, user);
		return user.accessToken;
	}
}
