import type { SafeProfilePhoto } from "@gamenite/shared";

export const DEFAULT_PROFILE_PHOTO_SRC =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAHklEQVR4nO3BMQEAAADCoPdPbQ43oAAAAAAAAAAA4G8G2wAB9v0ZVwAAAABJRU5ErkJggg==";

export function getProfilePhotoSrc(profilePhoto?: SafeProfilePhoto): string {
  if (!profilePhoto) return DEFAULT_PROFILE_PHOTO_SRC;
  return `data:${profilePhoto.mimeType};base64,${profilePhoto.dataBase64}`;
}
