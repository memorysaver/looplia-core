/**
 * Shared types for build wizard components
 */

export type QuestionOption = {
  id: string;
  label: string;
  inferred?: boolean;
};

export type Question = {
  id: string;
  text: string;
  type: "single-select" | "multi-select" | "text";
  options?: QuestionOption[];
  reason?: string;
};

export type Section = {
  id: string;
  title: string;
  completed: boolean;
  questions: Question[];
};

export type Recommendation = {
  goalId: string;
  skill: string;
  stepId: string;
  matchScore?: number;
  rationale?: string;
};

export type Answers = Record<string, Record<string, string | string[]>>;

export type ClarificationResult = {
  requirements: {
    inputType?: string;
    goals?: string[];
    outputFormat?: string;
  };
  recommendations: Recommendation[];
  clarificationNeeded: boolean;
  clarifications: {
    sections: Section[];
  };
};

export type PreviewStep = {
  id: string;
  skill: string;
  needs: string[];
  output: string;
};

export type PreviewWorkflow = {
  name: string;
  steps: PreviewStep[];
};

export type WizardPhase =
  | "description"
  | "analyzing"
  | "clarifying"
  | "generating"
  | "preview"
  | "complete"
  | "error";

export type WizardState = {
  phase: WizardPhase;
  description: string;
  sections: Section[];
  currentSectionIndex: number;
  answers: Answers;
  recommendations: Recommendation[];
  workflow: PreviewWorkflow | null;
  error: Error | null;
};
