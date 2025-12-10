/**
 * GitHub Projects MCP Tools
 *
 * MCP tools for GitHub Projects v2 integration with teammate-agents.
 * Enables project creation, task management, agent assignment, and progress tracking.
 */

import type { MCPTool } from '../utils/types.js';
import type { ILogger } from '../core/logger.js';
import type { ClaudeFlowToolContext } from './claude-flow-tools.js';

/**
 * Create all GitHub Projects MCP tools
 */
export function createGitHubProjectsTools(logger: ILogger): MCPTool[] {
  return [
    // Epic/Project management
    createEpicCreateTool(logger),
    createEpicListTool(logger),
    createEpicGetTool(logger),
    createEpicProgressTool(logger),

    // Task/Issue management
    createEpicTaskCreateTool(logger),
    createEpicTaskListTool(logger),
    createEpicTaskUpdateTool(logger),

    // Agent assignment
    createAgentAvailableIssuesTool(logger),
    createAgentAssignIssueTool(logger),
    createAgentUnassignIssueTool(logger),

    // PR integration
    createPRLinkTool(logger),
    createPRMergeTool(logger),

    // Sync management
    createProjectSyncStartTool(logger),
    createProjectSyncStopTool(logger),
    createProjectSyncStatusTool(logger),

    // Hive-Mind tools
    createHiveMindEpicLoadTool(logger),
    createHiveMindTaskCompleteTool(logger),
    createHiveMindTaskStatusUpdateTool(logger),
    createHiveMindDetectCompletedTool(logger),
    createHiveMindSyncCompletionTool(logger),
    createHiveMindRetrospectiveCompleteTool(logger),

    // Hive-Mind PR tools
    createHiveMindPRCreateTool(logger),
    createHiveMindPRListTool(logger),
    createHiveMindPRLinkTool(logger),
    createHiveMindPRStatusTool(logger),
    createHiveMindPRMergeTool(logger),
    createHiveMindPRStatsTool(logger),
    createHiveMindBranchCreateTool(logger),

    // Hive-Mind Task Status tools
    createHiveMindReadyTasksTool(logger),
    createHiveMindNextTaskTool(logger),
    createHiveMindTaskStatusSummaryTool(logger),
    createHiveMindRefreshStatusTool(logger),
  ];
}

/**
 * Create a new epic with GitHub Project
 */
function createEpicCreateTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/epic_create',
    description: 'Create a new epic with an associated GitHub Project for tracking tasks and progress',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the epic',
        },
        description: {
          type: 'string',
          description: 'Detailed description of the epic',
        },
        owner: {
          type: 'string',
          description: 'GitHub owner (user or org) for the project',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to apply to the epic issue',
        },
        milestone: {
          type: 'string',
          description: 'Milestone to associate with the epic',
        },
      },
      required: ['title', 'description'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Creating epic with GitHub Project', { title: input.title, sessionId: context?.sessionId });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available - ensure teammate-agents is configured');
      }

      const epicId = await teammateManager.createEpic(input.title, input.description);
      const epic = await teammateManager.getEpic(epicId);

      return {
        success: true,
        epicId,
        epic,
        projectUrl: epic?.url,
        projectNumber: epic?.metadata?.projectNumber,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * List all epics
 */
function createEpicListTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/epic_list',
    description: 'List all epics with their GitHub Project status',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['active', 'completed', 'all'],
          default: 'active',
          description: 'Filter epics by status',
        },
        limit: {
          type: 'number',
          default: 50,
          description: 'Maximum number of epics to return',
        },
      },
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Listing epics', { status: input.status, sessionId: context?.sessionId });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      const epics = await teammateManager.listEpics();

      let filtered = epics;
      if (input.status === 'active') {
        filtered = epics.filter((e: any) => e.status !== 'completed');
      } else if (input.status === 'completed') {
        filtered = epics.filter((e: any) => e.status === 'completed');
      }

      return {
        success: true,
        epics: filtered.slice(0, input.limit || 50),
        count: filtered.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Get epic details
 */
function createEpicGetTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/epic_get',
    description: 'Get detailed information about a specific epic and its GitHub Project',
    inputSchema: {
      type: 'object',
      properties: {
        epicId: {
          type: 'string',
          description: 'ID of the epic to retrieve',
        },
      },
      required: ['epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Getting epic', { epicId: input.epicId, sessionId: context?.sessionId });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      const epic = await teammateManager.getEpic(input.epicId);
      if (!epic) {
        throw new Error(`Epic not found: ${input.epicId}`);
      }

      return {
        success: true,
        epic,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Get epic progress from GitHub Project
 */
function createEpicProgressTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/epic_progress',
    description: 'Get progress statistics for an epic from its GitHub Project',
    inputSchema: {
      type: 'object',
      properties: {
        epicId: {
          type: 'string',
          description: 'ID of the epic to get progress for',
        },
      },
      required: ['epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Getting epic progress', { epicId: input.epicId, sessionId: context?.sessionId });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      const progress = await teammateManager.getEpicProgress(input.epicId);

      return {
        success: true,
        epicId: input.epicId,
        progress,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Create a task/issue for an epic
 */
function createEpicTaskCreateTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/task_create',
    description: 'Create a new task (GitHub Issue) linked to an epic\'s project',
    inputSchema: {
      type: 'object',
      properties: {
        epicId: {
          type: 'string',
          description: 'ID of the epic to add the task to',
        },
        title: {
          type: 'string',
          description: 'Title of the task/issue',
        },
        description: {
          type: 'string',
          description: 'Description of the task',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to apply to the issue',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'medium',
          description: 'Task priority',
        },
        assignee: {
          type: 'string',
          description: 'GitHub username to assign the issue to',
        },
      },
      required: ['epicId', 'title', 'description'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Creating epic task', {
        epicId: input.epicId,
        title: input.title,
        sessionId: context?.sessionId
      });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      const issueNumber = await teammateManager.createEpicTask(
        input.epicId,
        input.title,
        input.description,
        input.labels || []
      );

      return {
        success: true,
        epicId: input.epicId,
        issueNumber,
        title: input.title,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * List tasks for an epic
 */
function createEpicTaskListTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/task_list',
    description: 'List all tasks (issues) in an epic\'s GitHub Project',
    inputSchema: {
      type: 'object',
      properties: {
        epicId: {
          type: 'string',
          description: 'ID of the epic',
        },
        status: {
          type: 'string',
          enum: ['open', 'closed', 'all'],
          default: 'all',
          description: 'Filter tasks by status',
        },
      },
      required: ['epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Listing epic tasks', { epicId: input.epicId, sessionId: context?.sessionId });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      const bridge = teammateManager.getProjectBridge();
      if (!bridge) {
        throw new Error('GitHub Projects not configured');
      }

      // Get issues from the project
      const issues = await bridge.getProjectIssues(input.epicId);

      let filtered = issues;
      if (input.status === 'open') {
        filtered = issues.filter((i: any) => i.state === 'OPEN');
      } else if (input.status === 'closed') {
        filtered = issues.filter((i: any) => i.state === 'CLOSED');
      }

      return {
        success: true,
        epicId: input.epicId,
        tasks: filtered,
        count: filtered.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Update a task's status
 */
function createEpicTaskUpdateTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/task_update',
    description: 'Update a task\'s status in the GitHub Project',
    inputSchema: {
      type: 'object',
      properties: {
        epicId: {
          type: 'string',
          description: 'ID of the epic',
        },
        issueNumber: {
          type: 'number',
          description: 'Issue number to update',
        },
        status: {
          type: 'string',
          enum: ['Todo', 'In Progress', 'In Review', 'Done'],
          description: 'New status for the task',
        },
        priority: {
          type: 'string',
          enum: ['Low', 'Medium', 'High', 'Critical'],
          description: 'New priority for the task',
        },
      },
      required: ['epicId', 'issueNumber'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Updating epic task', {
        epicId: input.epicId,
        issueNumber: input.issueNumber,
        sessionId: context?.sessionId
      });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      const bridge = teammateManager.getProjectBridge();
      if (!bridge) {
        throw new Error('GitHub Projects not configured');
      }

      await bridge.updateIssueStatus(input.epicId, input.issueNumber, {
        status: input.status,
        priority: input.priority,
      });

      return {
        success: true,
        epicId: input.epicId,
        issueNumber: input.issueNumber,
        updates: { status: input.status, priority: input.priority },
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Get available issues for an agent to work on
 */
function createAgentAvailableIssuesTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/agent_available_issues',
    description: 'Get issues available for an agent to work on, scored by relevance',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'ID of the agent looking for work',
        },
        epicId: {
          type: 'string',
          description: 'Optional: limit to specific epic',
        },
        limit: {
          type: 'number',
          default: 10,
          description: 'Maximum number of issues to return',
        },
      },
      required: ['agentId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Getting available issues for agent', {
        agentId: input.agentId,
        sessionId: context?.sessionId
      });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      const issues = await teammateManager.getAvailableIssuesForAgent(
        input.agentId,
        input.epicId
      );

      return {
        success: true,
        agentId: input.agentId,
        issues: issues.slice(0, input.limit || 10),
        count: issues.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Assign an agent to an issue
 */
function createAgentAssignIssueTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/agent_assign_issue',
    description: 'Assign an agent to work on a specific issue',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'ID of the agent to assign',
        },
        issueNumber: {
          type: 'number',
          description: 'Issue number to assign to the agent',
        },
      },
      required: ['agentId', 'issueNumber'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Assigning agent to issue', {
        agentId: input.agentId,
        issueNumber: input.issueNumber,
        sessionId: context?.sessionId
      });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      await teammateManager.assignAgentToIssue(input.agentId, input.issueNumber);

      return {
        success: true,
        agentId: input.agentId,
        issueNumber: input.issueNumber,
        status: 'assigned',
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Unassign an agent from an issue
 */
function createAgentUnassignIssueTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/agent_unassign_issue',
    description: 'Remove an agent\'s assignment from an issue',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'ID of the agent to unassign',
        },
        issueNumber: {
          type: 'number',
          description: 'Issue number to unassign from',
        },
      },
      required: ['agentId', 'issueNumber'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Unassigning agent from issue', {
        agentId: input.agentId,
        issueNumber: input.issueNumber,
        sessionId: context?.sessionId
      });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      const bridge = teammateManager.getProjectBridge();
      if (!bridge) {
        throw new Error('GitHub Projects not configured');
      }

      await bridge.unassignAgent(input.agentId, input.issueNumber);

      return {
        success: true,
        agentId: input.agentId,
        issueNumber: input.issueNumber,
        status: 'unassigned',
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Link a PR to an issue
 */
function createPRLinkTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/pr_link',
    description: 'Link a pull request to an issue (adds "Closes #N" relationship)',
    inputSchema: {
      type: 'object',
      properties: {
        prNumber: {
          type: 'number',
          description: 'Pull request number',
        },
        issueNumber: {
          type: 'number',
          description: 'Issue number to link to',
        },
      },
      required: ['prNumber', 'issueNumber'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Linking PR to issue', {
        prNumber: input.prNumber,
        issueNumber: input.issueNumber,
        sessionId: context?.sessionId
      });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      await teammateManager.linkPRToIssue(input.prNumber, input.issueNumber);

      return {
        success: true,
        prNumber: input.prNumber,
        issueNumber: input.issueNumber,
        relationship: 'closes',
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Handle PR merge (auto-close linked issues)
 */
function createPRMergeTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/pr_merge_handle',
    description: 'Handle a merged PR by auto-closing linked issues and updating project status',
    inputSchema: {
      type: 'object',
      properties: {
        prNumber: {
          type: 'number',
          description: 'Pull request number that was merged',
        },
      },
      required: ['prNumber'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Handling PR merge', { prNumber: input.prNumber, sessionId: context?.sessionId });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      await teammateManager.handlePRMerge(input.prNumber);

      return {
        success: true,
        prNumber: input.prNumber,
        action: 'merged',
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Start project sync
 */
function createProjectSyncStartTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/sync_start',
    description: 'Start bidirectional sync between internal state and GitHub Project',
    inputSchema: {
      type: 'object',
      properties: {
        epicId: {
          type: 'string',
          description: 'ID of the epic to sync',
        },
        intervalMs: {
          type: 'number',
          default: 30000,
          description: 'Sync interval in milliseconds (default: 30 seconds)',
        },
      },
      required: ['epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Starting project sync', { epicId: input.epicId, sessionId: context?.sessionId });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      teammateManager.startProjectSync(input.epicId, input.intervalMs || 30000);

      return {
        success: true,
        epicId: input.epicId,
        intervalMs: input.intervalMs || 30000,
        status: 'syncing',
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Stop project sync
 */
function createProjectSyncStopTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/sync_stop',
    description: 'Stop bidirectional sync for an epic',
    inputSchema: {
      type: 'object',
      properties: {
        epicId: {
          type: 'string',
          description: 'ID of the epic to stop syncing',
        },
      },
      required: ['epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Stopping project sync', { epicId: input.epicId, sessionId: context?.sessionId });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      teammateManager.stopProjectSync(input.epicId);

      return {
        success: true,
        epicId: input.epicId,
        status: 'stopped',
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Get sync status
 */
function createProjectSyncStatusTool(logger: ILogger): MCPTool {
  return {
    name: 'github-projects/sync_status',
    description: 'Get the current sync status for all epics or a specific epic',
    inputSchema: {
      type: 'object',
      properties: {
        epicId: {
          type: 'string',
          description: 'Optional: ID of specific epic to check',
        },
      },
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Getting sync status', { epicId: input.epicId, sessionId: context?.sessionId });

      if (!context?.orchestrator) {
        throw new Error('Orchestrator not available');
      }

      const teammateManager = context.orchestrator.getTeammateManager?.();
      if (!teammateManager) {
        throw new Error('TeammateManager not available');
      }

      const bridge = teammateManager.getProjectBridge();
      if (!bridge) {
        return {
          success: true,
          configured: false,
          message: 'GitHub Projects not configured',
          timestamp: new Date().toISOString(),
        };
      }

      const syncStatus = bridge.getSyncStatus(input.epicId);

      return {
        success: true,
        configured: true,
        syncStatus,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

// ============================================================================
// Hive-Mind Tools
// ============================================================================

/**
 * Load an existing epic from GitHub
 */
function createHiveMindEpicLoadTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/epic_load',
    description: 'Load an existing epic from a GitHub repository. This allows Hive-Mind to pick up work on existing projects with SPARC-phased tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Optional: specific epic ID to load (searches by label if not provided)',
        },
      },
      required: ['owner', 'repo'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Loading epic from GitHub', { owner: input.owner, repo: input.repo, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      const orchestrator = createHiveMindOrchestrator({
        owner: input.owner,
        enableVectorSearch: true,
        enableLearning: true,
      });

      await orchestrator.initialize();

      const epic = await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);

      if (!epic) {
        return {
          success: false,
          error: 'Epic not found in repository',
          owner: input.owner,
          repo: input.repo,
          timestamp: new Date().toISOString(),
        };
      }

      // Store orchestrator in context for subsequent calls
      if (context) {
        (context as any).hiveMindOrchestrator = orchestrator;
      }

      return {
        success: true,
        epicId: epic.epicId,
        epicIssueNumber: epic.epicIssueNumber,
        epicIssueUrl: epic.epicIssueUrl,
        projectUrl: epic.projectUrl,
        projectNumber: epic.projectNumber,
        tasks: epic.tasks.map(t => ({
          taskId: t.taskId,
          issueNumber: t.issueNumber,
          title: t.title,
          phase: t.phase,
          assignedAgent: t.assignedAgent?.name,
          hasProjectItemId: !!t.projectItemId,
        })),
        taskCount: epic.tasks.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Complete a task in Hive-Mind
 */
function createHiveMindTaskCompleteTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/task_complete',
    description: 'Mark a task as complete. This closes the GitHub issue, updates project status to Done, and adds a completion comment.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID (from epic_load)',
        },
        taskId: {
          type: 'string',
          description: 'Task ID or issue number to complete',
        },
        success: {
          type: 'boolean',
          default: true,
          description: 'Whether the task was completed successfully',
        },
        completedBy: {
          type: 'string',
          description: 'Name of the agent or person who completed the task',
        },
        summary: {
          type: 'string',
          description: 'Summary of what was accomplished',
        },
        artifacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of files or artifacts created',
        },
        moveToReview: {
          type: 'boolean',
          default: false,
          description: 'Move to Review instead of Done (keeps issue open)',
        },
      },
      required: ['owner', 'repo', 'epicId', 'taskId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Completing task', { epicId: input.epicId, taskId: input.taskId, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      // Get or create orchestrator
      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
      }

      const result = await orchestrator.completeTask(input.epicId, input.taskId, {
        success: input.success !== false,
        completedBy: input.completedBy || 'Hive-Mind Agent',
        summary: input.summary,
        artifacts: input.artifacts,
        moveToReview: input.moveToReview,
      });

      return {
        success: true,
        taskId: result.taskId,
        issueNumber: result.issueNumber,
        status: result.status,
        completionTime: result.completionTime,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Update task status in Hive-Mind
 */
function createHiveMindTaskStatusUpdateTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/task_status_update',
    description: 'Update a task\'s status in the GitHub Project (move between columns)',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        taskId: {
          type: 'string',
          description: 'Task ID or issue number',
        },
        status: {
          type: 'string',
          enum: ['Todo', 'In Progress', 'Done'],
          description: 'New status for the task',
        },
      },
      required: ['owner', 'repo', 'epicId', 'taskId', 'status'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Updating task status', { epicId: input.epicId, taskId: input.taskId, status: input.status, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
      }

      await orchestrator.updateTaskStatus(input.epicId, input.taskId, input.status);

      return {
        success: true,
        epicId: input.epicId,
        taskId: input.taskId,
        status: input.status,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Auto-detect completed tasks
 */
function createHiveMindDetectCompletedTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/detect_completed',
    description: 'Auto-detect which tasks are completed by checking if expected files exist in the working directory',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        workingDir: {
          type: 'string',
          description: 'Local directory where the project files are located',
        },
      },
      required: ['owner', 'repo', 'epicId', 'workingDir'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Detecting completed tasks', { epicId: input.epicId, workingDir: input.workingDir, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
      }

      const detected = await orchestrator.autoDetectCompletedTasks(input.epicId, input.workingDir);

      return {
        success: true,
        epicId: input.epicId,
        completed: detected.completed.map((t: any) => ({
          taskId: t.taskId,
          issueNumber: t.issueNumber,
          title: t.title,
          phase: t.phase,
        })),
        pending: detected.pending.map((t: any) => ({
          taskId: t.taskId,
          issueNumber: t.issueNumber,
          title: t.title,
          phase: t.phase,
        })),
        completedCount: detected.completed.length,
        pendingCount: detected.pending.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Sync completion status to GitHub
 */
function createHiveMindSyncCompletionTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/sync_completion',
    description: 'Auto-detect completed tasks and sync their status to GitHub (close issues, update project board)',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        workingDir: {
          type: 'string',
          description: 'Local directory where the project files are located',
        },
        dryRun: {
          type: 'boolean',
          default: false,
          description: 'If true, only report what would be done without making changes',
        },
        completedBy: {
          type: 'string',
          default: 'Hive-Mind Auto-Sync',
          description: 'Name to attribute completions to',
        },
      },
      required: ['owner', 'repo', 'epicId', 'workingDir'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Syncing completion status', { epicId: input.epicId, workingDir: input.workingDir, dryRun: input.dryRun, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
      }

      const syncResult = await orchestrator.syncCompletionStatus(input.epicId, input.workingDir, {
        dryRun: input.dryRun,
        completedBy: input.completedBy || 'Hive-Mind Auto-Sync',
      });

      return {
        success: true,
        epicId: input.epicId,
        dryRun: input.dryRun,
        detected: {
          completed: syncResult.detected.completed.map((t: any) => ({
            taskId: t.taskId,
            issueNumber: t.issueNumber,
            title: t.title,
          })),
          pending: syncResult.detected.pending.map((t: any) => ({
            taskId: t.taskId,
            issueNumber: t.issueNumber,
            title: t.title,
          })),
        },
        results: syncResult.results.map((r: any) => ({
          taskId: r.taskId,
          issueNumber: r.issueNumber,
          success: r.success,
          status: r.status,
        })),
        completedCount: syncResult.results.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Retrospectively complete specific tasks
 */
function createHiveMindRetrospectiveCompleteTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/retrospective_complete',
    description: 'Retrospectively complete specific tasks that were already done. Closes issues and updates project status.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        taskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of task IDs or issue numbers to complete',
        },
        completedBy: {
          type: 'string',
          default: 'Hive-Mind Retrospective',
          description: 'Name to attribute completions to',
        },
        summary: {
          type: 'string',
          default: 'Task completed (retrospective)',
          description: 'Summary for completion comment',
        },
        closeIssues: {
          type: 'boolean',
          default: true,
          description: 'Whether to close the issues',
        },
      },
      required: ['owner', 'repo', 'epicId', 'taskIds'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Retrospective complete', { epicId: input.epicId, taskIds: input.taskIds, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
      }

      const results = await orchestrator.retrospectiveComplete(input.epicId, input.taskIds, {
        completedBy: input.completedBy || 'Hive-Mind Retrospective',
        summary: input.summary || 'Task completed (retrospective)',
        closeIssues: input.closeIssues !== false,
      });

      return {
        success: true,
        epicId: input.epicId,
        results: results.map((r: any) => ({
          taskId: r.taskId,
          issueNumber: r.issueNumber,
          success: r.success,
          status: r.status,
          completionTime: r.completionTime,
        })),
        completedCount: results.length,
        requestedCount: input.taskIds.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

// ============================================================================
// Hive-Mind PR Tools
// ============================================================================

/**
 * Create a branch for a task
 */
function createHiveMindBranchCreateTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/branch_create',
    description: 'Create a Git branch for a specific task. Generates a branch name based on the task if not provided.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        taskId: {
          type: 'string',
          description: 'Task ID or issue number to create branch for',
        },
        branchName: {
          type: 'string',
          description: 'Optional: custom branch name (auto-generated if not provided)',
        },
      },
      required: ['owner', 'repo', 'epicId', 'taskId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Creating task branch', { epicId: input.epicId, taskId: input.taskId, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      const result = await orchestrator.createTaskBranch(input.epicId, input.taskId, input.branchName);

      return {
        success: true,
        epicId: input.epicId,
        taskId: input.taskId,
        branch: result.branch,
        sha: result.sha,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Create a pull request for tasks
 */
function createHiveMindPRCreateTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/pr_create',
    description: 'Create a pull request linked to epic tasks. Automatically updates task issues and epic with PR references.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        title: {
          type: 'string',
          description: 'PR title',
        },
        body: {
          type: 'string',
          description: 'PR description',
        },
        branch: {
          type: 'string',
          description: 'Source branch name',
        },
        baseBranch: {
          type: 'string',
          default: 'main',
          description: 'Target branch to merge into',
        },
        taskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task IDs or issue numbers to link to this PR',
        },
        draft: {
          type: 'boolean',
          default: false,
          description: 'Create as draft PR',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional labels to add',
        },
        reviewers: {
          type: 'array',
          items: { type: 'string' },
          description: 'GitHub usernames to request as reviewers',
        },
        addToProject: {
          type: 'boolean',
          default: true,
          description: 'Add PR to epic project board',
        },
      },
      required: ['owner', 'repo', 'epicId', 'title', 'body', 'branch'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Creating PR', { epicId: input.epicId, branch: input.branch, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      const result = await orchestrator.createPullRequest(input.epicId, {
        title: input.title,
        body: input.body,
        branch: input.branch,
        baseBranch: input.baseBranch || 'main',
        taskIds: input.taskIds,
        draft: input.draft,
        labels: input.labels,
        reviewers: input.reviewers,
        addToProject: input.addToProject !== false,
      });

      return {
        success: true,
        epicId: input.epicId,
        prNumber: result.prNumber,
        prUrl: result.prUrl,
        branch: result.branch,
        linkedIssues: result.linkedIssues,
        projectItemId: result.projectItemId,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * List PRs for an epic
 */
function createHiveMindPRListTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/pr_list',
    description: 'List all pull requests associated with an epic',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        state: {
          type: 'string',
          enum: ['open', 'closed', 'all'],
          default: 'all',
          description: 'Filter by PR state',
        },
        includeExternal: {
          type: 'boolean',
          default: true,
          description: 'Include PRs not created via Hive-Mind but linked to epic issues',
        },
      },
      required: ['owner', 'repo', 'epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Listing PRs', { epicId: input.epicId, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      const prs = await orchestrator.listEpicPullRequests(input.epicId, {
        state: input.state,
        includeExternal: input.includeExternal !== false,
      });

      return {
        success: true,
        epicId: input.epicId,
        pullRequests: prs.map((pr: any) => ({
          prNumber: pr.prNumber,
          prUrl: pr.prUrl,
          title: pr.title,
          branch: pr.branch,
          baseBranch: pr.baseBranch,
          status: pr.status,
          linkedIssues: pr.linkedIssueNumbers,
          createdAt: pr.createdAt,
          mergedAt: pr.mergedAt,
        })),
        total: prs.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Link PR to tasks
 */
function createHiveMindPRLinkTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/pr_link',
    description: 'Link an existing pull request to epic tasks. Updates PR body, adds comments to issues, and notifies epic.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        prNumber: {
          type: 'number',
          description: 'PR number to link',
        },
        taskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Task IDs or issue numbers to link',
        },
        addComments: {
          type: 'boolean',
          default: true,
          description: 'Add comments to linked issues',
        },
        updateEpic: {
          type: 'boolean',
          default: true,
          description: 'Add notification comment to epic issue',
        },
      },
      required: ['owner', 'repo', 'epicId', 'prNumber', 'taskIds'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Linking PR to tasks', { epicId: input.epicId, prNumber: input.prNumber, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      await orchestrator.linkPullRequestToTasks(input.epicId, input.prNumber, input.taskIds, {
        addComments: input.addComments !== false,
        updateEpic: input.updateEpic !== false,
      });

      return {
        success: true,
        epicId: input.epicId,
        prNumber: input.prNumber,
        linkedTasks: input.taskIds.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Sync PR status
 */
function createHiveMindPRStatusTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/pr_status',
    description: 'Get or sync the status of a pull request. Checks reviews, approvals, and merge state.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        prNumber: {
          type: 'number',
          description: 'PR number to check',
        },
      },
      required: ['owner', 'repo', 'epicId', 'prNumber'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Getting PR status', { epicId: input.epicId, prNumber: input.prNumber, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      const pr = await orchestrator.syncPullRequestStatus(input.epicId, input.prNumber);

      if (!pr) {
        return {
          success: false,
          error: `PR #${input.prNumber} not found`,
          epicId: input.epicId,
          prNumber: input.prNumber,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        epicId: input.epicId,
        prNumber: pr.prNumber,
        prUrl: pr.prUrl,
        title: pr.title,
        branch: pr.branch,
        baseBranch: pr.baseBranch,
        status: pr.status,
        linkedIssues: pr.linkedIssueNumbers,
        createdAt: pr.createdAt,
        mergedAt: pr.mergedAt,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Handle PR merge
 */
function createHiveMindPRMergeTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/pr_merge',
    description: 'Handle a merged PR - sync status, complete linked tasks, and update epic. Call this after a PR has been merged.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        prNumber: {
          type: 'number',
          description: 'PR number that was merged',
        },
        completeTasks: {
          type: 'boolean',
          default: true,
          description: 'Automatically complete linked tasks',
        },
        completedBy: {
          type: 'string',
          default: 'Hive-Mind (PR Merged)',
          description: 'Attribution for task completion',
        },
      },
      required: ['owner', 'repo', 'epicId', 'prNumber'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Handling PR merge', { epicId: input.epicId, prNumber: input.prNumber, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      const result = await orchestrator.handlePullRequestMerge(input.epicId, input.prNumber, {
        completeTasks: input.completeTasks !== false,
        completedBy: input.completedBy || 'Hive-Mind (PR Merged)',
      });

      return {
        success: true,
        epicId: input.epicId,
        prNumber: result.pr.prNumber,
        prStatus: result.pr.status,
        completedTasks: result.completedTasks.map((t: any) => ({
          taskId: t.taskId,
          issueNumber: t.issueNumber,
          success: t.success,
          status: t.status,
        })),
        completedCount: result.completedTasks.length,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Get PR statistics for epic
 */
function createHiveMindPRStatsTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/pr_stats',
    description: 'Get PR statistics for an epic - total PRs, merged, open, and task coverage',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
      },
      required: ['owner', 'repo', 'epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Getting PR stats', { epicId: input.epicId, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      const stats = await orchestrator.getEpicPRStats(input.epicId);

      return {
        success: true,
        epicId: input.epicId,
        stats: {
          total: stats.total,
          open: stats.open,
          merged: stats.merged,
          closed: stats.closed,
          draft: stats.draft,
          tasksWithPR: stats.tasksWithPR,
          tasksWithoutPR: stats.tasksWithoutPR,
          prCoverage: stats.tasksWithPR + stats.tasksWithoutPR > 0
            ? Math.round((stats.tasksWithPR / (stats.tasksWithPR + stats.tasksWithoutPR)) * 100)
            : 0,
        },
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Get tasks that are ready for implementation
 */
function createHiveMindReadyTasksTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/tasks_ready',
    description: 'Get tasks that are ready for implementation. Returns tasks that are not blocked, not in progress, and not done. Useful for Hive-Mind agents to pick up work.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        phase: {
          type: 'string',
          enum: ['Specification', 'Pseudocode', 'Architecture', 'Refinement', 'Completion'],
          description: 'Filter by SPARC phase',
        },
        agentType: {
          type: 'string',
          description: 'Filter by assigned agent type (researcher, coder, tester, etc.)',
        },
        checkDependencies: {
          type: 'boolean',
          default: true,
          description: 'Only return tasks whose dependencies are complete',
        },
        refreshFromGitHub: {
          type: 'boolean',
          default: false,
          description: 'Refresh task statuses from GitHub before returning',
        },
      },
      required: ['owner', 'repo', 'epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Getting ready tasks', { epicId: input.epicId, phase: input.phase, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      // Optionally refresh from GitHub
      if (input.refreshFromGitHub) {
        await orchestrator.refreshTaskStatuses(input.epicId);
      }

      const readyTasks = orchestrator.getReadyTasks(input.epicId, {
        phase: input.phase,
        agentType: input.agentType,
        includeDependencyCheck: input.checkDependencies !== false,
      });

      return {
        success: true,
        epicId: input.epicId,
        filters: {
          phase: input.phase || 'all',
          agentType: input.agentType || 'all',
          checkDependencies: input.checkDependencies !== false,
        },
        count: readyTasks.length,
        tasks: readyTasks.map(task => ({
          taskId: task.taskId,
          issueNumber: task.issueNumber,
          issueUrl: task.issueUrl,
          title: task.title,
          phase: task.phase,
          status: task.status,
          assignedAgent: task.assignedAgent ? {
            name: task.assignedAgent.name,
            type: task.assignedAgent.type,
          } : null,
          dependencies: task.dependencies || [],
        })),
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Get the next task to work on
 */
function createHiveMindNextTaskTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/task_next',
    description: 'Get the next highest priority task to work on. Returns the first ready task based on SPARC phase order and dependencies.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        agentType: {
          type: 'string',
          description: 'Filter by agent type (only return tasks assigned to this agent type)',
        },
        refreshFromGitHub: {
          type: 'boolean',
          default: false,
          description: 'Refresh task statuses from GitHub before returning',
        },
      },
      required: ['owner', 'repo', 'epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Getting next task', { epicId: input.epicId, agentType: input.agentType, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      // Optionally refresh from GitHub
      if (input.refreshFromGitHub) {
        await orchestrator.refreshTaskStatuses(input.epicId);
      }

      const nextTask = orchestrator.getNextTask(input.epicId, input.agentType);

      if (!nextTask) {
        return {
          success: true,
          epicId: input.epicId,
          hasNextTask: false,
          message: 'No ready tasks available',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        epicId: input.epicId,
        hasNextTask: true,
        task: {
          taskId: nextTask.taskId,
          issueNumber: nextTask.issueNumber,
          issueUrl: nextTask.issueUrl,
          title: nextTask.title,
          phase: nextTask.phase,
          status: nextTask.status,
          assignedAgent: nextTask.assignedAgent ? {
            name: nextTask.assignedAgent.name,
            type: nextTask.assignedAgent.type,
            skills: nextTask.assignedAgent.skills,
          } : null,
          dependencies: nextTask.dependencies || [],
        },
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Get task status summary for an epic
 */
function createHiveMindTaskStatusSummaryTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/task_status_summary',
    description: 'Get a summary of task statuses for an epic. Shows counts by status (backlog, ready, in_progress, review, done, blocked) and progress by SPARC phase.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
        refreshFromGitHub: {
          type: 'boolean',
          default: false,
          description: 'Refresh task statuses from GitHub before returning',
        },
      },
      required: ['owner', 'repo', 'epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Getting task status summary', { epicId: input.epicId, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      // Optionally refresh from GitHub
      if (input.refreshFromGitHub) {
        await orchestrator.refreshTaskStatuses(input.epicId);
      }

      const summary = orchestrator.getTaskStatusSummary(input.epicId);

      // Calculate overall progress
      const overallProgress = summary.total > 0
        ? Math.round((summary.done / summary.total) * 100)
        : 0;

      // Calculate active work (in_progress + review)
      const activeWork = summary.inProgress + summary.review;

      return {
        success: true,
        epicId: input.epicId,
        summary: {
          total: summary.total,
          backlog: summary.backlog,
          ready: summary.ready,
          inProgress: summary.inProgress,
          review: summary.review,
          done: summary.done,
          blocked: summary.blocked,
        },
        progress: {
          overallPercent: overallProgress,
          activeWork,
          availableWork: summary.ready + summary.backlog,
        },
        byPhase: summary.byPhase,
        timestamp: new Date().toISOString(),
      };
    },
  };
}

/**
 * Refresh task statuses from GitHub
 */
function createHiveMindRefreshStatusTool(logger: ILogger): MCPTool {
  return {
    name: 'hivemind/task_status_refresh',
    description: 'Refresh task statuses from GitHub. Syncs local cache with current GitHub project board and issue states.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'GitHub owner (user or organization)',
        },
        repo: {
          type: 'string',
          description: 'GitHub repository name',
        },
        epicId: {
          type: 'string',
          description: 'Epic ID',
        },
      },
      required: ['owner', 'repo', 'epicId'],
    },
    handler: async (input: any, context?: ClaudeFlowToolContext) => {
      logger.info('Refreshing task statuses', { epicId: input.epicId, sessionId: context?.sessionId });

      const { createHiveMindOrchestrator } = await import('../teammate-agents/integration/hive-mind-github.js');

      let orchestrator = (context as any)?.hiveMindOrchestrator;
      if (!orchestrator) {
        orchestrator = createHiveMindOrchestrator({
          owner: input.owner,
          enableVectorSearch: true,
          enableLearning: true,
        });
        await orchestrator.initialize();
        await orchestrator.loadEpicFromGitHub(input.repo, input.epicId);
        if (context) {
          (context as any).hiveMindOrchestrator = orchestrator;
        }
      }

      await orchestrator.refreshTaskStatuses(input.epicId);

      // Get updated summary
      const summary = orchestrator.getTaskStatusSummary(input.epicId);

      return {
        success: true,
        epicId: input.epicId,
        message: 'Task statuses refreshed from GitHub',
        summary: {
          total: summary.total,
          backlog: summary.backlog,
          ready: summary.ready,
          inProgress: summary.inProgress,
          review: summary.review,
          done: summary.done,
          blocked: summary.blocked,
        },
        timestamp: new Date().toISOString(),
      };
    },
  };
}
