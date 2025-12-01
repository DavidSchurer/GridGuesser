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
        className="flex items-center gap-3 px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div className="text-left">
          <div className="text-sm font-medium text-gray-800">{user.username}</div>
          <div className="text-xs text-gray-500">
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
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">{user.username}</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>

            <div className="p-4 border-b border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Statistics</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Games Played:</span>
                  <span className="font-medium">{user.stats.gamesPlayed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Win Rate:</span>
                  <span className="font-medium">
                    {user.stats.gamesPlayed > 0
                      ? Math.round((user.stats.gamesWon / user.stats.gamesPlayed) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Points:</span>
                  <span className="font-medium">{user.stats.totalPoints}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Best Streak:</span>
                  <span className="font-medium">{user.stats.bestStreak}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Streak:</span>
                  <span className="font-medium">{user.stats.currentStreak}</span>
                </div>
              </div>
            </div>

            <div className="p-2">
              <button
                onClick={() => {
                  logout();
                  setShowProfileMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 rounded-md transition-colors"
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

