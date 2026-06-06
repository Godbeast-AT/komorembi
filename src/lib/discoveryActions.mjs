export const DISCOVERY_ACTIONS = Object.freeze({
  block: "block",
  report: "report",
  skip: "skip",
  like: "like",
  superLike: "super_like",
});

export function createUserActionPayload(actorPeerId, targetPeerId, actionType) {
  return {
    actor_peer_id: actorPeerId,
    target_peer_id: targetPeerId,
    action_type: actionType,
  };
}

export function isPaidDiscoveryAction(actionType) {
  return false;
}
