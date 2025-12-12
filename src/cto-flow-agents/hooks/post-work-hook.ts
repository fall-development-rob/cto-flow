/**
 * Post-Work Hook for Automatic PR Creation
 *
 * This hook triggers when an agent completes work on a task and:
 * 1. Automatically creates a Pull Request linked to the issue
 * 2. Updates the GitHub issue status to "In Review"
 * 3. Adds PR link comment to the issue
 * 4. Updates epic progress percentage
 * 5. Handles branch creation if needed
 *
 * Integrates with:
 * - Agentic Hooks System for work completion detection
 * - GitHub Projects v2 via CtoFlowProjectBridge
 * - Octokit for PR creation and Git operations
 * - Hive-Mind orchestrator for epic tracking
 *
 * @module hooks/post-work-hook
 */

import type {
  AgenticHookContext,
  HookHandler,
  HookHandlerResult,
  HookPayload,
  HookRegistration,
  SideEffect,
} from '../../services/agentic-flow-hooks/types.js';
import { agenticHookManager } from '../../services/agentic-flow-hooks/hook-manager.js';
import { Logger } from '../../core/logger.js';
import { canUseCtoFlowMode } from '../core/config-manager.js';
import { createHiveMindOrchestrator, HiveMindGitHubOrchestrator } from '../integration/hive-mind-github.js';
import { OctokitClient } from '../github/octokit-client.js';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const logger = new Logger({
  level: 'info',
  format: 'text',
  destination: 'console'
}, { prefix: 'PostWorkHook' });

// ===== Type Definitions =====

export interface WorkOutput {
  epicId: string;
  taskId: string;
  issueNumber: number;
  agentId: string;
  agentType: string;
  repo: string;
  success: boolean;
  summary?: string;
  artifacts?: string[];
  changedFiles?: string[];
  branch?: string;
  baseBranch?: string;
}

export interface PostWorkPayload extends HookPayload {
  epicId: string;
  taskId: string;
  issueNumber: number;
  agentId: string;
  agentType: string;
  repo: string;
  success: boolean;
  summary?: string;
  artifacts?: string[];
  changedFiles?: string[];
  branch?: string;
  baseBranch?: string;
  workOutput?: WorkOutput;
}

export interface PRCreationResult {
  prNumber: number;
  prUrl: string;
  branch: string;
  title: string;
  body: string;
}

// ===== Orchestrator Cache =====

const orchestratorCache: Map<string, HiveMindGitHubOrchestrator> = new Map();

async function getOrchestrator(repo: string): Promise<HiveMindGitHubOrchestrator | null> {
  if (!repo) return null;

  const parts = repo.split('/');
  if (parts.length !== 2) return null;

  const [owner, repoName] = parts;
  const cacheKey = `${owner}/${repoName}`;

  if (orchestratorCache.has(cacheKey)) {
    return orchestratorCache.get(cacheKey)!;
  }

  try {
    const orchestrator = createHiveMindOrchestrator({
      owner,
      repo: repoName,
      enableVectorSearch: false,
      enableLearning: true,
    });

    await orchestrator.initialize();
    orchestratorCache.set(cacheKey, orchestrator);

    return orchestrator;
  } catch (error) {
    logger.error('Failed to initialize orchestrator', error);
    return null;
  }
}

// ===== Git Operations =====

/**
 * Gets the current Git branch
 */
function getCurrentBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    logger.warn('Failed to get current branch', error);
    return 'main';
  }
}

/**
 * Gets the default base branch (main or master)
 */
function getBaseBranch(): string {
  try {
    // Check if remote has main or master
    const remotes = execSync('git remote show origin', { encoding: 'utf8' });
    if (remotes.includes('HEAD branch: main')) return 'main';
    if (remotes.includes('HEAD branch: master')) return 'master';

    // Fallback to checking local branches
    const branches = execSync('git branch -a', { encoding: 'utf8' });
    if (branches.includes('origin/main')) return 'main';
    if (branches.includes('origin/master')) return 'master';

    return 'main'; // Default
  } catch (error) {
    logger.warn('Failed to detect base branch, defaulting to main', error);
    return 'main';
  }
}

/**
 * Creates a new branch for the work if not already on one
 */
