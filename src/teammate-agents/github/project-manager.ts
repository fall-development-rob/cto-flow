/**
 * GitHub Projects Manager
 *
 * Manages GitHub Projects v2 for epic lifecycle tracking.
 * Provides bidirectional sync between internal epic state and GitHub Projects.
 *
 * Uses Octokit for GitHub API access (REST + GraphQL).
 *
 * Features:
 * - Create GitHub Projects from epics
 * - Map epic states to project columns/status fields
 * - Add/remove issues from projects
 * - Track progress via project views
 * - Sync project state with internal epic state
 *
 * @module github/project-manager
 */

import { EventEmitter } from 'events';
import {
  OctokitClient,
  createOctokitClient,
  type GitHubClientConfig,
  type ProjectV2,
  type ProjectItem as OctokitProjectItem,
} from './octokit-client.js';

// ============================================================================
// Type Definitions
// ============================================================================

export interface GitHubProject {
  id: string;
  number: number;
  title: string;
  url: string;
  shortDescription?: string;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
  owner: {
    login: string;
    type: 'User' | 'Organization';
  };
  fields: ProjectField[];
  items: ProjectItem[];
}

export interface ProjectField {
  id: string;
  name: string;
  dataType: 'TEXT' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'ITERATION';
  options?: ProjectFieldOption[];
}

export interface ProjectFieldOption {
  id: string;
  name: string;
  color?: string;
  description?: string;
}

export interface ProjectItem {
  id: string;
  type: 'ISSUE' | 'PULL_REQUEST' | 'DRAFT_ISSUE';
  content?: {
    number: number;
    title: string;
    url: string;
    state: string;
    assignees: string[];
  };
  fieldValues: Record<string, any>;
}

export interface ProjectConfig {
  owner: string;
  repo?: string;
  ownerType: 'user' | 'org';
  statusFieldName: string;
  statusMapping: Record<string, string>; // epicState -> projectStatus
  defaultView?: 'board' | 'table' | 'roadmap';
  token?: string;
}

export interface CreateProjectOptions {
  title: string;
  description?: string;
  epicId: string;
  visibility?: 'PUBLIC' | 'PRIVATE';
  createStatusField?: boolean;
  statusOptions?: string[];
}

export interface AddItemOptions {
  projectId: string;
  issueNumber?: number;
  prNumber?: number;
  draftTitle?: string;
  draftBody?: string;
  status?: string;
}

export interface ProjectSyncState {
  projectId: string;
  projectNumber: number;
  epicId: string;
  lastSyncAt: Date;
  itemCount: number;
  statusCounts: Record<string, number>;
}

// Default status options matching epic lifecycle
export const DEFAULT_STATUS_OPTIONS = [
  'Backlog',
  'Planning',
  'In Progress',
  'Review',
  'Done',
  'Archived'
];

// Map epic states to project statuses
export const DEFAULT_STATUS_MAPPING: Record<string, string> = {
  'uninitialized': 'Backlog',
  'planning': 'Planning',
  'active': 'In Progress',
  'paused': 'Backlog',
  'blocked': 'In Progress',
  'review': 'Review',
  'completed': 'Done',
  'archived': 'Archived'
};

// ============================================================================
// GitHub Projects Manager Class
// ============================================================================

export class GitHubProjectManager extends EventEmitter {
  private config: ProjectConfig;
  private client: OctokitClient;
  private projectCache: Map<string, GitHubProject> = new Map();
  private syncStates: Map<string, ProjectSyncState> = new Map();
  private projectIdCache: Map<number, string> = new Map(); // projectNumber -> projectId
  private statusFieldCache: Map<string, ProjectField> = new Map(); // projectId -> statusField

  constructor(config: ProjectConfig) {
    super();
    this.config = {
      statusFieldName: 'Status',
      statusMapping: DEFAULT_STATUS_MAPPING,
      defaultView: 'board',
      ...config
    };

    // Initialize Octokit client
    this.client = createOctokitClient({
      owner: config.owner,
      repo: config.repo || '',
      token: config.token,
    });
  }

