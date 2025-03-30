import simpleGit, { SimpleGit } from 'simple-git';
import prompts from 'prompts';
import { TPrProvider, TProjectConfig, TSubmoduleConfig } from '../../configs/config-schema';
import { ILogger, PullRequestProvider } from '../../types';
import { AbstractCrewMember } from './abstract-crew-member';
import { AzureDevOpsClient } from '../../pr-providers/azure-dev-ops/azure-dev-ops-client';
import { GitlabClient } from '../../pr-providers/gitlab/gitlab-client';
import * as fs from 'fs';

export abstract class AbstractSubmodulesHandler extends AbstractCrewMember {
  constructor(
    protected readonly projectConfigs: TProjectConfig[],
    protected readonly prProviders: TPrProvider[],
    protected readonly logger: ILogger,
  ) {
    super();
  }

  // Common methods for working with submodules

  protected async selectProjects(projects: TProjectConfig[]) {
    const { selectedProjects } = await prompts({
      type: 'multiselect',
      name: 'selectedProjects',
      message: `${this.logger.prefix} Select projects to update submodules`,
      choices: projects.map((project) => ({
        title: `${project.name} (${project.repositoryId})`,
        value: project.name,
      })),
      validate: (value) => (value.length > 0 ? true : 'You must select at least one project'),
    });

    return selectedProjects;
  }

  protected async selectProjectsToUpdate(): Promise<TProjectConfig[]> {
    const selectedProjectNames = await this.selectProjects(this.projectConfigs);
    return this.projectConfigs.filter((project) => selectedProjectNames.includes(project.name));
  }

