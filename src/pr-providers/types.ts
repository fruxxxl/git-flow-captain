import type { TProjectConfig } from '../configs/config-schema';

/**
 * @interface IPrProvider
 * @description Defines the contract for a Pull/Merge Request provider client.
 */
export interface IPrProvider {
  /**
   * Creates a Pull/Merge Request.
   *
   * @param {TProjectConfig} project - The configuration of the project for which to create the PR/MR.
   * @param {string} sourceBranch - The name of the source branch.
   * @param {string} targetBranch - The name of the target branch.
   * @param {string} title - The title for the PR/MR.
   * @param {string} [description] - Optional description for the PR/MR.
   * @returns {Promise<string | undefined>} A promise that resolves with the URL of the created PR/MR,
   *                                      or undefined if the creation failed or the URL could not be determined.
   */
  createPr(
    project: TProjectConfig,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description?: string,
  ): Promise<string | undefined>;
}

// You might want to move related types like ICreateMergeRequestParams and ICreatePullRequestParams here too
// for better organization, but for now, we'll just define the core interface.
