/**
 * Octokit Client for GitHub API
 *
 * Provides a unified interface for GitHub REST and GraphQL APIs.
 * Replaces gh CLI dependency for better portability and reliability.
 *
 * @module github/octokit-client
 */

import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';

// ============================================================================
// Type Definitions
// ============================================================================

export interface GitHubClientConfig {
  token?: string;
  owner: string;
  repo: string;
}

export interface ProjectV2 {
  id: string;
  number: number;
  title: string;
  url: string;
  closed: boolean;
  fields: {
    nodes: ProjectField[];
  };
}

export interface ProjectField {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{ id: string; name: string }>;
}

export interface ProjectItem {
  id: string;
  type: string;
  fieldValues: {
    nodes: Array<{
      field: { name: string };
      name?: string;
      text?: string;
    }>;
  };
  content?: {
    __typename: string;
    number: number;
    title: string;
    state: string;
    assignees?: { nodes: Array<{ login: string }> };
  };
}

export interface IssueData {
  number: number;
  title: string;
  body: string;
  state: string;
  labels: string[];
  assignees: string[];
  url: string;
}

export interface CreateProjectResult {
  id: string;
  number: number;
  url: string;
}

export interface CreateIssueResult {
  number: number;
  url: string;
  id: number;
}

// ============================================================================
// Octokit Client Class
// ============================================================================

export class OctokitClient {
  private octokit: Octokit;
  private graphqlWithAuth: typeof graphql;
  private owner: string;
  private repo: string;

  constructor(config: GitHubClientConfig) {
    const token = config.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

    if (!token) {
      throw new Error(
        'GitHub token required. Set GITHUB_TOKEN or GH_TOKEN environment variable, ' +
        'or pass token in config.'
      );
    }

    this.owner = config.owner;
    this.repo = config.repo;

    this.octokit = new Octokit({ auth: token });
    this.graphqlWithAuth = graphql.defaults({
      headers: { authorization: `token ${token}` },
    });
  }

  // ==========================================================================
  // Project Management (GraphQL - Projects v2)
  // ==========================================================================

  /**
   * Creates a new GitHub Project v2
   */
  async createProject(title: string, ownerId?: string): Promise<CreateProjectResult> {
    // First get the owner ID if not provided
    const ownerNodeId = ownerId || await this.getOwnerNodeId();

    const mutation = `
      mutation($ownerId: ID!, $title: String!) {
        createProjectV2(input: { ownerId: $ownerId, title: $title }) {
          projectV2 {
            id
            number
            url
          }
        }
      }
    `;

    const result: any = await this.graphqlWithAuth(mutation, {
      ownerId: ownerNodeId,
      title,
    });

    return {
      id: result.createProjectV2.projectV2.id,
      number: result.createProjectV2.projectV2.number,
      url: result.createProjectV2.projectV2.url,
    };
  }

  /**
   * Links a project to a repository
   * This makes the project show up in the repo's Projects tab
   */
  async linkProjectToRepo(projectId: string, repoId?: string): Promise<void> {
    const repositoryId = repoId || await this.getRepoNodeId();

    const mutation = `
      mutation($projectId: ID!, $repositoryId: ID!) {
        linkProjectV2ToRepository(input: { projectId: $projectId, repositoryId: $repositoryId }) {
          repository {
            id
          }
        }
      }
    `;

    await this.graphqlWithAuth(mutation, {
      projectId,
      repositoryId,
    });
  }

  /**
   * Gets the node ID for the repository
   */
  async getRepoNodeId(): Promise<string> {
    const query = `
      query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          id
        }
      }
    `;

    const result: any = await this.graphqlWithAuth(query, {
      owner: this.owner,
      name: this.repo,
    });

    if (!result.repository?.id) {
      throw new Error(`Repository ${this.owner}/${this.repo} not found`);
    }

    return result.repository.id;
  }

