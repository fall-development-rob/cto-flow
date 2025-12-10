# SPARC Tooling Integration: Claude-Flow Systems Integration Specification

**Project**: Claude-Flow Agent Orchestration Framework
**Feature**: Teammate-Driven Agent Management
**Phase**: Architecture Integration
**Version**: 1.0.0
**Date**: 2025-12-09
**Status**: Implementation Ready

---

## Executive Summary

This document provides concrete integration specifications showing exactly how the Teammate-Driven Agent Management system integrates with ALL existing claude-flow tooling. Each section includes actual function signatures, data structures, and code patterns derived from the existing codebase.

---

## 1. Hive-Mind Integration

### 1.1 Memory Class Extensions

**Location**: `/src/hive-mind/core/Memory.ts`

The existing Memory class provides:
- High-performance LRU cache with compression
- Namespace isolation for different data types
- Batch operations for high throughput
- Pattern learning and access prediction

**Epic Namespace Registration**:

```typescript
// Add to initializeNamespaces() in Memory.ts
const epicNamespaces: MemoryNamespace[] = [
  {
    name: 'epic-context',
    description: 'Epic project context and metadata',
    retentionPolicy: 'persistent',
    maxEntries: 1000,
  },
  {
    name: 'epic-decisions',
    description: 'Architectural Decision Records for epics',
    retentionPolicy: 'persistent',
    maxEntries: 10000,
  },
  {
    name: 'epic-tasks',
    description: 'Task state and assignment tracking',
    retentionPolicy: 'time-based',
    ttl: 86400 * 30, // 30 days
  },
  {
    name: 'epic-sync',
    description: 'GitHub bidirectional sync state',
    retentionPolicy: 'time-based',
    ttl: 3600, // 1 hour
  },
  {
    name: 'sparc-specs',
    description: 'SPARC specification outputs',
    retentionPolicy: 'persistent',
    maxEntries: 5000,
  },
];
```

**Memory Key Patterns for Epics**:

```typescript
// Memory key structure for epic data
const epicKeys = {
  context: (epicId: string) => `epic:${epicId}:context`,
  decisions: (epicId: string, decisionId: string) => `epic:${epicId}:decisions:${decisionId}`,
  tasks: (epicId: string, taskId: string) => `epic:${epicId}:tasks:${taskId}`,
  agents: (epicId: string, agentId: string) => `epic:${epicId}:agents:${agentId}`,
  sync: (epicId: string) => `epic:${epicId}:sync`,
  sparc: (taskId: string, phase: string) => `sparc:${taskId}:${phase}`,
};
```

**Epic Context Store/Retrieve Pattern**:

```typescript
// Store epic context using existing Memory.store()
async function storeEpicContext(memory: Memory, epic: EpicContext): Promise<void> {
  await memory.store(
    epicKeys.context(epic.id),
    {
      id: epic.id,
      title: epic.title,
      state: epic.state,
      objectives: epic.objectives,
      constraints: epic.constraints,
      currentPhase: epic.currentPhase,
      assignedAgents: epic.assignedAgents,
      githubIssueNumber: epic.githubIssueNumber,
      lastSync: new Date(),
    },
    'epic-context',
    undefined // permanent
  );
}

// Retrieve with automatic cache optimization
async function retrieveEpicContext(memory: Memory, epicId: string): Promise<EpicContext | null> {
  return await memory.retrieve(epicKeys.context(epicId), 'epic-context');
}
```

### 1.2 Agent Class Extensions

**Location**: `/src/hive-mind/core/Agent.ts`

The existing Agent class provides:
- Task execution with phases (analysis, execution, validation)
- Communication buffer for message passing
- Learning loop for capability improvement
- Heartbeat and health monitoring

**Add Epic Assignment Tracking**:

