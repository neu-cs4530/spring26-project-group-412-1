import { createContext } from "react";
import type { InviteInfo } from "@gamenite/shared";

export interface InviteContextValue {
  invites: InviteInfo[];
  pendingCount: number;
  refreshInvites: () => Promise<void>;
}

export const InviteContext = createContext<InviteContextValue>({
  invites: [],
  pendingCount: 0,
  refreshInvites: async () => {},
});
