import { ICreateMergeRequestParams } from './types';
import { Gitlab } from '@gitbeaker/rest';

export class GitlabClient {
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

  public async createMergeRequest(params: ICreateMergeRequestParams) {
    const { sourceBranch, targetBranch, title, description, labels = [] } = params;

    try {
      const response = await this.api.MergeRequests.create(params.repositoryId, sourceBranch, targetBranch, title, {
        description,
        labels,
      });

      console.log('Merge Request created successfully:', response.web_url);

      return response;
    } catch (error: any) {
      console.error('Error creating Merge Request:', error.message);
      throw error; // Rethrow the error for handling upstream
    }
  }
}