```typescript
// Extend Agent class properties
export class EpicAwareAgent extends Agent {
  public currentEpicId: string | null = null;
  public epicRole: 'coordinator' | 'developer' | 'reviewer' | null = null;
  public epicCapabilityScore: number = 0;

  /**
   * Claim an issue from epic backlog (self-selection)
   */
  async claimIssue(epicId: string, issueNumber: number): Promise<boolean> {
    // Check if agent is already assigned
    if (this.currentTask) {
      return false;
    }

    // Calculate capability match score (6-factor algorithm)
    const score = await this.calculateIssueMatchScore(epicId, issueNumber);
    if (score < 50) {
      return false; // Below minimum threshold
    }

    // Store claim in memory
    await this.storeInMemory(`epic:${epicId}:claim:${issueNumber}`, {
      agentId: this.id,
      agentName: this.name,
      score,
      claimedAt: new Date(),
    });

    // Broadcast claim to swarm
    await this.sendMessage(null, 'issue_claimed', {
      epicId,
      issueNumber,
      agentId: this.id,
      score,
    });

    this.currentEpicId = epicId;
    return true;
  }

  /**
   * 6-Factor Issue Match Scoring Algorithm
   */
  private async calculateIssueMatchScore(epicId: string, issueNumber: number): Promise<number> {
    const issue = await this.retrieveFromMemory(`epic:${epicId}:issue:${issueNumber}`);
    if (!issue) return 0;

    let score = 0;

    // Factor 1: Capability Match (40%)
    const requiredSkills = issue.labels || [];
    const matchingSkills = this.capabilities.filter(cap =>
      requiredSkills.some((skill: string) => cap.toLowerCase().includes(skill.toLowerCase()))
    );
    score += (matchingSkills.length / Math.max(requiredSkills.length, 1)) * 40;

    // Factor 2: Performance History (20%)
    const metrics = await this.db.getAgentMetrics(this.id);
    score += (metrics?.successRate || 0.5) * 20;

    // Factor 3: Availability (20%)
    const workload = this.status === 'idle' ? 0 : 0.8;
    score += (1 - workload) * 20;

    // Factor 4: Specialization (10%)
    const agentTypeMatch = this.type === issue.preferredAgentType ? 1 : 0.5;
    score += agentTypeMatch * 10;

    // Factor 5: Experience (10%)
    const similarTasks = metrics?.similarTasksCompleted || 0;
    score += Math.min(similarTasks / 10, 1) * 10;

    return Math.round(score);
  }

  /**
   * Request peer review for completed work
   */
  async requestPeerReview(epicId: string, prNumber: number): Promise<void> {
    await this.sendMessage(null, 'review_requested', {
      epicId,
      prNumber,
      requestingAgent: this.id,
      agentType: this.type,
      timestamp: new Date(),
    });
  }
}
```

### 1.3 HiveMind Queen Integration

**Add Epic Coordination to Queen**:

```typescript
// Extend Queen class for epic-level decisions
class EpicCoordinatorQueen extends Queen {
  /**
   * Make architectural decision for epic (stored as ADR)
   */
  async makeArchitecturalDecision(
    epicId: string,
    decision: {
      title: string;
      context: string;
      options: { name: string; pros: string[]; cons: string[] }[];
      recommendation: string;
    }
  ): Promise<string> {
    // Gather consensus from swarm
    const consensusResult = await this.consensusEngine.proposeDecision({
      type: 'architectural',
      epicId,
      decision,
      requiredApproval: 0.66,
    });

    if (consensusResult.approved) {
      // Store ADR in memory
      const adrId = `ADR-${Date.now()}`;
      await this.memory.store(
        epicKeys.decisions(epicId, adrId),
        {
          id: adrId,
          ...decision,
          selectedOption: consensusResult.selectedOption,
          rationale: consensusResult.rationale,
          votingAgents: consensusResult.votingAgents,
          createdAt: new Date(),
        },
        'epic-decisions'
      );

      // Update GitHub issue with ADR reference
      await this.syncADRToGitHub(epicId, adrId);

      return adrId;
    }

    throw new Error('Decision not approved by consensus');
  }
}
```

---

## 2. Memory System Integration

### 2.1 Distributed Memory System

**Location**: `/src/memory/distributed-memory.ts`

The existing DistributedMemorySystem provides:
- Partitioned storage with metadata
- Query by type, tags, and namespace
- Memory entry lifecycle management

**Epic-Specific Memory Operations**:

```typescript
// Epic memory operations using existing interface
interface EpicMemoryOperations {
  // Store epic with proper partitioning
  async storeEpic(epic: EpicContext): Promise<void> {
    await this.memory.store(
      `epic:${epic.id}`,
      epic,
      {
        type: 'epic-context',
        tags: ['epic', epic.state, ...epic.labels],
        partition: 'epics',
      }
    );
  }

  // Query all active epics
  async getActiveEpics(): Promise<EpicContext[]> {
    const entries = await this.memory.query({
      type: 'state',
      namespace: 'epics',
    });
    return entries
      .filter(e => e.value?.state === 'active')
      .map(e => e.value as EpicContext);
  }

  // Store agent-epic assignment
  async assignAgentToEpic(agentId: string, epicId: string, role: string): Promise<void> {
    await this.memory.store(
      `epic:${epicId}:agent:${agentId}`,
      {
        agentId,
        epicId,
        role,
        assignedAt: new Date(),
        status: 'active',
      },
      {
        type: 'agent-assignment',
        tags: ['epic', epicId, 'agent', agentId],
        partition: 'epic-assignments',
      }
    );
  }
}
```

### 2.2 Memory Namespace Strategy

```yaml
# Epic memory namespace hierarchy
epic:
  {epicId}:
    context:          # Core epic metadata (EpicContext)
    sparc-spec:       # SPARC specification output
    maestro-spec:     # Maestro-generated specification
    sync:             # GitHub sync state
    decisions:
      {adrId}:        # Architectural Decision Records
    tasks:
      {issueNumber}:  # Task state and progress
    agents:
      {agentId}:      # Agent assignment and performance
    timeline:
      {timestamp}:    # Epic events and milestones

sparc:
  {taskId}:
    specification:    # SPARC phase 1 output
    pseudocode:       # SPARC phase 2 output
    architecture:     # SPARC phase 3 output
    refinement:       # SPARC phase 4 output
    completion:       # SPARC phase 5 output
    epic-ref:         # Reference to generated epic
```

