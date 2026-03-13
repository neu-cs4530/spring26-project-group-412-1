/* eslint no-console: "off" */

import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useState } from "react";
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

/**
 * Websocket connection for the app. It would be natural to define this in a
 * useEffect hook, but the React docts advise against this.
 * https://react.dev/learn/you-might-not-need-an-effect#initializing-the-application
 * */
type StoredAuth = {
  user: SafeUserInfo;
  pass: string;
};

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
  const [auth, setAuth] = useState<AuthContext | null>(() => {
    if (typeof window === "undefined") return null;

    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as StoredAuth;
      return {
        user: parsed.user,
        pass: parsed.pass,
        reset: () => {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          setAuth(null);
        },
        setUser: (user: SafeUserInfo) => {
          setAuth((prev) => {
            if (!prev) return prev;
            const next = { ...prev, user };
            localStorage.setItem(
              AUTH_STORAGE_KEY,
              JSON.stringify({ user: next.user, pass: next.pass }),
            );
            return next;
          });
        },
      };
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  });

  const installAuth = (
    incomingAuth: { user: SafeUserInfo; pass: string; reset: () => void } | null,
  ) => {
    if (incomingAuth === null) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setAuth(null);
      return;
    }

    const nextAuth: AuthContext = {
      user: incomingAuth.user,
      pass: incomingAuth.pass,
      reset: () => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuth(null);
      },
      setUser: (user: SafeUserInfo) => {
        setAuth((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, user };
          localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
              user: updated.user,
              pass: updated.pass,
            }),
          );
          return updated;
        });
      },
    };

    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        user: nextAuth.user,
        pass: nextAuth.pass,
      }),
    );

    setAuth(nextAuth);
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
