import { Crew } from './crew/crew';

import { AbstractCrewMember } from './crew/members/abstract-crew-member';
import { TasksList } from './tasks/tasks-list';

interface ILogger {
  info: (message: string) => void;
}

export class GitFlowCaptain {
  constructor(
    private readonly taskList: TasksList,
    private readonly crew: Crew<AbstractCrewMember>,
    private readonly logger: ILogger,
  ) {
    this.logger.info('Welcome aboard!');
  }

  async startMission() {
    const choosedTask = await this.taskList.chooseTaskInteractive();

    await this.crew.executeAssigned(choosedTask);
  }
}
