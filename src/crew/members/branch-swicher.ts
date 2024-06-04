import simpleGit, { SimpleGit } from 'simple-git';
import prompts from 'prompts';
import { TProjectConfig } from '../../configs/config-schema';
import { ILogger } from '../../types';
import { AbstractCrewMember } from './abstract-crew-member';

interface IPreparedGitItem {
  parentName?: string;
  name: string;
  remoteName: string;
  baseBranch: string;
  isSubmodule: boolean;
  git: SimpleGit;
}

export class BranchSwitcher extends AbstractCrewMember {
  private branch: string = '';
  private isNeedUpdateProjectBranch: boolean = false;
  private isNeedUpdateSubmodules: boolean = false;
  private allChoosedGits: IPreparedGitItem[] = [];

  constructor(
    private readonly projectConfigs: TProjectConfig[],
    private readonly logger: ILogger,
  ) {
    super();
  }

  public async execute() {
    await this.askBranch();
    await this.askIsNeedUpdate();

    const selectedProjects = await this.selectProjects(this.projectConfigs);

    this.logger.info(`Selected projects: ${selectedProjects.join(', ')}`);

    const selectedProjectsConfigs = this.projectConfigs.filter((project) => selectedProjects.includes(project.name));

    const preparedProjectGits: IPreparedGitItem[] = [];
    const preparedSubmoduleGits: IPreparedGitItem[] = [];
    const preparedUniqSubmoduleGits: IPreparedGitItem[] = [];
    const uniqSubmodules = new Set<string>();

    for (const projectConfig of selectedProjectsConfigs) {
      const projectGit: SimpleGit = simpleGit(projectConfig.path);

      preparedProjectGits.push({
        name: projectConfig.name,
        remoteName: projectConfig.remoteName,
        baseBranch: projectConfig.baseBranch,
        isSubmodule: false,
        git: projectGit,
      });

      const selectedSubmodules = await this.selectSubmodulesToUpdate(projectConfig);

      for (const submodule of selectedSubmodules) {
        const submoduleGit: SimpleGit = simpleGit(`${projectConfig.path}/${submodule.name}`);
        preparedSubmoduleGits.push({
          name: `${projectConfig.name}/${submodule.name}`,
          remoteName: submodule.remoteName,
          baseBranch: submodule.baseBranch,
          isSubmodule: true,
          git: submoduleGit,
        });

        if (uniqSubmodules.has(submodule.name)) {
          continue;
        }

        uniqSubmodules.add(submodule.name);

        preparedUniqSubmoduleGits.push({
          parentName: projectConfig.name,
          name: submodule.name,
          remoteName: submodule.remoteName,
          baseBranch: submodule.baseBranch,
          isSubmodule: true,
          git: submoduleGit,
        });
      }
    }

    const allChoosedGits = [...preparedProjectGits, ...preparedSubmoduleGits];

    const isConfirmed = await this.confirmWillBeUpdated(allChoosedGits);
    if (!isConfirmed) {
      this.logger.info('Branch switch cancelled');
      return;
    }

    await this.fetchFromRemote();

    // first update uniq submodules from base branch
    const submodulesChanges: IPreparedGitItem[] = [];
    for (const gitedItem of preparedUniqSubmoduleGits) {
      await gitedItem.git.checkout(this.branch);
      if (this.isNeedUpdateSubmodules) {
        const spinner = this.logger.makeAwaiting(
          `Updating submodule ${gitedItem.parentName}/${gitedItem.name} from ${gitedItem.baseBranch}`,
        );
        try {
          await gitedItem.git.pull(gitedItem.remoteName, gitedItem.baseBranch);

          this.logger.successAwaiting(
            `Submodule ${gitedItem.parentName}/${gitedItem.name} updated from ${gitedItem.baseBranch} successfully`,
            spinner,
          );

          const status = await gitedItem.git.status();
          if (status.ahead > 0) {
            submodulesChanges.push(gitedItem);
          }
        } catch (error) {
          this.logger.failAwaiting(
            `Failed to update submodule ${gitedItem.parentName}/${gitedItem.name} from ${gitedItem.baseBranch}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            spinner,
          );
        }
      }
    }

    if (submodulesChanges.length) {
      this.logger.info(
        `Sumbodules ${submodulesChanges.map((item) => `${item.parentName}/${item.name}`).join(', ')} has changes!`,
      );

      const { isPushChanges } = await prompts({
        type: 'confirm',
        name: 'isPushChanges',
        message: `${this.logger.prefix} Do you want to push changes of merged submodules to remote?`,
        instructions: 'For pulling them in another project submodules (avoiding duplicate empty changes commits)',
        initial: true,
      });

      if (isPushChanges) {
        for (const gitSubmoduleItem of submodulesChanges) {
          const spinner = this.logger.makeAwaiting(
            `Pushing changes to ${gitSubmoduleItem.parentName}/${gitSubmoduleItem.name}`,
          );
          await gitSubmoduleItem.git.push(gitSubmoduleItem.remoteName, this.branch);
          this.logger.successAwaiting(
            `Pushed changes to ${gitSubmoduleItem.parentName}/${gitSubmoduleItem.name} successfully`,
            spinner,
          );
        }
        await this.fetchFromRemote();
      }
    }

    for (const gitedItem of preparedProjectGits) {
      await gitedItem.git.checkout(this.branch);
      if (this.isNeedUpdateProjectBranch) {
        const spinner = this.logger.makeAwaiting(
          `Updating ${gitedItem.name} branch ${this.branch} from ${gitedItem.baseBranch}`,
        );

        try {
          await gitedItem.git.pull(gitedItem.remoteName, gitedItem.baseBranch);
          this.logger.successAwaiting(
            `Project ${gitedItem.name} branch updated from ${gitedItem.baseBranch} successfully`,
            spinner,
          );
        } catch (error) {
          this.logger.failAwaiting(
            `Failed to update ${gitedItem.name} branch ${this.branch} from ${gitedItem.baseBranch}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            spinner,
          );

          continue;
        }
      }
    }

    for (const gitedItem of preparedSubmoduleGits) {
      const spinner = this.logger.makeAwaiting(`Checkout submodule ${gitedItem.name} to updated ${this.branch}`);

      try {
        await gitedItem.git.checkout(this.branch);
        await gitedItem.git.pull(gitedItem.remoteName, this.branch);
        this.logger.successAwaiting(`Submodule ${gitedItem.name} switched to ${this.branch} successfully`, spinner);
      } catch (error) {
        this.logger.failAwaiting(
          `Failed to checkout submodule ${gitedItem.name} to branch ${this.branch}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          spinner,
        );

        continue;
      }
    }
  }

  private async askBranch() {
    const { branch } = await prompts({
      type: 'text',
      name: 'branch',
      message: `${this.logger.prefix} Enter branch to switch`,
      validate: (value) => (value.length > 0 ? true : 'You must enter branch name'),
    });

    this.branch = branch;
  }

  private async askIsNeedUpdate() {
    const { isNeedUpdateProjectBranch } = await prompts({
      type: 'confirm',
      name: 'isNeedUpdateProjectBranch',
      message: `${this.logger.prefix} Do you want to update project branch?`,
    });

    const { isNeedUpdateSubmodules } = await prompts({
      type: 'confirm',
      name: 'isNeedUpdateSubmodules',
      message: `${this.logger.prefix} Do you want to update submodules?`,
    });

    this.isNeedUpdateProjectBranch = isNeedUpdateProjectBranch;
    this.isNeedUpdateSubmodules = isNeedUpdateSubmodules;
  }

  private async confirmWillBeUpdated(preparedGits: IPreparedGitItem[]) {
    const textSubmodules = preparedGits
      .filter((git) => git.isSubmodule)
      .map(
        (git) =>
          `${git.name}: switch to ${this.branch} ${this.isNeedUpdateSubmodules ? `(with update from ${git.baseBranch})` : ''}`,
      )
      .join('\n');

    const textProjects = preparedGits
      .filter((git) => !git.isSubmodule)
      .map(
        (git) =>
          `${git.name}: switch to ${this.branch} ${this.isNeedUpdateProjectBranch ? `(with update from ${git.baseBranch})` : ''}`,
      )
      .join('\n');

    const { isConfirmed } = await prompts({
      type: 'confirm',
      name: 'isConfirmed',
      message: `${this.logger.prefix} Confirm action?:
===SUBMODULES===
${textSubmodules}

====PROJECTS===
${textProjects}`,
      initial: true,
    });

    return isConfirmed;
  }

  async fetchFromRemote() {
    for (const gitedItem of this.allChoosedGits) {
      const spinner = this.logger.makeAwaiting(`Fetching ${gitedItem.name} from ${gitedItem.remoteName}`);
      try {
        await gitedItem.git.fetch(gitedItem.remoteName);
        this.logger.successAwaiting(`Fetched ${gitedItem.name} from ${gitedItem.remoteName} successfully`, spinner);
      } catch (error) {
        this.logger.failAwaiting(
          `Failed to fetch ${gitedItem.name} from ${gitedItem.remoteName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          spinner,
        );
      }
    }
  }

  private async selectProjects(projects: TProjectConfig[]) {
    const { selectedProjects } = await prompts({
      type: 'multiselect',
      name: 'selectedProjects',
      message: `${this.logger.prefix} Select projects to switch branch`,
      choices: projects.map((project) => ({
        title: `${project.name} (${project.repositoryId})`,
        value: project.name,
      })),
      validate: (value) => (value.length > 0 ? true : 'You must select at least one project'),
    });

    return selectedProjects;
  }

  private async selectSubmodulesToUpdate(projectConfig: TProjectConfig) {
    const submoduleChoices = projectConfig.submodules.map((submodule) => ({
      title: `${submodule.name} (${submodule.baseBranch})`,
      value: submodule.name,
    }));

    const response = await prompts({
      type: 'multiselect',
      name: 'submodules',
      message: `${this.logger.prefix} [${projectConfig.name}] Select submodules to switch to branch`,
      choices: submoduleChoices,
    });

    const selectedSubmodules = projectConfig.submodules.filter((submodule) =>
      response.submodules.includes(submodule.name),
    );

    return selectedSubmodules;
  }
}
