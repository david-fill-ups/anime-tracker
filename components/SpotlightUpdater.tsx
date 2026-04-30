"use client";

import { useEffect } from "react";
import { useSpotlight, type SpotlightAnime } from "./SpotlightContext";

export default function SpotlightUpdater({ anime }: { anime: SpotlightAnime }) {
  const { setSpotlight } = useSpotlight();

  useEffect(() => {
    setSpotlight(anime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime.coverImageUrl]);

  return null;
}
