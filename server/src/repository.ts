import { createRepo } from "./keyv.ts";
import type {
  AuthRecord,
  ChatRecord,
  CommentRecord,
  GameRecord,
  InviteByInviteeIndexRecord,
  InviteByInviterIndexRecord,
  InvitePendingIndexRecord,
  InviteRecord,
  MessageRecord,
  ThreadRecord,
  UserRecord,
} from "./models.ts";

export const AuthRepo = createRepo<AuthRecord>("auth");
export const ChatRepo = createRepo<ChatRecord>("chat");
export const CommentRepo = createRepo<CommentRecord>("comment");
export const GameRepo = createRepo<GameRecord>("game");
export const InviteRepo = createRepo<InviteRecord>("invite");
export const InvitePendingByRoomInviteeRepo = createRepo<InvitePendingIndexRecord>(
  "invite_pending_by_room_invitee",
);
export const InviteByInviteeRepo = createRepo<InviteByInviteeIndexRecord>("invite_by_invitee");
export const InviteByInviterRepo = createRepo<InviteByInviterIndexRecord>("invite_by_inviter");
export const MessageRepo = createRepo<MessageRecord>("message");
export const ThreadRepo = createRepo<ThreadRecord>("thread");
export const UserRepo = createRepo<UserRecord>("user");
