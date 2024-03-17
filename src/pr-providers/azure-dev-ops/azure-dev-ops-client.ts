import axios from 'axios';
import { AzureCreatePullRequestResponse, ICreatePullRequestParams } from './types';

export class AzureDevOpsClient {
  private pat: string;
  private apiVersion: string = '7.1-preview.1';

  constructor(
    private readonly organization: string,
    private readonly project: string,
  ) {
    const pat = process.env.AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN;
    if (!pat) {
      throw new Error('AZURE_DEVOPS_PERSONAL_ACCESS_TOKEN is not set');
    }
    this.pat = pat;
  }

  get baseUrl() {
    return `https://dev.azure.com/${this.organization}/${this.project}`;
  }

  private createPanelLink(response: AzureCreatePullRequestResponse): string {
    return `${this.baseUrl}/_git/${response.repository.name}/pullrequest/${response.pullRequestId}`;
  }

  public async createPullRequest(params: ICreatePullRequestParams): Promise<AzureCreatePullRequestResponse> {
    const { repositoryId, sourceBranch, targetBranch, title, description, reviewers = [] } = params;

    const prRequestUrl = `${this.baseUrl}/_apis/git/repositories/${repositoryId}/pullrequests?api-version=${this.apiVersion}`;
    const prRequestBody = {
      sourceRefName: `refs/heads/${sourceBranch}`,
      targetRefName: `refs/heads/${targetBranch}`,
      title,
      description,
      reviewers,
    };

    try {
      const response = await axios.post<AzureCreatePullRequestResponse>(prRequestUrl, prRequestBody, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`:${this.pat}`).toString('base64')}`,
        },
      });

      console.log('PR created successfully:', this.createPanelLink(response.data));

      // Optionally, link tasks (work items) to the newly created PR here by making additional API calls
      // This step requires the PR ID from response.data and separate API calls to link work items

      return response.data; // Return the response data for further processing
    } catch (error) {
      console.error('Error creating PR:', error);
      throw error; // Rethrow the error for handling upstream
    }
  }
}