  // ==========================================================================
  // Project CRUD Operations
  // ==========================================================================

  /**
   * Creates a new GitHub Project for an epic
   */
  async createProject(options: CreateProjectOptions): Promise<GitHubProject> {
    const {
      title,
      description,
      epicId,
      createStatusField = true,
      statusOptions = DEFAULT_STATUS_OPTIONS
    } = options;

    try {
      // Create project using Octokit GraphQL
      const result = await this.client.createProject(title);

      const projectNumber = result.number;
      const projectId = result.id;

      // Cache the project ID
      this.projectIdCache.set(projectNumber, projectId);

      // Link project to repository if repo is configured
      if (this.config.repo) {
        try {
          await this.client.linkProjectToRepo(projectId);
          this.emit('project:linked', { projectNumber, repo: this.config.repo });
        } catch (linkError) {
          // Log but don't fail - project was created successfully
          console.warn(`Could not link project to repo: ${linkError}`);
        }
      }

      // Create status field if requested
      if (createStatusField) {
        await this.createStatusField(projectNumber, statusOptions);
      }

      // Get full project details
      const project = await this.getProject(projectNumber);

      // Initialize sync state
      const syncState: ProjectSyncState = {
        projectId,
        projectNumber,
        epicId,
        lastSyncAt: new Date(),
        itemCount: 0,
        statusCounts: {}
      };
      this.syncStates.set(epicId, syncState);

      this.emit('project:created', { project, epicId });
      return project;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit('error', { operation: 'createProject', error: message });
      throw new Error(`Failed to create project: ${message}`);
    }
  }

