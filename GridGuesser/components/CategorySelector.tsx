"use client";

import React, { useState, useEffect } from "react";

export interface Category {
  id: string;
  name: string;
  searchTermsCount: number;
}

interface CategorySelectorProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  customQuery?: string;
  onCustomQueryChange?: (query: string) => void;
}

export default function CategorySelector({
  selectedCategory,
  onCategoryChange,
  customQuery = "",
  onCustomQueryChange,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [localCustomQuery, setLocalCustomQuery] = useState(customQuery);
  // 'choose' = show two buttons, 'preset' = show preset grid, 'custom' = show text input
  const [mode, setMode] = useState<'choose' | 'preset' | 'custom'>(
    selectedCategory === 'custom' ? 'custom' : selectedCategory !== 'landmarks' && selectedCategory !== '' ? 'preset' : 'choose'
  );

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || (process.env.NEXT_PUBLIC_SOCKET_URL ? `${process.env.NEXT_PUBLIC_SOCKET_URL}/api` : 'http://localhost:3001/api')}/categories`)
      .then(res => res.json())
      .then(data => {
        setCategories(data.categories);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching categories:', error);
        setCategories([
          { id: 'landmarks', name: 'Famous Landmarks', searchTermsCount: 15 },
          { id: 'animals', name: 'Animals', searchTermsCount: 15 },
          { id: 'food', name: 'Food & Dishes', searchTermsCount: 15 },
          { id: 'nature', name: 'Nature & Landscapes', searchTermsCount: 15 },
        ]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    setLocalCustomQuery(customQuery);
  }, [customQuery]);

  const handleCustomQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalCustomQuery(value);
    if (onCustomQueryChange) {
      onCustomQueryChange(value);
    }
    if (value.trim().length > 0) {
      onCategoryChange('custom');
    }
  };

  const handleSelectPreset = () => {
    setMode('preset');
    // Default to first category if currently on custom
    if (selectedCategory === 'custom' || selectedCategory === '') {
      onCategoryChange('landmarks');
    }
  };

  const handleSelectCustom = () => {
    setMode('custom');
    onCategoryChange('custom');
  };

  const handleBack = () => {
    setMode('choose');
  };

  if (loading) {
    return (
      <div className="w-full p-4 text-center text-gray-500">
        Loading categories...
      </div>
    );
  }

  // Initial choice screen: two buttons
  if (mode === 'choose') {
    return (
      <div className="space-y-3">
        <button
          onClick={handleSelectPreset}
          className="w-full p-5 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all duration-200 text-left"
        >
          <div className="font-bold text-lg text-gray-800 dark:text-gray-100">
            Select Preset Category
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose from {categories.length} curated image categories
          </p>
        </button>

        <button
          onClick={handleSelectCustom}
          className="w-full p-5 rounded-xl border-2 border-purple-500 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all duration-200 text-left"
        >
          <div className="font-bold text-lg text-gray-800 dark:text-gray-100">
            Choose Custom Category
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Type any topic and we&apos;ll find images using AI
          </p>
        </button>
      </div>
    );
  }

  // Preset category grid
  if (mode === 'preset') {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
        >
          ← Back
        </button>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Select Image Category
        </label>

        <div className="grid grid-cols-2 gap-3">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={`
                p-4 rounded-lg border-2 transition-all duration-200 text-left
                ${
                  selectedCategory === category.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                }
              `}
            >
              <div className="font-semibold text-gray-800 dark:text-gray-100">
                {category.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {category.searchTermsCount} images
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Custom category input
  return (
    <div className="space-y-4">
      <button
        onClick={handleBack}
        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1"
      >
        ← Back
      </button>

      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Enter your custom category
      </label>

      <input
        type="text"
        value={localCustomQuery}
        onChange={handleCustomQueryChange}
        placeholder="e.g., 'famous paintings', 'space exploration', 'dinosaurs'..."
        className={`
          w-full px-4 py-3 rounded-lg border-2 transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-purple-500
          ${
            localCustomQuery.trim().length > 0
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
              : 'border-gray-300 dark:border-gray-600'
          }
          text-gray-800 dark:text-gray-100
          placeholder-gray-400 dark:placeholder-gray-500
          bg-white dark:bg-gray-800
        `}
        autoFocus
      />

      {localCustomQuery.trim().length > 0 && (
        <p className="text-xs text-purple-600 dark:text-purple-400">
          Images will be discovered for &quot;{localCustomQuery}&quot; using AI
        </p>
      )}
    </div>
  );
}
