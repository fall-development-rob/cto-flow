/**
 * Worker Mode Configuration Manager
 *
 * Manages configuration for CTO-Flow worker execution modes.
 * Supports local execution, GitHub Codespaces, and hybrid approaches.
 * Configuration priority order:
 * 1. Programmatic overrides (highest)
 * 2. Environment variables
 * 3. Config file (~/.claude-flow/cto-flow/worker-config.json)
 * 4. Defaults (lowest)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Worker execution modes
 */
export type WorkerMode = 'local' | 'codespace' | 'hybrid';

/**
 * GitHub Codespaces machine types
 */
export type CodespaceMachine = 'standardLinux32gb' | 'largePremiumLinux';

/**
 * Task context for determining execution mode
 */
export interface TaskContext {
  labels?: string[];
  complexity?: 'low' | 'medium' | 'high';
  resourceIntensive?: boolean;
  requiresGpu?: boolean;
  estimatedDuration?: number; // in minutes
}

/**
 * Local worker configuration
 */
export interface LocalWorkerConfig {
  maxConcurrentTasks: number;
  useHiveMind: boolean;
  memoryLimit?: number; // in MB
  cpuLimit?: number; // percentage
}

/**
 * Codespace worker configuration
 */
export interface CodespaceWorkerConfig {
  machine: CodespaceMachine;
  timeout: number; // in minutes
  agenticFlowRepo: string;
  branch?: string;
  setupScript?: string;
}

/**
 * Hybrid worker configuration
 */
export interface HybridWorkerConfig {
  useCodespaceForLabels: string[];
  useLocalForLabels: string[];
  defaultMode: 'local' | 'codespace';
  complexityThreshold?: 'medium' | 'high'; // Run in codespace if >= threshold
  durationThreshold?: number; // in minutes - Run in codespace if >= threshold
}

/**
 * Complete worker configuration
 */
export interface WorkerConfig {
  mode: WorkerMode;
  local?: LocalWorkerConfig;
  codespace?: CodespaceWorkerConfig;
  hybrid?: HybridWorkerConfig;
}

/**
 * Configuration validation result
 */
export interface WorkerConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Default configuration values
 */
export const DEFAULT_WORKER_CONFIG: WorkerConfig = {
  mode: 'local',
  local: {
    maxConcurrentTasks: 5,
    useHiveMind: true,
    memoryLimit: 4096, // 4GB
    cpuLimit: 80 // 80%
  },
  codespace: {
    machine: 'standardLinux32gb',
    timeout: 60, // 60 minutes
    agenticFlowRepo: 'ruvnet/agentic-flow',
    branch: 'main'
  },
  hybrid: {
    useCodespaceForLabels: ['gpu-required', 'heavy-compute', 'long-running'],
    useLocalForLabels: ['quick-fix', 'documentation', 'simple'],
    defaultMode: 'local',
    complexityThreshold: 'high',
    durationThreshold: 30 // 30 minutes
  }
};

/**
 * Environment variable mappings
 */
const ENV_VAR_MAPPINGS = {
  'CTOFLOW_WORKER_MODE': 'mode',
  'CTOFLOW_LOCAL_MAX_CONCURRENT': 'local.maxConcurrentTasks',
  'CTOFLOW_LOCAL_USE_HIVEMIND': 'local.useHiveMind',
  'CTOFLOW_LOCAL_MEMORY_LIMIT': 'local.memoryLimit',
  'CTOFLOW_LOCAL_CPU_LIMIT': 'local.cpuLimit',
  'CTOFLOW_CODESPACE_MACHINE': 'codespace.machine',
  'CTOFLOW_CODESPACE_TIMEOUT': 'codespace.timeout',
  'CTOFLOW_CODESPACE_REPO': 'codespace.agenticFlowRepo',
  'CTOFLOW_CODESPACE_BRANCH': 'codespace.branch',
  'CTOFLOW_CODESPACE_SETUP_SCRIPT': 'codespace.setupScript',
  'CTOFLOW_HYBRID_DEFAULT_MODE': 'hybrid.defaultMode',
  'CTOFLOW_HYBRID_COMPLEXITY_THRESHOLD': 'hybrid.complexityThreshold',
  'CTOFLOW_HYBRID_DURATION_THRESHOLD': 'hybrid.durationThreshold'
};

