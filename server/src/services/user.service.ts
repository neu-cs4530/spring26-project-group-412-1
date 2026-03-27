import {
  defaultProfilePhoto,
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_MIME_TYPES,
  type ProfilePhotoMimeType,
  type SafeUserInfo,
  type UserUpdateRequest,
} from "@gamenite/shared";
import { getUserByUsername, updateAuth } from "./auth.service.ts";
import { UserRepo } from "../repository.ts";

const disallowedUsernames = new Set(["login", "signup", "list"]);
const allowedProfilePhotoMimeTypes = new Set<ProfilePhotoMimeType>(PROFILE_PHOTO_MIME_TYPES);
export const MAX_PROFILE_PHOTO_BYTES = PROFILE_PHOTO_MAX_BYTES;

function detectProfilePhotoMimeType(buffer: Buffer): ProfilePhotoMimeType | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Retrieves a single user from the database.
 *
 * @param userId - Valid user id.
 * @returns the found user object (without the password).
 */
export async function populateSafeUserInfo(userId: string): Promise<SafeUserInfo> {
  const record = await UserRepo.get(userId);
  return Promise.resolve({
    username: record.username,
    display: record.display,
    createdAt: new Date(record.createdAt),
    bio: record.bio,
    profilePhoto: record.profilePhoto
      ? {
          mimeType: record.profilePhoto.mimeType,
          dataBase64: record.profilePhoto.dataBase64,
          sizeBytes: record.profilePhoto.sizeBytes,
        }
      : defaultProfilePhoto,
  });
}

/**
 * Create and store a new user
 *
 * @param newUser - The user object to be saved, containing user details like username, password, etc.
 * @returns Resolves with the saved user object (without the password) or an error message.
 */
export async function createUser(
  username: string,
  password: string,
  createdAt: Date,
): Promise<SafeUserInfo | { error: string }> {
  if ((await getUserByUsername(username)) !== null) {
    return { error: "User already exists" };
  }
  if (disallowedUsernames.has(username)) {
    return { error: "That is not a permitted username" };
  }
  const id = await UserRepo.add({
    username,
    createdAt: createdAt.toISOString(),
    display: username,
  });
  await updateAuth(username, password, id);
  return Promise.resolve({
    username,
    createdAt,
    display: username,
    profilePhoto: defaultProfilePhoto,
  });
}

/**
 * Retrieves a list of usernames from the database
 *
 * @param usernames - A list of usernames
 * @returns the SafeUserInfo objects corresponding to those users
 * @throws if any of the usernames are not valid
 */
export async function getUsersByUsername(usernames: string[]): Promise<SafeUserInfo[]> {
  return Promise.all(
    usernames.map(async (username) => {
      const user = await getUserByUsername(username);
      if (user === null) {
        throw new Error(`No user ${username}`);
      }
      return populateSafeUserInfo(user.userId);
    }),
  );
}

/**
 * Updates user information in the database
 *
 * @param username - A valid username for the user to update
 * @param updates - An object that defines the fields to be updated and their new values
 * @returns the updated user object (without the password)
 * @throws if the username does not exist in the database
 */
export async function updateUser(
  username: string,
  { display, password, bio }: UserUpdateRequest,
): Promise<SafeUserInfo> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);
  if (password !== undefined) await updateAuth(username, password, user.userId);
  const newUser = await UserRepo.get(user.userId);
  if (display !== undefined) newUser.display = display;
  if (bio !== undefined) newUser.bio = bio;
  await UserRepo.set(user.userId, newUser);
  return populateSafeUserInfo(user.userId);
}

/**
 * Updates a user's profile photo.
 *
 * @param username - Username owning the profile photo.
 * @param profilePhoto - Uploaded file data.
 * @throws if the user doesn't exist or if the upload is invalid.
 */
export async function updateUserProfilePhoto(
  username: string,
  profilePhoto: { buffer: Buffer; mimetype: string; size: number },
): Promise<SafeUserInfo> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);

  if (profilePhoto.size === 0 || profilePhoto.buffer.length === 0) {
    throw new Error("Profile photo is empty");
  }

  if (profilePhoto.size > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error(`Profile photo exceeds maximum size of ${MAX_PROFILE_PHOTO_BYTES} bytes`);
  }

  if (!allowedProfilePhotoMimeTypes.has(profilePhoto.mimetype as ProfilePhotoMimeType)) {
    throw new Error(
      `Profile photo content type must be one of: ${PROFILE_PHOTO_MIME_TYPES.join(", ")}`,
    );
  }

  const detectedMimeType = detectProfilePhotoMimeType(profilePhoto.buffer);
  if (!detectedMimeType) {
    throw new Error(
      `Profile photo must be a valid PNG, JPEG, or WEBP image with matching file signature`,
    );
  }

  const newUser = await UserRepo.get(user.userId);
  newUser.profilePhoto = {
    mimeType: detectedMimeType,
    dataBase64: profilePhoto.buffer.toString("base64"),
    sizeBytes: profilePhoto.size,
    uploadedAt: new Date().toISOString(),
  };

  await UserRepo.set(user.userId, newUser);
  return populateSafeUserInfo(user.userId);
}
