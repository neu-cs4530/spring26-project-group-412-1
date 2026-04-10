import type { ErrorMsg, GameInfo, GameKey } from "@gamenite/shared";
import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.ts";
import { api, exceptionToErrorMsg } from "../services/api.ts";
import { gameNames } from "../util/consts.ts";

export default function NewGame() {
  const [gameKey, setGameKey] = useState<GameKey | "">("");
  const [startingMoney, setStartingMoney] = useState("1500");
  const [err, setErr] = useState<string | null>(null);
  const auth = useAuth();
  const navigate = useNavigate();

  const handleGameChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setErr(null);
    setGameKey(e.target.value as GameKey | "");
  };

  const handleCreateGame = async () => {
    if (gameKey === "") {
      setErr("Please select a game");
      return;
    }

    try {
      const res = await api.post<GameInfo | ErrorMsg>("/api/game/create", {
        auth,
        payload:
          gameKey === "monopoly"
            ? {
                gameKey: "monopoly",
                startingMoney: Number(startingMoney) || 1500,
              }
            : gameKey,
      });

      if ("error" in res.data) {
        setErr(res.data.error);
        return;
      }

      navigate(`/game/${res.data.gameId}`);
    } catch (error) {
      setErr(exceptionToErrorMsg(error).error);
    }
  };

  return (
    <form className="content spacedSection">
      <h2>Create new game</h2>
      <div>
        <select value={gameKey} aria-label="Game selection" onChange={handleGameChange}>
          <option value="">— Select a game —</option>
          {Object.entries(gameNames).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {gameKey === "monopoly" && (
        <div>
          <label htmlFor="startingMoney">Starting money: </label>
          <input
            id="startingMoney"
            type="number"
            min="1"
            step="1"
            value={startingMoney}
            onChange={(e) => setStartingMoney(e.target.value)}
          />
        </div>
      )}
      {err && <p className="error-message">{err}</p>}
      <div>
        <button className="primary narrow" type="button" onClick={handleCreateGame}>
          Create New Game
        </button>
      </div>
    </form>
  );
}
