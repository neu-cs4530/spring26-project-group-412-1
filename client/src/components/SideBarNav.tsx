import "./SideBarNav.css";
import { useContext, useState } from "react";
import { NavLink, type NavLinkRenderProps } from "react-router-dom";
import useAuth from "../hooks/useAuth.ts";
import { InviteContext } from "../contexts/InviteContext.ts";

/**
 * The SideBarNav component contains the primary navigation menu. It
 * highlights the currently selected page and triggers navigation when the
 * menu items are clicked.
 */
export default function SideBarNav() {
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const { username } = useAuth();
  const { pendingCount } = useContext(InviteContext);

  const toggleOptions = () => {
    setShowOptions(!showOptions);
  };

  const navClass = ({ isActive }: NavLinkRenderProps) =>
    `menu_button ${isActive ? "menu_selected" : ""}`;

  return (
    <div className="sideBarNav">
      <NavLink to="/" className={navClass}>
        <span className="navLinkInner">
          Home
          {pendingCount > 0 && <span className="inviteBadge">{pendingCount}</span>}
        </span>
      </NavLink>
      <NavLink to="/games" className={navClass}>
        Games
      </NavLink>
      <NavLink to="/forum" className={navClass}>
        Forum
      </NavLink>
      <NavLink
        to={`/profile/${username}`}
        id="menu_user"
        className={navClass}
        onClick={toggleOptions}
      >
        Profile
      </NavLink>
    </div>
  );
}
