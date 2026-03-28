import { api } from "./api";

export const INSUFFICIENT_TOKENS_ERROR = "INSUFFICIENT_TOKENS";

export interface ChatAccessPayload {
  ok?: boolean;
  unlocked?: boolean;
  alreadyUnlocked?: boolean;
  error?: string;
  message?: string;
  requiresPayment?: boolean;
  redirectTo?: string;
  tokensLeft?: number;
  tokensSpent?: number;
  tokenInfo?: {
    tokenRate?: number;
    costPerAction?: number;
  };
}

export const startRideChatAccess = async (rideId: string) => {
  try {
    const response = await api.post<ChatAccessPayload>(`/api/messages/access/${rideId}`);
    return { ok: true as const, payload: response.data };
  } catch (error: any) {
    const payload: ChatAccessPayload | undefined = error?.response?.data;

    if (payload?.error === INSUFFICIENT_TOKENS_ERROR) {
      return { ok: false as const, insufficientTokens: true as const, payload };
    }

    throw error;
  }
};
