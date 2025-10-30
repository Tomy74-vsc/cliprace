"use client";

import { useEffect } from "react";

export default function ClientEnhancement() {
  useEffect(() => {
    document.body.dataset.js = "enhanced";
  }, []);
  return null;
}
