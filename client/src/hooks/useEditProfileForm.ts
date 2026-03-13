import { type SubmitEvent, useState } from "react";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";
import { updateUser } from "../services/userService.ts";
import type { UserUpdateRequest } from "@gamenite/shared";

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

  /**
   * Handles submission of the form
   */
  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (user.display === display && user.bio === bio && password === confirm && password === "") {
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
    if (bio !== (user.bio ?? "")) updates.bio = bio;
    if (password !== "") updates.password = password;
    const response = await updateUser(auth, updates);
    if ("error" in response) {
      setErr(response.error);
      return;
    }

    if (updates.password !== undefined) {
      reset();
      return;
    }

    setUser(response);
    setErr(null);

    // We need to do this — or do something else that resets the login context
    reset();
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
  };
}
