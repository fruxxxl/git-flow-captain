import { ICrewMembers } from './types';
import { AbstractCrewMember } from './members/abstract-crew-member';

export class CrewMembers<T extends AbstractCrewMember> implements ICrewMembers {
  constructor(public readonly crewMembers: T[]) {
    //
  }

  async executeAssigned(crewMemberClassName: string) {
    const existingCrewMemberInstance = this.crewMembers.find(
      (member) => member.constructor.name === crewMemberClassName,
    );

    if (!existingCrewMemberInstance) {
      throw new Error(`Assigned crew member ${crewMemberClassName} absent in the crewMembers`);
    }

    await existingCrewMemberInstance.execute();
  }
}
