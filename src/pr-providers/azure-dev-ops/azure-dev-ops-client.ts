import axios from 'axios';
import { AzureCreatePullRequestResponse } from './types';
import type { IPrProvider } from '../types';
import type { TProjectConfig } from '../../configs/config-schema';

export class AzureDevOpsClient implements IPrProvider {
  private pat: string;
  private apiVersion: string = '7.1-preview.1';

  constructor(
    private readonly organization: string,
    private readonly project: string,
    private readonly host: string,
  ) {
    const pat = process.env.AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN;
    if (!pat) {
      throw new Error('AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN is not set');
    }
    this.pat = pat;
  }

  get baseUrl() {
    return `${this.host}/${this.organization}/${this.project}`;
  }

  private createPanelLink(response: AzureCreatePullRequestResponse): string {
    return `${this.host}/${this.organization}/${this.project}/_git/${response.repository.name}/pullrequest/${response.pullRequestId}`;
  }

  public async createPr(
    projectConfig: TProjectConfig,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description: string = 'Update submodules',
  ): Promise<string | undefined> {
    const prRequestUrl = `${this.baseUrl}/_apis/git/repositories/${projectConfig.repositoryId}/pullrequests?api-version=${this.apiVersion}`;
    const prRequestBody = {
      sourceRefName: `refs/heads/${sourceBranch}`,
      targetRefName: `refs/heads/${targetBranch}`,
      title,
      description,
    };

    try {
      const response = await axios.post<AzureCreatePullRequestResponse>(prRequestUrl, prRequestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`:${this.pat}`).toString('base64')}`,
        },
      });

      return this.createPanelLink(response.data);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || error;
      console.error(
        `AzureDevOpsClient Error creating Pull Request for repository ${projectConfig.repositoryId}: ${errorMessage}`,
      );
      throw error;
    }
  }
}
