import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { requestAIDataUpdate, requestAIOptimizationDiagnosis } from "../services/app.service";
import { checkAIAvailability } from '../services/ai-settings.service';
import { useApp } from "../AppContext";
import type {
  AIPromptResponse,
  AIPromptUpdatedScenario,
  AIOptimizationDiagnosisResponse,
} from "../types";
const SAMPLE_RESPONSE_PATH = "../data/sample_ai_response.json";

const loadSampleResponse = async (): Promise<AIPromptResponse | null> => {
  try {
    const mod = await import(SAMPLE_RESPONSE_PATH);
    const payload = (mod as { default?: AIPromptResponse }).default ?? (mod as AIPromptResponse);
    return payload ?? null;
  } catch (err) {
    return null;
  }
};

type AIPromptStatus = "idle" | "running" | "success" | "error";
type AIPromptRequestKind = "data-update" | "optimization-diagnosis" | null;

export interface AIPromptContextValue {
  isAvailable: boolean;
  setAvailability: (available: boolean) => void;
  status: AIPromptStatus;
  requestKind: AIPromptRequestKind;
  isRunning: boolean;
  response: AIPromptResponse | null;
  diagnosis: AIOptimizationDiagnosisResponse | null;
  updatedScenario: AIPromptUpdatedScenario | null;
  updateNotes: string[];
  errorMessage: string | null;
  lastPrompt: string | null;
  runPrompt: (scenarioId: string | number, prompt: string) => Promise<void>;
  runOptimizationDiagnosis: (scenarioId: string | number, errorMessage: string) => Promise<void>;
  clearResult: () => void;
}

const AIPromptContext = createContext<AIPromptContextValue | undefined>(undefined);

export const useAIPrompt = (): AIPromptContextValue => {
  const ctx = useContext(AIPromptContext);
  if (!ctx) throw new Error("useAIPrompt must be used within an AIPromptProvider");
  return ctx;
};

interface AIPromptProviderProps {
  children: React.ReactNode;
}

export const AIPromptProvider: React.FC<AIPromptProviderProps> = ({ children }) => {
  const { port } = useApp();
  const USE_SAMPLE_AI_RESPONSE = false;
  const [isAvailable, setIsAvailable] = useState(false);
  const availabilityConfigured = useRef(false);
  const setAvailability = (available: boolean) => {
    availabilityConfigured.current = true;
    setIsAvailable(available);
  };
  const [status, setStatus] = useState<AIPromptStatus>("idle");
  const [requestKind, setRequestKind] = useState<AIPromptRequestKind>(null);
  const [response, setResponse] = useState<AIPromptResponse | null>(null);
  const [diagnosis, setDiagnosis] = useState<AIOptimizationDiagnosisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatedScenario, setUpdatedScenario] = useState<AIPromptUpdatedScenario | null>(null);
  const [updateNotes, setUpdateNotes] = useState<string[]>([]);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    availabilityConfigured.current = false;
    let retry: ReturnType<typeof setTimeout>;
    setIsAvailable(false);
    const checkAvailability = async () => {
      try {
        const available = await checkAIAvailability(port, controller.signal);
        if (!controller.signal.aborted && !availabilityConfigured.current) setIsAvailable(available);
      } catch {
        // AI is optional. A failed availability check should stay out of the UI.
        if (!controller.signal.aborted && !availabilityConfigured.current) {
          setIsAvailable(false);
          // The desktop window can load before its local backend is ready.
          retry = setTimeout(checkAvailability, 5000);
        }
      }
    };
    checkAvailability();
    return () => { controller.abort(); clearTimeout(retry); };
  }, [port]);

  const runPrompt = async (scenarioId: string | number, prompt: string): Promise<void> => {
    if (!isAvailable) return;
    setStatus("running");
    setRequestKind("data-update");
    setErrorMessage(null);
    setResponse(null);
    setDiagnosis(null);
    setUpdatedScenario(null);
    setUpdateNotes([]);
    setLastPrompt(prompt);

    try {
      if (USE_SAMPLE_AI_RESPONSE) {
        const payload = await loadSampleResponse();
        if (payload) {
          setResponse(payload);
          setUpdatedScenario(payload.updatedScenario || null);
          setUpdateNotes(payload.updateNotes || (payload as any).updatedNotes || []);
          setStatus(payload.status === "success" ? "success" : "error");
          setErrorMessage(payload.errorMessage || payload.error || null);
          return;
        }
      }

      const result = await requestAIDataUpdate(port, scenarioId, prompt);
      let payload: AIPromptResponse | null = null;
      try {
        payload = await result.json();
      } catch (parseError) {
        payload = null;
      }

      if (!result.ok || !payload) {
        throw new Error(payload?.errorMessage || result.statusText || "AI request failed");
      }

      if (payload.status !== "success") {
        setErrorMessage(payload.errorMessage || payload.error || "AI request failed.");
        setResponse(payload);
        setStatus("error");
        return;
      }

      setResponse(payload);
      setUpdatedScenario(payload.updatedScenario || null);
      setUpdateNotes(payload.updateNotes || (payload as any).updatedNotes || []);
      setStatus("success");
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to run AI prompt");
      setStatus("error");
    }
  };

  const runOptimizationDiagnosis = async (
    scenarioId: string | number,
    failureMessage: string
  ): Promise<void> => {
    if (!isAvailable) return;
    setStatus("running");
    setRequestKind("optimization-diagnosis");
    setErrorMessage(null);
    setResponse(null);
    setDiagnosis(null);
    setUpdatedScenario(null);
    setUpdateNotes([]);
    setLastPrompt(failureMessage);

    try {
      const result = await requestAIOptimizationDiagnosis(port, scenarioId, failureMessage);
      let payload: AIOptimizationDiagnosisResponse | null = null;
      try {
        payload = await result.json();
      } catch (parseError) {
        payload = null;
      }

      if (!result.ok || !payload) {
        throw new Error(payload?.errorMessage || result.statusText || "AI diagnosis request failed");
      }

      if (payload.status !== "success") {
        setDiagnosis(payload);
        setErrorMessage(payload.errorMessage || payload.error || "AI diagnosis request failed.");
        setStatus("error");
        return;
      }

      setDiagnosis(payload);
      setStatus("success");
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to diagnose optimization error");
      setStatus("error");
    }
  };

  const clearResult = (): void => {
    setStatus("idle");
    setRequestKind(null);
    setErrorMessage(null);
    setResponse(null);
    setDiagnosis(null);
    setUpdatedScenario(null);
    setUpdateNotes([]);
    setLastPrompt(null);
  };

  const value = useMemo(
    () => ({
      isAvailable,
      setAvailability,
      status,
      requestKind,
      isRunning: status === "running",
      response,
      diagnosis,
      updatedScenario,
      updateNotes,
      errorMessage,
      lastPrompt,
      runPrompt,
      runOptimizationDiagnosis,
      clearResult,
    }),
    [isAvailable, status, requestKind, response, diagnosis, updatedScenario, updateNotes, errorMessage, lastPrompt]
  );

  return <AIPromptContext.Provider value={value}>{children}</AIPromptContext.Provider>;
};
