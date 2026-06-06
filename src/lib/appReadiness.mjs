export function createBootState({
  authResolved,
  sessionResolved,
  bootTimedOut,
  isBanned,
}) {
  if (isBanned) {
    return { bootState: "blocked", bootReason: "banned" };
  }

  if (authResolved && sessionResolved) {
    return { bootState: "ready" };
  }

  if (bootTimedOut) {
    return { bootState: "limited", bootReason: "timeout" };
  }

  return { bootState: "booting" };
}

export function shouldScheduleNotification(permission) {
  return permission?.display === "granted";
}
