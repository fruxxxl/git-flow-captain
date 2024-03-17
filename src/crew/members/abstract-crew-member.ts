import { ICrewMember } from '../types';

export abstract class AbstractCrewMember implements ICrewMember {
  public abstract execute(): Promise<void>;
}
