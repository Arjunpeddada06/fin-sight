import { http } from "./api";
import type { ChatResponse, ConversationDetail, ConversationSummary } from "../types";

export const sendChat = (message: string, conversationId?: string, documentIds?: string[]) =>
  http.post<ChatResponse>("/chat", { message, conversation_id: conversationId, document_ids: documentIds }, { timeout: 120_000 }).then((r) => r.data);

export const listConversations = () =>
  http.get<ConversationSummary[]>("/chat/history").then((r) => r.data);

export const getConversation = (id: string) =>
  http.get<ConversationDetail>(`/chat/${id}`).then((r) => r.data);

export const deleteConversation = (id: string) => http.delete(`/chat/${id}`);
