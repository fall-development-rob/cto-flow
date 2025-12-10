# SPARC Phase 3: Epic Integration Architecture

**Project**: Claude-Flow Agent Orchestration Framework
**Feature**: SPARC → Epic Automatic Generation & Bidirectional Sync
**Phase**: Architecture (Integration Design)
**Version**: 1.0.0
**Date**: 2025-12-09

---

## Executive Summary

This document details how SPARC methodology integrates with the Teammate-Driven Agent Management system, enabling:

1. **Automatic Epic Generation** from SPARC Specification phase output
2. **Bidirectional Synchronization** between SPARC memory and GitHub
3. **Phase-to-Milestone Mapping** for progress tracking
4. **Integration with Hive-Mind, Maestro, and all claude-flow tooling**

---

## 1. SPARC → Epic Generation Flow

### 1.1 Injection Point

Epic generation occurs at the **end of the Specification phase** in SPARC workflow:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SPARC Pipeline with Epic Export              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │ Specification│────▶│ Epic Export  │────▶│  Pseudocode  │   │
│  │    Phase     │     │   (NEW)      │     │    Phase     │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                    │                    │            │
│         │                    ▼                    │            │
│         │           ┌──────────────┐              │            │
│         │           │   GitHub     │              │            │
│         │           │  Epic + Issues│             │            │
│         │           └──────────────┘              │            │
│         │                    │                    │            │
│         ▼                    ▼                    ▼            │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              Memory: sparc:{taskId}                  │     │
│  │  ├── spec         (specification output)            │     │
│  │  ├── epic         (GitHub epic reference)           │     │
│  │  ├── sync         (bidirectional sync state)        │     │
│  │  └── decisions    (ADRs from later phases)          │     │
│  └──────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Transformation

**SPARC Specification Output → GitHub Epic Structure:**

| SPARC Element | GitHub Equivalent |
|---------------|-------------------|
| `taskDescription` | Epic Issue Title: `[EPIC] {taskDescription}` |
| `requirements[]` | Epic body requirements checklist |
| `userStories[]` | Child Issues (one per story) |
| `acceptanceCriteria[]` | Epic + child issue acceptance criteria |
| `constraints[]` | Epic body constraints section |
| `risks[]` | Epic body risks section + labels |
| `phases[]` | GitHub Milestones |
| `estimatedEffort` | Story points labels |

### 1.3 SparcEpicExporter Class

```typescript
class SparcEpicExporter {
  constructor(
    private githubClient: GitHubEpicClient,
    private memoryManager: EpicMemoryManager,
    private config: EpicExporterConfig
  )

  // Main export function - called after Specification phase
  async exportToEpic(specification: SparcSpecification): Promise<EpicExportResult> {
    // 1. Transform specification to epic structure
    const epicStructure = this.transformToEpicStructure(specification);

    // 2. Create milestones for SPARC phases
    const milestones = await this.createMilestones(specification.phases);

    // 3. Create parent epic issue
    const epicIssue = await this.githubClient.createEpic(epicStructure);

    // 4. Create child issues from user stories
    const childIssues = await this.createChildIssues(
      specification.userStories,
      epicIssue.number
    );

    // 5. Store in memory for subsequent SPARC phases
    await this.memoryManager.storeEpicReference(
      specification.taskId,
      { epicIssue, childIssues, milestones }
    );

    // 6. Initialize bidirectional sync
    if (this.config.syncEnabled) {
      await this.syncHandler.enableSync(epicIssue.number);
    }

    return { epicIssue, childIssues, milestones };
  }
}
```

---

## 2. Phase-to-Milestone Mapping

### 2.1 SPARC Phases → GitHub Milestones

