/**
 * Post-SPARC Hook for CTO-Flow Agent Management
 *
 * Automatically triggers when SPARC planning completes and converts the output
 * into a GitHub Epic with structured task issues.
 *
 * Features:
 * - Detects SPARC completion via hooks system
 * - Parses SPARC output (specification, pseudocode, architecture phases)
 * - Extracts epic title, task breakdown, acceptance criteria, and dependencies
 * - Creates GitHub Epic issue with child task issues
 * - Sets task statuses based on dependencies (Ready vs Blocked)
 * - Handles errors gracefully with detailed logging
 *
 * Integration:
 * - Registers with agentic-flow-hooks system
 * - Works with CtoFlowManager for GitHub operations
 * - Uses EpicMemoryManager for context persistence
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
import { canUseCtoFlowMode, getConfig as getCtoFlowConfig } from '../core/config-manager.js';
import { CtoFlowManager } from '../index.js';
import type { Epic } from '../index.js';

const logger = new Logger({
  level: 'info',
  format: 'text',
  destination: 'console'
}, { prefix: 'PostSparcHook' });

// ===== SPARC OUTPUT TYPES =====

/**
 * Parsed SPARC output structure
 */
export interface SparcOutput {
  // Epic metadata
  epicTitle: string;
  epicDescription: string;

  // SPARC phases
  specification?: SparcSpecification;
  pseudocode?: SparcPseudocode;
  architecture?: SparcArchitecture;
  refinement?: SparcRefinement;

  // Metadata
  completedPhases: string[];
  timestamp: Date;
  rawOutput?: string;
}

/**
 * SPARC Specification phase output
 */
export interface SparcSpecification {
  requirements: string[];
  userStories: string[];
  acceptanceCriteria: string[];
  constraints: string[];
  technicalStack?: string[];
  designNotes?: string;
}

/**
 * SPARC Pseudocode phase output
 */
export interface SparcPseudocode {
  algorithms: Array<{
    name: string;
    description: string;
    steps: string[];
  }>;
  dataStructures: string[];
  interfaces: string[];
}

/**
 * SPARC Architecture phase output
 */
export interface SparcArchitecture {
  components: Array<{
    name: string;
    description: string;
    dependencies: string[];
    priority: 'high' | 'medium' | 'low';
  }>;
  integrationPoints: string[];
  deploymentStrategy?: string;
}

/**
 * SPARC Refinement phase output
 */
export interface SparcRefinement {
  implementationSteps: Array<{
    task: string;
    description: string;
    acceptanceCriteria: string[];
    dependencies: string[];
    estimatedEffort?: string;
  }>;
  testingStrategy?: string;
  performanceTargets?: string[];
}

/**
 * Created task reference
 */
export interface CreatedTask {
  issueNumber: number;
  title: string;
  status: 'ready' | 'blocked';
  dependencies: string[];
  url: string;
}

/**
 * Post-SPARC hook payload
 */
export interface PostSparcPayload extends HookPayload {
  sparcOutput: SparcOutput;
  generateEpic?: boolean;
  repo?: string;
  autoCreateTasks?: boolean;
}

// ===== POST-SPARC HOOK CLASS =====

/**
 * Post-SPARC Hook
 *
 * Executes after SPARC planning completes:
 * - Parses SPARC output from all completed phases
 * - Creates GitHub Epic with metadata from specification
 * - Generates child task issues from architecture and refinement
 * - Sets task dependencies and statuses automatically
 * - Updates epic context in memory
 *
 * Conditional execution: Only runs when:
 * 1. CTO-Flow mode is enabled
 * 2. SPARC output is available
 * 3. generateEpic flag is set to true (default: true)
 */
export class PostSparcHook {
  private manager: CtoFlowManager | null = null;

  /**
   * Initialize CtoFlowManager lazily
   */
  private async getManager(): Promise<CtoFlowManager> {
    if (!this.manager) {
      const config = getCtoFlowConfig();
      this.manager = new CtoFlowManager(config);
      await this.manager.initialize();
    }
    return this.manager;
  }