---

## 3. Hook System Integration

### 3.1 Existing Hook Types

**Location**: `/src/cli/commands/hook.ts`

Existing hooks available:
- `pre-task` / `post-task` - Task lifecycle
- `pre-edit` / `post-edit` - File operations
- `pre-command` / `post-command` - Command execution
- `session-start` / `session-end` / `session-restore` - Session lifecycle
- `memory-sync` - Memory synchronization
- `notification` - Agent notifications

### 3.2 New Epic-Specific Hooks

```typescript
// Add to hookHandlers in hook.ts

// Epic lifecycle hooks
'pre-epic': async (args: string[]) => {
  const options = parseArgs<PreEpicOptions>(args);
  await executeHook('pre-epic', options);
},

'post-epic-phase': async (args: string[]) => {
  const options = parseArgs<PostEpicPhaseOptions>(args);
  if (!options.epicId || !options.phase) {
    throw new Error('--epic-id and --phase are required');
  }
  await executeHook('post-epic-phase', options);
},

'post-specification': async (args: string[]) => {
  const options = parseArgs<PostSpecificationOptions>(args);
  // Trigger automatic epic generation
  await executeHook('post-specification', options);
},

// Hook type definitions
interface PreEpicOptions {
  epicId: string;
  action: 'create' | 'resume' | 'pause' | 'complete';
  repo?: string;
  restoreContext?: boolean;
}

interface PostEpicPhaseOptions {
  epicId: string;
  phase: 'specification' | 'pseudocode' | 'architecture' | 'refinement' | 'completion';
  syncToGithub?: boolean;
  updateMilestone?: boolean;
}

interface PostSpecificationOptions {
  taskId: string;
  specPath: string;
  generateEpic?: boolean;
  repo?: string;
}
```

### 3.3 Hook Command Examples

```bash
# Before starting epic work - restore context
npx claude-flow@alpha hooks pre-epic \
  --epic-id "epic-2025-12-09T15-30-00Z" \
  --action resume \
  --restore-context

# After completing SPARC specification - auto-generate epic
npx claude-flow@alpha hooks post-specification \
  --task-id "auth-system-001" \
  --spec-path "./docs/specs/auth-system.md" \
  --generate-epic \
  --repo "owner/repo"

# After completing epic phase - sync to GitHub
npx claude-flow@alpha hooks post-epic-phase \
  --epic-id "epic-2025-12-09T15-30-00Z" \
  --phase "architecture" \
  --sync-to-github \
  --update-milestone

# Agent claiming issue
npx claude-flow@alpha hooks notification \
  --message "Agent coder-001 claimed issue #15" \
  --level info \
  --metadata '{"epicId":"epic-001","issueNumber":15,"agentId":"coder-001"}'
```

---

## 4. SPARC CLI Integration

### 4.1 Existing SPARC Commands

**Location**: `/src/cli/commands/sparc.ts`

Current workflow:
1. `sparc modes` - List available modes
2. `sparc run <mode> <task>` - Execute specific mode
3. `sparc tdd <task>` - Run full TDD workflow
4. `sparc workflow <file>` - Custom workflow from JSON

### 4.2 Extended SPARC Commands for Epic Generation

```typescript
// Add to sparcAction() switch statement
case 'epic':
  await runSparcWithEpic(ctx);
  break;

case 'resume-epic':
  await resumeFromEpic(ctx);
  break;

// New command implementations
async function runSparcWithEpic(ctx: CommandContext): Promise<void> {
  const taskDescription = ctx.args.slice(1).join(' ');
  const repo = ctx.flags.repo as string;
  const generateEpic = ctx.flags['generate-epic'] !== false;

  if (!taskDescription) {
    error('Usage: sparc epic <task-description> --repo owner/repo');
    return;
  }

  // Run specification phase
  const specResult = await runSparcMode({
    ...ctx,
    args: ['run', 'spec-pseudocode', taskDescription],
  });

  // If epic generation enabled, transform spec to GitHub epic
  if (generateEpic && repo) {
    info('Generating GitHub Epic from specification...');

    const exporter = new SparcEpicExporter(repo);
    const epicResult = await exporter.exportToEpic({
      taskId: specResult.instanceId,
      taskDescription,
      requirements: specResult.requirements,
      userStories: specResult.userStories,
      acceptanceCriteria: specResult.acceptanceCriteria,
    });

    success(`Epic created: ${epicResult.epicUrl}`);
    console.log(`📋 Epic #${epicResult.epicNumber}: ${taskDescription}`);
    console.log(`📊 ${epicResult.childIssues.length} child issues created`);
    console.log(`🎯 ${epicResult.milestones.length} milestones set`);

    // Store epic reference for subsequent phases
    await storeInMemory(`sparc:${specResult.instanceId}:epic-ref`, {
      epicId: epicResult.epicId,
      epicNumber: epicResult.epicNumber,
      epicUrl: epicResult.epicUrl,
    });
  }

  // Continue with remaining SPARC phases
  // Each phase updates the epic via hooks
}

