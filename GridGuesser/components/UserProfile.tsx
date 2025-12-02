"use client";

import React, { useState } from "react";
import { useAuth } from "../lib/authContext";
import AuthModal from "./AuthModal";

export default function UserProfile() {
  const { user, logout, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Login / Sign Up
          </button>
        </div>
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowProfileMenu(!showProfileMenu)}
        className="flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-lg hover:border-blue-500 hover:bg-white/20 transition-all"
      >
        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div className="text-left">
          <div className="text-sm font-bold text-white">{user.username}</div>
          <div className="text-xs text-blue-300 font-medium">
            {user.stats.gamesWon}W / {user.stats.gamesLost}L
          </div>
        </div>
      </button>

      {showProfileMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowProfileMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-72 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border-2 border-white/10 z-20 overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-gradient-to-br from-blue-600/20 to-purple-600/20">
              <h3 className="font-bold text-xl text-white mb-1">{user.username}</h3>
              <p className="text-sm text-gray-300">{user.email}</p>
            </div>

            <div className="p-5 border-b border-white/10">
              <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Statistics</h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Games Played:</span>
                  <span className="font-bold text-white text-base">{user.stats.gamesPlayed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Win Rate:</span>
                  <span className="font-bold text-blue-400 text-base">
                    {user.stats.gamesPlayed > 0
                      ? Math.round((user.stats.gamesWon / user.stats.gamesPlayed) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Total Points:</span>
                  <span className="font-bold text-white text-base">{user.stats.totalPoints}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Best Streak:</span>
                  <span className="font-bold text-purple-400 text-base">{user.stats.bestStreak}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Current Streak:</span>
                  <span className="font-bold text-white text-base">{user.stats.currentStreak}</span>
                </div>
              </div>
            </div>

            <div className="p-3">
              <button
                onClick={() => {
                  logout();
                  setShowProfileMenu(false);
                }}
                className="w-full px-4 py-2.5 text-center font-bold text-red-400 hover:text-white hover:bg-red-600/20 rounded-lg transition-all border border-red-600/30 hover:border-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

