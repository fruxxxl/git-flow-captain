import simpleGit, { SimpleGit } from 'simple-git';
import prompts from 'prompts';
import { TPrProvider, TProjectConfig } from '../../configs/config-schema';
import { ILogger } from '../../types';

import { AbstractSubmodulesHandler } from './abstract-submodules-handler';

export class SubmodulesLinker extends AbstractSubmodulesHandler {
  constructor(
    protected readonly projectConfigs: TProjectConfig[],
    protected readonly prProviders: TPrProvider[],
    protected readonly logger: ILogger,
  ) {
    super(projectConfigs, prProviders, logger);
  }

  public async execute() {
    // Project selection
    const selectedProjects = await this.selectProjectsToUpdate();

    this.logger.info(`Selected projects: ${selectedProjects.map((p) => p.name).join(', ')}`);

    // Confirmation request
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: 'Do you want to continue with selected projects?',
      initial: true,
    });

    if (!confirm) {
      this.logger.info('Operation cancelled by user');
      return;
    }

    // Processing each project
    for (const project of selectedProjects) {
      // Preparing branch for the project
      const featureProjectBranch = await this.prepareProjectFeacherBranch(project);
      if (!featureProjectBranch) continue;

      // Getting Git for the project
      const projectGit: SimpleGit = simpleGit(project.path);

      // Updating branch if user wants
      const updateResult = await this.updateProjectFeatureBranch(projectGit, project, featureProjectBranch);
      if (!updateResult) continue;

      // Selection and update of submodules
      const selectedSubmodules = await this.selectSubmodulesToUpdate(project);
      if (selectedSubmodules.length === 0) {
        continue;
      }

      // Preparing changes for commit
      const commitMessage = await this.stageSubmodulesForCommit(projectGit, project, selectedSubmodules);

      // Committing and pushing changes
      await this.commitAndPushChanges(projectGit, project, featureProjectBranch, commitMessage);

      // Creating PR/MR
      await this.createPullRequestInteractive(project, featureProjectBranch, commitMessage);
    }
  }

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
}
