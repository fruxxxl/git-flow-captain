import { Logger } from './logger';
import { CrewMembers } from './crew/crew-members';

import { CrewMembersAssignment } from './crew/crew-members-assignment';
import { AbstractCrewMember } from './crew/members/abstract-crew-member';
import { TasksList } from './tasks/tasks-list';

export class GitFlowCaptain {
  constructor(
    private readonly taskList: TasksList,
    private readonly crewMembersAssignment: CrewMembersAssignment,
    private readonly crewMembers: CrewMembers<AbstractCrewMember>,
    private readonly logger: Logger,
  ) {
    this.logger.info('Welcome aboard!');
  }

  async startMission() {
    const choosedTask = await this.taskList.chooseTaskInteractive();

    const crewMemberAssignedClassName = this.crewMembersAssignment.forTask(choosedTask);

    await this.crewMembers.executeAssigned(crewMemberAssignedClassName);
  }
}
