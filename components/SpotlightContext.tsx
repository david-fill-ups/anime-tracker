"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type SpotlightAnime = { coverImageUrl: string; title: string; score: number | null };

type SpotlightContextValue = {
  spotlight: SpotlightAnime | null;
  setSpotlight: (anime: SpotlightAnime) => void;
};

const SpotlightContext = createContext<SpotlightContextValue | null>(null);

export function SpotlightProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial: SpotlightAnime | null;
}) {
  const [spotlight, setSpotlight] = useState<SpotlightAnime | null>(initial);

  return (
    <SpotlightContext.Provider value={{ spotlight, setSpotlight }}>
      {children}
    </SpotlightContext.Provider>
  );
}

export function useSpotlight() {
  const ctx = useContext(SpotlightContext);
  if (!ctx) throw new Error("useSpotlight must be used within SpotlightProvider");
  return ctx;
}