async function resumeFromEpic(ctx: CommandContext): Promise<void> {
  const epicNumber = ctx.args[1];
  const repo = ctx.flags.repo as string;

  if (!epicNumber || !repo) {
    error('Usage: sparc resume-epic <epic-number> --repo owner/repo');
    return;
  }

  info(`Resuming SPARC workflow from Epic #${epicNumber}...`);

  // Restore epic context from GitHub + memory
  const context = await restoreEpicContext(repo, parseInt(epicNumber));

  // Determine current phase from milestones
  const currentPhase = context.currentMilestone?.phase || 'specification';

  success(`Restored context for: ${context.title}`);
  console.log(`📍 Current Phase: ${currentPhase}`);
  console.log(`✅ Completed: ${context.completedIssues}/${context.totalIssues} issues`);

  // Resume from current phase
  await runSparcMode({
    ...ctx,
    args: ['run', getSparcModeForPhase(currentPhase), context.title],
    flags: {
      ...ctx.flags,
      epicId: context.epicId,
      restoreMemory: true,
    },
  });
}
```

### 4.3 Updated SPARC Prompt with Epic Integration

```typescript
// Extend buildSparcPrompt() function
function buildSparcPromptWithEpic(
  mode: SparcMode,
  taskDescription: string,
  flags: any,
  epicContext?: EpicContext
): string {
  let prompt = buildSparcPrompt(mode, taskDescription, flags);

  if (epicContext) {
    prompt += `

## Epic Context Integration

**Active Epic**: ${epicContext.title} (#${epicContext.githubIssueNumber})
**Epic ID**: ${epicContext.id}
**Current State**: ${epicContext.state}
**Current Phase**: ${epicContext.currentPhase}

### Objectives
${epicContext.objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}

### Constraints
${epicContext.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

### Previously Made Decisions (ADRs)
${epicContext.decisions?.map(d => `- **${d.title}**: ${d.selectedOption}`).join('\n') || 'None yet'}

### Assigned Agents
${epicContext.assignedAgents?.map(a => `- ${a.name} (${a.type}): ${a.role}`).join('\n') || 'You are the first agent'}

### Memory Commands for Epic
\`\`\`bash
# Retrieve epic context
npx claude-flow memory query "epic:${epicContext.id}"

# Store your findings
npx claude-flow memory store "epic:${epicContext.id}:${mode.slug}" "<your-output>"

# Record a decision
npx claude-flow memory store "epic:${epicContext.id}:decisions:ADR-$(date +%s)" "<decision-yaml>"

# Update progress
npx claude-flow hooks notification --message "Completed ${mode.slug} phase" --metadata '{"epicId":"${epicContext.id}"}'
\`\`\`

### GitHub Sync
Your outputs will be automatically synced to GitHub Issue #${epicContext.githubIssueNumber}.
Update the issue with progress comments using:
\`\`\`bash
gh issue comment ${epicContext.githubIssueNumber} --body "Progress update: ..."
\`\`\`
`;
  }

  return prompt;
}
```

---

## 5. Maestro Integration

### 5.1 Existing Maestro Commands

**Location**: `/src/cli/commands/maestro.ts`

Current workflow:
1. `maestro create-spec <feature>` - Create specification
2. `maestro generate-design <feature>` - Generate technical design
3. `maestro generate-tasks <feature>` - Generate implementation tasks
4. `maestro implement-task <feature> <task-id>` - Implement specific task
5. `maestro approve-phase <feature>` - Approve and progress

### 5.2 Maestro + Epic Integration

```typescript
// Extend maestro commands for epic integration
maestroCommand.command('create-epic')
  .description('Create specification and GitHub epic together')
  .argument('<feature-name>', 'Feature name')
  .option('-r, --request <request>', 'Feature request description')
  .option('--repo <repo>', 'GitHub repository (owner/repo)')
  .option('--generate-epic', 'Auto-generate GitHub epic (default: true)')
  .action(async (featureName: string, options) => {
    try {
      console.log(chalk.blue(`📋 Creating specification + epic for ${featureName}...`));

      const bridge = await getCLIBridge();
      const orchestrator = await bridge.initializeOrchestrator();

      // Create spec using Maestro
      await orchestrator.createSpec(featureName, options.request);

      // Generate epic from spec
      if (options.generateEpic !== false && options.repo) {
        const epicExporter = new SparcEpicExporter(options.repo);
        const spec = await orchestrator.loadSpec(featureName);

        const epicResult = await epicExporter.exportMaestroSpec({
          featureName,
          requirements: spec.requirements,
          userStories: spec.userStories,
          designNotes: spec.designNotes,
        });

        console.log(chalk.green(`✅ Epic created: ${epicResult.epicUrl}`));

        // Link Maestro workflow to epic
        await orchestrator.linkToEpic(featureName, epicResult.epicId);
      }

    } catch (error) {
      handleError(error as Error, 'create-epic');
    }
  });