  /**
   * Create hook handler
   */
  createHandler(): HookHandler {
    return async (payload: HookPayload, context: AgenticHookContext): Promise<HookHandlerResult> => {
      // Check if CTO-Flow mode is enabled
      if (!canUseCtoFlowMode()) {
        logger.debug('CTO-Flow mode disabled, skipping post-SPARC hook');
        return {
          continue: true,
          modified: false,
        };
      }

      const sparcPayload = payload as PostSparcPayload;

      // Check if epic generation is requested (default: true)
      const generateEpic = sparcPayload.generateEpic !== false;
      if (!generateEpic) {
        logger.debug('Epic generation not requested, skipping');
        return {
          continue: true,
          modified: false,
        };
      }

      // Validate SPARC output is provided
      if (!sparcPayload.sparcOutput) {
        logger.warn('Post-SPARC hook called without SPARC output');
        return {
          continue: true,
          modified: false,
          metadata: {
            warning: 'No SPARC output provided',
          },
        };
      }

      // Validate repo is configured or provided
      const config = getCtoFlowConfig();
      const repo = sparcPayload.repo ||
        (config?.github?.owner && config?.github?.repo
          ? `${config.github.owner}/${config.github.repo}`
          : null);

      if (!repo) {
        logger.warn('Epic generation requested but no repository configured');
        return {
          continue: true,
          modified: false,
          metadata: {
            warning: 'Epic generation skipped: no repository configured',
          },
        };
      }

      logger.info(`Post-SPARC hook: generating epic from SPARC output`);

      try {
        const sideEffects: SideEffect[] = [];

        // Get CtoFlowManager
        const manager = await this.getManager();

        // Parse and validate SPARC output
        const sparcOutput = sparcPayload.sparcOutput;
        const validationResult = this.validateSparcOutput(sparcOutput);

        if (!validationResult.valid) {
          logger.warn(`SPARC output validation failed: ${validationResult.errors.join(', ')}`);
          return {
            continue: true,
            modified: false,
            metadata: {
              warning: 'SPARC output validation failed',
              errors: validationResult.errors,
            },
          };
        }

        // Create epic from SPARC output
        const epicResult = await this.createEpicFromSparc(manager, sparcOutput, repo);

        logger.info(`Epic created: ${epicResult.epic.url}`);
        logger.info(`Created ${epicResult.tasks.length} task issues`);

        // Store epic reference in memory
        sideEffects.push({
          type: 'memory',
          action: 'store',
          data: {
            namespace: 'sparc:epic-refs',
            key: epicResult.epic.epicId,
            value: {
              epicId: epicResult.epic.epicId,
              epicUrl: epicResult.epic.url,
              epicNumber: epicResult.epic.issueNumber,
              tasks: epicResult.tasks,
              sparcPhases: sparcOutput.completedPhases,
              createdAt: new Date(),
            },
          },
        });

        // Track epic generation metric
        sideEffects.push({
          type: 'metric',
          action: 'increment',
          data: {
            name: 'epic.generated.from_sparc',
            value: 1,
          },
        });

        sideEffects.push({
          type: 'metric',
          action: 'update',
          data: {
            name: 'epic.tasks.created',
            value: epicResult.tasks.length,
          },
        });

        // Send notification
        sideEffects.push({
          type: 'notification',
          action: 'send',
          data: {
            title: 'Epic Generated from SPARC Planning',
            message: `Epic "${sparcOutput.epicTitle}" created with ${epicResult.tasks.length} tasks`,
            severity: 'info',
            link: epicResult.epic.url,
          },
        });

        // Log epic creation
        sideEffects.push({
          type: 'log',
          action: 'info',
          data: {
            level: 'info',
            message: `Epic generated from SPARC: ${sparcOutput.epicTitle}`,
            data: {
              epicId: epicResult.epic.epicId,
              epicUrl: epicResult.epic.url,
              tasksCreated: epicResult.tasks.length,
              phases: sparcOutput.completedPhases,
            },
          },
        });

        return {
          continue: true,
          modified: true,
          payload: {
            ...sparcPayload,
            epicGenerated: true,
            epicResult,
          },
          sideEffects,
          metadata: {
            teammateMode: true,
            epicGenerated: true,
            epicId: epicResult.epic.epicId,
            epicUrl: epicResult.epic.url,
            tasksCreated: epicResult.tasks.length,
          },
        };

      } catch (error) {
        logger.error('Post-SPARC hook failed', error);

        // Track failure metric
        const sideEffects: SideEffect[] = [{
          type: 'metric',
          action: 'increment',
          data: {
            name: 'epic.generated.failure',
            value: 1,
          },
        }];

        return {
          continue: true,
          modified: false,
          sideEffects,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
            sparcTitle: sparcPayload.sparcOutput?.epicTitle,
          },
        };
      }
    };
  }

  /**
   * Validate SPARC output structure
   */
  private validateSparcOutput(output: SparcOutput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!output.epicTitle || output.epicTitle.trim().length === 0) {
      errors.push('Epic title is required');
    }

    if (!output.completedPhases || output.completedPhases.length === 0) {
      errors.push('At least one SPARC phase must be completed');
    }

    // Validate at least specification or architecture is present
    if (!output.specification && !output.architecture) {
      errors.push('Either specification or architecture phase must be completed');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create GitHub Epic from SPARC output
   */
  private async createEpicFromSparc(
    manager: CtoFlowManager,
    sparcOutput: SparcOutput,
    repo: string
  ): Promise<{
    epic: Epic;
    tasks: CreatedTask[];
  }> {
    // Create epic
    const epic = await manager.createEpic(sparcOutput.epicTitle, {
      metadata: {
        description: sparcOutput.epicDescription,
        source: 'sparc',
        completedPhases: sparcOutput.completedPhases,
        specification: sparcOutput.specification,
        architecture: sparcOutput.architecture,
        timestamp: sparcOutput.timestamp,
      },
    });

    logger.info(`Created epic: ${epic.epicId}`);

    // Extract tasks from SPARC phases
    const taskDefinitions = this.extractTasksFromSparc(sparcOutput);
    logger.info(`Extracted ${taskDefinitions.length} tasks from SPARC output`);

    // Create task issues
    const createdTasks: CreatedTask[] = [];
    const taskMap = new Map<string, CreatedTask>();

    for (const taskDef of taskDefinitions) {
      try {
        // Determine if task is blocked by dependencies
        const blockedByDeps = taskDef.dependencies.some(dep => {
          const depTask = taskMap.get(dep);
          return !depTask || depTask.status === 'blocked';
        });

        const taskStatus = blockedByDeps ? 'blocked' : 'ready';

        // Create task issue via CtoFlowManager
        const projectBridge = manager.getProjectBridge();
        if (!projectBridge) {
          logger.warn('GitHub Projects not configured, skipping task creation');
          continue;
        }

        const result = await manager.createEpicTask(
          epic.epicId,
          taskDef.title,
          this.formatTaskDescription(taskDef),
          {
            labels: [taskStatus, taskDef.priority, ...taskDef.dependencies],
            priority: taskDef.priority,
          }
        );

        if (result) {
          const createdTask: CreatedTask = {
            issueNumber: result.issueNumber,
            title: taskDef.title,
            status: taskStatus,
            dependencies: taskDef.dependencies,
            url: `https://github.com/${repo}/issues/${result.issueNumber}`,
          };

          createdTasks.push(createdTask);
          taskMap.set(taskDef.title, createdTask);

          logger.info(`Created task #${result.issueNumber}: ${taskDef.title} (${taskStatus})`);
        }
      } catch (error) {
        logger.error(`Failed to create task: ${taskDef.title}`, error);
      }
    }

    return {
      epic,
      tasks: createdTasks,
    };
  }

  /**
   * Extract task definitions from SPARC output
   */
  private extractTasksFromSparc(sparcOutput: SparcOutput): Array<{
    title: string;
    description: string;
    acceptanceCriteria: string[];
    dependencies: string[];
    priority: 'high' | 'medium' | 'low';
  }> {
    const tasks: Array<{
      title: string;
      description: string;
      acceptanceCriteria: string[];
      dependencies: string[];
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // Extract from architecture phase (components become tasks)
    if (sparcOutput.architecture) {
      for (const component of sparcOutput.architecture.components) {
        tasks.push({
          title: `Implement ${component.name}`,
          description: component.description,
          acceptanceCriteria: [
            `${component.name} is fully implemented`,
            'All unit tests pass',
            'Documentation is complete',
          ],
          dependencies: component.dependencies,
          priority: component.priority,
        });
      }
    }

    // Extract from refinement phase (implementation steps become tasks)
    if (sparcOutput.refinement) {
      for (const step of sparcOutput.refinement.implementationSteps) {
        tasks.push({
          title: step.task,
          description: step.description,
          acceptanceCriteria: step.acceptanceCriteria,
          dependencies: step.dependencies,
          priority: 'medium', // Default priority for refinement tasks
        });
      }
    }

    // If no tasks from architecture/refinement, create from specification
    if (tasks.length === 0 && sparcOutput.specification) {
      for (const requirement of sparcOutput.specification.requirements) {
        tasks.push({
          title: requirement,
          description: `Implement: ${requirement}`,
          acceptanceCriteria: sparcOutput.specification.acceptanceCriteria,
          dependencies: [],
          priority: 'medium',
        });
      }
    }

    return tasks;
  }

  /**
   * Format task description with acceptance criteria
   */
  private formatTaskDescription(taskDef: {
    description: string;
    acceptanceCriteria: string[];
    dependencies: string[];
  }): string {
    let description = taskDef.description;

    if (taskDef.acceptanceCriteria.length > 0) {
      description += '\n\n## Acceptance Criteria\n';
      for (const criteria of taskDef.acceptanceCriteria) {
        description += `- [ ] ${criteria}\n`;
      }
    }

    if (taskDef.dependencies.length > 0) {
      description += '\n\n## Dependencies\n';
      for (const dep of taskDef.dependencies) {
        description += `- ${dep}\n`;
      }
    }

    return description;
  }

  /**
   * Register this hook with the agentic hook manager
   */
  register(): void {
    const registration: HookRegistration = {
      id: 'post-sparc-epic-generator',
      type: 'workflow-complete',
      handler: this.createHandler(),
      priority: 85, // High priority - runs early after SPARC completion
      filter: {
        patterns: [/^sparc:complete/, /^sparc-planning-complete/],
      },
      options: {
        async: true,
        timeout: 180000, // 3 minute timeout for GitHub API operations
        retries: 2,
        errorHandler: (error: Error) => {
          logger.error('SPARC epic generation failed, continuing workflow', error);
        },
      },
    };

    agenticHookManager.register(registration);
    logger.info('Registered post-SPARC hook');
  }

  /**
   * Unregister this hook from the agentic hook manager
   */
  unregister(): void {
    agenticHookManager.unregister('post-sparc-epic-generator');
    logger.info('Unregistered post-SPARC hook');
  }
}

// ===== HOOK REGISTRATION FUNCTIONS =====

/**
 * Register the post-SPARC hook with the agentic hook manager
 *
 * This function should be called during claude-flow initialization
 * to enable automatic epic generation from SPARC planning.
 *
 * The hook checks canUseCtoFlowMode() internally and gracefully
 * no-ops when CTO-Flow mode is disabled.
 */
export function registerPostSparcHook(): void {
  logger.info('Registering post-SPARC hook...');

  try {
    const hook = new PostSparcHook();
    hook.register();

    logger.info('Successfully registered post-SPARC hook');
  } catch (error) {
    logger.error('Failed to register post-SPARC hook', error);
    throw error;
  }
}

/**
 * Unregister the post-SPARC hook from the agentic hook manager
 *
 * Useful for testing or when disabling CTO-Flow mode at runtime
 */
export function unregisterPostSparcHook(): void {
  logger.info('Unregistering post-SPARC hook...');

  try {
    const hook = new PostSparcHook();
    hook.unregister();

    logger.info('Successfully unregistered post-SPARC hook');
  } catch (error) {
    logger.error('Failed to unregister post-SPARC hook', error);
  }
}

/**
 * Manually trigger SPARC epic generation
 *
 * This function allows manual invocation of the hook for testing
 * or when SPARC output is generated outside the normal hook flow.
 *
 * @param sparcOutput - Parsed SPARC output
 * @param options - Optional configuration
 * @returns Created epic and tasks
 */
export async function handleSparcComplete(
  sparcOutput: SparcOutput,
  options?: {
    repo?: string;
    autoCreateTasks?: boolean;
  }
): Promise<{
  epic: Epic;
  tasks: CreatedTask[];
}> {
  logger.info('Manually handling SPARC completion...');

  // Validate CTO-Flow mode is enabled
  if (!canUseCtoFlowMode()) {
    throw new Error('CTO-Flow mode is not enabled');
  }

  // Get repository from options or config
  const config = getCtoFlowConfig();
  const repo = options?.repo ||
    (config?.github?.owner && config?.github?.repo
      ? `${config.github.owner}/${config.github.repo}`
      : null);

  if (!repo) {
    throw new Error('Repository not configured');
  }

  // Create hook instance and generate epic
  const hook = new PostSparcHook();
  const manager = await hook['getManager'](); // Access private method for manual invocation

  return await hook['createEpicFromSparc'](manager, sparcOutput, repo);
}

// Export hook class and types
export { PostSparcHook as default };
