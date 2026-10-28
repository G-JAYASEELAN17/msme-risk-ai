import { QueryClient } from "@tanstack/react-query";

/**
 * Global TanStack QueryClient configured for high performance, sensible stale/cache times,
 * and duplicate request suppression.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds fresh window
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection window
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
