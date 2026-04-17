"use client";

// Browser extensions (e.g. password managers) inject attributes like `fdprocessedid`
// into form elements after SSR but before React hydrates, causing benign hydration
// warnings. Patch console.error at module load time (before hydration) to suppress them.
const EXTENSION_ATTRS = ["fdprocessedid"];

if (typeof window !== "undefined") {
  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    // Check all string args — React 19 passes the component tree diff in later args,
    // so fdprocessedid may appear in args[1] or args[2], not just args[0].
    const combined = args.map((a) => (typeof a === "string" ? a : "")).join(" ");
    if (EXTENSION_ATTRS.some((attr) => combined.includes(attr))) return;
    original(...args);
  };
}

export default function SuppressExtensionHydration() {
  return null;
}
