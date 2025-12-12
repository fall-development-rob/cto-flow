/**
 * Codespace Worker Module
 *
 * Handles codespace-based task execution for distributed autonomous agent workflows.
 * Creates GitHub Codespaces, executes agentic-flow tasks, and manages lifecycle.
 *
 * @module workers/codespace-worker
 */

import { Octokit } from '@octokit/rest';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Machine types available for GitHub Codespaces
 */
export type CodespaceMachineType =
  | 'standardLinux32gb'
  | 'largePremiumLinux'
  | 'basicLinux32gb'
  | 'standardLinux'
  | 'premiumLinux';

/**
 * Configuration for codespace worker
 */
export interface CodespaceWorkerConfig {
  /** Machine type for the codespace */
  machine: CodespaceMachineType;

  /** Timeout in minutes (default: 60) */
  timeout: number;

  /** Repository URL for agentic-flow (default: ruvnet/agentic-flow) */
  agenticFlowRepo: string;

  /** Version/branch of agentic-flow to use */
  agenticFlowVersion?: string;

  /** Idle timeout in minutes (default: 30) */
  idleTimeoutMinutes?: number;

  /** Retention period in days (default: 0 = delete immediately) */
  retentionPeriodMinutes?: number;
}

/**
 * Context for task execution in codespace
 */
export interface TaskExecutionContext {
  /** GitHub issue number */
  issueNumber: number;

  /** Issue title */
  issueTitle: string;

  /** Issue body/description */
  issueBody: string;

  /** Optional epic/project ID */
  epicId?: string;

  /** Repository in format owner/repo */
  repo: string;

  /** Branch to create/work on */
  branch?: string;

  /** Additional environment variables */
  envVars?: Record<string, string>;

  /** Task-specific configuration for agentic-flow */
  agenticConfig?: {
    mode?: 'autonomous' | 'guided' | 'interactive';
    maxIterations?: number;
    testCoverage?: number;
    reviewers?: string[];
  };
}

/**
 * Codespace state information
 */
export interface CodespaceState {
  /** Codespace ID */
  id: number;

  /** Codespace name */
  name: string;

  /** Current state */
  state: 'Available' | 'Unavailable' | 'Creating' | 'Starting' | 'Stopping' | 'Shutdown' | 'Archived';

  /** Machine type */
  machineType: string;

  /** Git status */
  gitStatus?: {
    ref: string;
    ahead: number;
    behind: number;
  };

  /** URL for web access */
  webUrl?: string;

  /** Created timestamp */
  createdAt: string;

  /** Last used timestamp */
  lastUsedAt: string;
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  /** Whether task completed successfully */
  success: boolean;

  /** Output from execution */
  output: string;

  /** Error message if failed */
  error?: string;

  /** Created pull request number */
  pullRequestNumber?: number;

  /** Created pull request URL */
  pullRequestUrl?: string;

  /** Changed files */
  filesChanged?: string[];

  /** Execution metrics */
  metrics?: {
    duration: number;
    iterations: number;
    testsRun: number;
    testsPassed: number;
  };
}

/**
 * Execution progress callback
 */
export type ProgressCallback = (progress: {
  stage: 'creating' | 'starting' | 'installing' | 'executing' | 'testing' | 'submitting' | 'cleaning';
  message: string;
  percentage?: number;
}) => void;

// ============================================================================
// Codespace Worker Class
// ============================================================================