  /**
   * Gets a project by number
   */
  async getProject(projectNumber: number): Promise<ProjectV2 | null> {
    const query = `
      query($owner: String!, $number: Int!) {
        user(login: $owner) {
          projectV2(number: $number) {
            id
            number
            title
            url
            closed
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const result: any = await this.graphqlWithAuth(query, {
        owner: this.owner,
        number: projectNumber,
      });

      return result.user?.projectV2 || null;
    } catch (error: any) {
      // Try organization if user fails
      if (error.message?.includes('Could not resolve')) {
        return this.getOrgProject(projectNumber);
      }
      throw error;
    }
  }

  /**
   * Gets an organization project by number
   */
  private async getOrgProject(projectNumber: number): Promise<ProjectV2 | null> {
    const query = `
      query($owner: String!, $number: Int!) {
        organization(login: $owner) {
          projectV2(number: $number) {
            id
            number
            title
            url
            closed
            fields(first: 20) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result: any = await this.graphqlWithAuth(query, {
      owner: this.owner,
      number: projectNumber,
    });

    return result.organization?.projectV2 || null;
  }

  /**
   * Lists all projects for the owner
   */
  async listProjects(first: number = 20): Promise<ProjectV2[]> {
    const query = `
      query($owner: String!, $first: Int!) {
        user(login: $owner) {
          projectsV2(first: $first) {
            nodes {
              id
              number
              title
              url
              closed
            }
          }
        }
      }
    `;

    try {
      const result: any = await this.graphqlWithAuth(query, {
        owner: this.owner,
        first,
      });

      return result.user?.projectsV2?.nodes || [];
    } catch {
      // Try organization
      return this.listOrgProjects(first);
    }
  }

  private async listOrgProjects(first: number): Promise<ProjectV2[]> {
    const query = `
      query($owner: String!, $first: Int!) {
        organization(login: $owner) {
          projectsV2(first: $first) {
            nodes {
              id
              number
              title
              url
              closed
            }
          }
        }
      }
    `;

    const result: any = await this.graphqlWithAuth(query, {
      owner: this.owner,
      first,
    });

    return result.organization?.projectsV2?.nodes || [];
  }

  /**
   * Adds a single-select field to a project (like Status)
   */
  async addSingleSelectField(
    projectId: string,
    fieldName: string,
    options: string[]
  ): Promise<{ fieldId: string }> {
    const mutation = `
      mutation($projectId: ID!, $name: String!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {
        createProjectV2Field(input: {
          projectId: $projectId,
          dataType: SINGLE_SELECT,
          name: $name,
          singleSelectOptions: $options
        }) {
          projectV2Field {
            ... on ProjectV2SingleSelectField {
              id
            }
          }
        }
      }
    `;

    const result: any = await this.graphqlWithAuth(mutation, {
      projectId,
      name: fieldName,
      options: options.map(name => ({ name, color: 'GRAY' })),
    });

    return { fieldId: result.createProjectV2Field.projectV2Field.id };
  }

  /**
   * Adds an issue to a project
   */
  async addIssueToProject(projectId: string, issueId: string): Promise<{ itemId: string }> {
    const mutation = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item {
            id
          }
        }
      }
    `;

    const result: any = await this.graphqlWithAuth(mutation, {
      projectId,
      contentId: issueId,
    });

    return { itemId: result.addProjectV2ItemById.item.id };
  }

  /**
   * Updates a project item's field value
   */
  async updateProjectItemField(
    projectId: string,
    itemId: string,
    fieldId: string,
    optionId: string
  ): Promise<void> {
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: { singleSelectOptionId: $optionId }
        }) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await this.graphqlWithAuth(mutation, {
      projectId,
      itemId,
      fieldId,
      optionId,
    });
  }

  /**
   * Lists items in a project
   */
  async listProjectItems(projectId: string, first: number = 100): Promise<ProjectItem[]> {
    const query = `
      query($projectId: ID!, $first: Int!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: $first) {
              nodes {
                id
                type
                fieldValues(first: 10) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      field { ... on ProjectV2SingleSelectField { name } }
                      name
                    }
                    ... on ProjectV2ItemFieldTextValue {
                      field { ... on ProjectV2Field { name } }
                      text
                    }
                  }
                }
                content {
                  __typename
                  ... on Issue {
                    number
                    title
                    state
                    assignees(first: 10) {
                      nodes { login }
                    }
                  }
                  ... on PullRequest {
                    number
                    title
                    state
                    assignees(first: 10) {
                      nodes { login }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result: any = await this.graphqlWithAuth(query, {
      projectId,
      first,
    });

    return result.node?.items?.nodes || [];
  }

  // ==========================================================================
  // Issue Management (REST API)
  // ==========================================================================

  /**
   * Creates a new issue
   */
  async createIssue(
    title: string,
    body: string,
    labels?: string[],
    assignees?: string[]
  ): Promise<CreateIssueResult> {
    const response = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      labels,
      assignees,
    });

    return {
      number: response.data.number,
      url: response.data.html_url,
      id: response.data.id,
    };
  }

  /**
   * Gets an issue by number
   */
  async getIssue(issueNumber: number): Promise<IssueData | null> {
    try {
      const response = await this.octokit.issues.get({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
      });

      return {
        number: response.data.number,
        title: response.data.title,
        body: response.data.body || '',
        state: response.data.state,
        labels: response.data.labels.map((l: any) =>
          typeof l === 'string' ? l : l.name || ''
        ),
        assignees: response.data.assignees?.map((a: any) => a.login) || [],
        url: response.data.html_url,
      };
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Updates an issue
   */
  async updateIssue(
    issueNumber: number,
    updates: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      labels?: string[];
      assignees?: string[];
    }
  ): Promise<void> {
    await this.octokit.issues.update({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      ...updates,
    });
  }

  /**
   * Adds labels to an issue
   */
  async addLabels(issueNumber: number, labels: string[]): Promise<void> {
    await this.octokit.issues.addLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      labels,
    });
  }

