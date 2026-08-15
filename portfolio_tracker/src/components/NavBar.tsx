import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const tabs = [
    { label: "Home", path: "/" },
    { label: "Portfolios", path: "/portfolio" },
    { label: "Industry", path: "/industry" },
    { label: "Charts", path: "/charts" },
    { label: "Watchlist", path: "/watchlist" },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="w-full bg-white shadow-sm border-b">
      {/* Desktop nav */}
      <ul className="hidden md:flex max-w-6xl mx-auto text-sm font-semibold tracking-wide">
        {tabs.map((tab) => (
          <li key={tab.path} className="w-full text-center">
            <NavLink
              to={tab.path}
              end
              className={({ isActive }) =>
                `block py-5 hover:bg-[#eef4ff] transition ${
                  isActive ? "border-b-2 border-black font-bold" : "text-gray-600"
                }`
              }
            >
              {tab.label}
            </NavLink>
          </li>
        ))}
        <li className="w-full text-center">
          <button
            onClick={handleLogout}
            className="block py-5 px-3 w-full text-sm font-semibold text-red-600 hover:bg-[#ffeaea] transition cursor-pointer"
          >
            Logout
          </button>
        </li>
      </ul>

      {/* Mobile nav header */}
      <div className="flex md:hidden items-center justify-between px-4 py-3">
        <span className="text-sm font-bold tracking-tight">Investly</span>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="text-gray-600 hover:text-gray-900 transition"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 text-sm font-semibold tracking-wide">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `block px-5 py-3 hover:bg-[#eef4ff] transition ${
                  isActive ? "border-l-2 border-black font-bold" : "text-gray-600"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
          <button
            onClick={handleLogout}
            className="block w-full text-left px-5 py-3 text-red-600 hover:bg-[#ffeaea] transition cursor-pointer"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