maestroCommand.command('sync-epic')
  .description('Sync Maestro workflow state with GitHub epic')
  .argument('<feature-name>', 'Feature name')
  .option('--direction <dir>', 'Sync direction: push|pull|bidirectional', 'bidirectional')
  .action(async (featureName: string, options) => {
    try {
      console.log(chalk.blue(`🔄 Syncing ${featureName} with GitHub epic...`));

      const bridge = await getCLIBridge();
      const orchestrator = await bridge.initializeOrchestrator();
      const state = orchestrator.getWorkflowState(featureName);

      if (!state?.epicId) {
        throw new Error('No epic linked to this feature. Use maestro create-epic first.');
      }

      const syncService = new EpicSyncService(state.epicId);
      await syncService.sync(options.direction);

      console.log(chalk.green(`✅ Sync completed for ${featureName}`));

    } catch (error) {
      handleError(error as Error, 'sync-epic');
    }
  });
```

### 5.3 Maestro Workflow State → Epic Milestone Mapping

```typescript
// Map Maestro phases to epic milestones
const maestroToEpicPhaseMap = {
  'requirements': 'SPARC: Requirements Complete',
  'design': 'SPARC: Design Complete',
  'implementation': 'SPARC: Implementation Complete',
  'review': 'SPARC: Review Complete',
  'completed': 'SPARC: Ready for Release',
};

// Sync Maestro task completion to GitHub issue
async function syncTaskCompletion(
  featureName: string,
  taskId: number,
  state: MaestroWorkflowState
): Promise<void> {
  const epicId = state.epicId;
  if (!epicId) return;

  // Find corresponding GitHub issue
  const issueNumber = await getLinkedIssueNumber(epicId, taskId);

  // Close issue with completion comment
  await ghClient.closeIssue(issueNumber, {
    comment: `Task completed by Maestro workflow.\n\nPhase: ${state.currentPhase}\nImplemented by: Agent ${state.implementingAgent}`,
    labels: ['completed', 'maestro-automated'],
  });

  // Update milestone progress
  await updateMilestoneProgress(epicId, state.currentPhase);
}
```

---

## 6. Agent Registry Integration

### 6.1 Existing Agent Registry

**Location**: `/src/agents/agent-registry.ts`

Provides:
- Agent registration with capabilities
- Query by type, status, tags
- Capability matching for task assignment
- Performance statistics

### 6.2 Epic Assignment Extensions

```typescript
// Extend AgentRegistry for epic-aware operations
export class EpicAwareAgentRegistry extends AgentRegistry {
  /**
   * Find best agent for epic issue using 6-factor scoring
   */
  async findBestAgentForEpicIssue(
    epicId: string,
    issue: GitHubIssue
  ): Promise<AgentState | null> {
    // Extract required capabilities from issue labels
    const requiredCapabilities = issue.labels
      .filter(l => l.name.startsWith('skill:'))
      .map(l => l.name.replace('skill:', ''));

    // Get healthy, available agents
    let candidates = await this.getHealthyAgents(0.5);
    candidates = candidates.filter(a => a.status === 'idle');

    if (candidates.length === 0) return null;

    // Score each candidate using 6-factor algorithm
    const scored = candidates.map(agent => ({
      agent,
      score: this.calculateEpicIssueScore(agent, issue, requiredCapabilities),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return best candidate if above threshold
    const best = scored[0];
    if (best && best.score >= 50) {
      return best.agent;
    }

    return null;
  }

  /**
   * 6-Factor scoring for epic issue assignment
   */
  private calculateEpicIssueScore(
    agent: AgentState,
    issue: GitHubIssue,
    requiredCapabilities: string[]
  ): number {
    let score = 0;

    // Factor 1: Capability Match (40%)
    const agentCaps = [
      ...agent.capabilities.languages,
      ...agent.capabilities.frameworks,
      ...agent.capabilities.domains,
      ...agent.capabilities.tools,
    ];
    const matchCount = requiredCapabilities.filter(req =>
      agentCaps.some(cap => cap.toLowerCase().includes(req.toLowerCase()))
    ).length;
    score += (matchCount / Math.max(requiredCapabilities.length, 1)) * 40;

    // Factor 2: Performance History (20%)
    score += agent.metrics.successRate * 20;

    // Factor 3: Availability (20%)
    const availability = 1 - agent.workload;
    score += availability * 20;

    // Factor 4: Specialization (10%)
    const issueType = this.inferIssueType(issue);
    const typeMatch = agent.type === issueType ? 1 : 0.5;
    score += typeMatch * 10;

    // Factor 5: Experience (10%)
    const similarTasks = agent.metrics.tasksCompleted;
    score += Math.min(similarTasks / 20, 1) * 10;

    return Math.round(score);
  }

  /**
   * Track agent epic assignments
   */
  async assignAgentToEpic(
    agentId: string,
    epicId: string,
    role: 'coordinator' | 'developer' | 'reviewer'
  ): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    // Store assignment
    await this.storeCoordinationData(agentId, {
      type: 'epic-assignment',
      epicId,
      role,
      assignedAt: new Date(),
    });

    // Update agent metadata
    await this.updateAgent(agentId, {
      ...agent,
      currentEpicId: epicId,
      epicRole: role,
    } as any);

    this.emit('agent:epic-assigned', { agentId, epicId, role });
  }

  /**
   * Get all agents assigned to an epic
   */
  async getEpicAgents(epicId: string): Promise<AgentState[]> {
    const allAgents = await this.getAllAgents();
    return allAgents.filter((agent: any) => agent.currentEpicId === epicId);
  }

  private inferIssueType(issue: GitHubIssue): AgentType {
    const labels = issue.labels.map(l => l.name.toLowerCase());

    if (labels.includes('bug')) return 'optimizer';
    if (labels.includes('feature')) return 'coder';
    if (labels.includes('test')) return 'tester';
    if (labels.includes('docs')) return 'documenter';
    if (labels.includes('research')) return 'researcher';
    if (labels.includes('review')) return 'reviewer';

    return 'coder'; // default
  }
}
```

---

## 7. GitHub Integration

### 7.1 SparcEpicExporter Implementation

```typescript
// /src/epic/sparc-epic-exporter.ts
import { Octokit } from '@octokit/rest';

interface SparcSpecification {
  taskId: string;
  taskDescription: string;
  requirements: Requirement[];
  userStories: UserStory[];
  acceptanceCriteria: AcceptanceCriteria[];
  phases?: SparcPhase[];
}

interface EpicExportResult {
  epicId: string;
  epicNumber: number;
  epicUrl: string;
  childIssues: ChildIssue[];
  milestones: Milestone[];
}

export class SparcEpicExporter {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(repository: string) {
    const [owner, repo] = repository.split('/');
    this.owner = owner;
    this.repo = repo;
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }

  async exportToEpic(specification: SparcSpecification): Promise<EpicExportResult> {
    const epicId = `epic-${new Date().toISOString().replace(/[:.]/g, '-')}`;

    // 1. Create milestones for SPARC phases
    const milestones = await this.createMilestones(specification.phases);

    // 2. Create parent epic issue
    const epicBody = this.formatEpicBody(specification, epicId);
    const epicIssue = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title: `[EPIC] ${specification.taskDescription}`,
      body: epicBody,
      labels: ['epic', 'sparc-generated', 'teammate-driven'],
      milestone: milestones[0]?.number,
    });

    // 3. Create child issues from user stories
    const childIssues = await this.createChildIssues(
      specification.userStories,
      epicIssue.data.number,
      milestones
    );

    // 4. Store epic reference in memory
    await this.storeEpicReference(specification.taskId, {
      epicId,
      epicNumber: epicIssue.data.number,
      epicUrl: epicIssue.data.html_url,
      childIssues,
      milestones,
    });

    return {
      epicId,
      epicNumber: epicIssue.data.number,
      epicUrl: epicIssue.data.html_url,
      childIssues,
      milestones,
    };
  }

