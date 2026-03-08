"use client";

import { useEffect } from "react";

export default function LibraryUrlSaver() {
  useEffect(() => {
    sessionStorage.setItem("libraryUrl", window.location.pathname + window.location.search);
  });

  return null;
}
