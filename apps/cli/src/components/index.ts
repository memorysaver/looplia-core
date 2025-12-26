/**
 * CLI Component exports
 */

export { type Activity, ActivityItem } from "./activity-item";
export { ActivityLog } from "./activity-log";
export { AgentOutput } from "./agent-output";
export { type AgentNode, AgentTree } from "./agent-tree";
export { BoxedArea } from "./boxed-area";
// Shared components
export { Header } from "./header";
export { MultiSelectInput } from "./inputs/multi-select-input";
export { SelectInput } from "./inputs/select-input";
// Input components (v0.6.4)
export { TextInput } from "./inputs/text-input";
export { ProgressBar } from "./progress-bar";
export { ProgressSection } from "./progress-section";
export { Spinner } from "./spinner";
// Generic streaming UI (v0.3.4 - universal)
export {
  renderStreamingQuery,
  StreamingQueryUI,
} from "./streaming-query-ui";
export { TokenStats } from "./token-stats";
export { UsageStats } from "./usage-stats";
// Build wizard components (v0.6.4)
export { type BuildWizardResult, renderBuildWizard } from "./wizard/index";
export {
  buildPreview,
  calculateComplexity,
  deriveWorkflowName,
  formatPreviewWorkflow,
} from "./wizard/preview-builder";
export { QuestionCard } from "./wizard/question-card";
export { ReviewPanel } from "./wizard/review-panel";
export { SectionView } from "./wizard/section-view";
export { TabBar } from "./wizard/tab-bar";
export type {
  Answers,
  ClarificationResult,
  PreviewStep,
  PreviewWorkflow,
  Question,
  QuestionOption,
  Recommendation,
  Section,
  WizardPhase,
  WizardState,
} from "./wizard/types";
export { BuildWizard, type WizardResult } from "./wizard/wizard";
export { WorkspaceHeader } from "./workspace-header";
