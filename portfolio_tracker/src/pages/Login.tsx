import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await login(email, password);

    if (error) {
      setError(error.message);
      return;
    }

    navigate("/");
  };

  return (
    <div className="min-h-screen flex">

      {/* Left panel — value proposition */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-gray-950 text-white px-16 py-14">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Investly</h1>
          <p className="text-gray-400 text-sm">Your personal investing dashboard</p>
        </div>

        <div className="space-y-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">What's inside</div>
            <ul className="space-y-5">
              <li className="flex gap-4">
                <span className="mt-0.5 text-green-400 text-lg">↗</span>
                <div>
                  <div className="font-semibold text-sm">Portfolio tracking</div>
                  <div className="text-gray-400 text-xs mt-0.5">Track your holdings, cost basis, P&amp;L, and return % across multiple portfolios.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="mt-0.5 text-blue-400 text-lg">◎</span>
                <div>
                  <div className="font-semibold text-sm">Watchlist</div>
                  <div className="text-gray-400 text-xs mt-0.5">Monitor stocks you're watching and see how they've moved since you added them.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="mt-0.5 text-purple-400 text-lg">∿</span>
                <div>
                  <div className="font-semibold text-sm">Charts &amp; metrics</div>
                  <div className="text-gray-400 text-xs mt-0.5">Price history, P/E, EPS, market cap, beta, revenue, and more for any stock.</div>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="mt-0.5 text-amber-400 text-lg">✦</span>
                <div>
                  <div className="font-semibold text-sm">Benji — AI investing assistant</div>
                  <div className="text-gray-400 text-xs mt-0.5">Ask questions about your portfolio, look up stocks, and add holdings by chat.</div>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <p className="text-xs text-gray-600">Market data via Yahoo Finance</p>
      </div>

      {/* Right panel — login form */}
      <div className="flex flex-col justify-center w-full md:w-1/2 px-10 md:px-20 bg-white">
        <div className="max-w-sm w-full mx-auto">
          <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
          <p className="text-sm text-gray-500 mb-8">Sign in to your account</p>

          <form className="flex flex-col gap-4" onSubmit={handleLogin}>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</label>
              <input
                className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="you@example.com"
                type="email"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password</label>
              <input
                className="border border-gray-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                placeholder="••••••••"
                type="password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button className="mt-1 px-3 py-2.5 text-sm font-semibold rounded-lg bg-gray-950 text-white hover:bg-gray-800 transition cursor-pointer">
              Sign in
            </button>
          </form>

          <p className="text-sm text-gray-500 mt-6 text-center">
            Don't have an account?{" "}
            <Link to="/register" className="text-gray-900 font-semibold underline underline-offset-2">
              Create one
            </Link>
          </p>
        </div>
      </div>

    </div>
  );
}
