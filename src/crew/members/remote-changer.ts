import simpleGit, { SimpleGit } from 'simple-git';
import prompts from 'prompts';
import { TProjectConfig, TSubmoduleConfig } from '../../configs/config-schema';

import { AbstractCrewMember } from './abstract-crew-member';
import { ILogger } from 'src/types';
import { IContext } from '@crew/context';

export class RemoteChanger extends AbstractCrewMember {
  constructor(
    private readonly projectConfigs: TProjectConfig[],
    private readonly logger: ILogger,
  ) {
    super();
  }

  public async execute(context: IContext) {
    const selectedProjects = await this.selectProjects(this.projectConfigs);

    const restProjectsConfigs = this.projectConfigs.filter((project) => !selectedProjects.includes(project.name));
    const selectedProjectsConfigs = this.projectConfigs.filter((project) => selectedProjects.includes(project.name));

    if (selectedProjectsConfigs.length === 0) {
      this.logger.info('No projects to update. Exiting.');
      return;
    }

    for (const projectConfig of selectedProjectsConfigs) {
      const projectGit: SimpleGit = simpleGit(projectConfig.path);
      const remotes = await projectGit.getRemotes(true);

      this.logger.info(`Current remotes for ${projectConfig.name}:`);
      remotes.forEach((remote) => this.logger.info(`- ${remote.name} -> ${remote.refs.fetch}`));

      const remoteName = await this.askForRemoteName(projectConfig);
      const newRemoteUrl = await this.askForNewRemoteUrl(projectConfig);

      projectConfig.remoteName = remoteName;
      projectConfig.remoteUrl = newRemoteUrl;

      for (const submodule of projectConfig.submodules) {
        const submoduleGit: SimpleGit = simpleGit(`${projectConfig.path}/${submodule.name}`);
        const remotes = await submoduleGit.getRemotes(true);

        this.logger.info(`Current remotes for ${projectConfig.name}/${submodule.name}:`);
        remotes.forEach((remote) => this.logger.info(`- ${remote.name} -> ${remote.refs.fetch}`));

        const submoduleRemoteName = await this.askForRemoteName(submodule, projectConfig.name);
        const submoduleNewRemoteUrl = await this.askForNewRemoteUrl(submodule, projectConfig.name);

        submodule.remoteName = submoduleRemoteName;
        submodule.remoteUrl = submoduleNewRemoteUrl;
      }
    }

    context.set('projectConfigs', [...restProjectsConfigs, ...selectedProjectsConfigs]);

    await this.changeRemoteUrl(selectedProjectsConfigs);
  }

  private async selectProjects(projects: TProjectConfig[]) {
    const { selectedProjects } = await prompts({
      type: 'multiselect',
      name: 'selectedProjects',
      message: `${this.logger.prefix} Select projects to change remote`,
      choices: projects.map((project) => ({
        title: `${project.name} (${project.repositoryId})`,
        value: project.name,
      })),
      validate: (value) => (value.length > 0 ? true : 'You must select at least one project'),
    });

    return selectedProjects;
  }

  private async askForRemoteName(config: TProjectConfig | TSubmoduleConfig, parentName?: string): Promise<string> {
    const name = `${parentName ? `${parentName}/` : ''}${config.name}`;

    const initial = config.remoteName || 'origin';

    const { remoteName } = await prompts({
      type: 'text',
      name: 'remoteName',
      message: `${this.logger.prefix} Enter the remoteName for [${name}] (default is ${initial}):`,
      initial,
      validate: (value) => (value ? true : `remoteName for [${name}] cannot be empty`),
    });

    return remoteName;
  }

  private async askForNewRemoteUrl(config: TProjectConfig | TSubmoduleConfig, parentName?: string): Promise<string> {
    const name = `${parentName ? `${parentName}/` : ''}${config.name}`;

    const { newRemoteUrl } = await prompts({
      type: 'text',
      name: 'newRemoteUrl',
      message: `${this.logger.prefix} Enter the new remoteURL for [${name}]:`,
      validate: (value) => (value ? true : `remoteURL for [${name}] cannot be empty`),
    });

    return newRemoteUrl;
  }

  private async changeRemoteUrl(selectedProjectsConfigs: TProjectConfig[]) {
    for (const projectConfig of selectedProjectsConfigs) {
      const projectGit: SimpleGit = simpleGit(projectConfig.path);
      await projectGit.remote(['set-url', projectConfig.remoteName, projectConfig.remoteUrl]);

      this.logger.info(
        `Remote for ${projectConfig.name} changed to ${projectConfig.remoteName}/${projectConfig.remoteUrl}`,
      );

      if (projectConfig.submodules) {
        for (const submodule of projectConfig.submodules) {
          const submoduleGit: SimpleGit = simpleGit(`${projectConfig.path}/${submodule.name}`);
          await submoduleGit.remote(['set-url', submodule.remoteName, submodule.remoteUrl]);
          this.logger.info(
            `Remote for ${projectConfig.name}/${submodule.name} changed to ${submodule.remoteName}/${submodule.remoteUrl}`,
          );
        }
      }
    }
  }
}
