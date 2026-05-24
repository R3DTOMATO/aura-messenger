import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// When a request returns UNAUTHORIZED, mark auth.me as null so the
// app re-renders the LoginPage. (No redirect needed — the router
// switches based on the user query.)
const handleUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (error.data?.code !== "UNAUTHORIZED" && error.message !== UNAUTHED_ERR_MSG) {
    return;
  }
  queryClient.setQueryData(
    [["auth", "me"], { type: "query" }] as unknown as [readonly unknown[]],
    null
  );
  queryClient.invalidateQueries({ queryKey: [["auth", "me"]] });
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    handleUnauthorized(event.query.state.error);
    console.error("[API Query Error]", event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    handleUnauthorized(event.mutation.state.error);
    console.error("[API Mutation Error]", event.mutation.state.error);
  }
});

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/api/trpc`,
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
