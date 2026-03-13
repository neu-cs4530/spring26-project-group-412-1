/* eslint no-console: "off" */

import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import Login from "./pages/Login.tsx";
import type { AuthContext } from "./contexts/LoginContext.ts";
import Layout from "./components/Layout.tsx";
import Home from "./pages/Home.tsx";
import ThreadList from "./pages/ThreadList.tsx";
import Profile from "./pages/Profile.tsx";
import { io } from "socket.io-client";
import type { GameSocket } from "./util/types.ts";
import LoggedInRoute from "./components/LoggedInRoute.tsx";
import NewGame from "./pages/NewGame.tsx";
import Game from "./pages/Game.tsx";
import GameList from "./pages/GameList.tsx";
import ThreadPage from "./pages/ThreadPage.tsx";
import { ErrorBoundary } from "react-error-boundary";
import fallback from "./fallback.tsx";
import NewThread from "./pages/NewThread.tsx";
import TimeContextKeeper from "./components/UpdatingTimeContext.tsx";
import type { SafeUserInfo } from "@gamenite/shared";

/** If `true`, all incoming socket messages will be logged */
const DEBUG_SOCKETS = false;
const AUTH_STORAGE_KEY = "gamenite-auth";

type StoredAuth = {
  user: SafeUserInfo;
  pass: string;
};

type LoginAuth = {
  user: SafeUserInfo;
  pass: string;
  reset: () => void;
};

/**
 * Reads the persisted auth payload from localStorage, if present.
 */
function loadStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

let socket: GameSocket | null = null;
if (typeof window !== "undefined") {
  socket = io();
  if (DEBUG_SOCKETS) {
    socket.onAny((tag, payload) => {
      console.log(`from socket got ${tag}(${JSON.stringify(payload)})`);
    });
  }
}

function NoSuchRoute() {
  const { pathname } = useLocation();
  return `No page found for route '${pathname}'`;
}

export default function App() {
  const [storedAuth, setStoredAuth] = useState<StoredAuth | null>(() => loadStoredAuth());

  const auth = useMemo<AuthContext | null>(() => {
    if (!storedAuth) return null;

    return {
      user: storedAuth.user,
      pass: storedAuth.pass,
      reset: () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setStoredAuth(null);
      },
      setUser: (user: SafeUserInfo) => {
        const updated: StoredAuth = {
          user,
          pass: storedAuth.pass,
        };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
        setStoredAuth(updated);
      },
    };
  }, [storedAuth]);

  const installAuth = (incomingAuth: LoginAuth | null) => {
    if (incomingAuth === null) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setStoredAuth(null);
      return;
    }

    const nextStoredAuth: StoredAuth = {
      user: incomingAuth.user,
      pass: incomingAuth.pass,
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextStoredAuth));
    setStoredAuth(nextStoredAuth);
  };

  return (
    socket && (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login setAuth={installAuth} />} />
          <Route
            element={
              <LoggedInRoute auth={auth} socket={socket}>
                <TimeContextKeeper updateFrequency={20 * 1000}>
                  <ErrorBoundary fallbackRender={fallback}>
                    <Layout />
                  </ErrorBoundary>
                </TimeContextKeeper>
              </LoggedInRoute>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/forum" element={<ThreadList />} />
            <Route path="/forum/post/new" element={<NewThread />} />
            <Route path="/forum/post/:threadId" element={<ThreadPage />} />
            <Route path="/games" element={<GameList />} />
            <Route path="/game/new" element={<NewGame />} />
            <Route path="/game/:gameId" element={<Game />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/*" element={<NoSuchRoute />} />
          </Route>
        </Routes>
      </BrowserRouter>
    )
  );
}
