# Teammate-Driven Agent Management: Optional Configuration

## Overview

Teammate-Driven Agent Management (TDAM) is designed as an **optional enhancement** to claude-flow. This document specifies how the feature can be enabled, disabled, and how the system gracefully degrades when the feature is off.

## Design Principle: Optional by Default

TDAM follows the principle of **progressive enhancement**:
- Claude-flow works fully without TDAM
- TDAM adds capabilities when enabled
- All TDAM features gracefully degrade when disabled
- No breaking changes to existing workflows

## Configuration Schema

### Master Configuration

```typescript
// Type definition for teammate configuration
interface TeammateConfig {
  /**
   * Master toggle for teammate mode
   * @default false
   */
  enabled: boolean;

  /**
   * GitHub integration settings
   */
  github: {
    /** Repository owner/organization */
    owner: string;
    /** Repository name */
    repo: string;
    /** Sync interval in milliseconds */
    syncInterval: number;
    /** Enable webhook-based real-time sync */
    webhookEnabled: boolean;
    /** Epic label for identification */
    epicLabel: string;
  };

  /**
   * Agent behavior settings
   */
  agents: {
    /** Enable automatic work assignment based on capabilities */
    autoAssignment: boolean;
    /** Enable peer review workflow */
    peerReview: boolean;
    /** Enable context sharing between agents */
    contextSharing: boolean;
    /** Minimum score threshold for assignment (0-100) */
    assignmentThreshold: number;
  };

  /**
   * Memory integration settings
   */
  memory: {
    /** Persist decisions and context to epic */
    persistToEpic: boolean;
    /** Restore context from epic on session start */
    restoreFromEpic: boolean;
    /** Memory TTL in milliseconds */
    ttl: number;
    /** Namespace prefix for epic memory */
    namespacePrefix: string;
  };

  /**
   * Hook integration settings
   */
  hooks: {
    /** Run pre-task epic context loading */
    preTaskLoad: boolean;
    /** Run post-specification epic generation */
    postSpecGenerate: boolean;
    /** Run post-task epic sync */
    postTaskSync: boolean;
  };
}
```

### Default Configuration

```json
{
  "teammate": {
    "enabled": false,
    "github": {
      "owner": "",
      "repo": "",
      "syncInterval": 30000,
      "webhookEnabled": false,
      "epicLabel": "epic"
    },
    "agents": {
      "autoAssignment": true,
      "peerReview": true,
      "contextSharing": true,
      "assignmentThreshold": 50
    },
    "memory": {
      "persistToEpic": true,
      "restoreFromEpic": true,
      "ttl": 604800000,
      "namespacePrefix": "epic"
    },
    "hooks": {
      "preTaskLoad": true,
      "postSpecGenerate": false,
      "postTaskSync": true
    }
  }
}
```

## Enabling Teammate Mode

### Method 1: Configuration File

Edit `claude-flow.config.json`:

```json
{
  "teammate": {
    "enabled": true,
    "github": {
      "owner": "your-org",
      "repo": "your-repo"
    }
  }
}
```

### Method 2: Environment Variables

```bash
# Enable teammate mode
export CLAUDE_FLOW_TEAMMATE_MODE=true
export CLAUDE_FLOW_TEAMMATE_GITHUB_OWNER=your-org
export CLAUDE_FLOW_TEAMMATE_GITHUB_REPO=your-repo
```

### Method 3: CLI Flag (Per-Command)

```bash
# Enable for single command
npx claude-flow@alpha sparc run coder "task" --teammate-mode

# Disable for single command (when globally enabled)
npx claude-flow@alpha sparc run coder "task" --no-teammate-mode
```

### Method 4: Programmatic

```typescript
import { configManager } from '@claude-flow/config';

// Enable teammate mode
configManager.set('teammate.enabled', true);
configManager.set('teammate.github.owner', 'your-org');
configManager.set('teammate.github.repo', 'your-repo');
await configManager.save();
```

## Feature Detection

### Checking if Teammate Mode is Enabled

```typescript
// In application code
import { configManager } from '@claude-flow/config';

function isTeammateModeEnabled(): boolean {
  return configManager.get('teammate.enabled') === true;
}

function isGitHubConfigured(): boolean {
  const owner = configManager.get('teammate.github.owner');
  const repo = configManager.get('teammate.github.repo');
  return Boolean(owner && repo);
}

function canUseTeammateMode(): boolean {
  return isTeammateModeEnabled() && isGitHubConfigured();
}
```

### Feature Flags Pattern

```typescript
// Feature flag wrapper for teammate functionality
async function withTeammateMode<T>(
  teammateAction: () => Promise<T>,
  fallbackAction: () => Promise<T>
): Promise<T> {
  if (canUseTeammateMode()) {
    try {
      return await teammateAction();
    } catch (error) {
      console.warn('Teammate mode failed, falling back:', error);
      return await fallbackAction();
    }
  }
  return await fallbackAction();
}

// Usage example
const context = await withTeammateMode(
  async () => epicManager.loadContext(epicId),
  async () => memory.retrieve('context', 'current-task')
);
```

