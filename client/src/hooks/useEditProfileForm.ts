import { type SubmitEvent, useEffect, useState } from "react";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";
import { updateUser, uploadUserProfilePhoto } from "../services/userService.ts";
import type { UserUpdateRequest } from "@gamenite/shared";
import { PROFILE_PHOTO_MAX_BYTES, PROFILE_PHOTO_MIME_TYPES } from "@gamenite/shared";

const profilePhotoMimeTypeSet = new Set<string>(PROFILE_PHOTO_MIME_TYPES);

/**
 * Custom hook to manage profile form logic
 * @returns an object containing
 *  - Form values `display`, `password`, and `confirm`
 *  - Form setters `setDisplay`, `setPassword`, and `setConfirm`
 *  - Possibly-null error message `err`
 *  - Submission handler `handleSubmit`
 */
export default function useEditProfileForm() {
  const { user, reset, setUser } = useLoginContext();
  const [display, setDisplay] = useState(user.display);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<null | string>(null);
  const [bio, setBio] = useState(user.bio ?? "");
  const auth = useAuth();
  const [success, setSuccess] = useState<null | string>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [photoFile]);

  const hasPhotoChange = photoFile !== null;

  const resetSelectedPhoto = () => {
    setSuccess(null);
    setErr(null);
    setPhotoFile(null);
  };

  const selectPhoto = (file: File | null) => {
    setSuccess(null);
    setErr(null);

    if (!file) {
      setPhotoFile(null);
      return;
    }

    if (!profilePhotoMimeTypeSet.has(file.type)) {
      setPhotoFile(null);
      setErr("Profile photo must be a PNG, JPEG, or WEBP image");
      return;
    }

    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      setPhotoFile(null);
      setErr(`Profile photo exceeds maximum size of ${PROFILE_PHOTO_MAX_BYTES} bytes`);
      return;
    }

    setPhotoFile(file);
  };

  /**
   * Handles submission of the form
   */
  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    setSuccess(null);
    const currentBio = user.bio ?? "";
    const uploadedPhoto = photoFile;

    if (
      user.display === display &&
      currentBio === bio &&
      password === confirm &&
      password === "" &&
      !hasPhotoChange
    ) {
      setErr("No changes to submit");
      return;
    }

    if (display.trim() !== display) {
      setErr("Display names can't begin or end with whitespace");
      return;
    }

    if (display.trim() === "") {
      setErr("Please enter a display name");
      return;
    }

    if (password.trim() !== password) {
      setErr("Passwords can't begin or end with whitespace");
      return;
    }

    if (password !== confirm) {
      setErr("Passwords don't match");
      return;
    }

    const updates: UserUpdateRequest = {};
    if (display !== user.display) updates.display = display;
    if (bio !== currentBio) updates.bio = bio;
    if (password !== "") updates.password = password;
    let didUploadPhoto = false;

    try {
      let latestUser = user;

      if (uploadedPhoto) {
        const photoResponse = await uploadUserProfilePhoto(auth, uploadedPhoto);
        if ("error" in photoResponse) {
          setErr(photoResponse.error);
          return;
        }
        latestUser = photoResponse;
        setUser(photoResponse);
        setPhotoFile(null);
        didUploadPhoto = true;
      }

      if (Object.keys(updates).length > 0) {
        const response = await updateUser(auth, updates);
        if ("error" in response) {
          if (didUploadPhoto) {
            setErr(`Profile photo updated, but other changes failed: ${response.error}`);
            return;
          }
          setErr(response.error);
          return;
        }
        latestUser = response;
      }

      if (updates.password !== undefined) {
        reset();
        return;
      }

      setUser(latestUser);
      if (uploadedPhoto && Object.keys(updates).length > 0) {
        setSuccess("Profile and photo updated");
      } else if (uploadedPhoto) {
        setSuccess("Profile photo updated");
      } else {
        setSuccess("Profile updated");
      }
    } catch {
      if (didUploadPhoto) {
        setErr("Profile photo may have been updated, but another profile change failed");
        return;
      }
      setErr("Something went wrong while updating your profile");
    }
  };

  return {
    display,
    setDisplay,
    password,
    setPassword,
    confirm,
    setConfirm,
    bio,
    setBio,
    err,
    handleSubmit,
    photoFile,
    photoPreviewUrl,
    selectPhoto,
    resetSelectedPhoto,
    success,
  };
}