  protected async checkPathExists(path: string): Promise<boolean> {
    return fs.promises
      .access(path, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  protected async checkBranchExists(git: SimpleGit, branch: string): Promise<boolean> {
    const { all } = await git.branchLocal();
    return all.includes(branch);
  }

  protected async createOrSelectBranch(project: TProjectConfig, askForExisting = true): Promise<string> {
    const projectGit: SimpleGit = simpleGit(project.path);

    if (askForExisting) {
      const { choice } = await prompts({
        type: 'select',
        name: 'choice',
        message: 'Create a new feature branch or select an existing one?',
        choices: [
          { title: 'Create a new feature branch from ' + project.baseBranch, value: 'create' },
          { title: 'Select an existing branch', value: 'select' },
          { title: 'Do not change the current branch', value: 'current' },
        ],
      });

      this.logger.info(`Choice: ${choice}`);

      if (choice === 'select') {
        const { all } = await projectGit.branchLocal();
        const { branchName } = await prompts({
          type: 'select',
          name: 'branchName',
          message: 'Select a branch:',
          choices: all.filter((b) => b !== project.baseBranch).map((b) => ({ title: b, value: b })),
        });

        await projectGit.checkout(branchName);
        this.logger.info(`Selected an existing feature branch ${branchName} for updating submodules`);
        return branchName;
      } else if (choice === 'current') {
        const branchSummary = await projectGit.branch();
        const currentBranch = branchSummary.current;
        this.logger.info(`Working with the current project branch: ${currentBranch}`);
        return currentBranch;
      }
    }

    // Getting list of existing branches for validation
    const { all } = await projectGit.branchLocal();
    const branchChoices = all.map((branch) => branch);

    let branchName = 'unknown';

    try {
      // Create a new branch
      const { branchName: newBranchName } = await prompts({
        type: 'text',
        name: 'branchName',
        message: 'Enter the name of the new feature branch:',
        validate: (value) => (branchChoices.includes(value) ? 'Branch already exists' : true),
      });

      branchName = newBranchName;

      await projectGit.checkout(`${project.remoteName}/${project.baseBranch}`);

      // Creating new branch
      await projectGit.checkoutLocalBranch(branchName);
      this.logger.info(`Created a new branch ${branchName} for updating submodules`);
      return branchName;
    } catch (error) {
      this.logger.error(
        `Failed to create branch ${branchName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Trying to return to base branch
      try {
        await projectGit.checkout(project.baseBranch);
      } catch (e) {
        // Ignoring possible error when returning to base branch
      }

      return '';
    }
  }

  protected async updateBranchFromBase(project: TProjectConfig, featureBranchName: string): Promise<boolean> {
    const projectGit: SimpleGit = simpleGit(project.path);

    try {
      // Checking if branch exists
      const { all } = await projectGit.branchLocal();

      if (!all.includes(featureBranchName)) {
        // Branch doesn't exist, creating it
        this.logger.info(`Branch ${featureBranchName} does not exist, creating it`);
        await projectGit.checkout(`${project.remoteName}/${project.baseBranch}`);
        await projectGit.checkoutLocalBranch(featureBranchName);
      } else {
        // Branch exists, switching to it
        await projectGit.checkout(featureBranchName);
      }

      await projectGit.pull(project.remoteName, project.baseBranch);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update branch from base: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  protected async selectSubmodulesToUpdate(projectConfig: TProjectConfig) {
    const submoduleChoices = projectConfig.submodules.map((submodule) => ({
      title: `${submodule.name} (${submodule.baseBranch})`,
      value: submodule.name,
    }));

    const response = await prompts({
      type: 'multiselect',
      name: 'submodules',
      message: `${this.logger.prefix} Select submodules to update`,
      choices: submoduleChoices,
      validate: (value) => (value.length > 0 ? true : 'You must select at least one submodule'),
    });

    const selectedSubmodules = projectConfig.submodules.filter((submodule) =>
      response.submodules.includes(submodule.name),
    );

    if (selectedSubmodules.length === 0) {
      this.logger.error(
        `No submodules selected for updating in project ${projectConfig.name} (${projectConfig.repositoryId})`,
      );
    }

    return selectedSubmodules;
  }

  protected async stageSubmodulesForCommit(
    projectGit: SimpleGit,
    project: TProjectConfig,
    selectedSubmodules: TSubmoduleConfig[],
  ) {
    let commitMessage = 'feat(submodules): update links \n';

    const spinnerStaging = this.logger.makeAwaiting(
      `Staging changed submodules ${selectedSubmodules.map((submodule) => submodule.name).join(', ')} for project ${project.name} (${project.repositoryId})...`,
    );

    let commitsNumber = 0;

    for (const submodule of selectedSubmodules) {
      const submoduleGit: SimpleGit = simpleGit(`${project.path}/${submodule.name}`);

      await submoduleGit.checkout(submodule.baseBranch);
      await submoduleGit.pull(submodule.remoteName, submodule.baseBranch);

      const previousCommit = (await projectGit.raw(['ls-tree', 'HEAD', submodule.name])).split(/\s+/)[2];
      const currentCommit = (await submoduleGit.revparse(['HEAD'])).trim();

      const commits = await submoduleGit.log({
        from: previousCommit,
        to: currentCommit,
      });

      if (commits.total === 0) {
        this.logger.warnAwaiting(`No new commits found in ${submodule.name}`, spinnerStaging);
        continue;
      }

      commitsNumber += commits.total;

      const commitTitles = commits.all.map((commit) => `- ${commit.message}`).join('\n');

      commitMessage += `\n${submodule.name}:\n${commitTitles}\n`;

      await projectGit.add(`${submodule.name}`);
    }

    if (commitsNumber === 0) {
      spinnerStaging.warn('Nothing to staging');
    } else {
      spinnerStaging.succeed(
        `Submodules ${selectedSubmodules.map((submodule) => submodule.name).join(', ')} staged for commit`,
      );
    }

    return commitMessage;
  }

  protected async pushBranchToRemote(project: TProjectConfig, branchName: string): Promise<void> {
    const projectGit: SimpleGit = simpleGit(project.path);
    await projectGit.push(project.remoteName, branchName);
  }

  protected async commitSubmoduleChanges(project: TProjectConfig, commitMessage: string): Promise<void> {
    const projectGit: SimpleGit = simpleGit(project.path);
    await projectGit.add('.');
    await projectGit.commit(commitMessage);
  }

  protected generateCommitMessage(updatedSubmodules: TSubmoduleConfig[]): string {
    const submodulesList = updatedSubmodules.map((submodule) => `- ${submodule.name}`).join('\n');
    return `feat(submodules): update links \n\n${submodulesList}`;
  }

  protected async createPullRequest(
    project: TProjectConfig,
    featureBranchName: string,
    prProvider: TPrProvider,
    title: string,
  ): Promise<void> {
    if (prProvider.provider === PullRequestProvider.AzureDevOps) {
      const azureDevOpsClient = new AzureDevOpsClient(prProvider.host, prProvider.project, prProvider.organization);
      await azureDevOpsClient.createPullRequest({
        repositoryId: project.repositoryId,
        sourceBranch: featureBranchName,
        targetBranch: project.baseBranch,
        title: title,
        description: 'Update submodules',
      });
    } else if (prProvider.provider === PullRequestProvider.Gitlab) {
      const gitlabClient = new GitlabClient(prProvider.host);
      await gitlabClient.createMergeRequest({
        sourceBranch: featureBranchName,
        targetBranch: project.baseBranch,
        title: title,
        description: 'Update submodules',
        repositoryId: project.repositoryId,
      });
    }
  }

  protected getPrProviderByName(providerName: string): TPrProvider | undefined {
    return this.prProviders.find((provider) => provider.provider === providerName);
  }

  protected async promptForTaskId(): Promise<string | undefined> {
    const { taskId } = await prompts({
      type: 'text',
      name: 'taskId',
      message: 'Enter task id in start of title or skip:',
    });

    return taskId;
  }

  // Method for branch preparation with more reliable behavior
  protected async prepareProjectFeacherBranch(project: TProjectConfig): Promise<string> {
    this.logger.info(`Configuring updating submodules for project ${project.name} (${project.repositoryId})`);

    const projectGit: SimpleGit = simpleGit(project.path);
    const pathExists = await this.checkPathExists(project.path);
    if (!pathExists) {
      this.logger.error(`Path ${project.path} does not exist.`);
      return '';
    }

    const branchExists = await this.checkBranchExists(projectGit, project.baseBranch);
    if (!branchExists) {
      this.logger.error(`Branch ${project.baseBranch} does not exist in repository ${project.repositoryId}.`);
      return '';
    }

    // Creating or selecting branch
    return await this.createOrSelectBranch(project, true);
  }

  // Method for updating branch with base branch
  protected async updateProjectFeatureBranch(
    projectGit: SimpleGit,
    project: TProjectConfig,
    featureProjectBranch: string,
  ): Promise<boolean> {
    const { isUpdateFeatureBranch } = await prompts({
      type: 'confirm',
      name: 'isUpdateFeatureBranch',
      message: `${this.logger.prefix} Do you want to update the feature branch ${featureProjectBranch} from ${project.baseBranch}?`,
    });

    if (isUpdateFeatureBranch) {
      const spinner = this.logger.makeAwaiting(
        `Updating the feature branch ${featureProjectBranch} from ${project.baseBranch}`,
      );

      try {
        await projectGit.checkout(featureProjectBranch);
        await projectGit.pull(project.remoteName, project.baseBranch);
        this.logger.successAwaiting(
          `Feature branch ${featureProjectBranch} updated from ${project.baseBranch} successfully`,
          spinner,
        );
      } catch (error) {
        this.logger.failAwaiting(
          `Failed to update feature branch ${featureProjectBranch} from ${project.baseBranch}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          spinner,
        );

        return false;
      }
    }
    return true;
  }

  // Method for committing and pushing changes
  protected async commitAndPushChanges(
    projectGit: SimpleGit,
    project: TProjectConfig,
    featureProjectBranch: string,
    commitMessage: string,
  ): Promise<boolean> {
    const { isCommitChanges } = await prompts({
      type: 'confirm',
      name: 'isCommitChanges',
      message: `${this.logger.prefix} Do you want to commit changes?`,
      initial: true,
    });

    if (!isCommitChanges) {
      return false;
    }

    const commitSpinner = this.logger.makeAwaiting(
      `Committing new links of submodules for ${project.name} (${project.repositoryId})`,
    );

    try {
      await projectGit.commit(commitMessage);
      this.logger.successAwaiting(
        `New links of submodules for ${project.name} (${project.repositoryId}) committed.`,
        commitSpinner,
      );

      const { isPushToRemote } = await prompts({
        type: 'confirm',
        name: 'isPushToRemote',
        message: `${this.logger.prefix} Do you want to push changes to remote?`,
        initial: true,
      });

      if (!isPushToRemote) {
        return false;
      }

      const pushSpinner = this.logger.makeAwaiting(
        `Pushing changes to remote ${project.remoteName} for ${project.name} (${project.repositoryId})`,
      );

      await projectGit.push(project.remoteName, featureProjectBranch);
      this.logger.successAwaiting(
        `Changes pushed to remote ${project.remoteName} for ${project.name} (${project.repositoryId})`,
        pushSpinner,
      );

      return true;
    } catch (error) {
      this.logger.failAwaiting(
        `Error on commit or push: ${error instanceof Error ? error.message : 'Unknown error'}`,
        commitSpinner,
      );
      return false;
    }
  }

  // Method for creating PR
  protected async createPullRequestInteractive(
    project: TProjectConfig,
    featureProjectBranch: string,
    description: string,
  ): Promise<void> {
    const { isCreatePr } = await prompts({
      type: 'confirm',
      name: 'isCreatePr',
      message: `${this.logger.prefix} Do you want to create PR request?`,
      initial: true,
    });

    if (!isCreatePr) {
      return;
    }

    const prProvidersChoices = this.prProviders.map(({ provider }) => ({
      title: provider,
      value: provider,
    }));

    const {
      prProvider: prProviderName,
      prTitle,
      taskId,
    } = await prompts([
      {
        type: 'select',
        name: 'prProvider',
        message: `${this.logger.prefix} Select PR provider`,
        choices: prProvidersChoices,
      },
      {
        type: 'text',
        name: 'prTitle',
        message: `${this.logger.prefix} Enter PR title`,
        initial: `Update submodules for ${project.name}`,
      },
      {
        type: 'text',
        name: 'taskId',
        message: `${this.logger.prefix} Enter task id in start of title or skip:`,
      },
    ]);

    const prOptionsResponse = {
      prProvider: prProviderName,
      prTitle,
    };

    switch (prOptionsResponse.prProvider) {
      case PullRequestProvider.AzureDevOps: {
        const prProvider = this.prProviders.find((prProvider) => prProvider.provider === prOptionsResponse.prProvider);
        if (!prProvider) {
          this.logger.error(
            `PR provider ${prOptionsResponse.prProvider} is not configured for project ${project.name} (${project.repositoryId}). See Readme for more information`,
          );
          return;
        }

        const createPRSpinner = this.logger.makeAwaiting(
          `Creating PR request using ${prOptionsResponse.prProvider}...`,
        );

        try {
          const azureDevOpsClient = new AzureDevOpsClient(prProvider.host, prProvider.project, prProvider.organization);
          await azureDevOpsClient.createPullRequest({
            repositoryId: project.repositoryId,
            sourceBranch: featureProjectBranch,
            targetBranch: project.baseBranch,
            title: `${taskId ? `${taskId} ` : ''}${prOptionsResponse.prTitle}`,
            description,
          });

          this.logger.successAwaiting('PR request created successfully', createPRSpinner);
        } catch (error) {
          this.logger.failAwaiting(
            `Error creating PR: ${error instanceof Error ? error.message : 'Unknown error'}`,
            createPRSpinner,
          );
        }
        break;
      }
      case PullRequestProvider.Gitlab: {
        const prProvider = this.prProviders.find((prProvider) => prProvider.provider === prOptionsResponse.prProvider);
        if (!prProvider) {
          this.logger.error(
            `PR provider ${prOptionsResponse.prProvider} is not configured for project ${project.name} (${project.repositoryId}). See Readme for more information`,
          );
          return;
        }

        const createPRSpinner = this.logger.makeAwaiting(
          `Creating PR request using ${prOptionsResponse.prProvider}...`,
        );

        try {
          const gitlabClient = new GitlabClient(prProvider.host);
          await gitlabClient.createMergeRequest({
            sourceBranch: featureProjectBranch,
            targetBranch: project.baseBranch,
            title: `${taskId ? `${taskId} ` : ''}${prOptionsResponse.prTitle}`,
            description,
            repositoryId: project.repositoryId,
          });

          this.logger.successAwaiting('PR request created successfully', createPRSpinner);
        } catch (error) {
          this.logger.failAwaiting(
            `Error creating PR: ${error instanceof Error ? error.message : 'Unknown error'}`,
            createPRSpinner,
          );
        }
        break;
      }
      default:
        this.logger.error('Invalid PR provider');
    }
  }
}