```yaml
milestones:
  specification:
    title: "SPARC: Requirements Complete"
    description: "All requirements analyzed and documented"
    issues: [Requirements issues, User Story issues]

  pseudocode:
    title: "SPARC: Design Complete"
    description: "Algorithms and logic flow designed"
    issues: [Design task issues]

  architecture:
    title: "SPARC: Architecture Approved"
    description: "System architecture validated"
    issues: [Architecture task issues]

  refinement:
    title: "SPARC: Implementation Complete"
    description: "TDD implementation with 90%+ coverage"
    issues: [Implementation issues, Test issues]

  completion:
    title: "SPARC: Ready for Release"
    description: "Integrated, documented, deployed"
    issues: [Integration issues, Documentation issues]
```

### 2.2 Automatic Phase Progression

```typescript
// When all issues in a milestone are closed, advance SPARC phase
async function checkPhaseProgression(epicId: string) {
  const epicContext = await memoryManager.getEpicContext(epicId);
  const currentPhase = epicContext.currentPhase;

  const milestone = getMilestoneForPhase(currentPhase);
  const issuesInMilestone = await githubClient.getMilestoneIssues(milestone.id);

  const allClosed = issuesInMilestone.every(issue => issue.state === 'closed');

  if (allClosed) {
    const nextPhase = getNextPhase(currentPhase);

    // Update epic context
    await memoryManager.updatePhase(epicId, nextPhase);

    // Post progress comment to epic
    await githubClient.addComment(epicId, formatPhaseProgressComment(currentPhase, nextPhase));

    // Emit event for hooks
    eventEmitter.emit('sparc:phase:advanced', { epicId, from: currentPhase, to: nextPhase });
  }
}
```

---

## 3. Integration with Claude-Flow Systems

### 3.1 Hive-Mind Integration

**How Epics flow to Queen for decision-making:**

```typescript
// When architectural decision needed during SPARC Architecture phase
async function requestArchitecturalDecision(epicId: string, decision: DecisionRequest) {
  const hiveMind = await HiveMind.getInstance();
  const queen = hiveMind.queen;

  // Load epic context for Queen evaluation
  const epicContext = await memoryManager.getEpicContext(epicId);

  // Queen evaluates based on epic requirements + constraints
  const proposal = await queen.createProposal({
    type: 'architectural_decision',
    context: epicContext,
    decision: decision,
    consensusRequired: true
  });

  // Gather consensus from relevant agents
  const votes = await hiveMind.gatherVotes(proposal);

  if (votes.approved) {
    // Create ADR and store in epic
    const adr = await ADRManager.createDecision(epicId, {
      title: decision.title,
      decision: decision.choice,
      rationale: votes.rationale,
      participants: votes.voters
    });

    // Update GitHub epic with ADR link
    await githubClient.addComment(epicId, formatADRComment(adr));
  }

  return votes;
}
```

### 3.2 Maestro Integration

**Epic body becomes Maestro specification:**

```typescript
// Maestro reads epic to create specs-driven swarm
async function initializeMaestroFromEpic(epicId: string) {
  const epicData = await githubClient.getEpic(epicId);
  const epicContext = await memoryManager.getEpicContext(epicId);

  // Extract Maestro specification from epic body
  const maestroSpec = parseMaestroSpecFromEpic(epicData.body);

  // Determine optimal topology based on complexity
  const topology = determineTopology(epicContext.complexity);
  // Simple → star, Moderate → hierarchical, Complex → mesh

  // Initialize Maestro swarm
  const swarm = await MaestroSwarmCoordinator.create({
    topology: topology,
    specification: maestroSpec,
    queenMode: 'strategic',
    autoSpawn: true
  });

  // Store Maestro reference in epic memory
  await memoryManager.store(`epic:${epicId}:maestro`, {
    swarmId: swarm.id,
    topology: topology,
    agents: swarm.agents.map(a => a.id)
  });

  return swarm;
}
```

### 3.3 Swarm Coordination

**Epic issues become swarm tasks:**

