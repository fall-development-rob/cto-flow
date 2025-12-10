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
