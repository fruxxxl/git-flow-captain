import simpleGit, { SimpleGit } from 'simple-git';
import prompts from 'prompts';
import { TPrProvider, TProjectConfig, TSubmoduleConfig } from '../../configs/config-schema';
import { PullRequestProvider } from '../../types';
import { AzureDevOpsClient } from '../../pr-providers/azure-dev-ops/azure-dev-ops-client';
import * as fs from 'fs';
import { Logger } from '../../logger';
import { AbstractCrewMember } from './abstract-crew-member';

export class SubmodulesLinker extends AbstractCrewMember {
  constructor(
    private readonly projectConfigs: TProjectConfig[],
    private readonly prProviders: TPrProvider[],
    private readonly logger: Logger,
  ) {
    super();
  }

  public async execute() {
    const selectedProjects = await this.selectProjects(this.projectConfigs);

    this.logger.info(`Selected projects: ${selectedProjects.join(', ')}`);

    const selectedProjectsConfigs = this.projectConfigs.filter((project) => selectedProjects.includes(project.name));

    for (const projectConfig of selectedProjectsConfigs) {
      const projectGit: SimpleGit = simpleGit(projectConfig.path);
      const featureProjectBranch = await this.prepareProjectFeacherBranch(projectConfig);
      if (!featureProjectBranch) continue;

      const selectedSubmodules = await this.selectSubmodulesToUpdate(projectConfig);
      if (selectedSubmodules.length === 0) {
        continue;
      }

      const commitMessage = await this.stageSubmodulesForCommit(projectGit, projectConfig, selectedSubmodules);
      await this.commitAndPushChanges(projectGit, projectConfig, featureProjectBranch, commitMessage);
      await this.pushChanges(projectGit, projectConfig, featureProjectBranch);
      await this.createPullRequest(projectConfig, featureProjectBranch, commitMessage);
    }
  }