```typescript
// Convert epic child issues to swarm task graph
async function buildTaskGraphFromEpic(epicId: string) {
  const childIssues = await githubClient.getEpicChildren(epicId);

  const taskGraph = new TaskGraph();

  for (const issue of childIssues) {
    const task = {
      id: `task-${issue.number}`,
      title: issue.title,
      requirements: extractRequirements(issue.body),
      dependencies: extractDependencies(issue.body), // #123 references
      priority: extractPriority(issue.labels),
      storyPoints: extractStoryPoints(issue.labels)
    };

    taskGraph.addTask(task);
  }

  // Build dependency edges
  for (const task of taskGraph.tasks) {
    for (const depId of task.dependencies) {
      taskGraph.addEdge(depId, task.id);
    }
  }

  return taskGraph;
}
```

### 3.4 Memory Integration

**Unified memory namespace for epic context:**

```yaml
# Memory namespace structure
epic:{epicId}:
  context:           # Core epic metadata (permanent)
    id: string
    githubIssueNumber: number
    repository: string
    state: active|paused|completed
    currentPhase: specification|pseudocode|architecture|refinement|completion

  sparc-spec:        # SPARC specification output
    taskDescription: string
    requirements: array
    userStories: array
    acceptanceCriteria: array

  maestro-spec:      # Maestro specification (derived from epic)
    swarmId: string
    topology: string
    agents: array

  decisions:         # Architectural Decision Records
    ADR-001: {...}
    ADR-002: {...}

  tasks:{taskId}:    # Task completion tracking
    status: string
    assignedAgent: string
    completedAt: timestamp

  sync:              # Bidirectional sync state
    lastSyncTimestamp: timestamp
    contentHash: string
    conflictStrategy: github_wins|memory_wins|merge
```

### 3.5 Hook Integration

**Hooks for epic lifecycle events:**

```typescript
// Register epic-specific hooks
hookManager.register('post-specification', {
  handler: async (context) => {
    if (context.options.generateEpic) {
      const result = await sparcEpicExporter.exportToEpic(context.specification);
      return { epic: result };
    }
  },
  priority: 100
});

hookManager.register('pre-task', {
  handler: async (context) => {
    if (context.epicId) {
      // Restore epic context before agent starts work
      const epicContext = await contextRestoration.restore(context.epicId, {
        strategy: 'summary',
        targetAgent: context.agentId,
        maxTokens: 4000
      });
      context.epicContext = epicContext;
    }
  },
  priority: 100
});

hookManager.register('post-task', {
  handler: async (context) => {
    if (context.epicId) {
      // Update epic progress
      await progressTracker.updateProgress(context.epicId, {
        type: 'task_completed',
        taskId: context.taskId,
        agentId: context.agentId
      });

      // Sync to GitHub
      await githubSync.syncToGitHub(context.epicId);

      // Check phase progression
      await checkPhaseProgression(context.epicId);
    }
  },
  priority: 100
});
```

---

## 4. Bidirectional Synchronization

### 4.1 GitHub → Memory Sync

```typescript
// Webhook handler for GitHub events
async function handleGitHubWebhook(event: WebhookEvent) {
  const { action, issue } = event.payload;
  const epicId = extractEpicId(issue);

  if (!epicId) return;

  switch (action) {
    case 'edited':
      // Parse updated description for spec changes
      const changes = detectSpecChanges(issue.body);
      if (changes.hasChanges) {
        await syncChangesToMemory(epicId, changes);
      }
      break;

    case 'closed':
      await markIssueCompletedInMemory(epicId, issue.number);
      await checkPhaseProgression(epicId);
      break;

    case 'labeled':
      await syncLabelsToMemory(epicId, issue.number, issue.labels);
      break;
  }
}
```

### 4.2 Memory → GitHub Sync