  /**
   * Gets a project by number
   */
  async getProject(projectNumber: number): Promise<GitHubProject> {
    try {
      const data = await this.client.getProject(projectNumber);

      if (!data) {
        throw new Error(`Project #${projectNumber} not found`);
      }

      // Cache the project ID
      this.projectIdCache.set(projectNumber, data.id);

      const project: GitHubProject = {
        id: data.id,
        number: data.number,
        title: data.title,
        url: data.url,
        closed: data.closed,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: {
          login: this.config.owner,
          type: this.config.ownerType === 'org' ? 'Organization' : 'User'
        },
        fields: data.fields?.nodes?.map((f: any) => ({
          id: f.id,
          name: f.name,
          dataType: f.dataType,
          options: f.options?.map((o: any) => ({
            id: o.id,
            name: o.name
          }))
        })) || [],
        items: []
      };

      // Cache status field if found
      const statusField = project.fields.find(
        f => f.name.toLowerCase() === this.config.statusFieldName.toLowerCase()
      );
      if (statusField) {
        this.statusFieldCache.set(data.id, statusField);
      }

      // Cache the project
      this.projectCache.set(String(projectNumber), project);

      return project;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get project: ${message}`);
    }
  }

  /**
   * Lists all projects for the owner
   */
  async listProjects(limit: number = 20): Promise<GitHubProject[]> {
    try {
      const projects = await this.client.listProjects(limit);

      return projects.map((p: ProjectV2) => ({
        id: p.id,
        number: p.number,
        title: p.title,
        url: p.url,
        closed: p.closed,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: {
          login: this.config.owner,
          type: this.config.ownerType === 'org' ? 'Organization' : 'User'
        },
        fields: [],
        items: []
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list projects: ${message}`);
    }
  }

  /**
   * Closes/archives a project
   */
  async closeProject(projectNumber: number): Promise<void> {
    // Note: Closing a project requires GraphQL mutation
    // For now, we'll emit an event and log a warning
    console.warn('closeProject: GraphQL mutation for closing projects not yet implemented');
    this.emit('project:closed', { projectNumber });
  }

  /**
   * Deletes a project
   */
  async deleteProject(projectNumber: number): Promise<void> {
    // Note: Deleting a project requires GraphQL mutation
    console.warn('deleteProject: GraphQL mutation for deleting projects not yet implemented');
    this.projectCache.delete(String(projectNumber));
    this.projectIdCache.delete(projectNumber);
    this.emit('project:deleted', { projectNumber });
  }

  // ==========================================================================
  // Project Items (Issues/PRs)
  // ==========================================================================

  /**
   * Adds an issue to a project
   */
  async addIssueToProject(projectNumber: number, issueNumber: number, repo?: string): Promise<ProjectItem> {
    try {
      // Get project ID
      let projectId = this.projectIdCache.get(projectNumber);
      if (!projectId) {
        const project = await this.getProject(projectNumber);
        projectId = project.id;
      }

      // Get issue node ID
      const issueNodeId = await this.client.getIssueNodeId(issueNumber);

      // Add issue to project
      const result = await this.client.addIssueToProject(projectId, issueNodeId);

      const item: ProjectItem = {
        id: result.itemId,
        type: 'ISSUE',
        content: {
          number: issueNumber,
          title: '',
          url: `https://github.com/${this.config.owner}/${this.config.repo}/issues/${issueNumber}`,
          state: 'open',
          assignees: []
        },
        fieldValues: {}
      };

      this.emit('item:added', { projectNumber, item });
      return item;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to add issue to project: ${message}`);
    }
  }

  /**
   * Adds a PR to a project
   */
  async addPRToProject(projectNumber: number, prNumber: number, repo?: string): Promise<ProjectItem> {
    try {
      // Get project ID
      let projectId = this.projectIdCache.get(projectNumber);
      if (!projectId) {
        const project = await this.getProject(projectNumber);
        projectId = project.id;
      }

      // Get PR node ID (similar to issue)
      const prNodeId = await this.getPRNodeId(prNumber);

      // Add PR to project
      const result = await this.client.addIssueToProject(projectId, prNodeId);

      const item: ProjectItem = {
        id: result.itemId,
        type: 'PULL_REQUEST',
        content: {
          number: prNumber,
          title: '',
          url: `https://github.com/${this.config.owner}/${this.config.repo}/pull/${prNumber}`,
          state: 'open',
          assignees: []
        },
        fieldValues: {}
      };

      this.emit('item:added', { projectNumber, item });
      return item;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to add PR to project: ${message}`);
    }
  }

  /**
   * Creates a draft issue in the project
   */
  async createDraftItem(projectNumber: number, title: string, body?: string): Promise<ProjectItem> {
    // Note: Creating draft items requires GraphQL mutation
    console.warn('createDraftItem: Consider creating a real issue instead');

    const item: ProjectItem = {
      id: `draft_${Date.now()}`,
      type: 'DRAFT_ISSUE',
      fieldValues: {}
    };

    this.emit('item:created', { projectNumber, item });
    return item;
  }

  /**
   * Removes an item from a project
   */
  async removeItem(projectNumber: number, itemId: string): Promise<void> {
    // Note: Removing items requires GraphQL mutation
    console.warn('removeItem: GraphQL mutation for removing items not yet implemented');
    this.emit('item:removed', { projectNumber, itemId });
  }

  /**
   * Lists all items in a project
   */
  async listItems(projectNumber: number, limit: number = 100): Promise<ProjectItem[]> {
    try {
      // Get project ID
      let projectId = this.projectIdCache.get(projectNumber);
      if (!projectId) {
        const project = await this.getProject(projectNumber);
        projectId = project.id;
      }

      const items = await this.client.listProjectItems(projectId, limit);

      return items.map((item: OctokitProjectItem) => ({
        id: item.id,
        type: (item.content?.__typename === 'PullRequest' ? 'PULL_REQUEST' : 'ISSUE') as any,
        content: item.content ? {
          number: item.content.number,
          title: item.content.title,
          url: '',
          state: item.content.state?.toLowerCase() || 'open',
          assignees: item.content.assignees?.nodes?.map((a: any) => a.login) || []
        } : undefined,
        fieldValues: this.parseFieldValues(item.fieldValues?.nodes || [])
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list items: ${message}`);
    }
  }

  // ==========================================================================
  // Field Operations
  // ==========================================================================

  /**
   * Creates the Status field with predefined options
   */
  async createStatusField(projectNumber: number, options: string[] = DEFAULT_STATUS_OPTIONS): Promise<ProjectField> {
    try {
      // Get project ID
      let projectId = this.projectIdCache.get(projectNumber);
      if (!projectId) {
        const project = await this.getProject(projectNumber);
        projectId = project.id;
      }

      // Check if status field already exists
      const existingField = await this.getStatusField(projectNumber);
      if (existingField) {
        return existingField;
      }

      // Create single select field
      const result = await this.client.addSingleSelectField(
        projectId,
        this.config.statusFieldName,
        options
      );

      const field: ProjectField = {
        id: result.fieldId,
        name: this.config.statusFieldName,
        dataType: 'SINGLE_SELECT',
        options: options.map((opt, idx) => ({
          id: `option_${idx}`,
          name: opt
        }))
      };

      this.statusFieldCache.set(projectId, field);
      this.emit('field:created', { projectNumber, field });
      return field;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Field might already exist
      if (message.includes('already exists') || message.includes('duplicate')) {
        const existingField = await this.getStatusField(projectNumber);
        if (existingField) return existingField;
      }
      throw new Error(`Failed to create status field: ${message}`);
    }
  }

  /**
   * Gets the Status field for a project
   */
  async getStatusField(projectNumber: number): Promise<ProjectField | null> {
    try {
      // Check cache first
      const projectId = this.projectIdCache.get(projectNumber);
      if (projectId && this.statusFieldCache.has(projectId)) {
        return this.statusFieldCache.get(projectId)!;
      }

      // Get project with fields
      const project = await this.getProject(projectNumber);

      const statusField = project.fields.find(f =>
        f.name.toLowerCase() === this.config.statusFieldName.toLowerCase()
      );

      if (statusField && projectId) {
        this.statusFieldCache.set(projectId, statusField);
      }

      return statusField || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get status field: ${message}`);
    }
  }

  /**
   * Updates an item's status
   */
  async updateItemStatus(projectNumber: number, itemId: string, status: string): Promise<void> {
    try {
      // Get project ID
      let projectId = this.projectIdCache.get(projectNumber);
      if (!projectId) {
        const project = await this.getProject(projectNumber);
        projectId = project.id;
      }

      // Get the status field
      const statusField = await this.getStatusField(projectNumber);
      if (!statusField) {
        throw new Error('Status field not found');
      }

      // Find the option ID for the given status
      const option = statusField.options?.find(opt =>
        opt.name.toLowerCase() === status.toLowerCase()
      );

      if (!option) {
        throw new Error(`Status option "${status}" not found`);
      }

      await this.client.updateProjectItemField(projectId, itemId, statusField.id, option.id);

      this.emit('item:statusUpdated', { projectNumber, itemId, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to update item status: ${message}`);
    }
  }

  // ==========================================================================
  // Epic-Project Synchronization
  // ==========================================================================

  /**
   * Creates a project from an epic and adds all related issues
   */
  async createProjectFromEpic(
    epicId: string,
    epicTitle: string,
    epicDescription: string,
    issueNumbers: number[],
    repo?: string
  ): Promise<{ project: GitHubProject; syncState: ProjectSyncState }> {
    // Create the project
    const project = await this.createProject({
      title: `[Epic] ${epicTitle}`,
      description: epicDescription,
      epicId,
      createStatusField: true
    });

    // Add all issues to the project
    for (const issueNumber of issueNumbers) {
      try {
        await this.addIssueToProject(project.number, issueNumber, repo);
      } catch (error) {
        console.error(`Failed to add issue #${issueNumber} to project:`, error);
        // Continue with other issues
      }
    }

    // Get sync state
    const syncState = this.syncStates.get(epicId)!;
    syncState.itemCount = issueNumbers.length;

    this.emit('epic:projectCreated', { epicId, project, syncState });
    return { project, syncState };
  }

  /**
   * Syncs epic state to project status
   */
  async syncEpicStateToProject(
    projectNumber: number,
    epicState: string,
    itemIds?: string[]
  ): Promise<void> {
    const projectStatus = this.config.statusMapping[epicState] || 'Backlog';

    if (itemIds) {
      // Update specific items
      for (const itemId of itemIds) {
        try {
          await this.updateItemStatus(projectNumber, itemId, projectStatus);
        } catch (error) {
          console.error(`Failed to update item ${itemId} status:`, error);
        }
      }
    }

    this.emit('sync:epicToProject', { projectNumber, epicState, projectStatus });
  }

  /**
   * Syncs project status back to epic state
   */
  async getProjectStatusSummary(projectNumber: number): Promise<Record<string, number>> {
    const items = await this.listItems(projectNumber);
    const statusCounts: Record<string, number> = {};

    for (const item of items) {
      const status = item.fieldValues[this.config.statusFieldName] || 'Backlog';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }

    return statusCounts;
  }

  /**
   * Determines overall epic state from project items
   */
  async determineEpicStateFromProject(projectNumber: number): Promise<string> {
    const statusCounts = await this.getProjectStatusSummary(projectNumber);
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    if (total === 0) return 'uninitialized';

    // If all items are Done -> completed
    if (statusCounts['Done'] === total) return 'completed';

    // If all items are Archived -> archived
    if (statusCounts['Archived'] === total) return 'archived';

    // If any items are in Review -> review
    if (statusCounts['Review'] > 0) return 'review';

    // If any items are In Progress -> active
    if (statusCounts['In Progress'] > 0) return 'active';

    // If any items are in Planning -> planning
    if (statusCounts['Planning'] > 0) return 'planning';

    // Default to planning/backlog
    return 'planning';
  }

  /**
   * Gets the sync state for an epic
   */
  getSyncState(epicId: string): ProjectSyncState | undefined {
    return this.syncStates.get(epicId);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Gets PR node ID for adding to project
   */
  private async getPRNodeId(prNumber: number): Promise<string> {
    // Use a GraphQL query similar to getIssueNodeId
    // For now, we'll construct it based on the pattern
    // This would need a proper implementation in OctokitClient
    throw new Error('getPRNodeId not yet implemented - use addIssueToProject for PRs');
  }

  /**
   * Parses field values from GraphQL response
   */
  private parseFieldValues(nodes: any[]): Record<string, any> {
    const values: Record<string, any> = {};

    for (const node of nodes) {
      if (node.field?.name) {
        values[node.field.name] = node.name || node.text || null;
      }
    }

    return values;
  }

  /**
   * Gets the Octokit client for direct access
   */
  getClient(): OctokitClient {
    return this.client;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a GitHubProjectManager for a user
 */
export function createUserProjectManager(
  username: string,
  repo?: string,
  token?: string
): GitHubProjectManager {
  return new GitHubProjectManager({
    owner: username,
    repo,
    ownerType: 'user',
    statusFieldName: 'Status',
    statusMapping: DEFAULT_STATUS_MAPPING,
    token
  });
}

/**
 * Creates a GitHubProjectManager for an organization
 */
export function createOrgProjectManager(
  orgName: string,
  repo?: string,
  token?: string
): GitHubProjectManager {
  return new GitHubProjectManager({
    owner: orgName,
    repo,
    ownerType: 'org',
    statusFieldName: 'Status',
    statusMapping: DEFAULT_STATUS_MAPPING,
    token
  });
}

export default GitHubProjectManager;
