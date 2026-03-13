import { type SafeUserInfo, withAuth, zUserAuth, zUserUpdateRequest } from "@gamenite/shared";
import multer from "multer";
import { type NextFunction, type Request, type Response } from "express";
import {
  MAX_PROFILE_PHOTO_BYTES,
  createUser,
  getUsersByUsername,
  populateSafeUserInfo,
  updateUser,
  updateUserProfilePhoto,
} from "../services/user.service.ts";
import { type RestAPI } from "../types.ts";
import { z } from "zod";
import { checkAuth, getUserByUsername } from "../services/auth.service.ts";

const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: MAX_PROFILE_PHOTO_BYTES,
  },
}).single("photo");

const zPhotoAuth = z.object({
  authUsername: z.string(),
  authPassword: z.string(),
});

/**
 * Parse a multipart profile-photo upload request.
 */
export function profilePhotoUploadMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  profilePhotoUpload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).send({
          error: `Profile photo exceeds maximum size of ${MAX_PROFILE_PHOTO_BYTES} bytes`,
        });
        return;
      }
      res.status(400).send({ error: "Invalid profile photo upload payload" });
      return;
    }

    if (err) {
      res.status(400).send({ error: "Invalid profile photo upload payload" });
      return;
    }

    next();
  });
}

/**
 * Handles user login by validating credentials.
 * @param req The request containing username and password in the body.
 * @param res The response, either returning the user or an error.
 */
export const postLogin: RestAPI<SafeUserInfo> = async (req, res) => {
  const userAuth = zUserAuth.safeParse(req.body);
  if (!userAuth.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(userAuth.data);
  if (!user) {
    res.send({ error: "Invalid username or password" });
    return;
  }

  res.send(await populateSafeUserInfo(user.userId));
};

/**
 * Update a user's information
 * @param req A request containing a new password
 * @param res The response, either returning the updated user or an error
 */
export const postByUsername: RestAPI<SafeUserInfo, { username: string }> = async (req, res) => {
  const body = withAuth(zUserUpdateRequest).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user || user.username !== req.params.username) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await updateUser(req.params.username, body.data.payload));
};

/**
 * Update a user's profile photo.
 */
export const postByUsernamePhoto: RestAPI<SafeUserInfo, { username: string }> = async (
  req,
  res,
) => {
  const auth = zPhotoAuth.safeParse(req.body);
  if (!auth.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth({
    username: auth.data.authUsername,
    password: auth.data.authPassword,
  });
  if (!user || user.username !== req.params.username) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  if (!req.file) {
    res.status(400).send({ error: "No profile photo uploaded" });
    return;
  }

  try {
    res.send(await updateUserProfilePhoto(req.params.username, req.file));
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith("No user ")) {
        res.status(404).send({ error: "User not found" });
        return;
      }
      if (error.message.includes("Profile photo")) {
        res.status(400).send({ error: error.message });
        return;
      }
    }
    throw error;
  }
};

/**
 * Handles the creation of a new user account.
 * @param req The request containing username and password in the body.
 * @param res The response, either returning the created user or an error.
 * @returns A promise resolving to void.
 */
export const postSignup: RestAPI<SafeUserInfo> = async (req, res) => {
  const userAuth = zUserAuth.safeParse(req.body);
  if (!userAuth.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  res.send(await createUser(userAuth.data.username, userAuth.data.password, new Date()));
};

/**
 * Retrieves a user by their username.
 * @param req The request containing the username as a route parameter.
 * @param res The response, either returning the user (200) or an error.
 */
export const getByUsername: RestAPI<SafeUserInfo, { username: string }> = async (req, res) => {
  const user = await getUserByUsername(req.params.username);
  if (!user) {
    res.status(404).send({ error: "User not found" });
    return;
  }
  res.send(await populateSafeUserInfo(user.userId));
};

/**
 * Returns the user information for a list of users
 */
export const postList: RestAPI<SafeUserInfo[]> = async (req, res) => {
  const usernames = z.array(z.string()).safeParse(req.body);
  if (!usernames.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  let users: SafeUserInfo[];
  try {
    users = await getUsersByUsername(usernames.data);
  } catch {
    res.send({ error: "Usernames do not all exist" });
    return;
  }

  res.send(users);
};
