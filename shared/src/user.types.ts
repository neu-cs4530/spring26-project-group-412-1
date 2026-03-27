import { z } from "zod";

export const PROFILE_PHOTO_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export type ProfilePhotoMimeType = (typeof PROFILE_PHOTO_MIME_TYPES)[number];

export interface SafeProfilePhoto {
  mimeType: ProfilePhotoMimeType;
  dataBase64: string;
  sizeBytes: number;
}

export const defaultProfilePhoto: SafeProfilePhoto = {
  mimeType: "image/png",
  dataBase64:
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABHUlEQVR4nO3aQQrCMBRF0Xf//5u2g0k1qk2b0bZ2c5yYcY2Qy3jJ2MZsYgAAAAAAAAAAgH+ZtZt2f8Yv8m8l8m8w9m0b7v0q9m1g9S7n7rj7k7w2m8w3v5m8J7x1p7m1s7Q9w8x0w2x8g5lq2m0s1P0Kz5g4v4g6w4Rr8Wf3j3l0b7Jm2Qe2bH2S1n7bA3dM0x5x6wLr8Wg7wN9V7QK8fYg2m4m4m6m7vH4xN6G2xYk9E6Q8w1v0Vv8kqW6P8i2+f7q9H3wT8Q5QF8z2w0mWwJj7o5b6jC6k0AAAAAAAAAAPgB9x0Qx0Zg7cYAAAAASUVORK5CYII=",
  sizeBytes: 0,
};

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
