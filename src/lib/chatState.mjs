function getActivityTime(chat) {
  const raw = chat.last_activity || chat.created_at || "";
  const value = new Date(raw).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sortChats(a, b) {
  if (Boolean(a.priority) !== Boolean(b.priority)) {
    return a.priority ? -1 : 1;
  }

  return getActivityTime(b) - getActivityTime(a);
}

function sortRequests(currentPeerId) {
  return (a, b) => {
    if (Boolean(a.priority) !== Boolean(b.priority)) {
      return a.priority ? -1 : 1;
    }

    const aIncoming = a.initiator_peer_id !== currentPeerId;
    const bIncoming = b.initiator_peer_id !== currentPeerId;
    if (aIncoming !== bIncoming) {
      return aIncoming ? -1 : 1;
    }

    return getActivityTime(b) - getActivityTime(a);
  };
}

export function partitionChats(chats, currentPeerId) {
  const approved = [];
  const requests = [];

  for (const chat of chats) {
    const isParticipant = chat.user1_peer_id === currentPeerId || chat.user2_peer_id === currentPeerId;
    if (!isParticipant) continue;

    if (chat.status === "approved") {
      approved.push(chat);
      continue;
    }

    if (chat.status === "pending") {
      requests.push(chat);
      continue;
    }

    if (chat.status === "declined" && chat.initiator_peer_id === currentPeerId) {
      requests.push(chat);
    }
  }

  return {
    approved: approved.sort(sortChats),
    requests: requests.sort(sortRequests(currentPeerId)),
  };
}

export function canSendMessage(chat, currentPeerId) {
  if (!chat || chat.status !== "approved") return false;
  return chat.user1_peer_id === currentPeerId || chat.user2_peer_id === currentPeerId;
}

export function filterChatsBySearch(chats, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return chats;

  return chats.filter((chat) => {
    const name = chat.other_user?.display_name || "";
    const peerId = chat.other_user?.peer_id || "";
    const lastMessage = chat.last_message || "";
    return `${name} ${peerId} ${lastMessage}`.toLowerCase().includes(normalized);
  });
}

export function filterMessagesBySearch(messages, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return messages;
  return messages.filter((message) => String(message.content || "").toLowerCase().includes(normalized));
}
