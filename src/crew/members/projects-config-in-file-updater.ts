import { GeneralConfigs } from '@configs/general-configs';
import { AbstractCrewMember } from './abstract-crew-member';
import { ILogger } from 'src/types';
import { IContext } from '@crew/context';
import { TProjectConfig } from '@configs/config-schema';
import prompts from 'prompts';
import { copyFileSync, writeFileSync } from 'fs';

export class ProjectsConfigInFileUpdater extends AbstractCrewMember {
  constructor(
    private readonly configPath: string,
    private readonly logger: ILogger,
  ) {
    super();
  }

  public async execute(context: IContext): Promise<void> {
    const projectConfigs = context.get<TProjectConfig[]>('projectConfigs');

    await this.backupConfigFile(this.configPath);

    const { action } = await prompts({
      type: 'select',
      name: 'action',
      message: 'Would you like to save the updated configuration to a file or display it on screen?',
      choices: [
        { title: 'Save to file', value: 'save' },
        { title: 'Display on screen', value: 'display' },
      ],
    });

    if (action === 'save') {
      this.injectUpdatedProjectsConfigToGeneralConfigFile(projectConfigs);
    } else if (action === 'display') {
      this.logger.info('Displayed the updated "projects" configuration on screen. ');
      console.log(JSON.stringify({ projects: projectConfigs }, null, 2));
    }
  }

  private async backupConfigFile(filePath: string): Promise<void> {
    const backupFilePath = `${filePath}.backup_${new Date().toISOString()}.json`;
    try {
      copyFileSync(filePath, backupFilePath);
      this.logger.info(`Backup of the configuration file has been saved to ${backupFilePath}`);
    } catch (error) {
      this.logger.error(`Failed to create a backup of the configuration file: ${error}`);
    }
  }

  private injectUpdatedProjectsConfigToGeneralConfigFile(projectConfigs: TProjectConfig[]): void {
    try {
      const fullConfig = GeneralConfigs.FromFile(
        this.configPath,
        this.logger.extendPrefix(GeneralConfigs.name),
      ).parsedAndValidated();

      writeFileSync(this.configPath, JSON.stringify({ ...fullConfig, projects: projectConfigs }, null, 2));

      this.logger.info(`Projects configuration updated in ${this.configPath}`);
    } catch (error) {
      this.logger.error(`Failed to save configuration to ${this.configPath}: ${error}`);
    }
  }
}