## Graceful Degradation

### Feature Comparison

| Feature | Teammate ON | Teammate OFF | Degradation |
|---------|------------|--------------|-------------|
| Context Storage | GitHub Epic + Memory | Memory only | Reduced persistence |
| Work Assignment | 6-factor scoring | Round-robin/manual | Less optimization |
| Peer Review | Automatic PR flow | Manual review | More manual steps |
| Session Recovery | Full epic restore | Memory namespace | Limited history |
| Progress Tracking | GitHub Issues | TodoWrite | Local only |
| Decision History | ADRs in epic | Memory ADRs | No GitHub backup |
| Team Coordination | Epic-based sync | Memory messaging | No persistence |
| SPARC Integration | Auto-epic generation | Standard SPARC | No GitHub artifacts |

### Degradation Implementation

```typescript
// Agent assignment with graceful degradation
async function assignWork(agent: Agent, task: Task): Promise<Assignment> {
  if (canUseTeammateMode()) {
    // Full teammate mode: scored assignment via epic
    const score = await calculateAgentScore(agent, task);
    if (score >= config.teammate.agents.assignmentThreshold) {
      return await epicManager.assignIssue(agent, task.issueNumber);
    }
  }

  // Fallback: simple memory-based assignment
  const assignment = { agentId: agent.id, taskId: task.id, timestamp: Date.now() };
  await memory.store('assignments', task.id, assignment);
  return assignment;
}

// Context restoration with graceful degradation
async function restoreContext(sessionId: string): Promise<Context> {
  if (canUseTeammateMode()) {
    // Try epic-based restoration
    const epicContext = await epicManager.loadContext(sessionId);
    if (epicContext) {
      // Also update local memory for faster access
      await memory.store('context', sessionId, epicContext);
      return epicContext;
    }
  }

  // Fallback: memory-only restoration
  return await memory.retrieve('context', sessionId) || createDefaultContext();
}

// SPARC specification with optional epic generation
async function runSpecification(task: string, options: SparcOptions): Promise<SparcResult> {
  const result = await sparc.runSpecification(task);

  if (canUseTeammateMode() && options.generateEpic !== false) {
    // Generate epic from specification
    const epic = await epicExporter.exportToEpic(result.specification);
    result.epicId = epic.epicId;
    result.epicUrl = epic.epicUrl;
  }

  return result;
}
```

### Fallback Chains

```typescript
// Multi-level fallback for context loading
async function loadContext(identifier: string): Promise<Context> {
  // Level 1: Try epic (if teammate mode enabled)
  if (canUseTeammateMode()) {
    const epicContext = await epicManager.loadContext(identifier);
    if (epicContext) return epicContext;
  }

  // Level 2: Try persistent memory
  const memoryContext = await memory.retrieve('epic-context', identifier);
  if (memoryContext) return JSON.parse(memoryContext);

  // Level 3: Try session memory
  const sessionContext = await memory.retrieve('session', identifier);
  if (sessionContext) return JSON.parse(sessionContext);

  // Level 4: Return empty context
  return createDefaultContext();
}
```

## CLI Behavior

### Commands When Teammate Mode Disabled

```bash
# Epic commands show helpful message
$ npx claude-flow@alpha epic create "My Epic"
⚠️  Teammate mode is not enabled.

To enable teammate mode:
  1. Set CLAUDE_FLOW_TEAMMATE_MODE=true
  2. Configure GitHub: CLAUDE_FLOW_TEAMMATE_GITHUB_OWNER and CLAUDE_FLOW_TEAMMATE_GITHUB_REPO

Or use --teammate-mode flag:
  npx claude-flow@alpha epic create "My Epic" --teammate-mode

# Standard commands work normally
$ npx claude-flow@alpha sparc run coder "implement feature"
✅ Running coder mode...
```

### Command-Level Override

```bash
# Enable teammate mode for this command only
$ npx claude-flow@alpha sparc run spec-pseudocode "auth system" \
    --teammate-mode \
    --generate-epic

# Disable teammate mode for this command (when globally enabled)
$ npx claude-flow@alpha sparc run coder "quick fix" --no-teammate-mode
```

## Hook Integration

### Conditional Hook Execution

```typescript
// pre-task hook with teammate mode check
export const preTaskHook: Hook = {
  name: 'pre-task-epic-load',
  trigger: 'pre-task',
  condition: () => canUseTeammateMode() && config.teammate.hooks.preTaskLoad,
  execute: async (context) => {
    const epicId = context.epicId || await detectActiveEpic();
    if (epicId) {
      const epicContext = await epicManager.loadContext(epicId);
      return { ...context, epicContext };
    }
    return context;
  }
};

// post-specification hook for epic generation
export const postSpecHook: Hook = {
  name: 'post-spec-epic-generate',
  trigger: 'post-specification',
  condition: (context) =>
    canUseTeammateMode() &&
    config.teammate.hooks.postSpecGenerate &&
    context.options?.generateEpic !== false,
  execute: async (context) => {
    const epic = await epicExporter.exportToEpic(context.specification);
    console.log(`📋 Epic created: ${epic.epicUrl}`);
    return { ...context, epic };
  }
};
```

