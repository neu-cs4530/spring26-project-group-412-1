const lockWaiters = new Map<string, Array<() => void>>();

async function acquireKeyedLock(key: string): Promise<void> {
  const queue = lockWaiters.get(key);
  if (!queue) {
    lockWaiters.set(key, []);
    return;
  }

  await new Promise<void>((resolve) => {
    queue.push(resolve);
  });
}

function releaseKeyedLock(key: string): void {
  const queue = lockWaiters.get(key);
  if (!queue) return;

  const next = queue.shift();
  if (next) {
    next();
    return;
  }

  lockWaiters.delete(key);
}

/**
 * Serializes async work per key inside this server process.
 */
export async function withKeyedLock<T>(key: string, action: () => Promise<T> | T): Promise<T> {
  await acquireKeyedLock(key);
  try {
    return await action();
  } finally {
    releaseKeyedLock(key);
  }
}

export function gameLockKey(gameId: string): string {
  return `game:${gameId}`;
}

export function inviteLockKey(inviteId: string): string {
  return `invite:${inviteId}`;
}