  private async createMilestones(phases?: SparcPhase[]): Promise<Milestone[]> {
    const defaultPhases = [
      { name: 'specification', title: 'SPARC: Requirements Complete' },
      { name: 'pseudocode', title: 'SPARC: Design Complete' },
      { name: 'architecture', title: 'SPARC: Architecture Approved' },
      { name: 'refinement', title: 'SPARC: Implementation Complete' },
      { name: 'completion', title: 'SPARC: Ready for Release' },
    ];

    const milestones: Milestone[] = [];
    const phaseList = phases || defaultPhases;

    for (const phase of phaseList) {
      const milestone = await this.octokit.issues.createMilestone({
        owner: this.owner,
        repo: this.repo,
        title: phase.title,
        description: `SPARC ${phase.name} phase milestone`,
        state: 'open',
      });
      milestones.push({
        number: milestone.data.number,
        title: milestone.data.title,
        phase: phase.name,
      });
    }

    return milestones;
  }

  private async createChildIssues(
    userStories: UserStory[],
    epicNumber: number,
    milestones: Milestone[]
  ): Promise<ChildIssue[]> {
    const childIssues: ChildIssue[] = [];

    for (const story of userStories) {
      // Determine milestone based on story phase
      const milestone = this.selectMilestoneForStory(story, milestones);

      const issue = await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title: story.title,
        body: this.formatIssueBody(story, epicNumber),
        labels: [...(story.labels || []), 'user-story', 'epic-child'],
        milestone: milestone?.number,
      });

