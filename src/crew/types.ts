import { Task } from '@tasks/task';
import { Context } from './context';

export interface ICrew {
  executeAssigned: (task: Task) => Promise<void>;
}

export interface ICrewMember {
  execute: (context: Context) => Promise<void>;
}