  /**
   * Removes a label from an issue
   */
  async removeLabel(issueNumber: number, label: string): Promise<void> {
    try {
      await this.octokit.issues.removeLabel({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        name: label,
      });
    } catch (error: any) {
      // Ignore if label doesn't exist
      if (error.status !== 404) {
        throw error;
      }
    }
  }

  /**
   * Adds assignees to an issue
   */
  async addAssignees(issueNumber: number, assignees: string[]): Promise<void> {
    await this.octokit.issues.addAssignees({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      assignees,
    });
  }

  /**
   * Removes assignees from an issue
   */
  async removeAssignees(issueNumber: number, assignees: string[]): Promise<void> {
    await this.octokit.issues.removeAssignees({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      assignees,
    });
  }

  /**
   * Creates a comment on an issue
   */
  async createComment(issueNumber: number, body: string): Promise<{ id: number }> {
    const response = await this.octokit.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      body,
    });

    return { id: response.data.id };
  }

  /**
   * Lists issues with optional filters
   */
  async listIssues(options?: {
    state?: 'open' | 'closed' | 'all';
    labels?: string;
    assignee?: string;
    per_page?: number;
  }): Promise<IssueData[]> {
    const response = await this.octokit.issues.listForRepo({
      owner: this.owner,
      repo: this.repo,
      state: options?.state || 'open',
      labels: options?.labels,
      assignee: options?.assignee,
      per_page: options?.per_page || 30,
    });

    return response.data
      .filter((item: any) => !item.pull_request) // Filter out PRs
      .map((issue: any) => ({
        number: issue.number,
        title: issue.title,
        body: issue.body || '',
        state: issue.state,
        labels: issue.labels.map((l: any) =>
          typeof l === 'string' ? l : l.name || ''
        ),
        assignees: issue.assignees?.map((a: any) => a.login) || [],
        url: issue.html_url,
      }));
  }

  /**
   * Closes an issue
   */
  async closeIssue(issueNumber: number): Promise<void> {
    await this.octokit.issues.update({
      owner: this.owner,
      repo: this.repo,
      issue_number: issueNumber,
      state: 'closed',
    });
  }

  // ==========================================================================
  // Pull Request Management (REST API)
  // ==========================================================================

  /**
   * Gets a pull request by number
   */
  async getPullRequest(prNumber: number): Promise<{
    number: number;
    title: string;
    body: string;
    state: string;
    merged: boolean;
    head: { ref: string };
    base: { ref: string };
  } | null> {
    try {
      const response = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      return {
        number: response.data.number,
        title: response.data.title,
        body: response.data.body || '',
        state: response.data.state,
        merged: response.data.merged,
        head: { ref: response.data.head.ref },
        base: { ref: response.data.base.ref },
      };
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Lists commits in a pull request
   */
  async listPRCommits(prNumber: number): Promise<Array<{ sha: string; message: string }>> {
    const response = await this.octokit.pulls.listCommits({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    return response.data.map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
    }));
  }

  // ==========================================================================
  // Label Management (REST API)
  // ==========================================================================

  /**
   * Creates a label if it doesn't exist
   */
  async ensureLabel(name: string, color: string = 'ededed', description?: string): Promise<void> {
    try {
      await this.octokit.issues.getLabel({
        owner: this.owner,
        repo: this.repo,
        name,
      });
    } catch (error: any) {
      if (error.status === 404) {
        await this.octokit.issues.createLabel({
          owner: this.owner,
          repo: this.repo,
          name,
          color,
          description,
        });
      } else {
        throw error;
      }
    }
  }

  // ==========================================================================
  // Repository Management (REST API)
  // ==========================================================================

  /**
   * Creates a new repository
   */
  async createRepository(options: {
    name: string;
    description?: string;
    private?: boolean;
    autoInit?: boolean;
  }): Promise<{ name: string; fullName: string; url: string; cloneUrl: string }> {
    const response = await this.octokit.repos.createForAuthenticatedUser({
      name: options.name,
      description: options.description,
      private: options.private ?? false,
      auto_init: options.autoInit ?? true,
    });

    // Update internal repo reference
    this.repo = response.data.name;

    return {
      name: response.data.name,
      fullName: response.data.full_name,
      url: response.data.html_url,
      cloneUrl: response.data.clone_url,
    };
  }

  /**
   * Deletes a repository (use with caution!)
   */
  async deleteRepository(owner?: string, repo?: string): Promise<void> {
    await this.octokit.repos.delete({
      owner: owner || this.owner,
      repo: repo || this.repo,
    });
  }

  /**
   * Gets repository info
   */
  async getRepository(): Promise<{
    name: string;
    fullName: string;
    description: string;
    url: string;
    defaultBranch: string;
    private: boolean;
  } | null> {
    try {
      const response = await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });

      return {
        name: response.data.name,
        fullName: response.data.full_name,
        description: response.data.description || '',
        url: response.data.html_url,
        defaultBranch: response.data.default_branch,
        private: response.data.private,
      };
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Checks if a repository exists
   */
  async repoExists(owner?: string, repo?: string): Promise<boolean> {
    try {
      await this.octokit.repos.get({
        owner: owner || this.owner,
        repo: repo || this.repo,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Updates the internal repo reference
   */
  setRepo(repo: string): void {
    this.repo = repo;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Gets the node ID for the owner (user or org)
   */
  private async getOwnerNodeId(): Promise<string> {
    // Try as user first
    try {
      const query = `query($login: String!) { user(login: $login) { id } }`;
      const result: any = await this.graphqlWithAuth(query, { login: this.owner });
      if (result.user?.id) {
        return result.user.id;
      }
    } catch {
      // Not a user, try org
    }

    // Try as organization
    const query = `query($login: String!) { organization(login: $login) { id } }`;
    const result: any = await this.graphqlWithAuth(query, { login: this.owner });
    if (result.organization?.id) {
      return result.organization.id;
    }

    throw new Error(`Could not find user or organization: ${this.owner}`);
  }

  /**
   * Gets the node ID for an issue
   */
  async getIssueNodeId(issueNumber: number): Promise<string> {
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
          }
        }
      }
    `;

    const result: any = await this.graphqlWithAuth(query, {
      owner: this.owner,
      repo: this.repo,
      number: issueNumber,
    });

    if (!result.repository?.issue?.id) {
      throw new Error(`Issue #${issueNumber} not found`);
    }

    return result.repository.issue.id;
  }

  /**
   * Gets owner and repo
   */
  getRepoInfo(): { owner: string; repo: string } {
    return { owner: this.owner, repo: this.repo };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createOctokitClient(config: GitHubClientConfig): OctokitClient {
  return new OctokitClient(config);
}

export default OctokitClient;
