export interface ICrewMembers {
  executeAssigned: (crewMemberClassName: string) => Promise<void>;
}

export interface ICrewMember {
  execute: () => Promise<void>;
}
