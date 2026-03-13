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

export const getMyInvites = async (auth: UserAuth): APIResponse<InviteInfo[]> => {
  try {
    const res = await api.get<InviteInfo[] | ErrorMsg>(`${INVITE_API_URL}/list`, {
      params: auth,
    });

    if ("error" in res.data) return res.data;
    return res.data.map(reviveInviteDates);
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const createInviteRequest = async (
  auth: UserAuth,
  roomId: string,
  inviteeUsername: string,
): APIResponse<InviteInfo> => {
  try {
    const res = await api.post<InviteInfo | ErrorMsg>(`${INVITE_API_URL}/create`, {
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
      payload: null,
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
      payload: null,
    });

    if ("error" in res.data) return res.data;
    return reviveInviteDates(res.data);
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
