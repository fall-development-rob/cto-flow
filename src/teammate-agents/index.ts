/**
 * Teammate-Driven Agent Management System - Main Index
 *
 * Provides the TeammateManager facade and exports all public components
 * for the Teammate-Driven Agent Management system integrated with claude-flow.
 *
 * @module teammate-agents
 */

// ===== CORE TYPE EXPORTS =====
export type {
  // Epic State Machine Types
  EpicState,
  TeammateConfig,
  CreateEpicParams,
  CreateTaskParams,
  CreateADRParams,
  StateTransitionParams,
  AssignAgentParams,
  EpicQueryFilter,
  TaskQueryFilter,
  ScoringContext,
  PerformanceMetrics,
  EpicStatistics,
  ValidationResult,
  EpicEventType,
  EpicEvent,

  // Core Epic Types
  Task,
  Assignment,
  AgentPerformance,
  AgentScore,
  AgentProfile,
  ADR,
  ProjectContext,
  BlockingReason,
  EpicContext,
  TaskPriority,
  TaskStatus,
  AgentAvailability,
  ADRStatus,

  // Config Types
  ConfigValidationResult,
} from './core/types';

// Export core constants
export {
  EPIC_STATE_TRANSITIONS,
  DEFAULT_SCORING_WEIGHTS,
  MINIMUM_SCORE_THRESHOLD,
  DEFAULT_TEAMMATE_CONFIG,
  isValidStateTransition,
  meetsScoreThreshold,
  calculateTotalScore,
  validateScoringWeights,
} from './core/types';

// Export EpicState enum directly
export { EpicState } from './core/types';

// ===== CORE CLASS EXPORTS =====
export { EpicStateMachine } from './core/epic-state-machine';
export type {
  TransitionMetadata,
  StateTransition,
  GuardFunction,
  TransitionHook,
  StateMachineConfig
} from './core/epic-state-machine';

export {
  TeammateConfigManager,
  DEFAULT_CONFIG,
  isTeammateModeEnabled,
  isGitHubConfigured,
  canUseTeammateMode,
  validateConfig,
  getConfig,
  loadConfig,
  getConfigManager,
} from './core/config-manager';

export {
  EpicMemoryManager,
  createEpicMemoryManager,
  EPIC_NAMESPACES,
  TTL_PRESETS,
} from './memory/epic-memory-manager';

export type {
  MemoryOptions,
  EpicMemoryConfig,
  ArchitecturalDecision,
  Alternative,
  TaskProgress,
  Checkpoint,
  AgentAssignment,
  SyncState,
  SyncConflict,
  Milestone,
} from './memory/epic-memory-manager';

// ===== IMPORTS FOR TEAMMATE MANAGER =====
import { EpicState, type TeammateConfig as CoreTeammateConfig, type EpicContext, type Assignment, type AgentScore, type CreateEpicParams, type EpicQueryFilter, DEFAULT_TEAMMATE_CONFIG } from './core/types';
import { EpicStateMachine } from './core/epic-state-machine';
import { TeammateConfigManager } from './core/config-manager';
import { EpicMemoryManager } from './memory/epic-memory-manager';
import { randomUUID } from 'crypto';

// ===== TEAMMATE MANAGER TYPES =====

/**
 * Epic simplified interface for external use
 */
export interface Epic {
  id: string;
  epicId: string;
  name: string;
  description: string;
  state: EpicState;
  createdAt: Date;
  updatedAt: Date;
  url?: string;
  issueNumber?: number;
  metadata: Record<string, unknown>;
}

/**
 * Epic creation options
 */
export interface EpicOptions {
  metadata?: Record<string, unknown>;
  labels?: string[];
  issueNumber?: number;
}

/**
 * Epic filter options
 */
export interface EpicFilter {
  state?: EpicState | EpicState[];
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Epic sync result
 */
export interface SyncResult {
  success: boolean;
  epicId: string;
  synced: boolean;
  conflicts?: number;
  error?: string;
  timestamp: Date;
}

/**
 * SPARC specification interface (simplified)
 */
export interface SparcSpecification {
  title: string;
  description: string;
  requirements: string[];
  constraints: string[];
  technicalStack?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Epic export result from SPARC spec
 */
export interface EpicExportResult {
  success: boolean;
  epicId: string;
  epic: Epic;
  tasksCreated: number;
  error?: string;
}

// ===== TEAMMATE MANAGER CLASS =====

/**
 * TeammateManager - Main facade for Teammate-Driven Agent Management
 *
 * Provides high-level API for:
 * - Epic lifecycle management
 * - Agent work assignment
 * - Context persistence and restoration
 * - SPARC integration
 */
export class TeammateManager {
  private configManager: TeammateConfigManager;
  private memoryManager: EpicMemoryManager;
  private stateMachines: Map<string, EpicStateMachine> = new Map();
  private epics: Map<string, Epic> = new Map();
  private initialized = false;

