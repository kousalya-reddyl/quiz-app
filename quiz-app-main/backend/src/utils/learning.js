const XP_PER_CORRECT = 10;
const XP_PER_LEVEL = 100;

const getDateOnly = (d) => {
  const date = new Date(d);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const isSameDay = (a, b) => getDateOnly(a).getTime() === getDateOnly(b).getTime();

const isYesterday = (a, b) => {
  const dayA = getDateOnly(a);
  const dayB = getDateOnly(b);
  const diffDays = Math.round((dayB - dayA) / (24 * 60 * 60 * 1000));
  return diffDays === 1;
};

const levelForXp = (xp) => Math.floor(xp / XP_PER_LEVEL) + 1;

const nextLevelXp = (level) => level * XP_PER_LEVEL;

const applyProgression = (profile, correctAnswers, completedAt = new Date()) => {
  const existingXp = profile?.xp || 0;
  const earnedXp = Math.max(0, correctAnswers || 0) * XP_PER_CORRECT;
  const newXp = existingXp + earnedXp;

  const lastQuizDate = profile?.lastQuizDate ? new Date(profile.lastQuizDate) : null;
  let currentStreak = profile?.currentStreak || 0;

  if (!lastQuizDate) {
    currentStreak = 1;
  } else if (isSameDay(lastQuizDate, completedAt)) {
    currentStreak = currentStreak || 1;
  } else if (isYesterday(lastQuizDate, completedAt)) {
    currentStreak = currentStreak + 1;
  } else {
    currentStreak = 1;
  }

  const longestStreak = Math.max(profile?.longestStreak || 0, currentStreak);
  const level = levelForXp(newXp);

  return {
    xp: newXp,
    level,
    currentStreak,
    longestStreak,
    lastQuizDate: completedAt,
    xpPerLevel: XP_PER_LEVEL,
    xpNextLevel: nextLevelXp(level)
  };
};

module.exports = {
  XP_PER_CORRECT,
  XP_PER_LEVEL,
  applyProgression,
  levelForXp,
  nextLevelXp
};
