"use client";

import { useEffect } from "react";
import { ensureSeedData } from "@/lib/seed";

export function useSeedData() {
  useEffect(() => {
    ensureSeedData().catch(() => {
      // ignore
    });
  }, []);
}

