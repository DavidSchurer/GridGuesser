"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, ReactNode } from 'react';

/**
 * TanStack Query Provider for Server State Management
 * 
 * Benefits:
 * - Automatic caching and refetching
 * - Background updates
 * - Optimistic updates
 * - Better error handling
 * - DevTools for debugging
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: How long data is considered fresh
            staleTime: 5 * 1000, // 5 seconds
            
            // Cache time: How long inactive data stays in memory
            gcTime: 10 * 60 * 1000, // 10 minutes
            
            // Retry failed queries
            retry: 1,
            
            // Refetch on window focus (useful for active games)
            refetchOnWindowFocus: true,
            
            // Don't refetch on reconnect for game state
            refetchOnReconnect: false,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools - only visible in development */}
      <ReactQueryDevtools initialIsOpen={false} position="bottom" />
    </QueryClientProvider>
  );
}

/**
 * Query Keys for organized cache management
 */
export const queryKeys = {
  gameRoom: (roomId: string) => ['gameRoom', roomId] as const,
  userProfile: () => ['userProfile'] as const,
  activeRooms: () => ['activeRooms'] as const,
} as const;
