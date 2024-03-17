/* eslint-disable prettier/prettier */

import 'source-map-support/register';
import dotenv from 'dotenv';

import { Logger } from './logger';
import { SubmodulesLinker } from './crew/members/submodules-linker';
import { GeneralConfigs } from './configs/general-configs';
import { ETaskName } from './tasks/types';
import { TasksList } from './tasks/tasks-list';
import { Task } from './tasks/task';
import { CrewMembersAssignment } from './crew/crew-members-assignment';
import { BranchFeaturer } from './crew/members/branch-featurer';
import { CrewMembers } from './crew/crew-members';
import { GitFlowCaptain } from './git-flow-captain';

dotenv.config();

const main = async () => {
  const config = GeneralConfigs.FromFile(
    './config.json',
    Logger.Prefixed(GeneralConfigs.name),
  ).parsedAndValidated();

  new GitFlowCaptain(
    new TasksList([
      new Task(ETaskName.LINK_SUBMODULES, 'Interactive link merged submodules'),
      new Task(ETaskName.PREPARE_BRANCHES_FOR_FEATURE, 'Prepare branches for feature'),
      // TODO: Add other tasks here
    ], Logger.Prefixed(TasksList.name)),
    new CrewMembersAssignment({
      [ETaskName.LINK_SUBMODULES]: SubmodulesLinker.name,
      [ETaskName.PREPARE_BRANCHES_FOR_FEATURE]: BranchFeaturer.name,
      // TODO: Add other assignments here
    }),
    new CrewMembers([
        new SubmodulesLinker(
          config.projects,
          config.prProviders,
          Logger.Prefixed(SubmodulesLinker.name),
        ),
        new BranchFeaturer(
          config.projects,
          config.prProviders,
          Logger.Prefixed(BranchFeaturer.name),
        ),
        // TODO: Add other executors here
      ],
    ),
    Logger.Prefixed(GitFlowCaptain.name),
  ).startMission();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