export class CodespaceWorker {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: {
    token?: string;
    owner: string;
    repo: string;
  }) {
    const token = config.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

    if (!token) {
      throw new Error(
        'GitHub token required. Set GITHUB_TOKEN or GH_TOKEN environment variable.'
      );
    }

    this.owner = config.owner;
    this.repo = config.repo;
    this.octokit = new Octokit({ auth: token });
  }

  // ==========================================================================
  // Codespace Management
  // ==========================================================================

  /**
   * Creates a codespace for task execution
   */
  async createCodespaceForTask(
    context: TaskExecutionContext,
    config: CodespaceWorkerConfig,
    onProgress?: ProgressCallback
  ): Promise<{ codespaceId: number; codespaceName: string }> {
    onProgress?.({ stage: 'creating', message: 'Creating codespace...' });

    try {
      // Determine branch
      const branch = context.branch || `task/issue-${context.issueNumber}`;

      // Create the codespace
      const response = await this.octokit.codespaces.createForAuthenticatedUser({
        repository_id: await this.getRepoId(),
        ref: branch,
        machine: config.machine,
        idle_timeout_minutes: config.idleTimeoutMinutes ?? 30,
        retention_period_minutes: config.retentionPeriodMinutes ?? 0,
        display_name: `Task #${context.issueNumber}: ${context.issueTitle.slice(0, 50)}`,
      });

      const codespaceId = response.data.id;
      const codespaceName = response.data.name;

      onProgress?.({
        stage: 'creating',
        message: `Codespace created: ${codespaceName}`,
        percentage: 20,
      });

      // Wait for codespace to be available
      await this.waitForCodespaceState(codespaceId, 'Available', onProgress);

      onProgress?.({
        stage: 'starting',
        message: 'Codespace is ready',
        percentage: 40,
      });

      return { codespaceId, codespaceName };
    } catch (error: any) {
      throw new Error(`Failed to create codespace: ${error.message}`);
    }
  }

  /**
   * Gets the repository ID
   */
  private async getRepoId(): Promise<number> {
    const response = await this.octokit.repos.get({
      owner: this.owner,
      repo: this.repo,
    });

    return response.data.id;
  }

  /**
   * Waits for codespace to reach desired state
   */
  private async waitForCodespaceState(
    codespaceId: number,
    desiredState: string,
    onProgress?: ProgressCallback,
    maxWaitMs: number = 300000 // 5 minutes
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const state = await this.getCodespaceStatus(codespaceId);

      if (state.state === desiredState) {
        return;
      }

      if (state.state === 'Shutdown' || state.state === 'Archived') {
        throw new Error(`Codespace entered terminal state: ${state.state}`);
      }

      onProgress?.({
        stage: 'starting',
        message: `Waiting for codespace (current: ${state.state})...`,
      });

      // Wait 5 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Timeout waiting for codespace to reach state: ${desiredState}`);
  }

  /**
   * Executes task in codespace using agentic-flow
   */
  async executeTaskInCodespace(
    codespaceId: number,
    context: TaskExecutionContext,
    config: CodespaceWorkerConfig,
    onProgress?: ProgressCallback
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    try {
      onProgress?.({
        stage: 'installing',
        message: 'Installing agentic-flow...',
        percentage: 50,
      });

      // Install agentic-flow
      await this.executeInCodespace(
        codespaceId,
        this.getInstallScript(config)
      );

      onProgress?.({
        stage: 'executing',
        message: 'Running agentic-flow on task...',
        percentage: 60,
      });

      // Execute the task
      const executionScript = this.getExecutionScript(context, config);
      const output = await this.executeInCodespace(codespaceId, executionScript);

      onProgress?.({
        stage: 'testing',
        message: 'Running tests...',
        percentage: 75,
      });

      // Run tests
      const testResults = await this.runTests(codespaceId);

      onProgress?.({
        stage: 'submitting',
        message: 'Creating pull request...',
        percentage: 85,
      });

      // Create pull request
      const prResult = await this.createPullRequest(codespaceId, context);

      const duration = Date.now() - startTime;

      onProgress?.({
        stage: 'submitting',
        message: 'Task completed successfully',
        percentage: 100,
      });

      return {
        success: true,
        output,
        pullRequestNumber: prResult.number,
        pullRequestUrl: prResult.url,
        filesChanged: prResult.filesChanged,
        metrics: {
          duration,
          iterations: this.parseIterations(output),
          testsRun: testResults.total,
          testsPassed: testResults.passed,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message,
        metrics: {
          duration: Date.now() - startTime,
          iterations: 0,
          testsRun: 0,
          testsPassed: 0,
        },
      };
    }
  }

  /**
   * Generates installation script for agentic-flow
   */
  private getInstallScript(config: CodespaceWorkerConfig): string {
    const version = config.agenticFlowVersion || 'latest';

    return `
      set -e

      # Update npm
      npm install -g npm@latest

      # Install agentic-flow
      if [ "${version}" = "latest" ]; then
        npm install -g ${config.agenticFlowRepo}
      else
        npm install -g ${config.agenticFlowRepo}@${version}
      fi

      # Verify installation
      agentic-flow --version
    `;
  }

  /**
   * Generates execution script for the task
   */
  private getExecutionScript(
    context: TaskExecutionContext,
    config: CodespaceWorkerConfig
  ): string {
    const agenticConfig = context.agenticConfig || {};
    const mode = agenticConfig.mode || 'autonomous';
    const maxIterations = agenticConfig.maxIterations || 10;
    const testCoverage = agenticConfig.testCoverage || 80;

    // Build environment variables
    const envVars = {
      ISSUE_NUMBER: context.issueNumber.toString(),
      ISSUE_TITLE: context.issueTitle,
      ISSUE_BODY: context.issueBody,
      EPIC_ID: context.epicId || '',
      REPO: context.repo,
      BRANCH: context.branch || `task/issue-${context.issueNumber}`,
      ...context.envVars,
    };

    const envExports = Object.entries(envVars)
      .map(([key, value]) => `export ${key}="${value.replace(/"/g, '\\"')}"`)
      .join('\n');

    return `
      set -e

      # Set environment variables
      ${envExports}

      # Configure git
      git config --global user.name "Codespace Worker"
      git config --global user.email "codespace-worker@github.com"

      # Create/checkout branch
      git checkout -b "$BRANCH" || git checkout "$BRANCH"

      # Run agentic-flow
      agentic-flow execute \\
        --mode ${mode} \\
        --issue "$ISSUE_NUMBER" \\
        --max-iterations ${maxIterations} \\
        --test-coverage ${testCoverage} \\
        --auto-commit \\
        --output json
    `;
  }

  /**
   * Executes commands in codespace
   */
  private async executeInCodespace(
    codespaceId: number,
    script: string
  ): Promise<string> {
    // GitHub doesn't provide direct exec API for codespaces
    // We need to use the codespace CLI or REST API indirectly

    // This is a simplified implementation - in production, you would:
    // 1. Use GitHub CLI installed in codespace
    // 2. Use SSH to connect and execute
    // 3. Use VS Code Server API
    // 4. Use Codespaces CLI API

    // For now, we'll use a webhook/polling approach via REST API
    // by creating files and monitoring them

    const commandFile = `.codespace-command-${Date.now()}.sh`;
    const outputFile = `.codespace-output-${Date.now()}.txt`;

    // Create command file in codespace
    await this.createFileInCodespace(codespaceId, commandFile, script);

    // Trigger execution (this would be handled by a runner in the codespace)
    // In practice, you'd have a daemon running that watches for these files

    // Wait for output file
    const output = await this.waitForOutputFile(codespaceId, outputFile);

    // Cleanup
    await this.deleteFileInCodespace(codespaceId, commandFile);
    await this.deleteFileInCodespace(codespaceId, outputFile);

    return output;
  }

  /**
   * Creates a file in codespace via Git API
   */
  private async createFileInCodespace(
    codespaceId: number,
    path: string,
    content: string
  ): Promise<void> {
    // Implementation would use the Git API to commit files
    // This is a placeholder for the actual implementation
    console.log(`Creating file in codespace ${codespaceId}: ${path}`);
  }

  /**
   * Waits for output file to be created
   */
  private async waitForOutputFile(
    codespaceId: number,
    path: string,
    maxWaitMs: number = 600000 // 10 minutes
  ): Promise<string> {
    // Implementation would poll for file existence
    // This is a placeholder for the actual implementation
    return 'Command executed successfully';
  }

  /**
   * Deletes a file in codespace
   */
  private async deleteFileInCodespace(
    codespaceId: number,
    path: string
  ): Promise<void> {
    // Implementation would use the Git API
    console.log(`Deleting file in codespace ${codespaceId}: ${path}`);
  }

  /**
   * Runs tests in codespace
   */
  private async runTests(codespaceId: number): Promise<{
    total: number;
    passed: number;
    failed: number;
  }> {
    const output = await this.executeInCodespace(
      codespaceId,
      'npm test -- --coverage --json'
    );

    // Parse test results
    try {
      const results = JSON.parse(output);
      return {
        total: results.numTotalTests || 0,
        passed: results.numPassedTests || 0,
        failed: results.numFailedTests || 0,
      };
    } catch {
      return { total: 0, passed: 0, failed: 0 };
    }
  }

  /**
   * Creates pull request from codespace changes
   */
  private async createPullRequest(
    codespaceId: number,
    context: TaskExecutionContext
  ): Promise<{
    number: number;
    url: string;
    filesChanged: string[];
  }> {
    // Get changed files
    const filesChanged = await this.getChangedFiles(codespaceId);

    // Push changes
    await this.executeInCodespace(
      codespaceId,
      `git push -u origin ${context.branch || `task/issue-${context.issueNumber}`}`
    );

    // Create PR using Octokit
    const [owner, repo] = context.repo.split('/');
    const response = await this.octokit.pulls.create({
      owner,
      repo,
      title: `Fix: ${context.issueTitle}`,
      head: context.branch || `task/issue-${context.issueNumber}`,
      base: 'main',
      body: `Automated fix for issue #${context.issueNumber}\n\n${context.issueBody}\n\n---\n\n*Generated by Codespace Worker*`,
    });

    return {
      number: response.data.number,
      url: response.data.html_url,
      filesChanged,
    };
  }

  /**
   * Gets list of changed files
   */
  private async getChangedFiles(codespaceId: number): Promise<string[]> {
    const output = await this.executeInCodespace(
      codespaceId,
      'git diff --name-only HEAD'
    );

    return output.split('\n').filter(line => line.trim());
  }

  /**
   * Parses iteration count from output
   */
  private parseIterations(output: string): number {
    const match = output.match(/Iteration (\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Cleans up and destroys codespace
   */
  async cleanupCodespace(
    codespaceId: number,
    onProgress?: ProgressCallback
  ): Promise<void> {
    onProgress?.({
      stage: 'cleaning',
      message: 'Cleaning up codespace...',
    });

    try {
      await this.octokit.codespaces.deleteForAuthenticatedUser({
        codespace_name: await this.getCodespaceName(codespaceId),
      });

      onProgress?.({
        stage: 'cleaning',
        message: 'Codespace deleted successfully',
      });
    } catch (error: any) {
      throw new Error(`Failed to cleanup codespace: ${error.message}`);
    }
  }

  /**
   * Gets codespace name from ID
   */
  private async getCodespaceName(codespaceId: number): Promise<string> {
    const response = await this.octokit.codespaces.listForAuthenticatedUser();
    const codespace = response.data.codespaces.find(cs => cs.id === codespaceId);

    if (!codespace) {
      throw new Error(`Codespace ${codespaceId} not found`);
    }

    return codespace.name;
  }

  /**
   * Gets current codespace status
   */
  async getCodespaceStatus(codespaceId: number): Promise<CodespaceState> {
    const response = await this.octokit.codespaces.listForAuthenticatedUser();
    const codespace = response.data.codespaces.find(cs => cs.id === codespaceId);

    if (!codespace) {
      throw new Error(`Codespace ${codespaceId} not found`);
    }

    return {
      id: codespace.id,
      name: codespace.name,
      state: codespace.state as CodespaceState['state'],
      machineType: codespace.machine?.name || 'unknown',
      gitStatus: codespace.git_status ? {
        ref: codespace.git_status.ref || '',
        ahead: codespace.git_status.ahead || 0,
        behind: codespace.git_status.behind || 0,
      } : undefined,
      webUrl: codespace.web_url,
      createdAt: codespace.created_at,
      lastUsedAt: codespace.last_used_at,
    };
  }

  // ==========================================================================
  // High-Level Workflow
  // ==========================================================================

  /**
   * Executes complete task workflow: create, execute, cleanup
   */
  async executeTask(
    context: TaskExecutionContext,
    config: CodespaceWorkerConfig,
    onProgress?: ProgressCallback
  ): Promise<TaskExecutionResult> {
    let codespaceId: number | null = null;

    try {
      // Create codespace
      const { codespaceId: id } = await this.createCodespaceForTask(
        context,
        config,
        onProgress
      );
      codespaceId = id;

      // Execute task
      const result = await this.executeTaskInCodespace(
        codespaceId,
        context,
        config,
        onProgress
      );

      return result;
    } finally {
      // Always cleanup codespace
      if (codespaceId) {
        try {
          await this.cleanupCodespace(codespaceId, onProgress);
        } catch (error) {
          console.error('Failed to cleanup codespace:', error);
        }
      }
    }
  }

  /**
   * Lists all active codespaces for the authenticated user
   */
  async listCodespaces(): Promise<CodespaceState[]> {
    const response = await this.octokit.codespaces.listForAuthenticatedUser();

    return response.data.codespaces.map(cs => ({
      id: cs.id,
      name: cs.name,
      state: cs.state as CodespaceState['state'],
      machineType: cs.machine?.name || 'unknown',
      gitStatus: cs.git_status ? {
        ref: cs.git_status.ref || '',
        ahead: cs.git_status.ahead || 0,
        behind: cs.git_status.behind || 0,
      } : undefined,
      webUrl: cs.web_url,
      createdAt: cs.created_at,
      lastUsedAt: cs.last_used_at,
    }));
  }

  /**
   * Stops a running codespace
   */
  async stopCodespace(codespaceId: number): Promise<void> {
    const codespaceName = await this.getCodespaceName(codespaceId);
    await this.octokit.codespaces.stopForAuthenticatedUser({
      codespace_name: codespaceName,
    });
  }

  /**
   * Starts a stopped codespace
   */
  async startCodespace(codespaceId: number): Promise<void> {
    const codespaceName = await this.getCodespaceName(codespaceId);
    await this.octokit.codespaces.startForAuthenticatedUser({
      codespace_name: codespaceName,
    });
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a new CodespaceWorker instance
 */
export function createCodespaceWorker(config: {
  token?: string;
  owner: string;
  repo: string;
}): CodespaceWorker {
  return new CodespaceWorker(config);
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default codespace worker configuration
 */
export const DEFAULT_CODESPACE_CONFIG: CodespaceWorkerConfig = {
  machine: 'standardLinux32gb',
  timeout: 60,
  agenticFlowRepo: 'ruvnet/agentic-flow',
  agenticFlowVersion: 'latest',
  idleTimeoutMinutes: 30,
  retentionPeriodMinutes: 0,
};

export default CodespaceWorker;