      childIssues.push({
        number: issue.data.number,
        title: issue.data.title,
        url: issue.data.html_url,
        milestone: milestone?.title,
      });
    }

    return childIssues;
  }

  private formatEpicBody(spec: SparcSpecification, epicId: string): string {
    return `## Epic Context

**Epic ID**: \`${epicId}\`
**Generated**: ${new Date().toISOString()}
**Generator**: SPARC Teammate-Driven Agent Management

---

## Description

${spec.taskDescription}

---

## Requirements

${spec.requirements.map((r, i) => `${i + 1}. ${r.description}`).join('\n')}

---

## User Stories

${spec.userStories.map(s => `- [ ] ${s.title}`).join('\n')}

---

## Acceptance Criteria

${spec.acceptanceCriteria.map(c => `- [ ] ${c.criterion}`).join('\n')}

---

## Agent Coordination

<!-- This section is automatically updated by teammate agents -->

### Assigned Agents
_No agents assigned yet_

### Architectural Decisions (ADRs)
_No decisions recorded yet_

### Progress Updates
_Progress will appear here as agents work_

---

<!-- SPARC-EPIC-METADATA
epicId: ${epicId}
taskId: ${spec.taskId}
state: active
currentPhase: specification
version: 1
-->
`;
  }

  private formatIssueBody(story: UserStory, epicNumber: number): string {
    return `## User Story

**Parent Epic**: #${epicNumber}

### Description
${story.description}

### Acceptance Criteria
${story.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n')}

### Technical Notes
${story.technicalNotes || '_To be determined during implementation_'}

---

## Agent Assignment

<!-- Updated automatically when agent claims issue -->
**Assigned Agent**: _Unassigned_
**Capability Match Score**: _N/A_

---

<!-- ISSUE-METADATA
epicNumber: ${epicNumber}
storyId: ${story.id}
estimatedEffort: ${story.estimatedEffort || 'medium'}
requiredCapabilities: ${JSON.stringify(story.requiredCapabilities || [])}
-->
`;
  }
}
```

---

## 8. Bidirectional Sync Service

```typescript
// /src/epic/epic-sync-service.ts
export class EpicSyncService {
  private epicId: string;
  private memory: Memory;
  private octokit: Octokit;
  private pollInterval: number = 30000; // 30 seconds
  private syncTimer?: NodeJS.Timer;

  constructor(epicId: string, memory: Memory) {
    this.epicId = epicId;
    this.memory = memory;
    this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }

  /**
   * Enable bidirectional sync
   */
  async enableSync(direction: 'push' | 'pull' | 'bidirectional' = 'bidirectional'): Promise<void> {
    // Initial sync
    if (direction === 'pull' || direction === 'bidirectional') {
      await this.pullFromGitHub();
    }
    if (direction === 'push' || direction === 'bidirectional') {
      await this.pushToGitHub();
    }

    // Start polling for changes
    if (direction === 'bidirectional') {
      this.startPolling();
    }
  }

  /**
   * Pull changes from GitHub to memory
   */
  async pullFromGitHub(): Promise<void> {
    const epicContext = await this.memory.retrieve(
      `epic:${this.epicId}:context`,
      'epic-context'
    );

    if (!epicContext?.githubIssueNumber) return;

    // Fetch epic issue
    const issue = await this.octokit.issues.get({
      owner: epicContext.owner,
      repo: epicContext.repo,
      issue_number: epicContext.githubIssueNumber,
    });

    // Parse SPARC-EPIC-METADATA from body
    const metadata = this.parseEpicMetadata(issue.data.body || '');

    // Fetch child issues
    const childIssues = await this.fetchChildIssues(epicContext);

    // Update memory with GitHub state
    await this.memory.store(
      `epic:${this.epicId}:context`,
      {
        ...epicContext,
        title: issue.data.title,
        state: issue.data.state,
        labels: issue.data.labels.map(l => typeof l === 'string' ? l : l.name),
        childIssues: childIssues.map(i => ({
          number: i.number,
          title: i.title,
          state: i.state,
          assignee: i.assignee?.login,
        })),
        lastSync: new Date(),
        syncSource: 'github',
        ...metadata,
      },
      'epic-context'
    );

    // Store sync state
    await this.memory.store(
      `epic:${this.epicId}:sync`,
      {
        lastPull: new Date(),
        issueEtag: issue.headers.etag,
        childIssueCount: childIssues.length,
      },
      'epic-sync'
    );
  }

  /**
   * Push changes from memory to GitHub
   */
  async pushToGitHub(): Promise<void> {
    const epicContext = await this.memory.retrieve(
      `epic:${this.epicId}:context`,
      'epic-context'
    );

    if (!epicContext?.githubIssueNumber) return;

    // Update epic issue body with current state
    const updatedBody = await this.formatUpdatedBody(epicContext);

    await this.octokit.issues.update({
      owner: epicContext.owner,
      repo: epicContext.repo,
      issue_number: epicContext.githubIssueNumber,
      body: updatedBody,
    });

    // Update sync state
    await this.memory.store(
      `epic:${this.epicId}:sync`,
      {
        lastPush: new Date(),
        pushedState: epicContext.state,
        pushedPhase: epicContext.currentPhase,
      },
      'epic-sync'
    );
  }

  /**
   * Start polling for GitHub changes
   */
  private startPolling(): void {
    this.syncTimer = setInterval(async () => {
      try {
        const hasChanges = await this.checkForChanges();
        if (hasChanges) {
          await this.pullFromGitHub();
        }
      } catch (error) {
        console.error('Sync polling error:', error);
      }
    }, this.pollInterval);
  }