  /**
   * Creates a new TeammateManager instance
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<CoreTeammateConfig>) {
    this.configManager = TeammateConfigManager.getInstance();
    this.memoryManager = new EpicMemoryManager();

    if (config) {
      this.configManager.loadConfig(config);
    }
  }

  // ===== INITIALIZATION =====

  /**
   * Initialize the TeammateManager
   *
   * @param config - Optional configuration overrides
   */
  async initialize(config?: Partial<CoreTeammateConfig>): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load configuration
    if (config) {
      this.configManager.loadConfig(config);
    } else {
      this.configManager.loadConfig();
    }

    // Validate configuration
    const validation = this.configManager.validateConfig();
    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    // Initialize memory manager
    await this.memoryManager.initialize();

    this.initialized = true;
  }

  /**
   * Check if Teammate mode is enabled
   */
  isEnabled(): boolean {
    return this.configManager.isTeammateModeEnabled();
  }

  /**
   * Check if Teammate mode can be used (enabled AND configured)
   */
  canUse(): boolean {
    return this.configManager.canUseTeammateMode();
  }

  // ===== EPIC OPERATIONS =====

  /**
   * Create a new epic
   *
   * @param title - Epic title
   * @param options - Epic creation options
   * @returns Created epic
   */
  async createEpic(title: string, options?: EpicOptions): Promise<Epic> {
    if (!this.initialized) {
      await this.initialize();
    }

    const epicId = `epic-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const now = new Date();

    const epic: Epic = {
      id: epicId,
      epicId,
      name: title,
      description: options?.metadata?.description as string || '',
      state: EpicState.UNINITIALIZED,
      createdAt: now,
      updatedAt: now,
      issueNumber: options?.issueNumber,
      metadata: options?.metadata || {},
    };

    // Create state machine for epic
    const stateMachine = new EpicStateMachine({
      initialState: EpicState.UNINITIALIZED,
    });

    this.stateMachines.set(epicId, stateMachine);
    this.epics.set(epicId, epic);

    // Store in memory
    const epicContext: EpicContext = {
      epicId,
      name: title,
      description: epic.description,
      state: EpicState.UNINITIALIZED,
      projectContext: {
        goals: [],
        constraints: [],
        decisions: [],
        technicalStack: [],
        requirements: [],
        stakeholders: [],
        metadata: {},
      },
      tasks: new Map(),
      assignments: new Map(),
      adrs: new Map(),
      agents: new Map(),
      stateHistory: [],
      blockingReasons: [],
      createdAt: now,
      updatedAt: now,
      metadata: options?.metadata || {},
    };

    await this.memoryManager.storeEpicContext(epicContext);

    // Transition to ACTIVE state
    await stateMachine.transition(
      EpicState.ACTIVE,
      {
        reason: 'Epic created',
        triggeredBy: 'system',
      },
      {}
    );

    epic.state = EpicState.ACTIVE;
    epic.updatedAt = new Date();

    // Update in memory
    epicContext.state = EpicState.ACTIVE;
    epicContext.updatedAt = new Date();
    await this.memoryManager.storeEpicContext(epicContext);

    return epic;
  }

  /**
   * Get an epic by ID
   *
   * @param epicId - Epic identifier
   * @returns Epic or null if not found
   */
  async getEpic(epicId: string): Promise<Epic | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Try to get from memory
    let epic = this.epics.get(epicId);

    if (!epic) {
      // Try to load from memory manager
      const context = await this.memoryManager.loadEpicContext(epicId);
      if (context) {
        epic = {
          id: context.epicId,
          epicId: context.epicId,
          name: context.name,
          description: context.description,
          state: context.state,
          createdAt: context.createdAt,
          updatedAt: context.updatedAt,
          metadata: context.metadata,
        };
        this.epics.set(epicId, epic);
      }
    }

    return epic || null;
  }

  /**
   * List epics with optional filtering
   *
   * @param filter - Optional filter criteria
   * @returns Array of epics
   */
  async listEpics(filter?: EpicFilter): Promise<Epic[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    let epics = Array.from(this.epics.values());

    if (filter) {
      // Filter by state
      if (filter.state) {
        const states = Array.isArray(filter.state) ? filter.state : [filter.state];
        epics = epics.filter(epic => states.includes(epic.state));
      }

      // Filter by creation date
      if (filter.createdAfter) {
        epics = epics.filter(epic => epic.createdAt >= filter.createdAfter!);
      }

      if (filter.createdBefore) {
        epics = epics.filter(epic => epic.createdAt <= filter.createdBefore!);
      }
    }

    return epics.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Sync an epic with GitHub
   *
   * @param epicId - Epic identifier
   * @returns Sync result
   */
  async syncEpic(epicId: string): Promise<SyncResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const epic = await this.getEpic(epicId);
    if (!epic) {
      return {
        success: false,
        epicId,
        synced: false,
        error: 'Epic not found',
        timestamp: new Date(),
      };
    }

    // Get sync state from memory
    const syncState = await this.memoryManager.getSyncState(epicId);

    return {
      success: true,
      epicId,
      synced: syncState?.status === 'synced',
      conflicts: syncState?.conflicts.filter(c => !c.resolved).length || 0,
      timestamp: new Date(),
    };
  }

  // ===== AGENT OPERATIONS =====

  /**
   * Assign work to an agent from epic
   *
   * @param epicId - Epic identifier
   * @param issueNumber - GitHub issue number
   * @returns Assignment or null if not possible
   */
  async assignWork(epicId: string, issueNumber: number): Promise<Assignment | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const epic = await this.getEpic(epicId);
    if (!epic) {
      return null;
    }

    // Load epic context
    const context = await this.memoryManager.loadEpicContext(epicId);
    if (!context) {
      return null;
    }

    // For now, return a placeholder assignment
    // Real implementation would use agent scoring
    const assignment: Assignment = {
      id: randomUUID(),
      taskId: `task-${issueNumber}`,
      agentId: 'placeholder-agent',
      epicId,
      assignedAt: new Date(),
      score: 75,
      status: 'assigned' as any,
    };

    // Store assignment in context
    context.assignments.set(assignment.id, assignment);
    await this.memoryManager.storeEpicContext(context);

    return assignment;
  }

  /**
   * Get all assignments for an epic
   *
   * @param epicId - Epic identifier
   * @returns Array of assignments
   */
  async getAssignments(epicId: string): Promise<Assignment[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const context = await this.memoryManager.loadEpicContext(epicId);
    if (!context) {
      return [];
    }

    return Array.from(context.assignments.values());
  }

  // ===== CONTEXT OPERATIONS =====

  /**
   * Save epic context to memory
   *
   * @param epicId - Epic identifier
   */
  async saveContext(epicId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const epic = await this.getEpic(epicId);
    if (!epic) {
      throw new Error(`Epic ${epicId} not found`);
    }

    const context = await this.memoryManager.loadEpicContext(epicId);
    if (!context) {
      throw new Error(`Epic context ${epicId} not found`);
    }

    // Context is already in memory, just ensure it's up to date
    context.updatedAt = new Date();
    await this.memoryManager.storeEpicContext(context);
  }

  /**
   * Restore epic context from memory
   *
   * @param epicId - Epic identifier
   * @returns Restored epic context
   */
  async restoreContext(epicId: string): Promise<EpicContext> {
    if (!this.initialized) {
      await this.initialize();
    }

    const context = await this.memoryManager.loadEpicContext(epicId);
    if (!context) {
      throw new Error(`Epic context ${epicId} not found`);
    }

    // Restore state machine
    if (!this.stateMachines.has(epicId)) {
      const stateMachine = new EpicStateMachine({
        initialState: context.state,
      });
      this.stateMachines.set(epicId, stateMachine);
    }

    // Restore epic in cache
    const epic: Epic = {
      id: context.epicId,
      epicId: context.epicId,
      name: context.name,
      description: context.description,
      state: context.state,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      metadata: context.metadata,
    };
    this.epics.set(epicId, epic);

    return context;
  }

  /**
   * Clear epic context from memory
   *
   * @param epicId - Epic identifier
   */
  async clearContext(epicId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    await this.memoryManager.deleteEpic(epicId);
    this.epics.delete(epicId);
    this.stateMachines.delete(epicId);
  }

  // ===== SPARC INTEGRATION =====

  /**
   * Export SPARC specification to epic
   *
   * @param spec - SPARC specification
   * @returns Export result
   */
  async exportSpecToEpic(spec: SparcSpecification): Promise<EpicExportResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Create epic from SPARC spec
      const epic = await this.createEpic(spec.title, {
        metadata: {
          description: spec.description,
          source: 'sparc',
          ...spec.metadata,
        },
      });

      // Load context and update with SPARC data
      const context = await this.memoryManager.loadEpicContext(epic.epicId);
      if (context) {
        context.projectContext.requirements = spec.requirements;
        context.projectContext.constraints = spec.constraints;
        context.projectContext.technicalStack = spec.technicalStack || [];
        context.updatedAt = new Date();

        await this.memoryManager.storeEpicContext(context);
      }

      return {
        success: true,
        epicId: epic.epicId,
        epic,
        tasksCreated: 0, // Would create tasks from requirements in full implementation
      };
    } catch (error) {
      return {
        success: false,
        epicId: '',
        epic: {} as Epic,
        tasksCreated: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get statistics for an epic
   *
   * @param epicId - Epic identifier
   */
  async getEpicStats(epicId: string) {
    if (!this.initialized) {
      await this.initialize();
    }

    return await this.memoryManager.getEpicStats(epicId);
  }

  /**
   * Export epic data
   *
   * @param epicId - Epic identifier
   */
  async exportEpic(epicId: string) {
    if (!this.initialized) {
      await this.initialize();
    }

    return await this.memoryManager.exportEpic(epicId);
  }

  /**
   * Shutdown the manager
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await this.memoryManager.shutdown();
    this.stateMachines.clear();
    this.epics.clear();
    this.initialized = false;
  }
}

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Create a TeammateManager instance with optional configuration
 *
 * @param config - Optional configuration overrides
 * @returns Configured TeammateManager instance
 */
export function createTeammateManager(config?: Partial<CoreTeammateConfig>): TeammateManager {
  return new TeammateManager(config);
}

/**
 * Execute an action with Teammate mode if enabled, otherwise use fallback
 *
 * @param action - Action to execute if Teammate mode is enabled
 * @param fallback - Fallback value if Teammate mode is disabled
 * @returns Action result or fallback value
 */
export async function withTeammateMode<T>(
  action: () => Promise<T>,
  fallback: T
): Promise<T> {
  const manager = createTeammateManager();
  await manager.initialize();

  if (manager.canUse()) {
    try {
      return await action();
    } finally {
      await manager.shutdown();
    }
  }

  return fallback;
}

// ===== PLACEHOLDER EXPORTS FOR MISSING COMPONENTS =====

/**
 * Agent Scorer placeholder
 * TODO: Implement full agent scoring system
 */
export class AgentScorer {
  async scoreAgent(agentId: string, taskId: string, context: any): Promise<AgentScore> {
    return {
      agentId,
      taskId,
      totalScore: 75,
      breakdown: {
        capabilityMatch: 80,
        performanceHistory: 75,
        availability: 70,
        specialization: 65,
        experience: 70,
      },
      weights: DEFAULT_TEAMMATE_CONFIG.scoringWeights,
      meetsThreshold: true,
      calculatedAt: new Date(),
      metadata: {},
    };
  }
}

/**
 * Epic Sync Service placeholder
 * TODO: Implement full GitHub sync functionality
 */
export class EpicSyncService {
  async syncToGitHub(epicId: string): Promise<SyncResult> {
    return {
      success: true,
      epicId,
      synced: true,
      timestamp: new Date(),
    };
  }

  async syncFromGitHub(epicId: string): Promise<SyncResult> {
    return {
      success: true,
      epicId,
      synced: true,
      timestamp: new Date(),
    };
  }
}

/**
 * Register epic hooks placeholder
 * TODO: Implement full hooks system
 */
export function registerEpicHooks(): void {
  // Placeholder - hooks would be registered with claude-flow
}

/**
 * Register epic CLI commands placeholder
 * TODO: Implement full CLI integration
 */
export function registerEpicCommands(): void {
  // Placeholder - CLI commands would be registered with commander
}

// ===== DEFAULT EXPORT =====

export default TeammateManager;