```typescript
// After SPARC phase completion, sync updates to GitHub
async function syncMemoryToGitHub(epicId: string) {
  const epicContext = await memoryManager.getEpicContext(epicId);
  const currentGitHub = await githubClient.getEpic(epicId);

  // Detect changes
  const diffs = computeDiffs(epicContext, currentGitHub);

  for (const diff of diffs) {
    switch (diff.field) {
      case 'description':
        await githubClient.updateIssueBody(epicId, formatEpicBody(epicContext));
        break;

      case 'milestone':
        await githubClient.updateMilestone(epicId, diff.newValue);
        break;

      case 'labels':
        await githubClient.updateLabels(epicId, diff.newValue);
        break;
    }
  }

  // Update sync state
  await memoryManager.updateSyncState(epicId, {
    lastSyncTimestamp: Date.now(),
    contentHash: computeHash(epicContext)
  });
}
```

### 4.3 Conflict Resolution

```typescript
// When both GitHub and memory have changed
async function resolveConflict(
  conflict: Conflict,
  strategy: 'github_wins' | 'memory_wins' | 'merge'
): Promise<ResolvedValue> {
  switch (strategy) {
    case 'github_wins':
      return conflict.githubValue;

    case 'memory_wins':
      // Push memory value to GitHub
      await githubClient.updateField(conflict.field, conflict.memoryValue);
      return conflict.memoryValue;

    case 'merge':
      // Intelligent merge based on field type
      if (conflict.fieldType === 'array') {
        return mergeArrays(conflict.githubValue, conflict.memoryValue);
      } else {
        // Use most recent timestamp
        return conflict.githubTimestamp > conflict.memoryTimestamp
          ? conflict.githubValue
          : conflict.memoryValue;
      }
  }
}
```

---

## 5. CLI Commands

### 5.1 SPARC with Epic Generation

```bash
# Run SPARC with automatic epic generation
npx claude-flow sparc run spec-pseudocode "Build REST API" --generate-epic

# Run full SPARC pipeline with epic tracking
npx claude-flow sparc pipeline "Authentication System" \
  --generate-epic \
  --repo owner/repo \
  --sync-bidirectional

# Resume SPARC from existing epic
npx claude-flow sparc resume --epic-number 123

# Check SPARC/Epic sync status
npx claude-flow sparc sync-status --epic-number 123
```

### 5.2 Epic Management Commands

```bash
# Create epic from existing SPARC specification
npx claude-flow epic create-from-sparc ./sparc-artifacts/specification.md

# Sync epic to memory
npx claude-flow epic sync --epic-number 123 --direction github-to-memory

# Export memory state to epic
npx claude-flow epic sync --epic-number 123 --direction memory-to-github

# View epic integration status
npx claude-flow epic status 123
```

---

## 6. Configuration

### 6.1 Epic Export Configuration

```yaml
# .claude-flow/epic-config.yaml
epicExport:
  enabled: true
  autoGenerateOnSpecification: true

github:
  owner: ${GITHUB_OWNER}
  repo: ${GITHUB_REPO}
  token: ${GITHUB_TOKEN}

epic:
  labelPrefix: "sparc:"
  defaultLabels:
    - epic
    - sparc-generated
  template: "./templates/epic-template.md"

milestones:
  autoCreate: true
  mapping:
    specification: "SPARC: Requirements Complete"
    pseudocode: "SPARC: Design Complete"
    architecture: "SPARC: Architecture Approved"
    refinement: "SPARC: Implementation Complete"
    completion: "SPARC: Ready for Release"

sync:
  enabled: true
  method: webhook  # or 'polling'
  pollIntervalMs: 300000  # 5 minutes
  conflictResolution: github_wins

childIssues:
  autoCreate: true
  linkMethod: label  # or 'project', 'mention'

traceability:
  storeInMemory: true
  exportToFile: true
  filePath: "./sparc-artifacts/traceability"
```

---