## Memory Namespace Strategy

### When Teammate Mode Enabled

```
Memory Namespaces:
├── epic:{epicId}:context      # Epic-specific context
├── epic:{epicId}:decisions    # ADRs and decisions
├── epic:{epicId}:agents       # Agent assignments
├── epic:{epicId}:tasks        # Task state
├── sparc:{taskId}:spec        # SPARC specification
├── sparc:{taskId}:arch        # SPARC architecture
└── session:{sessionId}        # Session state
```

### When Teammate Mode Disabled

```
Memory Namespaces:
├── context:{taskId}           # Task context
├── decisions:{taskId}         # Local decisions
├── assignments                 # Agent assignments
├── tasks                       # Task state
└── session:{sessionId}        # Session state
```

### Namespace Migration

```typescript
// Migrate from non-teammate to teammate mode
async function migrateToTeammateMode(epicId: string): Promise<void> {
  // Load existing context
  const context = await memory.retrieve('context', 'current');
  const decisions = await memory.search('decisions:*');
  const tasks = await memory.search('tasks:*');

  // Create epic with existing data
  const epic = await epicManager.createEpic({
    title: context?.title || 'Migrated Project',
    context,
    decisions,
    tasks
  });

  // Re-store in epic namespaces
  await memory.store(`epic:${epicId}:context`, 'main', context);
  for (const decision of decisions) {
    await memory.store(`epic:${epicId}:decisions`, decision.key, decision.value);
  }

  console.log(`✅ Migrated to teammate mode: ${epic.url}`);
}
```

## Validation

### Configuration Validation

```typescript
function validateTeammateConfig(config: TeammateConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.enabled) {
    // Required fields when enabled
    if (!config.github.owner) {
      errors.push('teammate.github.owner is required when teammate mode is enabled');
    }
    if (!config.github.repo) {
      errors.push('teammate.github.repo is required when teammate mode is enabled');
    }

    // Warnings for suboptimal configuration
    if (!config.github.webhookEnabled && config.github.syncInterval > 60000) {
      warnings.push('Consider enabling webhooks or reducing syncInterval for better responsiveness');
    }
    if (config.agents.assignmentThreshold < 30) {
      warnings.push('Low assignmentThreshold may result in poor agent-task matching');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

### Runtime Validation

```bash
# Validate teammate configuration
$ npx claude-flow@alpha teammate validate

✅ Configuration valid
ℹ️  Teammate mode: disabled
ℹ️  GitHub: not configured
ℹ️  To enable: set teammate.enabled=true and configure GitHub

# With teammate mode enabled
$ npx claude-flow@alpha teammate validate

✅ Configuration valid
✅ Teammate mode: enabled
✅ GitHub: your-org/your-repo
✅ Webhook: enabled
⚠️  Warning: syncInterval (60000ms) is high for non-webhook mode
```

## Integration Testing

### Feature Toggle Tests

```typescript
describe('Teammate Mode Toggle', () => {
  it('should work without teammate mode', async () => {
    configManager.set('teammate.enabled', false);

    const result = await sparc.run('coder', 'implement feature');

    expect(result.success).toBe(true);
    expect(result.epicId).toBeUndefined(); // No epic created
  });

  it('should create epic when teammate mode enabled', async () => {
    configManager.set('teammate.enabled', true);
    configManager.set('teammate.github.owner', 'test-org');
    configManager.set('teammate.github.repo', 'test-repo');

    const result = await sparc.run('spec-pseudocode', 'feature', { generateEpic: true });

    expect(result.success).toBe(true);
    expect(result.epicId).toBeDefined();
  });

  it('should gracefully degrade on GitHub failure', async () => {
    configManager.set('teammate.enabled', true);
    mockGitHub.failNextRequest();

    const result = await sparc.run('coder', 'implement feature');

    expect(result.success).toBe(true); // Still succeeds
    expect(result.epicId).toBeUndefined(); // But no epic
    expect(result.warnings).toContain('GitHub sync failed, using local memory');
  });
});
```

## Summary

Teammate-Driven Agent Management is a fully optional enhancement that:

1. **Defaults to disabled** - No configuration required for basic claude-flow usage
2. **Enables progressively** - Turn on features as needed
3. **Degrades gracefully** - Falls back to memory-based coordination when disabled or on failure
4. **Integrates seamlessly** - Works with existing SPARC, hooks, and memory systems
5. **Supports per-command override** - Enable/disable via CLI flags

This design ensures that:
- Existing users are unaffected
- New users can adopt gradually
- The system remains robust even when GitHub is unavailable
- All features have sensible fallbacks