function ensureBranch(issueNumber: number, taskId: string): string {
  const currentBranch = getCurrentBranch();
  const baseBranch = getBaseBranch();

  // If already on a feature branch, use it
  if (currentBranch !== baseBranch && currentBranch !== 'HEAD') {
    logger.info(`Using existing branch: ${currentBranch}`);
    return currentBranch;
  }

  // Create a new branch from base
  const branchName = `feature/issue-${issueNumber}-${taskId.substring(0, 8)}`;

  try {
    // Check if branch already exists
    const branches = execSync('git branch', { encoding: 'utf8' });
    if (branches.includes(branchName)) {
      execSync(`git checkout ${branchName}`);
      logger.info(`Switched to existing branch: ${branchName}`);
    } else {
      execSync(`git checkout -b ${branchName}`);
      logger.info(`Created new branch: ${branchName}`);
    }

    return branchName;
  } catch (error) {
    logger.error('Failed to create/switch branch', error);
    return currentBranch;
  }
}

/**
 * Commits all changes with a formatted commit message
 */
function commitChanges(issueNumber: number, summary: string, agentType: string): boolean {
  try {
    // Check if there are changes to commit
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (!status.trim()) {
      logger.info('No changes to commit');
      return false;
    }

    // Stage all changes
    execSync('git add .');

    // Create commit message with conventional format
    const commitMessage = `feat: Complete work on issue #${issueNumber}

${summary || 'Task completed by agent'}

Closes #${issueNumber}

🤖 Generated with Claude Flow
Co-Authored-By: ${agentType} Agent <noreply@ruv.io>`;

    // Commit with message
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
    logger.info('Changes committed successfully');

    return true;
  } catch (error) {
    logger.error('Failed to commit changes', error);
    return false;
  }
}

/**
 * Pushes the branch to remote
 */
function pushBranch(branch: string): boolean {
  try {
    // Push with upstream tracking
    execSync(`git push -u origin ${branch}`, { stdio: 'inherit' });
    logger.info(`Pushed branch ${branch} to remote`);
    return true;
  } catch (error) {
    logger.error('Failed to push branch', error);
    return false;
  }
}

/**
 * Gets list of changed files in current branch
 */
function getChangedFiles(baseBranch: string): string[] {
  try {
    const files = execSync(`git diff --name-only ${baseBranch}...HEAD`, { encoding: 'utf8' });
    return files.split('\n').filter(f => f.trim());
  } catch (error) {
    logger.warn('Failed to get changed files', error);
    return [];
  }
}

// ===== PR Creation Logic =====

/**
 * Generates PR title from issue title and type
 */
function generatePRTitle(issueNumber: number, issueTitle: string, agentType: string): string {
  // Detect type from agent or issue title
  let type = 'feat';

  if (agentType.includes('test')) type = 'test';
  else if (agentType.includes('reviewer')) type = 'refactor';
  else if (agentType.includes('doc')) type = 'docs';
  else if (issueTitle.toLowerCase().includes('fix')) type = 'fix';
  else if (issueTitle.toLowerCase().includes('doc')) type = 'docs';
  else if (issueTitle.toLowerCase().includes('test')) type = 'test';

  return `[${type}] ${issueTitle} (#${issueNumber})`;
}

/**
 * Generates PR body with summary, changed files, and issue links
 */
function generatePRBody(options: {
  issueNumber: number;
  epicId: string;
  summary?: string;
  changedFiles?: string[];
  agentType: string;
  epicTitle?: string;
}): string {
  const { issueNumber, epicId, summary, changedFiles, agentType, epicTitle } = options;

  let body = `## Summary\n\n${summary || 'Work completed by automated agent'}\n\n`;

  // Add epic context
  if (epicTitle) {
    body += `**Epic**: ${epicTitle} (\`${epicId}\`)\n\n`;
  }

  // Add changed files
  if (changedFiles && changedFiles.length > 0) {
    body += `## Changed Files\n\n`;
    changedFiles.slice(0, 20).forEach(file => {
      body += `- \`${file}\`\n`;
    });
    if (changedFiles.length > 20) {
      body += `\n_...and ${changedFiles.length - 20} more files_\n`;
    }
    body += '\n';
  }

  // Add test plan
  body += `## Test Plan\n\n`;
  body += `- [ ] Code review completed\n`;
  body += `- [ ] Tests pass locally\n`;
  body += `- [ ] CI/CD pipeline passes\n`;
  body += `- [ ] Manual testing completed\n\n`;

  // Add footer
  body += `---\n`;
  body += `🤖 **Auto-generated by Claude Flow**\n`;
  body += `👤 **Agent**: ${agentType}\n`;
  body += `🔗 **Closes**: #${issueNumber}\n\n`;
  body += `Co-Authored-By: ${agentType} Agent <noreply@ruv.io>`;

  return body;
}

/**
 * Creates a pull request for completed work
 */