## 7. Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SPARC + Epic Integration Architecture                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Developer                                                              │
│      │                                                                   │
│      ▼                                                                   │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │  SPARC Coordinator                                            │     │
│   │  └── Specification Phase                                      │     │
│   │        └── SparcEpicExporter.exportToEpic() ─────────────────┼──┐  │
│   │  └── Pseudocode Phase                                         │  │  │
│   │  └── Architecture Phase ──► ADRManager ──────────────────────┼──┤  │
│   │  └── Refinement Phase                                         │  │  │
│   │  └── Completion Phase                                         │  │  │
│   └──────────────────────────────────────────────────────────────┘  │  │
│                          │                                           │  │
│                          ▼                                           │  │
│   ┌──────────────────────────────────────────────────────────────┐  │  │
│   │  Memory Manager                                               │  │  │
│   │  └── epic:{epicId}:context                                    │  │  │
│   │  └── epic:{epicId}:sparc-spec                                 │  │  │
│   │  └── epic:{epicId}:decisions (ADRs)                          │◄─┤  │
│   │  └── epic:{epicId}:sync                                       │  │  │
│   └──────────────────────────────────────────────────────────────┘  │  │
│                          │                                           │  │
│                          ▼                                           ▼  │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │  GitHub                                                          │ │
│   │  ├── Epic Issue (#123)                                          │◄┘
│   │  │     └── Milestones (per SPARC phase)                         │
│   │  │     └── Labels (sparc:*, complexity-*, etc.)                 │
│   │  │     └── Body (spec + acceptance criteria + ADR links)        │
│   │  └── Child Issues (#124, #125, ...)                             │
│   │        └── User Stories                                          │
│   │        └── Linked to Epic via labels                            │
│   └──────────────────────────────────────────────────────────────────┘
│                          │
│                          ▼ (webhooks)
│   ┌──────────────────────────────────────────────────────────────┐
│   │  EpicSyncService                                              │
│   │  └── handleGitHubWebhook() ──► syncToMemory()                │
│   │  └── syncMemoryToGitHub() ◄── post-task hooks                │
│   │  └── resolveConflicts()                                       │
│   └──────────────────────────────────────────────────────────────┘
│                          │
│                          ▼
│   ┌──────────────────────────────────────────────────────────────┐
│   │  Hive-Mind / Maestro / Swarm                                  │
│   │  └── Queen reads epic context for decisions                   │
│   │  └── Maestro generates specs from epic                        │
│   │  └── Swarm builds task graph from child issues               │
│   │  └── Agents self-select based on capability matching          │
│   └──────────────────────────────────────────────────────────────┘
│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Epic Generation Time | < 30 seconds | From spec completion to GitHub epic created |
| Sync Latency | < 10 seconds | Time from GitHub change to memory update |
| Phase Progression Accuracy | 100% | All milestone completions advance SPARC phase |
| ADR Coverage | 100% | All architecture decisions recorded |
| Traceability | 100% | All requirements linked to issues |
| Conflict Resolution | < 1 hour | Time to resolve sync conflicts |

---

## 9. Implementation Files

### New Files Required

```
src/
├── epic/
│   ├── sparc-epic-exporter.ts      # Main exporter class
│   ├── epic-sync-service.ts        # Bidirectional sync
│   ├── phase-milestone-mapper.ts   # SPARC phase → milestone
│   └── epic-body-formatter.ts      # Format epic body from spec
├── hooks/
│   └── epic-hooks.ts               # Epic-specific hooks
└── config/
    └── epic-config.ts              # Epic configuration

templates/
├── epic-template.md                # Epic body template
└── child-issue-template.md         # User story issue template
```

### Modified Files

```
src/
├── sparc/
│   └── sparc-coordinator.ts        # Add epic export after spec phase
├── memory/
│   └── unified-memory-manager.ts   # Add epic namespace support
└── cli/
    └── commands/sparc.ts           # Add --generate-epic flag
```

---

## Next Steps

1. **Implement SparcEpicExporter** class
2. **Add post-specification hook** for automatic epic generation
3. **Implement bidirectional sync** with webhook support
4. **Update SPARC CLI** with epic flags
5. **Test end-to-end** workflow

---

**Previous Phase**: [02-pseudocode.md](./02-pseudocode.md)
**Next Phase**: [04-refinement.md](./04-refinement.md) (Implementation with TDD)
