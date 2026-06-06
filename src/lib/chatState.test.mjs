import test from "node:test";
import assert from "node:assert/strict";

import {
  canSendMessage,
  filterChatsBySearch,
  filterMessagesBySearch,
  partitionChats,
} from "./chatState.mjs";

const baseChat = {
  id: "chat-1",
  created_at: "2026-05-29T09:00:00.000Z",
  user1_peer_id: "me",
  user2_peer_id: "them",
  initiator_peer_id: "me",
  status: "pending",
  priority: false,
  other_user: { display_name: "Kai", peer_id: "them" },
};

test("partitionChats separates approved chats from sender-visible requests", () => {
  const result = partitionChats(
    [
      { ...baseChat, id: "approved", status: "approved" },
      { ...baseChat, id: "outgoing-pending", status: "pending" },
      { ...baseChat, id: "incoming-pending", initiator_peer_id: "them", status: "pending" },
      { ...baseChat, id: "declined-by-them", status: "declined" },
      { ...baseChat, id: "declined-by-me", initiator_peer_id: "them", status: "declined" },
    ],
    "me",
  );

  assert.deepEqual(result.approved.map((chat) => chat.id), ["approved"]);
  assert.deepEqual(result.requests.map((chat) => chat.id), [
    "incoming-pending",
    "outgoing-pending",
    "declined-by-them",
  ]);
});

test("partitionChats sorts priority requests before normal requests", () => {
  const result = partitionChats(
    [
      { ...baseChat, id: "normal-new", priority: false, last_activity: "2026-05-29T11:00:00.000Z" },
      { ...baseChat, id: "priority-old", priority: true, last_activity: "2026-05-29T10:00:00.000Z" },
    ],
    "me",
  );

  assert.deepEqual(result.requests.map((chat) => chat.id), ["priority-old", "normal-new"]);
});

test("canSendMessage only allows approved chat participants", () => {
  assert.equal(canSendMessage({ ...baseChat, status: "approved" }, "me"), true);
  assert.equal(canSendMessage({ ...baseChat, status: "approved" }, "stranger"), false);
  assert.equal(canSendMessage({ ...baseChat, status: "pending" }, "me"), false);
});

test("search helpers filter chats and messages case-insensitively", () => {
  assert.deepEqual(
    filterChatsBySearch(
      [
        { ...baseChat, id: "a", other_user: { display_name: "Ari", peer_id: "ari" }, last_message: "coffee?" },
        { ...baseChat, id: "b", other_user: { display_name: "Mina", peer_id: "mina" }, last_message: "movie" },
      ],
      "COF",
    ).map((chat) => chat.id),
    ["a"],
  );

  assert.deepEqual(
    filterMessagesBySearch(
      [
        { id: "m1", content: "Neon skies" },
        { id: "m2", content: "quiet tea" },
      ],
      "tea",
    ).map((message) => message.id),
    ["m2"],
  );
});
