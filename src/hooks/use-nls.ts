"use client";

import { useState, useCallback } from "react";
import {
  generateNarrative,
  generateAllNarratives,
  invalidateTemplateCache,
} from "@/lib/nls/engine";
import type { NarrativeContext } from "@/lib/nls/engine";
import type {
  TransactionType,
  NarrativeLevel,
  TransactionNarratives,
} from "@/types/database";

interface UseNLSReturn {
  narratives: TransactionNarratives | null;
  loading: boolean;
  error: string | null;
  generate: (
    operationType: TransactionType,
    context: NarrativeContext,
    tenantId?: string
  ) => Promise<TransactionNarratives>;
  generateSingle: (
    operationType: TransactionType,
    level: NarrativeLevel,
    context: NarrativeContext,
    tenantId?: string
  ) => Promise<string>;
  reset: () => void;
  refreshCache: () => void;
}

export function useNLS(): UseNLSReturn {
  const [narratives, setNarratives] =
    useState<TransactionNarratives | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (
      operationType: TransactionType,
      context: NarrativeContext,
      tenantId?: string
    ): Promise<TransactionNarratives> => {
      setLoading(true);
      setError(null);
      try {
        const result = await generateAllNarratives(
          operationType,
          context,
          tenantId
        );
        setNarratives(result);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error generando narrativas";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generateSingle = useCallback(
    async (
      operationType: TransactionType,
      level: NarrativeLevel,
      context: NarrativeContext,
      tenantId?: string
    ): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
        const result = await generateNarrative(
          operationType,
          level,
          context,
          tenantId
        );
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Error generando narrativa";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setNarratives(null);
    setError(null);
  }, []);

  const refreshCache = useCallback(() => {
    invalidateTemplateCache();
  }, []);

  return {
    narratives,
    loading,
    error,
    generate,
    generateSingle,
    reset,
    refreshCache,
  };
}
