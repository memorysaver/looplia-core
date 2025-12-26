/**
 * Build Wizard Renderer
 *
 * Provides the renderBuildWizard function for use in build command.
 */

import { render } from "ink";
import { BuildWizard, type WizardResult } from "./wizard.js";

export type BuildWizardOptions = {
  /** Initial description (from CLI args) */
  initialDescription?: string;
  /** Workflow name (from --name flag) */
  workflowName?: string;
  /** Workspace path */
  workspace: string;
  /** Mock mode - use mock data instead of API calls */
  mock?: boolean;
};

export type BuildWizardResult = {
  result?: WizardResult;
  cancelled?: boolean;
  error?: Error;
};

/**
 * Render the build wizard and return a promise that resolves when complete.
 *
 * This is the main entry point for the interactive build wizard.
 */
export function renderBuildWizard(
  options: BuildWizardOptions
): Promise<BuildWizardResult> {
  return new Promise((resolve) => {
    let resolved = false;

    const handleComplete = (result: WizardResult) => {
      if (resolved) {
        return;
      }
      resolved = true;
      instance.unmount();
      resolve({ result });
    };

    const handleCancel = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      instance.unmount();
      resolve({ cancelled: true });
    };

    const instance = render(
      <BuildWizard
        initialDescription={options.initialDescription}
        mock={options.mock}
        onCancel={handleCancel}
        onComplete={handleComplete}
        workflowName={options.workflowName}
        workspace={options.workspace}
      />
    );

    // Handle unexpected unmount
    instance.waitUntilExit().then(() => {
      if (!resolved) {
        resolved = true;
        resolve({ cancelled: true });
      }
    });
  });
}
