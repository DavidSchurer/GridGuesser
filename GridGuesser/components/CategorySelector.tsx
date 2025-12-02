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
}

export default function CategorySelector({
  selectedCategory,
  onCategoryChange,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch available categories from server
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/categories`)
      .then(res => res.json())
      .then(data => {
        setCategories(data.categories);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching categories:', error);
        // Fallback categories
        setCategories([
          { id: 'landmarks', name: 'Famous Landmarks', searchTermsCount: 15 },
          { id: 'animals', name: 'Animals', searchTermsCount: 15 },
          { id: 'food', name: 'Food & Dishes', searchTermsCount: 15 },
          { id: 'nature', name: 'Nature & Landscapes', searchTermsCount: 15 },
        ]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="w-full p-4 text-center text-gray-500">
        Loading categories...
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
        Images will be fetched from Google Images based on your selected category
      </p>
    </div>
  );
}


