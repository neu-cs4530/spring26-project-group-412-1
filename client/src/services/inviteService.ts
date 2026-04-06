import type { ErrorMsg, InviteInfo, UserAuth } from "@gamenite/shared";
import type { APIResponse } from "../util/types.ts";
import { api, exceptionToErrorMsg } from "./api.ts";

const INVITE_API_URL = "/api/invite";

function reviveInviteDates(invite: InviteInfo): InviteInfo {
  return {
    ...invite,
    createdAt: new Date(invite.createdAt),
    updatedAt: new Date(invite.updatedAt),
    expiresAt: new Date(invite.expiresAt),
    respondedAt: invite.respondedAt ? new Date(invite.respondedAt) : undefined,
    canceledAt: invite.canceledAt ? new Date(invite.canceledAt) : undefined,
  };
}

export const getMineInvites = async (
  auth: UserAuth,
  includeHistory = false,
): APIResponse<InviteInfo[]> => {
  try {
    const res = await api.post<InviteInfo[] | ErrorMsg>(`${INVITE_API_URL}/mine`, {
      auth,
      payload: { includeHistory },
    });

    if ("error" in res.data) return res.data;
    return res.data.map(reviveInviteDates);
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const getSentInvites = async (
  auth: UserAuth,
  includeHistory = true,
): APIResponse<InviteInfo[]> => {
  try {
    const res = await api.post<InviteInfo[] | ErrorMsg>(`${INVITE_API_URL}/sent`, {
      auth,
      payload: { includeHistory },
    });

    if ("error" in res.data) return res.data;
    return res.data.map(reviveInviteDates);
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const sendInviteRequest = async (
  auth: UserAuth,
  roomId: string,
  inviteeUsername: string,
): APIResponse<InviteInfo> => {
  try {
    const res = await api.post<InviteInfo | ErrorMsg>(`${INVITE_API_URL}/send`, {
      auth,
      payload: { roomId, inviteeUsername },
    });

    if ("error" in res.data) return res.data;
    return reviveInviteDates(res.data);
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const acceptInviteRequest = async (
  auth: UserAuth,
  inviteId: string,
): APIResponse<InviteInfo> => {
  try {
    const res = await api.post<InviteInfo | ErrorMsg>(`${INVITE_API_URL}/${inviteId}/accept`, {
      auth,
      payload: {},
    });

    if ("error" in res.data) return res.data;
    return reviveInviteDates(res.data);
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const declineInviteRequest = async (
  auth: UserAuth,
  inviteId: string,
): APIResponse<InviteInfo> => {
  try {
    const res = await api.post<InviteInfo | ErrorMsg>(`${INVITE_API_URL}/${inviteId}/decline`, {
      auth,
      payload: {},
    });

    if ("error" in res.data) return res.data;
    return reviveInviteDates(res.data);
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const cancelInviteRequest = async (
  auth: UserAuth,
  inviteId: string,
): APIResponse<InviteInfo> => {
  try {
    const res = await api.post<InviteInfo | ErrorMsg>(`${INVITE_API_URL}/${inviteId}/cancel`, {
      auth,
      payload: {},
    });

    if ("error" in res.data) return res.data;
    return reviveInviteDates(res.data);
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

// Temporary compatibility aliases during client refactor.
export const getMyInvites = getMineInvites;
export const createInviteRequest = sendInviteRequest;
