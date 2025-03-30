import prompts from 'prompts';
import simpleGit, { SimpleGit } from 'simple-git';
import { TPrProvider, TProjectConfig } from '../../configs/config-schema';
import { ILogger } from '../../types';
import { AbstractSubmodulesHandler } from './abstract-submodules-handler';

// Interface for preconfigured operations
interface SubmoduleOperationPresets {
  updateFeatureBranch: boolean;
  commitChanges: boolean;
  pushToRemote: boolean;
  createPR: boolean;
  prProvider: string;
}

export class PreconfiguredSubmodulesLinker extends AbstractSubmodulesHandler {
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
    this.logger.info(`Selected projects: ${selectedProjects.map((p) => p.name).join(', ')}`);

    // Getting presets for all projects
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
      if (!presets) continue;

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
          featureBranchName = await this.createOrSelectBranch(project, false);
        }
      } else {
        // If branch name was not specified, requesting it
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
        continue;
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
          this.logger.info(`Creating PR using ${presets.prProvider}...`);
          const defaultTitle = `Update submodules for ${project.name}`;
          const taskId = await this.promptForTaskId();
          const prTitle = taskId ? `${taskId} ${defaultTitle}` : defaultTitle;

          await this.createPullRequest(project, featureBranchName, prProvider, prTitle);
          this.logger.success('PR request created successfully');
        } else {
          this.logger.warn(`PR provider ${presets.prProvider} not found. Skipping PR creation.`);
        }
      }
    }
  }

  private async getProjectsWithPresets(
    selectedProjects: TProjectConfig[],
  ): Promise<Map<TProjectConfig, SubmoduleOperationPresets>> {
    const projectsWithPresets = new Map<TProjectConfig, SubmoduleOperationPresets>();

    // Requesting common branch name for all projects
    const { commonBranchName } = await prompts({
      type: 'text',
      name: 'commonBranchName',
      message: 'Enter a common branch name for all projects (leave empty for separate branch names):',
    });

    // Getting presets for each project
    for (const project of selectedProjects) {
      const { presetChoices } = await prompts({
        type: 'multiselect',
        name: 'presetChoices',
        message: `Configure operations for ${project.name}:`,
        choices: [
          { title: 'Update feature branch from develop', value: 'updateFeatureBranch', selected: true },
          { title: 'Commit changes', value: 'commitChanges', selected: true },
          { title: 'Push to remote', value: 'pushToRemote', selected: true },
          { title: 'Create PR request', value: 'createPR', selected: true },
        ],
      });

      const presets: SubmoduleOperationPresets = {
        updateFeatureBranch: presetChoices.includes('updateFeatureBranch'),
        commitChanges: presetChoices.includes('commitChanges'),
        pushToRemote: presetChoices.includes('pushToRemote'),
        createPR: presetChoices.includes('createPR'),
        prProvider: 'Gitlab',
      };

      // If PR is enabled and there are multiple providers, request provider
      if (presets.createPR && this.prProviders.length > 1) {
        const { provider } = await prompts({
          type: 'select',
          name: 'provider',
          message: 'Select PR provider:',
          choices: this.prProviders.map((provider) => ({
            title: provider.provider,
            value: provider.provider,
          })),
          initial: 0,
        });

        presets.prProvider = provider;
      }

      // Saving branch name
      this.tempBranchNameMap.set(project.name, commonBranchName || '');

      projectsWithPresets.set(project, presets);
    }

    return projectsWithPresets;
  }

  private displayConfigurationSummary(
    projects: TProjectConfig[],
    projectsWithPresets: Map<TProjectConfig, SubmoduleOperationPresets>,
  ) {
    this.logger.info('════════════════════════════════════════════');
    this.logger.info('   CONFIGURATION SUMMARY');
    this.logger.info('════════════════════════════════════════════');

    for (const project of projects) {
      const presets = projectsWithPresets.get(project);
      if (!presets) continue;

      this.logger.info(`\n📁 Project: ${project.name}`);
      this.logger.info(`   Branch: ${this.tempBranchNameMap.get(project.name) || 'New branch will be created'}`);
      this.logger.info('   Operations:');
      this.logger.info(`     ➤ Update branch from ${project.baseBranch}: ${presets.updateFeatureBranch ? '✅' : '❌'}`);
      this.logger.info(`     ➤ Commit changes: ${presets.commitChanges ? '✅' : '❌'}`);
      this.logger.info(`     ➤ Push to remote ${project.remoteName}: ${presets.pushToRemote ? '✅' : '❌'}`);
      this.logger.info(`     ➤ Create PR/MR: ${presets.createPR ? '✅' : '❌'}`);

      if (presets.createPR) {
        this.logger.info(`     ➤ PR/MR Provider: ${presets.prProvider}`);
      }
    }

    this.logger.info('\n════════════════════════════════════════════');
    this.logger.info('   Starting Operations');
    this.logger.info('════════════════════════════════════════════\n');
  }
}