  private async selectProjects(projects: TProjectConfig[]) {
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

  private async prepareProjectFeacherBranch(project: TProjectConfig): Promise<string> {
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

    const featureProjectBranch = await this.createOrSelectBranch(projectGit, project);
    if (!featureProjectBranch) return '';

    await this.updateProjectFeatureBranch(projectGit, project, featureProjectBranch);

    return featureProjectBranch;
  }

  private async checkPathExists(path: string): Promise<boolean> {
    return fs.promises
      .access(path, fs.constants.F_OK)
      .then(() => true)
      .catch(() => false);
  }

  private async checkBranchExists(git: SimpleGit, branch: string): Promise<boolean> {
    const { all } = await git.branchLocal();
    return all.includes(branch);
  }

  private async askBranchSelectingVariant(project: TProjectConfig) {
    const { value } = await prompts({
      type: 'select',
      name: 'value',

      message: `${this.logger.prefix} Create a new feature branch or select an existing one?`,
      choices: [
        {
          title: `Create a new feature branch from ${project.baseBranch}`,
          value: 'createNewBranch',
        },
        { title: 'Select an existing branch', value: 'selectExistingBranch' },
        { title: 'Do not change the current branch', value: 'stayWithCurrent' },
      ],
    });

    return value as 'createNewBranch' | 'selectExistingBranch' | 'stayWithCurrent';
  }

  private async createOrSelectBranch(projectGit: SimpleGit, projectConfig: TProjectConfig) {
    const askResult = await this.askBranchSelectingVariant(projectConfig);

    const { all } = await projectGit.branchLocal();
    const branchChoices = all.map((branch) => ({
      title: branch,
      value: branch,
    }));

    let featureProjectBranch: string = '';
    switch (askResult) {
      case 'createNewBranch': {
        const { branchName } = await prompts({
          type: 'text',
          name: 'branchName',
          message: `${this.logger.prefix} Enter the name of the new feature branch:`,
          validate: (value) =>
            branchChoices.map((branch) => branch.value).find((branch) => branch === value)
              ? 'Branch already exists'
              : true,
        });

        featureProjectBranch = branchName;
        await projectGit.checkout(`${projectConfig.remote}/${projectConfig.baseBranch}`);
        await projectGit.checkoutLocalBranch(featureProjectBranch);
        this.logger.info(`Created a new branch ${featureProjectBranch} for updating submodules`);
        break;
      }
      case 'selectExistingBranch': {
        const { branchName } = await prompts({
          type: 'autocomplete',
          name: 'branchName',
          message: `${this.logger.prefix} Select an existing feature branch:`,
          choices: branchChoices,
        });
        featureProjectBranch = branchName;
        await projectGit.checkout(featureProjectBranch);
        this.logger.info(`Selected an existing feature branch ${featureProjectBranch} for updating submodules`);
        break;
      }
      case 'stayWithCurrent':
        featureProjectBranch = await projectGit.branch().then((branchSummary) => branchSummary.current);
        this.logger.info(`Working with the current project branch: ${featureProjectBranch}`);
        break;
      default:
        this.logger.warn('Invalid selection for new branch. Continue with next project');
        return null;
    }

    return featureProjectBranch;
  }

  private async updateProjectFeatureBranch(
    projectGit: SimpleGit,
    project: TProjectConfig,
    featureProjectBranch: string,
  ) {
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
        await projectGit.pull(project.remote, project.baseBranch);
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

  private async selectSubmodulesToUpdate(projectConfig: TProjectConfig) {
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

  private async stageSubmodulesForCommit(
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
      await submoduleGit.pull(submodule.remote, submodule.baseBranch);

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

  private async commitAndPushChanges(
    projectGit: SimpleGit,
    project: TProjectConfig,
    featureProjectBranch: string,
    commitMessage: string,
  ) {
    const { isNeedCommit } = await prompts({
      type: 'confirm',
      name: 'isNeedCommit',
      message: `${this.logger.prefix} Do you want to commit changes for ${project.name} (${project.repositoryId})?\nCommit message:\n${commitMessage}`,
      initial: true,
    });

    if (isNeedCommit) {
      await projectGit.commit(commitMessage);
      this.logger.info(`New links of submodules for ${project.name} (${project.repositoryId}) committed.`);
    }
  }

  private async pushChanges(projectGit: SimpleGit, project: TProjectConfig, featureProjectBranch: string) {
    const { isNeedPush } = await prompts({
      type: 'confirm',
      name: 'isNeedPush',
      message: `${this.logger.prefix} Do you want to push ${featureProjectBranch} of ${project.name} (${project.repositoryId}) to remote ${project.remote}?`,
      initial: false,
    });

    if (isNeedPush) {
      const pushSpinner = this.logger.makeAwaiting(
        `Pushing ${featureProjectBranch} of ${project.name} (${project.repositoryId}) to ${project.remote} remote...`,
      );
      await projectGit.push(project.remote, featureProjectBranch);
      this.logger.successAwaiting(
        `Pushed ${featureProjectBranch} of ${project.name} (${project.repositoryId}) to ${project.remote} remote`,
        pushSpinner,
      );
    }
  }

  private async createPullRequest(project: TProjectConfig, featureProjectBranch: string, description: string) {
    const { isNeedCreatePR } = await prompts([
      {
        type: 'confirm',
        name: 'isNeedCreatePR',
        message: `${this.logger.prefix} Do you want to create a PR request with linked submodules?`,
      },
    ]);

    if (!isNeedCreatePR) {
      this.logger.warn('PR request creation skipped');
      return;
    }

    const prOptionsResponse = await prompts([
      {
        type: 'select',
        name: 'prProvider',
        message: `${this.logger.prefix} Select PR provider:`,
        choices: [{ title: 'AzureDevOps', value: PullRequestProvider.AzureDevOps }],
      },
      {
        type: 'text',
        name: 'prTitle',
        message: `${this.logger.prefix} Enter the title for the PR (leave blank for default title):`,
        initial: `[${project.name}] Update submodules`,
      },
    ]);

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

        const azureDevOpsClient = new AzureDevOpsClient(prProvider.organization, prProvider.project);
        await azureDevOpsClient.createPullRequest({
          repositoryId: project.repositoryId,
          sourceBranch: featureProjectBranch,
          targetBranch: project.baseBranch,
          title: prOptionsResponse.prTitle,
          description,
        });

        this.logger.successAwaiting('PR request created successfully', createPRSpinner);

        break;
      }
      default:
        this.logger.error('Invalid PR provider');
        return;
    }
  }
}
