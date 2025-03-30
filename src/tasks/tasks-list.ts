import prompts from 'prompts';
import { Task } from './task';
import { ILogger } from '../types';

export class TasksList {
  constructor(
    public readonly tasks: Task[],
    private readonly logger: ILogger,
  ) {
    //
  }

  async chooseTaskInteractive() {
    const onCancel = () => {
      console.log('Operation cancelled');
      process.exit(0);
    };

    const { taskName } = await prompts(
      {
        type: 'select',
        name: 'taskName',
        message: `${this.logger.prefix} Which task would you like to execute?`,
        choices: this.tasks.map((task) => ({ title: task.title, value: task.name })),
        validate: (value) => (value.length > 0 ? true : 'You must select a task'),
      },
      { onCancel },
    );

    const task = this.tasks.find((t) => t.name === taskName);
    if (!task) {
      throw new Error(`Task with name "${taskName}" not found`);
    }

    this.logger.info(`Executing task "${task.title}"`);

    return task;
  }

  async select(): Promise<Task> {
    const response = await prompts({
      type: 'select',
      name: 'task',
      message: 'Which task would you like to execute?',
      choices: this.tasks.map((task) => ({
        title: task.title,
        value: task,
      })),
    });

    const selectedTask = response.task as Task;

    this.logger.info(`Executing task "${selectedTask.title}"`);
    return selectedTask;
  }
}
