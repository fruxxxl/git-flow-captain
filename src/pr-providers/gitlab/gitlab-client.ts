import { Gitlab } from '@gitbeaker/rest';
import type { IPrProvider } from '../types';
import type { TProjectConfig } from '../../configs/config-schema';

export class GitlabClient implements IPrProvider {
  private api: InstanceType<typeof Gitlab>;

  constructor(private readonly host: string) {
    const token = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
    if (!token) {
      throw new Error('GITLAB_PERSONAL_ACCESS_TOKEN is not set');
    }
    this.api = new Gitlab({
      host: this.host,
      token,
    });
  }

  /**
   * Creates a GitLab Merge Request.
   * @implements IPrProvider['createPr']
   */
  public async createPr(
    project: TProjectConfig,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description: string = 'Update submodules',
  ): Promise<string | undefined> {
    try {
      const response = await this.api.MergeRequests.create(project.repositoryId, sourceBranch, targetBranch, title, {
        description,
        squash: true,
        removeSourceBranch: true,
      });

      return response?.web_url as string | undefined;
    } catch (error: any) {
      console.error(
        `GitlabClient Error creating Merge Request for project ${project.repositoryId}: ${error.message ?? error}`,
      );
      throw error;
    }
  }
}