async function createPullRequest(
  orchestrator: HiveMindGitHubOrchestrator,
  client: OctokitClient,
  payload: PostWorkPayload
): Promise<PRCreationResult | null> {
  try {
    const baseBranch = payload.baseBranch || getBaseBranch();

    // Ensure we're on a feature branch
    const branch = payload.branch || ensureBranch(payload.issueNumber, payload.taskId);

    // Commit changes if needed
    const hasCommits = commitChanges(
      payload.issueNumber,
      payload.summary || 'Task completed',
      payload.agentType
    );

    if (!hasCommits) {
      logger.warn('No commits to create PR from');
      return null;
    }

    // Push branch to remote
    const pushed = pushBranch(branch);
    if (!pushed) {
      logger.error('Failed to push branch, cannot create PR');
      return null;
    }

    // Get changed files
    const changedFiles = payload.changedFiles || getChangedFiles(baseBranch);

    // Get epic details for context
    const epic = orchestrator.getEpic(payload.epicId);
    const epicTitle = epic?.title;

    // Get issue details for title
    const issue = await client.getIssue(payload.issueNumber);
    const issueTitle = issue?.title || `Issue #${payload.issueNumber}`;

    // Generate PR title and body
    const prTitle = generatePRTitle(payload.issueNumber, issueTitle, payload.agentType);
    const prBody = generatePRBody({
      issueNumber: payload.issueNumber,
      epicId: payload.epicId,
      summary: payload.summary,
      changedFiles,
      agentType: payload.agentType,
      epicTitle,
    });

    // Create the PR via Octokit
    const prResult = await client.createPullRequest({
      title: prTitle,
      body: prBody,
      head: branch,
      base: baseBranch,
      draft: false,
      linkedIssues: [payload.issueNumber],
      labels: [`epic:${payload.epicId}`, 'auto-generated', `agent:${payload.agentType}`],
    });

    logger.info(`Created PR #${prResult.number}: ${prResult.url}`);

    return {
      prNumber: prResult.number,
      prUrl: prResult.url,
      branch,
      title: prTitle,
      body: prBody,
    };
  } catch (error) {
    logger.error('Failed to create pull request', error);
    return null;
  }
}

// ===== Post-Work Hook Implementation =====

/**
 * Post-Work Hook
 *
 * Executes when an agent completes work on a task:
 * 1. Creates PR with linked issue
 * 2. Updates issue status to "In Review"
 * 3. Adds PR link comment to issue
 * 4. Updates epic progress
 */
