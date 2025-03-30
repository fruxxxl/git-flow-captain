/* eslint-disable prettier/prettier */

import 'source-map-support/register';
import 'module-alias/register'


import { config } from 'dotenv';

import { Logger } from './logger';
import { SubmodulesLinker } from './crew/members/submodules-linker';
import { GeneralConfigs } from './configs/general-configs';
import { ETaskName } from './tasks/types';
import { TasksList } from './tasks/tasks-list';
import { Task } from './tasks/task';

import { Crew as Crew } from './crew/crew';
import { GitFlowCaptain } from './git-flow-captain';
import { RemoteChanger } from './crew/members/remote-changer';
import { ProjectsConfigInFileUpdater } from './crew/members/projects-config-in-file-updater';
import { CrewTaskAssignment } from '@crew/crew-task-assignment';
import { Context } from '@crew/context';
import { BranchSwitcher } from '@crew/members/branch-swicher';
import { PreconfiguredSubmodulesLinker } from './crew/members/preconfigured-submodules-linker';

config();

const configPath = './config.json'

const main = async () => {
  const config = GeneralConfigs.FromFile(
    configPath,
    Logger.Prefixed(GeneralConfigs.name),
  ).parsedAndValidated();


  new GitFlowCaptain(
    new TasksList([
    new Task(ETaskName.LINK_SUBMODULES, 'Interactive link merged submodules'),
    new Task(ETaskName.PRECONFIGURED_LINK_SUBMODULES, 'Preconfigured link merged submodules'),
    new Task(ETaskName.CHANGE_REMOTE, 'Interactive change remote for feature'),
    new Task(ETaskName.BRANCH_SWITCHER, 'Interactive switch branches'),
  ], Logger.Prefixed(TasksList.name)),
    new Crew(
      new CrewTaskAssignment({
        [ETaskName.LINK_SUBMODULES]: {
          responsibles: [SubmodulesLinker.name],
          context: new Context(ETaskName.LINK_SUBMODULES, Logger.Prefixed(ETaskName.LINK_SUBMODULES)),
        },
        [ETaskName.PRECONFIGURED_LINK_SUBMODULES]: {
          responsibles: [PreconfiguredSubmodulesLinker.name],
          context: new Context(ETaskName.PRECONFIGURED_LINK_SUBMODULES, Logger.Prefixed(ETaskName.PRECONFIGURED_LINK_SUBMODULES)),
        },
        [ETaskName.CHANGE_REMOTE]: {
          responsibles: [RemoteChanger.name, ProjectsConfigInFileUpdater.name],
          context: new Context(ETaskName.CHANGE_REMOTE, Logger.Prefixed(ETaskName.CHANGE_REMOTE)),
        },
        [ETaskName.BRANCH_SWITCHER]: {
          responsibles: [BranchSwitcher.name],
          context: new Context(ETaskName.BRANCH_SWITCHER, Logger.Prefixed(ETaskName.BRANCH_SWITCHER)),
        },
      }),
      [
        new SubmodulesLinker(
          config.projects,
          config.prProviders,
          Logger.Prefixed(SubmodulesLinker.name),
        ),
        new PreconfiguredSubmodulesLinker(
          config.projects,
          config.prProviders,
          Logger.Prefixed(PreconfiguredSubmodulesLinker.name),
        ),
        new RemoteChanger(
          config.projects,
          Logger.Prefixed(RemoteChanger.name),
        ),
        new ProjectsConfigInFileUpdater(
          configPath,
          Logger.Prefixed(ProjectsConfigInFileUpdater.name),
        ),
        new BranchSwitcher(
          config.projects,
          Logger.Prefixed(BranchSwitcher.name),
        ),
      ],
    ),
    Logger.Prefixed(GitFlowCaptain.name),
  ).startMission();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