/**
 * Worker Configuration Manager
 *
 * Singleton class that manages worker mode configuration loading,
 * validation, and decision-making for task execution.
 */
export class WorkerConfigManager {
  private static instance: WorkerConfigManager | null = null;
  private config: WorkerConfig;
  private validationResult: WorkerConfigValidationResult | null = null;
  private configFilePath: string | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.config = this.deepClone(DEFAULT_WORKER_CONFIG);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): WorkerConfigManager {
    if (!WorkerConfigManager.instance) {
      WorkerConfigManager.instance = new WorkerConfigManager();
    }
    return WorkerConfigManager.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    WorkerConfigManager.instance = null;
  }

  /**
   * Load configuration from all sources with proper priority
   *
   * @param options - Optional configuration overrides
   * @returns The loaded configuration
   */
  public loadConfig(options: Partial<WorkerConfig> = {}): WorkerConfig {
    // Start with defaults
    this.config = this.deepClone(DEFAULT_WORKER_CONFIG);

    // Load from config file if it exists
    this.loadFromConfigFile();

    // Load from environment variables
    this.loadFromEnvironment();

    // Apply programmatic overrides (highest priority)
    this.applyOverrides(options);

    // Validate the final configuration
    this.validationResult = this.validateConfig();

    return this.getWorkerConfig();
  }

  /**
   * Get the current worker configuration
   */
  public getWorkerConfig(): WorkerConfig {
    return this.deepClone(this.config);
  }

  /**
   * Get the validation result for the current configuration
   */
  public getValidationResult(): WorkerConfigValidationResult | null {
    return this.validationResult;
  }

  /**
   * Set worker mode
   *
   * @param mode - The worker mode to set
   * @returns Updated configuration
   */
  public setWorkerMode(mode: WorkerMode): WorkerConfig {
    this.config.mode = mode;
    this.validationResult = this.validateConfig();
    return this.getWorkerConfig();
  }

  /**
   * Determine if a task should use Codespace based on configuration
   *
   * @param task - Task context containing labels, complexity, etc.
   * @returns true if task should use Codespace, false for local execution
   */
  public shouldUseCodespace(task: TaskContext): boolean {
    const mode = this.config.mode;

    // Force local mode
    if (mode === 'local') {
      return false;
    }

    // Force codespace mode
    if (mode === 'codespace') {
      return true;
    }

    // Hybrid mode - intelligent decision
    if (mode === 'hybrid' && this.config.hybrid) {
      const hybrid = this.config.hybrid;

      // Check labels first (highest priority)
      if (task.labels && task.labels.length > 0) {
        // If any label matches codespace labels, use codespace
        if (task.labels.some(label => hybrid.useCodespaceForLabels.includes(label))) {
          return true;
        }
        // If any label matches local labels, use local
        if (task.labels.some(label => hybrid.useLocalForLabels.includes(label))) {
          return false;
        }
      }

      // Check GPU requirement
      if (task.requiresGpu === true) {
        return true; // Always use codespace for GPU tasks
      }

      // Check complexity threshold
      if (task.complexity && hybrid.complexityThreshold) {
        const complexityOrder = { low: 0, medium: 1, high: 2 };
        const taskComplexity = complexityOrder[task.complexity];
        const threshold = complexityOrder[hybrid.complexityThreshold];
        if (taskComplexity >= threshold) {
          return true;
        }
      }

      // Check duration threshold
      if (task.estimatedDuration !== undefined && hybrid.durationThreshold !== undefined) {
        if (task.estimatedDuration >= hybrid.durationThreshold) {
          return true;
        }
      }

      // Check resource intensive flag
      if (task.resourceIntensive === true) {
        return true;
      }

      // Fall back to default mode
      return hybrid.defaultMode === 'codespace';
    }

    // Default to local if mode is unclear
    return false;
  }

  /**
   * Get default configuration
   */
  public getDefaultConfig(): WorkerConfig {
    return this.deepClone(DEFAULT_WORKER_CONFIG);
  }

  /**
   * Validate the current configuration
   *
   * @returns Validation result with errors and warnings
   */
  public validateConfig(): WorkerConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate mode
    const validModes: WorkerMode[] = ['local', 'codespace', 'hybrid'];
    if (!validModes.includes(this.config.mode)) {
      errors.push(`Invalid worker mode: ${this.config.mode}. Must be one of: ${validModes.join(', ')}`);
    }

    // Validate local config
    if (this.config.local) {
      const local = this.config.local;

      if (typeof local.maxConcurrentTasks !== 'number' || local.maxConcurrentTasks < 1) {
        errors.push('local.maxConcurrentTasks must be a number >= 1');
      }

      if (local.maxConcurrentTasks > 20) {
        warnings.push('local.maxConcurrentTasks > 20 may cause resource exhaustion');
      }

      if (typeof local.useHiveMind !== 'boolean') {
        errors.push('local.useHiveMind must be a boolean');
      }

      if (local.memoryLimit !== undefined) {
        if (typeof local.memoryLimit !== 'number' || local.memoryLimit < 512) {
          errors.push('local.memoryLimit must be a number >= 512 MB');
        }
        if (local.memoryLimit < 2048) {
          warnings.push('local.memoryLimit < 2048 MB may cause memory issues');
        }
      }

      if (local.cpuLimit !== undefined) {
        if (typeof local.cpuLimit !== 'number' || local.cpuLimit < 1 || local.cpuLimit > 100) {
          errors.push('local.cpuLimit must be a number between 1 and 100');
        }
      }
    }

    // Validate codespace config
    if (this.config.codespace) {
      const codespace = this.config.codespace;

      const validMachines: CodespaceMachine[] = ['standardLinux32gb', 'largePremiumLinux'];
      if (!validMachines.includes(codespace.machine)) {
        errors.push(`Invalid codespace machine: ${codespace.machine}. Must be one of: ${validMachines.join(', ')}`);
      }

      if (typeof codespace.timeout !== 'number' || codespace.timeout < 1) {
        errors.push('codespace.timeout must be a number >= 1 minute');
      }

      if (codespace.timeout > 240) {
        warnings.push('codespace.timeout > 240 minutes (4 hours) may incur high costs');
      }

      if (!codespace.agenticFlowRepo || codespace.agenticFlowRepo.trim() === '') {
        errors.push('codespace.agenticFlowRepo is required');
      }

      if (codespace.agenticFlowRepo && !codespace.agenticFlowRepo.includes('/')) {
        errors.push('codespace.agenticFlowRepo must be in format "owner/repo"');
      }
    }

    // Validate hybrid config
    if (this.config.hybrid) {
      const hybrid = this.config.hybrid;

      if (!Array.isArray(hybrid.useCodespaceForLabels)) {
        errors.push('hybrid.useCodespaceForLabels must be an array');
      }

      if (!Array.isArray(hybrid.useLocalForLabels)) {
        errors.push('hybrid.useLocalForLabels must be an array');
      }

      const validDefaultModes: ('local' | 'codespace')[] = ['local', 'codespace'];
      if (!validDefaultModes.includes(hybrid.defaultMode)) {
        errors.push(`Invalid hybrid.defaultMode: ${hybrid.defaultMode}. Must be 'local' or 'codespace'`);
      }

      if (hybrid.complexityThreshold !== undefined) {
        const validThresholds: ('medium' | 'high')[] = ['medium', 'high'];
        if (!validThresholds.includes(hybrid.complexityThreshold)) {
          errors.push(`Invalid hybrid.complexityThreshold: ${hybrid.complexityThreshold}. Must be 'medium' or 'high'`);
        }
      }

      if (hybrid.durationThreshold !== undefined) {
        if (typeof hybrid.durationThreshold !== 'number' || hybrid.durationThreshold < 1) {
          errors.push('hybrid.durationThreshold must be a number >= 1 minute');
        }
      }

      // Check for label conflicts
      const labelIntersection = hybrid.useCodespaceForLabels.filter(
        label => hybrid.useLocalForLabels.includes(label)
      );
      if (labelIntersection.length > 0) {
        warnings.push(`Labels appear in both codespace and local lists: ${labelIntersection.join(', ')}`);
      }
    }

    // Mode-specific validations
    if (this.config.mode === 'local' && !this.config.local) {
      errors.push('local configuration is required when mode is "local"');
    }

    if (this.config.mode === 'codespace' && !this.config.codespace) {
      errors.push('codespace configuration is required when mode is "codespace"');
    }

    if (this.config.mode === 'hybrid' && !this.config.hybrid) {
      errors.push('hybrid configuration is required when mode is "hybrid"');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Load configuration from config file
   * Searches in ~/.claude-flow/cto-flow/worker-config.json
   */
  private loadFromConfigFile(): void {
    const homeDir = os.homedir();
    const configPath = path.join(homeDir, '.claude-flow', 'cto-flow', 'worker-config.json');

    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent);
        this.mergeConfig(fileConfig);
        this.configFilePath = configPath;
      } catch (error) {
        // Silently continue if file cannot be read or parsed
        // Validation will catch issues later
      }
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    for (const [envVar, configPath] of Object.entries(ENV_VAR_MAPPINGS)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        this.setNestedValue(this.config, configPath, this.parseEnvValue(value));
      }
    }

    // Handle array environment variables
    const codespaceLabels = process.env.CTOFLOW_HYBRID_CODESPACE_LABELS;
    if (codespaceLabels && this.config.hybrid) {
      this.config.hybrid.useCodespaceForLabels = codespaceLabels.split(',').map(l => l.trim());
    }

    const localLabels = process.env.CTOFLOW_HYBRID_LOCAL_LABELS;
    if (localLabels && this.config.hybrid) {
      this.config.hybrid.useLocalForLabels = localLabels.split(',').map(l => l.trim());
    }
  }

  /**
   * Parse environment variable value to appropriate type
   */
  private parseEnvValue(value: string): any {
    // Boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Number values
    const numValue = Number(value);
    if (!isNaN(numValue)) return numValue;

    // String values
    return value;
  }

  /**
   * Apply configuration overrides
   */
  private applyOverrides(overrides: Partial<WorkerConfig>): void {
    this.mergeConfig(overrides);
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfig(source: any, target: any = this.config): void {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) {
            target[key] = {};
          }
          this.mergeConfig(source[key], target[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  /**
   * Set a nested value using dot notation path
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Deep clone an object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Get the path to the loaded config file (if any)
   */
  public getConfigFilePath(): string | null {
    return this.configFilePath;
  }

  /**
   * Export current configuration to a file
   *
   * @param filePath - Path to write the configuration file
   */
  public exportConfig(filePath?: string): void {
    const targetPath = filePath || path.join(
      os.homedir(),
      '.claude-flow',
      'cto-flow',
      'worker-config.json'
    );

    const configDir = path.dirname(targetPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, JSON.stringify(this.config, null, 2), 'utf-8');
    this.configFilePath = targetPath;
  }
}

/**
 * Utility function: Get current worker configuration
 */
export function getWorkerConfig(): WorkerConfig {
  return WorkerConfigManager.getInstance().getWorkerConfig();
}

/**
 * Utility function: Set worker mode
 */
export function setWorkerMode(mode: WorkerMode): WorkerConfig {
  return WorkerConfigManager.getInstance().setWorkerMode(mode);
}

/**
 * Utility function: Determine if task should use Codespace
 */
export function shouldUseCodespace(task: TaskContext): boolean {
  return WorkerConfigManager.getInstance().shouldUseCodespace(task);
}

/**
 * Utility function: Get default worker configuration
 */
export function getDefaultConfig(): WorkerConfig {
  return WorkerConfigManager.getInstance().getDefaultConfig();
}

/**
 * Utility function: Validate worker configuration
 */
export function validateWorkerConfig(): WorkerConfigValidationResult {
  return WorkerConfigManager.getInstance().validateConfig();
}

/**
 * Utility function: Load configuration with options
 */
export function loadWorkerConfig(options: Partial<WorkerConfig> = {}): WorkerConfig {
  return WorkerConfigManager.getInstance().loadConfig(options);
}

/**
 * Export the singleton instance getter for advanced usage
 */
export function getWorkerConfigManager(): WorkerConfigManager {
  return WorkerConfigManager.getInstance();
}
