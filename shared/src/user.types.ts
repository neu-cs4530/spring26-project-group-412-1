import { z } from "zod";

export const PROFILE_PHOTO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export type ProfilePhotoMimeType = (typeof PROFILE_PHOTO_MIME_TYPES)[number];

export interface SafeProfilePhoto {
  mimeType: ProfilePhotoMimeType;
  dataBase64: string;
  sizeBytes: number;
}

/**
 * Represents a "safe" user object that excludes sensitive information like
 * the password, suitable for exposing to clients,
 * - `username`: unique username of the user
 * - `display`: A display name
 * - `createdAt`: when this when the user registered.
 */
export interface SafeUserInfo {
  username: string;
  display: string;
  createdAt: Date;
  bio?: string;
  profilePhoto?: SafeProfilePhoto;
}

/*** TYPES USED IN THE USER API ***/

/**
 * Represents allowed updates to a user.
 */
export type UserUpdateRequest = z.infer<typeof zUserUpdateRequest>;
export const zUserUpdateRequest = z.object({
  password: z.string().optional(),
  display: z.string().optional(),
  bio: z.string().optional(),
});
