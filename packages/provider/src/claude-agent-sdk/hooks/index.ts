/**
 * Hooks Module
 *
 * Exports workflow and build validation hooks for SDK integration.
 */

export {
  type BuildValidationManifest,
  createBuildHooks,
  createBuildStopGuardHook,
  createBuildValidateHook,
  isWorkflowFile,
  readBuildValidation,
  updateBuildValidation,
} from "./build-hooks";
export {
  createWorkflowHooks,
  postWriteValidateHook,
  stopGuardHook,
} from "./workflow-hooks";