export class PostWorkHook {
  createHandler(): HookHandler {
    return async (payload: HookPayload, context: AgenticHookContext): Promise<HookHandlerResult> => {
      if (!canUseCtoFlowMode()) {
        logger.debug('CTO-Flow mode disabled, skipping post-work PR hook');
        return { continue: true, modified: false };
      }

      const workPayload = payload as PostWorkPayload;

      // Validate required fields
      if (!workPayload.epicId || !workPayload.issueNumber || !workPayload.repo) {
        logger.debug('Missing required fields for post-work PR hook');
        return { continue: true, modified: false };
      }

      // Only create PR if work was successful
      if (!workPayload.success) {
        logger.debug('Work was not successful, skipping PR creation');
        return { continue: true, modified: false };
      }

      logger.info(`Post-work PR: Agent ${workPayload.agentId} completed issue #${workPayload.issueNumber}`);

      try {
        const sideEffects: SideEffect[] = [];
        const orchestrator = await getOrchestrator(workPayload.repo);

        if (!orchestrator) {
          logger.warn('Could not get orchestrator for repo');
          return { continue: true, modified: false };
        }

        // Get the Octokit client for PR operations
        const [owner, repo] = workPayload.repo.split('/');
        const client = new OctokitClient({ owner, repo });

        // Create the pull request
        const prResult = await createPullRequest(orchestrator, client, workPayload);

        if (!prResult) {
          logger.warn('Failed to create PR, continuing without it');
          return { continue: true, modified: false };
        }

        // Add comment to issue with PR link
        await client.createComment(
          workPayload.issueNumber,
          `🔗 **Pull Request Created**\n\n` +
          `PR #${prResult.prNumber} has been automatically created for this issue.\n\n` +
          `**Link**: ${prResult.prUrl}\n` +
          `**Branch**: \`${prResult.branch}\`\n` +
          `**Agent**: ${workPayload.agentType}\n\n` +
          `_This issue will be closed automatically when the PR is merged._`
        );

        // Update issue status to "In Review" via orchestrator
        await orchestrator.updateTaskStatus(
          workPayload.epicId,
          workPayload.taskId || workPayload.issueNumber,
          'Review'
        );

        // Track PR in orchestrator
        await orchestrator.trackPullRequest(
          prResult.prNumber,
          workPayload.epicId,
          [workPayload.taskId || String(workPayload.issueNumber)],
          prResult.branch
        );

        // Store PR creation event
        sideEffects.push({
          type: 'memory',
          action: 'store',
          data: {
            namespace: 'epic:pr-created',
            key: `${workPayload.epicId}:${prResult.prNumber}`,
            value: {
              epicId: workPayload.epicId,
              taskId: workPayload.taskId,
              issueNumber: workPayload.issueNumber,
              prNumber: prResult.prNumber,
              prUrl: prResult.prUrl,
              branch: prResult.branch,
              agentId: workPayload.agentId,
              agentType: workPayload.agentType,
              createdAt: new Date().toISOString(),
            },
          },
        });

        // Track metrics
        sideEffects.push({
          type: 'metric',
          action: 'increment',
          data: {
            name: 'epic.pr.auto_created',
            value: 1,
          },
        });

        // Notification
        sideEffects.push({
          type: 'notification',
          action: 'send',
          data: {
            title: 'PR Created Automatically',
            message: `PR #${prResult.prNumber} created for issue #${workPayload.issueNumber}`,
            severity: 'info',
          },
        });

        logger.info(`Successfully created PR #${prResult.prNumber} for issue #${workPayload.issueNumber}`);

        return {
          continue: true,
          modified: true,
          payload: {
            ...workPayload,
            prCreated: true,
            prNumber: prResult.prNumber,
            prUrl: prResult.prUrl,
            branch: prResult.branch,
          },
          sideEffects,
          metadata: {
            epicId: workPayload.epicId,
            issueNumber: workPayload.issueNumber,
            prNumber: prResult.prNumber,
            prUrl: prResult.prUrl,
          },
        };

      } catch (error) {
        logger.error('Post-work PR hook failed', error);
        return {
          continue: true,
          modified: false,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        };
      }
    };
  }

  register(): void {
    const registration: HookRegistration = {
      id: 'post-work-pr-creation',
      type: 'workflow-complete',
      handler: this.createHandler(),
      priority: 85, // Run after post-work but before final cleanup
      filter: {
        patterns: [/^epic:work/, /^hive-mind:work/, /^work:complete/],
      },
      options: {
        async: true,
        timeout: 120000, // 2 minutes for git operations
        retries: 1,
      },
    };

    agenticHookManager.register(registration);
    logger.info('Registered post-work PR creation hook');
  }
}

// ===== Hook Registration Functions =====

/**
 * Register the post-work PR creation hook
 */
export function registerPostWorkHook(): void {
  logger.info('Registering post-work PR creation hook...');

  try {
    const hook = new PostWorkHook();
    hook.register();

    logger.info('Successfully registered post-work PR creation hook');
  } catch (error) {
    logger.error('Failed to register post-work PR creation hook', error);
    throw error;
  }
}

/**
 * Unregister the post-work PR creation hook
 */
export function unregisterPostWorkHook(): void {
  logger.info('Unregistering post-work PR creation hook...');

  try {
    agenticHookManager.unregister('post-work-pr-creation');

    // Clear orchestrator cache
    for (const [key, orchestrator] of orchestratorCache) {
      orchestrator.shutdown().catch(() => {});
    }
    orchestratorCache.clear();

    logger.info('Successfully unregistered post-work PR creation hook');
  } catch (error) {
    logger.error('Failed to unregister post-work PR creation hook', error);
  }
}

/**
 * Manual trigger for PR creation after work completion
 * Use when work is completed outside of the normal hook flow
 */
export async function handleWorkComplete(workOutput: WorkOutput): Promise<PRCreationResult | null> {
  if (!canUseCtoFlowMode()) {
    logger.debug('CTO-Flow mode disabled');
    return null;
  }

  const payload: PostWorkPayload = {
    ...workOutput,
  };

  const context: AgenticHookContext = {
    executionId: `work-complete-${Date.now()}`,
    timestamp: Date.now(),
    metadata: {},
  };

  const hook = new PostWorkHook();
  const result = await hook.createHandler()(payload, context);

  if (result.modified && result.payload?.prNumber) {
    return {
      prNumber: result.payload.prNumber,
      prUrl: result.payload.prUrl,
      branch: result.payload.branch,
      title: '',
      body: '',
    };
  }

  return null;
}

// Export hook class
export default PostWorkHook;
