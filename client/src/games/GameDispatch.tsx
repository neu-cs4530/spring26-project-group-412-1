import type { SafeUserInfo, TaggedGameView } from "@gamenite/shared";
import NimGame from "./NimGame.tsx";
import GuessGame from "./GuessGame.tsx";
import MonopolyGame from "./MonopolyGame.tsx";
import { type JSX } from "react";
import useLoginContext from "../hooks/useLoginContext.ts";
import useAuth from "../hooks/useAuth.ts";

interface GameDispatchProps {
  userPlayerIndex: number;
  players: SafeUserInfo[];
  gameId: string;
  view: TaggedGameView;
  chatId?: string;
}

export default function GameDispatch({
  userPlayerIndex,
  gameId,
  players,
  view,
  chatId,
}: GameDispatchProps): JSX.Element {
  const { socket } = useLoginContext();
  const auth = useAuth();

  function makeMove(move: unknown) {
    socket.emit("gameMakeMove", { auth, payload: { gameId, move } });
  }

  const childProps = { userPlayerIndex, players, makeMove };
  switch (view.type) {
    case "nim":
      return <NimGame {...{ ...childProps, view: view.view }} />;
    case "guess":
      return <GuessGame {...{ ...childProps, view: view.view }} />;
    case "monopoly":
      return <MonopolyGame {...{ ...childProps, view: view.view, chatId }} />;
  }
}