  /**
   * Stop sync polling
   */
  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  private async checkForChanges(): Promise<boolean> {
    const syncState = await this.memory.retrieve(
      `epic:${this.epicId}:sync`,
      'epic-sync'
    );

    if (!syncState) return true;

    const epicContext = await this.memory.retrieve(
      `epic:${this.epicId}:context`,
      'epic-context'
    );

    // Check using conditional request
    try {
      await this.octokit.issues.get({
        owner: epicContext.owner,
        repo: epicContext.repo,
        issue_number: epicContext.githubIssueNumber,
        headers: {
          'If-None-Match': syncState.issueEtag,
        },
      });
      return true; // Changed
    } catch (error: any) {
      if (error.status === 304) {
        return false; // Not modified
      }
      throw error;
    }
  }

  private parseEpicMetadata(body: string): Partial<EpicContext> {
    const metadataMatch = body.match(/<!-- SPARC-EPIC-METADATA\n([\s\S]*?)\n-->/);
    if (!metadataMatch) return {};

    const yaml = metadataMatch[1];
    const metadata: any = {};

    yaml.split('\n').forEach(line => {
      const [key, value] = line.split(': ').map(s => s.trim());
      if (key && value) {
        metadata[key] = value;
      }
    });

    return metadata;
  }
}
```

---

## 9. New CLI Commands Summary

```bash
# SPARC + Epic Commands
npx claude-flow sparc epic "<task>" --repo owner/repo     # Create spec + epic
npx claude-flow sparc resume-epic <number> --repo owner/repo  # Resume from epic

# Maestro + Epic Commands
npx claude-flow maestro create-epic <feature> --repo owner/repo
npx claude-flow maestro sync-epic <feature> --direction bidirectional

# Epic Management Commands
npx claude-flow epic create "<title>" --repo owner/repo
npx claude-flow epic resume <epic-id>
npx claude-flow epic status <epic-id>
npx claude-flow epic sync <epic-id> --direction push|pull|bidirectional
npx claude-flow epic assign-agent <epic-id> <agent-id> --role developer

# Agent Commands
npx claude-flow agent claim-issue <epic-id> <issue-number>
npx claude-flow agent request-review <epic-id> <pr-number>
npx claude-flow agent list-assignments <agent-id>

# Hook Commands
npx claude-flow hooks pre-epic --epic-id <id> --action resume
npx claude-flow hooks post-epic-phase --epic-id <id> --phase architecture
npx claude-flow hooks post-specification --task-id <id> --generate-epic
```

---

## 10. MCP Tool Extensions

```typescript
// New MCP tools for epic management
const epicMcpTools = {
  // Create epic from SPARC specification
  'mcp__claude-flow__sparc_generate_epic': {
    description: 'Generate GitHub Epic from SPARC specification',
    parameters: {
      taskId: 'string',
      repo: 'string',
      syncBidirectional: 'boolean',
    },
  },

  // Sync epic state
  'mcp__claude-flow__epic_sync': {
    description: 'Synchronize epic between memory and GitHub',
    parameters: {
      epicId: 'string',
      direction: 'push | pull | bidirectional',
    },
  },

  // Track SPARC phase progress
  'mcp__claude-flow__epic_phase_status': {
    description: 'Get or update SPARC phase status for epic',
    parameters: {
      epicId: 'string',
      phase: 'specification | pseudocode | architecture | refinement | completion',
      action: 'get | complete | skip',
    },
  },

  // Agent issue claim
  'mcp__claude-flow__epic_claim_issue': {
    description: 'Claim epic issue for agent self-selection',
    parameters: {
      epicId: 'string',
      issueNumber: 'number',
      agentId: 'string',
    },
  },

  // Request peer review
  'mcp__claude-flow__epic_request_review': {
    description: 'Request peer review from another agent',
    parameters: {
      epicId: 'string',
      prNumber: 'number',
      requestingAgentId: 'string',
    },
  },

  // Record architectural decision
  'mcp__claude-flow__epic_decision': {
    description: 'Record architectural decision (ADR) for epic',
    parameters: {
      epicId: 'string',
      title: 'string',
      context: 'string',
      decision: 'string',
      consequences: 'string[]',
    },
  },
};
```

---

## Summary

This integration specification provides concrete implementation patterns for integrating the Teammate-Driven Agent Management system with ALL existing claude-flow tooling:

| Component | Integration Type | Key Changes |
|-----------|-----------------|-------------|
| **Hive-Mind Memory** | Namespace extension | Add 5 epic namespaces, key patterns |
| **Hive-Mind Agent** | Class extension | Add EpicAwareAgent with claim/review |
| **Hive-Mind Queen** | Decision integration | ADR recording, consensus voting |
| **SPARC CLI** | Command extension | Add `epic`, `resume-epic` commands |
| **Maestro** | Workflow integration | Add `create-epic`, `sync-epic` commands |
| **Hook System** | Hook extension | Add 3 epic lifecycle hooks |
| **Agent Registry** | Query extension | Add 6-factor scoring, epic assignment |
| **GitHub** | Full integration | SparcEpicExporter, EpicSyncService |
| **MCP Tools** | 6 new tools | Epic management via MCP |

All patterns use existing interfaces and data structures, ensuring seamless integration with the current claude-flow architecture.
