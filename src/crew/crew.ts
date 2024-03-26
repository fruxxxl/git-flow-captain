
import { Task } from '@tasks/task';
import { AbstractCrewMember } from './members/abstract-crew-member';
import { ICrew } from './types';
import { CrewTaskAssignment } from './crew-task-assignment';


export class Crew<T extends AbstractCrewMember> implements ICrew {
  constructor(
    public readonly crewTaskAssignment: CrewTaskAssignment,
    public readonly crewMembers: T[],
  ) {
    //
  }

  async executeAssigned(task: Task) {
    const crewTaskAssignment = this.crewTaskAssignment.forTask(task);

    const existingCrewMemberInstances = this.crewMembers.filter((member) =>
      crewTaskAssignment.responsibles.includes(member.constructor.name),
    );

    if (!existingCrewMemberInstances.length) {
      throw new Error(`Assigned responsibles ${crewTaskAssignment.responsibles.join(', ')} absent in the crewMembers`);
    }

    for (const existingCrewMemberInstance of existingCrewMemberInstances) {
      await existingCrewMemberInstance.execute(crewTaskAssignment.context);
    }
  }
}
