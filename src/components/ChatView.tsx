"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronLeft, Send, MessageCircle, Search, Flag, MoreVertical, Zap } from "lucide-react";
import { recordMeetPromptResponse, supabase } from "@/services/supabase";
import { canSendMessage, filterChatsBySearch, filterMessagesBySearch, partitionChats } from "@/lib/chatState.mjs";
import PageTransition from "./PageTransition";
import NativeImage from "./NativeImage";

interface Chat {
    id: string;
    created_at: string;
    user1_peer_id: string;
    user2_peer_id: string;
    status: "pending" | "approved" | "declined" | "active" | "expired" | "locked" | "closed";
    initiator_peer_id: string;
    priority?: boolean;
    last_message?: string | null;
    last_activity?: string | null;
    current_streak?: number | null;
    planning_banner_until?: string | null;
    meet_prompt_private_note?: string | null;
    other_user?: {
        display_name: string;
        peer_id: string;
        photos?: string[];
    };
}

interface Message {
    id: string;
    created_at: string;
    chat_id: string;
    sender_peer_id: string;
    content: string;
    read_by?: string[];
}

interface ChatViewProps {
    currentPeerId: string;
    onReport?: (peerId: string) => void;
}

export default function ChatView({ currentPeerId, onReport }: ChatViewProps) {
    const [chats, setChats] = useState<Chat[]>([]);
    const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"approved" | "requests">("approved");
    const [chatSearch, setChatSearch] = useState("");
    const [messageSearch, setMessageSearch] = useState("");
    const [onlinePeerIds, setOnlinePeerIds] = useState<Set<string>>(new Set());
    const [isOverflowOpen, setIsOverflowOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchChats = useCallback(async () => {
        setIsLoading(true);

        try {
            const { data, error } = await supabase
                .from("chats")
                .select("*")
                .or(`user1_peer_id.eq.${currentPeerId},user2_peer_id.eq.${currentPeerId}`)
                .order("last_activity", { ascending: false });

            if (error) throw error;

            const enrichedChats = await Promise.all(
                (data || []).map(async (chat) => {
                    const otherPeerId = chat.user1_peer_id === currentPeerId ? chat.user2_peer_id : chat.user1_peer_id;
                    const { data: profile } = await supabase
                        .from("profiles")
                        .select("display_name, peer_id, photos")
                        .eq("peer_id", otherPeerId)
                        .single();

                    return {
                        ...chat,
                        other_user: profile || undefined,
                        last_message: chat.last_message || null,
                        last_activity: chat.last_activity || chat.created_at,
                    } as Chat;
                })
            );

            setChats(enrichedChats);
        } catch (error) {
            console.error("Error fetching chats:", error);
            setChats([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentPeerId]);

    useEffect(() => {
        void fetchChats();
    }, [fetchChats]);

    useEffect(() => {
        if (!selectedChat || selectedChat.status !== "approved" || selectedChat.id.startsWith("mock-")) {
            setMessages([]);
            return;
        }

        const fetchMessages = async () => {
            const { data, error } = await supabase
                .from("messages")
                .select("*")
                .eq("chat_id", selectedChat.id)
                .order("created_at", { ascending: true });

            if (error) {
                console.error("Error fetching messages:", error);
                return;
            }

            setMessages(data || []);
        };

        void fetchMessages();

        const channel = supabase
            .channel(`chat_${selectedChat.id}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "messages",
                    filter: `chat_id=eq.${selectedChat.id}`,
                },
                (payload) => {
                    const incomingMessage = payload.new as Message;
                    setMessages((prev) => {
                        if (prev.some((message) => message.id === incomingMessage.id)) return prev;
                        return [...prev, incomingMessage];
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedChat]);

    useEffect(() => {
        if (!selectedChat || !currentPeerId) return;

        const channel = supabase.channel(`presence_chat_${selectedChat.id}`, {
            config: {
                presence: {
                    key: currentPeerId,
                },
            },
        });

        channel
            .on("presence", { event: "sync" }, () => {
                const state = channel.presenceState();
                setOnlinePeerIds(new Set(Object.keys(state)));
            })
            .subscribe(async (status) => {
                if (status === "SUBSCRIBED") {
                    await channel.track({
                        peer_id: currentPeerId,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
            setOnlinePeerIds(new Set());
        };
    }, [currentPeerId, selectedChat]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const { approved, requests } = useMemo(
        () => partitionChats(chats, currentPeerId) as { approved: Chat[]; requests: Chat[] },
        [chats, currentPeerId]
    );
    const activeChats = activeTab === "approved" ? approved : requests;
    const visibleChats = filterChatsBySearch(activeChats, chatSearch) as Chat[];
    const visibleMessages = filterMessagesBySearch(messages, messageSearch) as Message[];

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedChat || !canSendMessage(selectedChat, currentPeerId)) return;

        const { error } = await supabase.from("messages").insert({
            chat_id: selectedChat.id,
            sender_peer_id: currentPeerId,
            content: newMessage.trim(),
        });

        if (error) {
            console.error("Error sending message:", error);
            return;
        }

        setNewMessage("");
    };

    const handleApprove = async () => {
        if (!selectedChat) return;

        const { data, error } = await supabase.rpc("approve_chat", {
            p_chat_id: selectedChat.id,
            p_user_peer_id: currentPeerId,
        });

        if (error || !data?.success) {
            alert(error?.message || data?.error || "Unable to approve this request.");
            return;
        }

        setSelectedChat({ ...selectedChat, status: "approved" });
        setActiveTab("approved");
        void fetchChats();
    };

    const handleDecline = async () => {
        if (!selectedChat) return;

        const { data, error } = await supabase.rpc("decline_chat", {
            p_chat_id: selectedChat.id,
            p_user_peer_id: currentPeerId,
        });

        if (error || !data?.success) {
            alert(error?.message || data?.error || "Unable to decline this request.");
            return;
        }

        setSelectedChat(null);
        void fetchChats();
    };

    const handleMeetYes = async () => {
        if (!selectedChat) return;
        await recordMeetPromptResponse(selectedChat.id, "yes");
        setSelectedChat({ ...selectedChat, status: "active" });
        void fetchChats();
    };

    const handleKeepChatting = async () => {
        if (!selectedChat) return;
        await recordMeetPromptResponse(selectedChat.id, "keep_chatting");
        setSelectedChat({ ...selectedChat, status: "active" });
        void fetchChats();
    };

    const renderChatSubtitle = (chat: Chat) => {
        if (chat.status === "locked") return "Meet prompt waiting";
        if (chat.status === "declined") return "Declined";
        if (chat.status === "pending") {
            return chat.initiator_peer_id === currentPeerId ? "Waiting for approval" : "Wants to chat";
        }
        return chat.last_message || (chat.current_streak ? `Day ${chat.current_streak}` : "No messages yet");
    };

    if (selectedChat) {
        const otherPeerId = selectedChat.other_user?.peer_id;
        const isOtherOnline = Boolean(otherPeerId && onlinePeerIds.has(otherPeerId));
        const isIncomingRequest = selectedChat.initiator_peer_id !== currentPeerId;
        const isOpenChat = selectedChat.status === "approved" || selectedChat.status === "active";

        return (
            <PageTransition currentKey={`chat-${selectedChat.id}`}>
                <div className="flex flex-col h-[calc(100vh-120px)] bg-background -mx-6 -mt-12">
                    <div className="p-4 border-b border-border bg-card flex items-center gap-4">
                        <button onClick={() => setSelectedChat(null)} className="p-2 hover:bg-muted rounded-full">
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="relative">
                                <NativeImage
                                    src={selectedChat.other_user?.photos?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.other_user?.display_name || "User")}&background=random`}
                                    alt={`${selectedChat.other_user?.display_name || "User"} avatar`}
                                    className="w-10 h-10 rounded-full object-cover"
                                    fallbackInitials={selectedChat.other_user?.display_name?.[0]}
                                />
                                <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-card rounded-full ${isOtherOnline ? "bg-green-500" : "bg-muted-foreground"}`} />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold truncate">{selectedChat.other_user?.display_name}</h3>
                                <p className={`text-[10px] font-bold uppercase tracking-wider ${isOtherOnline ? "text-green-500" : "text-muted-foreground"}`}>
                                    {isOtherOnline ? "Online" : "Offline"}
                                </p>
                                {Boolean(selectedChat.current_streak) && selectedChat.current_streak && selectedChat.current_streak > 0 && (
                                    <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                                        Day {selectedChat.current_streak}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="ml-auto relative">
                            <button
                                onClick={() => setIsOverflowOpen((open) => !open)}
                                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                                title="More"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            {isOverflowOpen && (
                                <div className="absolute right-0 top-10 z-20 min-w-36 rounded-2xl border border-border bg-card p-2 shadow-2xl">
                                    <button
                                        onClick={() => {
                                            setIsOverflowOpen(false);
                                            if (selectedChat.other_user?.peer_id && onReport) {
                                                onReport(selectedChat.other_user.peer_id);
                                            }
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10"
                                    >
                                        <Flag className="w-4 h-4" />
                                        Report
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {isOpenChat && (
                        <div className="p-3 border-b border-border bg-background">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    value={messageSearch}
                                    onChange={(event) => setMessageSearch(event.target.value)}
                                    placeholder="Search messages..."
                                    className="w-full pl-11 pr-4 py-2.5 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-foreground/10 text-sm font-medium"
                                />
                            </div>
                        </div>
                    )}

                    {selectedChat.status === "locked" && (
                        <div className="p-4 border-b border-border bg-amber-50 text-amber-950">
                            <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                                <p className="text-xs font-black uppercase tracking-widest text-amber-600">Day {selectedChat.current_streak}</p>
                                <h3 className="mt-1 text-lg font-black tracking-tight">Ready to meet?</h3>
                                <p className="mt-1 text-sm font-medium text-amber-900/70">
                                    This chat unlocks after both of you answer.
                                </p>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => void handleMeetYes()}
                                        className="rounded-2xl bg-foreground px-3 py-3 text-sm font-black text-background"
                                    >
                                        {"Yes, let's meet"}
                                    </button>
                                    <button
                                        onClick={() => void handleKeepChatting()}
                                        className="rounded-2xl border border-amber-200 bg-amber-100 px-3 py-3 text-sm font-black text-amber-950"
                                    >
                                        Keep chatting
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {isOpenChat ? (
                            visibleMessages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.sender_peer_id === currentPeerId ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${message.sender_peer_id === currentPeerId
                                            ? "bg-foreground text-background rounded-tr-none"
                                            : "bg-card border border-border rounded-tl-none"
                                            }`}
                                    >
                                        <p className="text-sm font-medium leading-relaxed">{message.content}</p>
                                        <p className={`text-[10px] mt-1 opacity-50 ${message.sender_peer_id === currentPeerId ? "text-right" : ""}`}>
                                            {new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex items-center justify-center text-center">
                                <div className="max-w-xs space-y-3">
                                    <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                                        {selectedChat.priority ? <Zap className="w-8 h-8 text-indigo-500" /> : <MessageCircle className="w-8 h-8 text-muted-foreground" />}
                                    </div>
                                    <h3 className="text-xl font-black tracking-tight">
                                        {selectedChat.status === "declined" ? "Request declined" : isIncomingRequest ? "Chat request" : "Waiting for approval"}
                                    </h3>
                                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                                        {selectedChat.status === "declined"
                                            ? "This request was declined. No message was sent."
                                            : isIncomingRequest
                                                ? `${selectedChat.other_user?.display_name || "This person"} wants to start a conversation.`
                                                : `${selectedChat.other_user?.display_name || "This person"} needs to accept your invite before messages open.`}
                                    </p>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-4 pt-4 border-t border-border bg-card pb-12">
                        {selectedChat.status === "locked" ? (
                            <div className="text-center p-4 bg-muted/30 rounded-2xl border border-border/50">
                                <p className="text-sm font-bold text-muted-foreground">Answer the meet prompt to keep chatting.</p>
                            </div>
                        ) : selectedChat.status === "pending" ? (
                            isIncomingRequest ? (
                                <div className="flex gap-3">
                                    <button
                                        onClick={handleDecline}
                                        className="flex-1 py-3 bg-muted text-muted-foreground font-bold rounded-2xl border border-border hover:bg-muted/80 transition-all"
                                    >
                                        Decline
                                    </button>
                                    <button
                                        onClick={handleApprove}
                                        className="flex-[2] py-3 bg-foreground text-background font-bold rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
                                    >
                                        Approve & Chat
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center p-4 bg-muted/30 rounded-2xl border border-border/50">
                                    <p className="text-sm font-bold text-muted-foreground italic mb-1">Waiting for approval...</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                        Messages unlock when they approve your invite.
                                    </p>
                                </div>
                            )
                        ) : isOpenChat ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
                                    placeholder="Write your message..."
                                    className="flex-1 px-5 py-3 bg-background border border-border rounded-full focus:outline-none focus:ring-2 focus:ring-foreground/20"
                                />
                                <button
                                    onClick={() => void sendMessage()}
                                    className="p-3 bg-foreground text-background rounded-full hover:scale-110 active:scale-95 transition-all shadow-md"
                                >
                                    <Send className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <div className="text-center p-4 bg-muted/30 rounded-2xl border border-border/50">
                                <p className="text-sm font-bold text-muted-foreground">No message was sent.</p>
                            </div>
                        )}
                    </div>
                </div>
            </PageTransition>
        );
    }

    return (
        <PageTransition currentKey="chats-list">
            <div className="space-y-6 pt-0">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-4xl font-black tracking-tighter">Messages</h2>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/30 p-1">
                    {[
                        { id: "approved", label: `Chats ${approved.length}` },
                        { id: "requests", label: `Requests ${requests.length}` },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as "approved" | "requests")}
                            className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={chatSearch}
                        onChange={(event) => setChatSearch(event.target.value)}
                        placeholder={activeTab === "approved" ? "Search your chats..." : "Search requests..."}
                        className="w-full pl-12 pr-6 py-3.5 bg-card border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-foreground/10 transition-all font-medium"
                    />
                </div>

                <div className="space-y-3">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="h-20 bg-muted/20 border border-border/20 rounded-[32px] animate-pulse" />
                        ))
                    ) : visibleChats.length > 0 ? (
                        visibleChats.map((chat) => (
                            <div
                                key={chat.id}
                                onClick={() => setSelectedChat(chat)}
                                className={`flex items-center gap-4 p-4 bg-muted/20 border rounded-[32px] hover:bg-muted/30 cursor-pointer transition-all active:scale-[0.98] ${chat.status === "pending" ? "border-dashed border-rose-500/20" : "border-border/40"}`}
                            >
                                <div className="relative">
                                    <NativeImage
                                        src={chat.other_user?.photos?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.other_user?.display_name || "User")}&background=random`}
                                        alt={`${chat.other_user?.display_name || "User"} avatar`}
                                        className="w-14 h-14 rounded-2xl object-cover border border-border/50 shadow-sm"
                                        fallbackInitials={chat.other_user?.display_name?.[0]}
                                    />
                                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-background rounded-full ${chat.status === "pending" ? "bg-amber-400" : chat.status === "declined" ? "bg-muted-foreground" : "bg-green-500"}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h3 className="text-sm font-black truncate text-foreground tracking-tight">{chat.other_user?.display_name}</h3>
                                            {chat.priority && (
                                                <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase rounded-md border border-indigo-500/20">
                                                    Super
                                                </span>
                                            )}
                                            {chat.status !== "approved" && (
                                                <span className="px-1.5 py-0.5 bg-rose-500/10 text-rose-500 text-[8px] font-black uppercase rounded-md border border-rose-500/20">
                                                    {chat.status === "declined" ? "Declined" : "Request"}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                            {new Date(chat.last_activity || chat.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                                        </span>
                                    </div>
                                    <p className={`text-xs truncate font-medium tracking-tight ${chat.status === "approved" ? "text-muted-foreground/70" : "text-muted-foreground/50 italic"}`}>
                                        {renderChatSubtitle(chat)}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
                                <MessageCircle className="w-10 h-10 text-muted-foreground/50" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-bold">{activeTab === "approved" ? "No messages yet" : "No requests"}</h3>
                                <p className="text-muted-foreground max-w-[220px] text-sm font-medium leading-relaxed">
                                    {activeTab === "approved"
                                        ? "Approved conversations will appear here."
                                        : "Incoming and outgoing chat requests will appear here."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageTransition>
    );
}
