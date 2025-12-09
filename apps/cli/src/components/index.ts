/**
 * CLI Component exports
 */

// Generic streaming UI (v0.3.4 - universal)
export {
  StreamingQueryUI,
  renderStreamingQuery,
} from "./StreamingQueryUI.js";
export { AgentOutput } from "./AgentOutput.js";

// Legacy kit-specific UI (kept for backward compatibility)
export { KitBuilderUI, renderKitBuilder } from "./KitBuilderUI.js";

// Shared components
export { Header } from "./Header.js";
export { ProgressBar } from "./ProgressBar.js";
export { ProgressSection } from "./ProgressSection.js";
export { ActivityLog } from "./ActivityLog.js";
export { ActivityItem, type Activity } from "./ActivityItem.js";
export { UsageStats } from "./UsageStats.js";
export { ResultSection } from "./ResultSection.js";
export { Spinner } from "./Spinner.js";
