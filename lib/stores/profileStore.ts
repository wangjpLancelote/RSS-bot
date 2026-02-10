export type CachedProfile = {
  userId: string;
  email: string | null;
  updatedAt: number;
};

type ProfileMap = Record<string, CachedProfile>;

const STORAGE_KEY = "rss-bot:profile-cache:v1";

let profiles: ProfileMap = {};
let hydrated = false;

function isBrowser() {
  return typeof window !== "undefined";
}

function hydrateFromStorage() {
  if (hydrated || !isBrowser()) {
    return;
  }

  hydrated = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return;
    }

    const next: ProfileMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      const profile = value as Partial<CachedProfile>;
      if (typeof key !== "string" || typeof profile.userId !== "string") {
        continue;
      }

      next[key] = {
        userId: profile.userId,
        email: typeof profile.email === "string" ? profile.email : null,
        updatedAt: typeof profile.updatedAt === "number" ? profile.updatedAt : Date.now()
      };
    }

    profiles = next;
  } catch (_err) {
    profiles = {};
  }
}

function persistToStorage() {
  if (!isBrowser()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (_err) {
    // ignore storage write failures
  }
}

export function getCachedProfile(userId: string): CachedProfile | null {
  hydrateFromStorage();
  return profiles[userId] ?? null;
}

export function setCachedProfile(userId: string, email: string | null) {
  hydrateFromStorage();
  profiles = {
    ...profiles,
    [userId]: {
      userId,
      email,
      updatedAt: Date.now()
    }
  };
  persistToStorage();
}

export function clearCachedProfile(userId?: string) {
  hydrateFromStorage();

  if (!userId) {
    profiles = {};
    persistToStorage();
    return;
  }

  if (!profiles[userId]) {
    return;
  }

  const next = { ...profiles };
  delete next[userId];
  profiles = next;
  persistToStorage();
}
