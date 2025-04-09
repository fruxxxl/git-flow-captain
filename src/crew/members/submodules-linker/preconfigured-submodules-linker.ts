import prompts from 'prompts';
import simpleGit, { SimpleGit } from 'simple-git';
import { TPrProvider, TProjectConfig } from '../../../configs/config-schema';
import { ILogger } from '../../../types';
import { AbstractSubmodulesLinker } from './abstract-submodules-linker';

// Interface for preconfigured operations
interface SubmoduleOperationPresets {
  updateFeatureBranch: boolean;
  commitChanges: boolean;
  pushToRemote: boolean;
  createPR: boolean;
  prProvider: string;
}

export class PreconfiguredSubmodulesLinker extends AbstractSubmodulesLinker {
  private tempBranchNameMap = new Map<string, string>();

  constructor(
    protected readonly projectConfigs: TProjectConfig[],
    protected readonly prProviders: TPrProvider[],
    protected readonly logger: ILogger,
  ) {
    super(projectConfigs, prProviders, logger);
  }

  public async execute() {
    // Selecting projects
    const selectedProjects = await this.selectProjectsToUpdate();
    if (selectedProjects.length === 0) {
      this.logger.info('No projects selected. Exiting.');
      return;
    }
    this.logger.info(`Selected projects: ${selectedProjects.map((p) => p.name).join(', ')}`);

    // Getting common presets for all selected projects
    const projectsWithPresets = await this.getProjectsWithPresets(selectedProjects);

    // Displaying summary of settings for all projects
    this.displayConfigurationSummary(selectedProjects, projectsWithPresets);

    // Requesting confirmation
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to continue with these settings?',
      initial: true,
    });

    if (!confirm) {
      this.logger.info('Operation cancelled by user');
      return;
    }

    // Processing each project
    for (const project of selectedProjects) {
      this.logger.info(`Configuring updating submodules for project ${project.name}`);

      const presets = projectsWithPresets.get(project);
      // Should always exist due to the logic in getProjectsWithPresets, but check for safety
      if (!presets) {
        this.logger.warn(`Presets not found for project ${project.name}. Skipping.`);
        continue;
      }

      // Getting branch name from map
      let featureBranchName = this.tempBranchNameMap.get(project.name) || '';

      // Checking if branch exists and creating it if necessary
      if (featureBranchName) {
        const projectGit: SimpleGit = simpleGit(project.path);

        try {
          const { all } = await projectGit.branchLocal();

          if (!all.includes(featureBranchName)) {
            // Branch doesn't exist, creating it
            this.logger.info(`Creating new branch: ${featureBranchName}`);
            await projectGit.checkout(`${project.remoteName}/${project.baseBranch}`);
            await projectGit.checkoutLocalBranch(featureBranchName);
          } else {
            // Branch exists, switching to it
            await projectGit.checkout(featureBranchName);
          }
        } catch (error) {
          this.logger.error(
            `Failed to checkout/create branch ${featureBranchName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          // Fallback to prompting for this specific project if common branch logic failed
          featureBranchName = await this.createOrSelectBranch(project, false);
        }
      } else {
        // If branch name was not specified (e.g., user left common name empty), requesting it per project
        featureBranchName = await this.createOrSelectBranch(project, false);
      }

      // Skipping project if branch name couldn't be obtained
      if (!featureBranchName) continue;

      // Updating branch if setting is enabled
      if (presets.updateFeatureBranch) {
        this.logger.info(`Updating feature branch ${featureBranchName} from ${project.baseBranch}...`);
        try {
          const projectGit: SimpleGit = simpleGit(project.path);
          await projectGit.pull(project.remoteName, project.baseBranch);
          this.logger.success(`Feature branch ${featureBranchName} updated from ${project.baseBranch} successfully`);
        } catch (error) {
          this.logger.error(`Failed to update branch: ${error instanceof Error ? error.message : 'Unknown error'}`);
          continue;
        }
      }

      // Selection and update of submodules
      const updatedSubmodules = await this.selectSubmodulesToUpdate(project);

      // Skipping if no submodules selected
      if (updatedSubmodules.length === 0) {
        this.logger.info(
          `No submodules selected or updated for ${project.name}. Skipping subsequent steps for this project.`,
        );
        continue; // Skip commit, push, PR for this project
      }

      // Preparing submodules for commit
      const projectGit: SimpleGit = simpleGit(project.path);
      await this.stageSubmodulesForCommit(projectGit, project, updatedSubmodules);

      // Committing changes if setting is enabled
      if (presets.commitChanges) {
        const commitMessage = this.generateCommitMessage(updatedSubmodules);
        this.logger.info(`Committing changes for ${project.name}...`);
        await this.commitSubmoduleChanges(project, commitMessage);
        this.logger.info(`New links of submodules for ${project.name} committed.`);
      }

      // Pushing changes if setting is enabled
      if (presets.pushToRemote) {
        this.logger.info(`Pushing ${featureBranchName} to remote ${project.remoteName}...`);
        await this.pushBranchToRemote(project, featureBranchName);
        this.logger.success(`Pushed ${featureBranchName} of ${project.name} to ${project.remoteName} remote`);
      }

      // Creating PR, if setting is enabled
      if (presets.createPR) {
        const prProvider = this.getPrProviderByName(presets.prProvider);
        if (prProvider) {
          this.logger.info(`Creating PR using ${presets.prProvider} for ${project.name}...`);
          const defaultTitle = `Update submodules for ${project.name}`;
          const taskId = await this.promptForTaskId(); // Assuming you might still want task ID per PR
          const prTitle = taskId ? `${taskId} ${defaultTitle}` : defaultTitle;

          await this.createPullRequest(project, featureBranchName, prProvider, prTitle);
          this.logger.success(`PR request created successfully for ${project.name}`);
        } else {
          // This case should be less likely now if a provider was selected upfront
          this.logger.warn(`PR provider ${presets.prProvider} not found. Skipping PR creation for ${project.name}.`);
        }
      }
    }
    this.logger.info('All selected projects processed.');
  }

  /**
   * Prompts the user for common settings (branch name, operations, PR provider)
   * to be applied to all selected projects.
   * @param selectedProjects - The list of projects selected by the user.
   * @returns A map where keys are project configs and values are the common operation presets.
   */
  private async getProjectsWithPresets(
    selectedProjects: TProjectConfig[],
  ): Promise<Map<TProjectConfig, SubmoduleOperationPresets>> {
    const projectsWithPresets = new Map<TProjectConfig, SubmoduleOperationPresets>();

    // 1. Request common branch name for all projects
    const { commonBranchName } = await prompts({
      type: 'text',
      name: 'commonBranchName',
      message:
        'Enter a common branch name for all selected projects (leave empty to name branches individually later):',
    });

    // 2. Request common operation presets for all projects
    const { presetChoices } = await prompts({
      type: 'multiselect',
      name: 'presetChoices',
      message: 'Select common operations for ALL selected projects:',
      choices: [
        { title: 'Update feature branch from base branch', value: 'updateFeatureBranch', selected: true },
        { title: 'Commit changes', value: 'commitChanges', selected: true },
        { title: 'Push to remote', value: 'pushToRemote', selected: true },
        { title: 'Create PR/MR request', value: 'createPR', selected: true },
      ],
      hint: '- Use space to select. Return to submit',
    });

    // Check if presetChoices is defined (user might cancel)
    if (!presetChoices) {
      this.logger.warn('Operation cancelled during preset selection.');
      // Return an empty map or handle cancellation appropriately
      return projectsWithPresets;
    }

    const createPRSelected = presetChoices.includes('createPR');
    let selectedPrProviderName = this.prProviders[0]?.provider || ''; // Default to first provider or empty string

    // 3. If PR is enabled and there are multiple providers, request provider ONCE
    if (createPRSelected && this.prProviders.length > 1) {
      const { provider } = await prompts({
        type: 'select',
        name: 'provider',
        message: 'Select PR/MR provider for ALL selected projects:',
        choices: this.prProviders.map((p) => ({
          title: p.provider,
          value: p.provider,
        })),
        initial: 0,
      });
      // Check if provider is defined (user might cancel)
      if (provider === undefined) {
        this.logger.warn('Operation cancelled during PR provider selection.');
        // Return an empty map or handle cancellation appropriately
        return projectsWithPresets;
      }
      selectedPrProviderName = provider;
    } else if (createPRSelected && this.prProviders.length === 1) {
      selectedPrProviderName = this.prProviders[0].provider; // Auto-select if only one provider
    } else if (createPRSelected && this.prProviders.length === 0) {
      this.logger.warn('Create PR selected, but no PR providers configured. PR creation will be skipped.');
      selectedPrProviderName = '' as any; // No provider available
    }

    // 4. Populate the map and branch name map with common settings
    const commonPresets: SubmoduleOperationPresets = {
      updateFeatureBranch: presetChoices.includes('updateFeatureBranch'),
      commitChanges: presetChoices.includes('commitChanges'),
      pushToRemote: presetChoices.includes('pushToRemote'),
      createPR: createPRSelected && !!selectedPrProviderName, // Only true if selected AND a provider is available/chosen
      prProvider: selectedPrProviderName,
    };

    for (const project of selectedProjects) {
      // Save common branch name (or empty string) for later use
      this.tempBranchNameMap.set(project.name, commonBranchName || '');
      // Apply common presets to this project
      projectsWithPresets.set(project, { ...commonPresets }); // Use spread to ensure a separate object if needed later
    }

    return projectsWithPresets;
  }

  /**
   * Displays a summary of the configuration for all selected projects based on common presets.
   * @param projects - The list of selected projects.
   * @param projectsWithPresets - The map containing projects and their assigned (common) presets.
   */
  private displayConfigurationSummary(
    projects: TProjectConfig[],
    projectsWithPresets: Map<TProjectConfig, SubmoduleOperationPresets>,
  ) {
    this.logger.info('════════════════════════════════════════════');
    this.logger.info('   CONFIGURATION SUMMARY (Applied to All)');
    this.logger.info('════════════════════════════════════════════');

    // Display common settings once
    const firstProject = projects[0]; // Get presets from the first project (they are all the same)
    const commonPresets = projectsWithPresets.get(firstProject);

    if (!commonPresets) {
      this.logger.warn('No configuration presets found to display.');
      this.logger.info('════════════════════════════════════════════\n');
      return;
    }

    const commonBranchName = this.tempBranchNameMap.get(firstProject.name);
    this.logger.info(`Common Branch Name: ${commonBranchName || 'Individual branches will be created/selected'}`);
    this.logger.info('Common Operations:');
    // Assuming baseBranch might differ per project, mention it generically or list projects below
    this.logger.info(`  ➤ Update feature branch from base branch: ${commonPresets.updateFeatureBranch ? '✅' : '❌'}`);
    this.logger.info(`  ➤ Commit changes: ${commonPresets.commitChanges ? '✅' : '❌'}`);
    this.logger.info(`  ➤ Push to remote: ${commonPresets.pushToRemote ? '✅' : '❌'}`);
    this.logger.info(`  ➤ Create PR/MR: ${commonPresets.createPR ? '✅' : '❌'}`);

    if (commonPresets.createPR) {
      this.logger.info(`  ➤ PR/MR Provider: ${commonPresets.prProvider}`);
    }

    this.logger.info('\nAffecting Projects:');
    for (const project of projects) {
      this.logger.info(`  📁 ${project.name} (Base: ${project.baseBranch}, Remote: ${project.remoteName})`);
    }

    this.logger.info('\n════════════════════════════════════════════');
    this.logger.info('   Starting Operations');
    this.logger.info('════════════════════════════════════════════\n');
  }
}
