import { IContext } from '@crew/context';
import { ICrewMember } from '../types';

export abstract class AbstractCrewMember implements ICrewMember {
  public abstract execute(context: IContext): Promise<void>;
}
