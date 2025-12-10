---
name: "Teammate-Driven Agent Management"
description: "Transform AI agents from automatons into collaborative teammates using GitHub Epics as persistent memory. Use when coordinating multi-agent workflows with persistent context, when context limits threaten continuity, or when building team-like agent collaboration with work assignment, peer review, and shared understanding."
---

# Teammate-Driven Agent Management

## Overview

Teammate-Driven Agent Management (TDAM) transforms AI agents from autonomous tools into collaborative team members. Instead of treating agents as stateless workers, TDAM provides persistent context through GitHub Epics, enabling agents to maintain understanding across sessions, coordinate work intelligently, and evolve their capabilities over time.

**This skill is OPTIONAL** - claude-flow works fully without it. Enable only when you need:
- Persistent context surviving context window exhaustion
- GitHub-integrated project coordination
- Team-like agent collaboration patterns
- Multi-session continuity

## Prerequisites

- Claude Flow installed (`npx claude-flow@alpha`)
- GitHub repository with Issues enabled
- GitHub CLI (`gh`) authenticated
- Optional: GitHub Projects for board visualization

## Quick Start

### Enable Teammate Mode

```bash
# Enable via environment variable
export CLAUDE_FLOW_TEAMMATE_MODE=true

# Or via CLI flag
npx claude-flow@alpha sparc run coder "implement feature" --teammate-mode

# Or via configuration
npx claude-flow@alpha config set teammate.enabled true
```

### Create Your First Epic

```bash
# Initialize an epic from a task description
npx claude-flow@alpha epic create "User Authentication System" \
  --description "Implement secure auth with JWT" \
  --labels "feature,security"

# Or generate from SPARC specification
npx claude-flow@alpha sparc run spec-pseudocode "auth system" --generate-epic
```

### Assign Agents to Epic

```bash
# Agents automatically claim appropriate issues based on capabilities
npx claude-flow@alpha epic assign epic-123 --auto-assign

# Or manually assign specific agent types
npx claude-flow@alpha epic assign epic-123 --agent-type coder --issues 1,2,3
```

---

## Core Concepts

### 1. GitHub Epics as Memory Prosthesis

When agents hit context limits, their accumulated understanding disappears. Epics solve this by storing:

- **Project Context**: Goals, constraints, architectural decisions
- **Task State**: What's done, what's in progress, what's blocked
- **Agent Assignments**: Who owns what, with capability matching
- **Decisions & ADRs**: Why choices were made
- **Conversation History**: Key discussions and resolutions

### 2. Agent Scoring Algorithm

Agents are assigned work based on a 6-factor scoring algorithm:

| Factor | Weight | Description |
|--------|--------|-------------|
| Capability Match | 40% | Skills match issue requirements |
| Performance History | 20% | Past success with similar tasks |
| Availability | 20% | Current workload capacity |
| Specialization | 10% | Domain expertise depth |
| Experience | 10% | Familiarity with this epic |

### 3. Epic State Machine

```
UNINITIALIZED → ACTIVE ⟷ PAUSED/BLOCKED → REVIEW → COMPLETED → ARCHIVED
```

Each state has specific agent behaviors and allowed transitions.

### 4. Bidirectional Sync

Changes flow both ways between memory and GitHub:
- Memory changes → GitHub updates (issues, comments, labels)
- GitHub changes → Memory sync (webhook or polling)

---

## Configuration

### Enable/Disable (Optional Feature)

```typescript
// claude-flow.config.json
{
  "teammate": {
    "enabled": false,           // Master toggle - false by default
    "github": {
      "owner": "your-org",
      "repo": "your-repo",
      "syncInterval": 30000,    // ms between syncs
      "webhookEnabled": true    // Real-time updates
    },
    "agents": {
      "autoAssignment": true,   // Auto-assign based on capabilities
      "peerReview": true,       // Enable peer review workflow
      "contextSharing": true    // Share context between agents
    },
    "memory": {
      "persistToEpic": true,    // Save decisions to GitHub
      "restoreFromEpic": true,  // Load context on session start
      "ttl": 604800000          // 7 days memory TTL
    }
  }
}
```

### Environment Variables

```bash
# Master toggle
CLAUDE_FLOW_TEAMMATE_MODE=true|false

# GitHub configuration
CLAUDE_FLOW_TEAMMATE_GITHUB_OWNER=your-org
CLAUDE_FLOW_TEAMMATE_GITHUB_REPO=your-repo
CLAUDE_FLOW_TEAMMATE_SYNC_INTERVAL=30000

# Feature flags
CLAUDE_FLOW_TEAMMATE_AUTO_ASSIGN=true
CLAUDE_FLOW_TEAMMATE_PEER_REVIEW=true
CLAUDE_FLOW_TEAMMATE_CONTEXT_SHARING=true
```

### CLI Flags

```bash
# Enable for single command
npx claude-flow@alpha <command> --teammate-mode

# Disable for single command (when globally enabled)
npx claude-flow@alpha <command> --no-teammate-mode

# Specify epic context
npx claude-flow@alpha <command> --epic=epic-123
```

---

## Workflows

### Workflow 1: SPARC → Epic Generation

When running SPARC specification phase, automatically generate an epic:

```bash
# Run specification with epic generation
npx claude-flow@alpha sparc run spec-pseudocode "payment processing" --generate-epic

# This creates:
# 1. GitHub Epic issue with full specification
# 2. Child issues for each user story
# 3. Milestones for each SPARC phase
# 4. Memory namespace for context
```

### Workflow 2: Agent Team Coordination

```bash
# Initialize a development team
npx claude-flow@alpha teammate team-create \
  --epic=epic-123 \
  --roles="lead:architect,dev:coder,test:tester,review:reviewer"

# Team members automatically:
# - Claim issues matching their role
# - Share context through epic memory
# - Review each other's work
# - Update epic with progress
```

### Workflow 3: Context Recovery

When resuming work after context loss:

```bash
# Restore full context from epic
npx claude-flow@alpha teammate context-restore --epic=epic-123

# This loads:
# - Project goals and constraints
# - Current task state
# - Previous decisions (ADRs)
# - Blocking issues
# - Agent assignments
```

### Workflow 4: Peer Review Integration

```bash
# Enable automatic peer review
npx claude-flow@alpha teammate peer-review enable --epic=epic-123

# When an agent completes work:
# 1. Code is committed to branch
# 2. PR is created automatically
# 3. Reviewer agent is assigned based on expertise
# 4. Review feedback updates epic memory
# 5. Iterations continue until approval
```

---

## Integration with Claude-Flow Features

### Memory System

```typescript
// Store epic context in memory
await mcp__claude-flow__memory_usage({
  action: 'store',
  namespace: 'epic-context',
  key: 'epic-123:goals',
  value: JSON.stringify(epicGoals),
  ttl: 604800000 // 7 days
});

// Retrieve on session start
const context = await mcp__claude-flow__memory_usage({
  action: 'retrieve',
  namespace: 'epic-context',
  key: 'epic-123:goals'
});
```

### Hook System

```bash
# Pre-task: Load epic context
npx claude-flow@alpha hooks pre-task --epic-id "epic-123"

# Post-specification: Generate epic
npx claude-flow@alpha hooks post-specification --generate-epic

# Post-edit: Update epic progress
npx claude-flow@alpha hooks post-edit --epic-id "epic-123" --file "src/auth.ts"

# Post-task: Sync to GitHub
npx claude-flow@alpha hooks post-task --epic-sync
```

### Swarm Coordination

```javascript
// Initialize swarm with epic context
mcp__claude-flow__swarm_init({
  topology: "hierarchical",
  maxAgents: 8,
  epicContext: "epic-123"  // Loads epic as shared context
});

// Agents spawned inherit epic awareness
mcp__claude-flow__agent_spawn({
  type: "coder",
  epicId: "epic-123",
  capabilities: ["typescript", "react"]
});
```

### SPARC Integration

```bash
# Run full SPARC pipeline with epic tracking
npx claude-flow@alpha sparc pipeline "feature" --epic=epic-123

# Each phase:
# 1. Loads current epic state
# 2. Performs phase work
# 3. Updates epic with results
# 4. Creates milestone for phase completion
```

---

## Graceful Degradation

When teammate mode is disabled, claude-flow works normally:

| Feature | Teammate Mode ON | Teammate Mode OFF |
|---------|-----------------|-------------------|
| Agent coordination | Epic-based | Memory-only |
| Context persistence | GitHub + Memory | Memory only |
| Work assignment | Scored algorithm | Round-robin |
| Peer review | Automatic PR flow | Manual |
| Session recovery | Full epic restore | Memory namespace |
| Progress tracking | GitHub Issues | TodoWrite |

### Fallback Behavior

```typescript
// Code automatically falls back when teammate mode disabled
if (config.teammate.enabled) {
  // Full epic integration
  await epicManager.assignWork(agent, issue);
} else {
  // Standard memory-based coordination
  await memory.store('task-assignment', { agent, task });
}
```

---

## CLI Commands

### Epic Management

```bash
# Create epic
npx claude-flow@alpha epic create "<title>" [options]

# List epics
npx claude-flow@alpha epic list [--status=active|completed|all]

# Show epic details
npx claude-flow@alpha epic show <epic-id>

# Update epic
npx claude-flow@alpha epic update <epic-id> --state=<state>

# Sync epic with GitHub
npx claude-flow@alpha epic sync <epic-id>
```

### Agent Assignment

```bash
# Auto-assign agents to epic issues
npx claude-flow@alpha epic assign <epic-id> --auto-assign

# Manual assignment
npx claude-flow@alpha epic assign <epic-id> --agent=<type> --issues=<list>

# View assignments
npx claude-flow@alpha epic assignments <epic-id>

# Reassign on failure
npx claude-flow@alpha epic reassign <epic-id> --issue=<number>
```

### Context Management

```bash
# Restore context from epic
npx claude-flow@alpha teammate context-restore --epic=<epic-id>

# Save current context to epic
npx claude-flow@alpha teammate context-save --epic=<epic-id>

# Clear local context
npx claude-flow@alpha teammate context-clear --epic=<epic-id>
```

### Team Operations

```bash
# Create agent team
npx claude-flow@alpha teammate team-create --epic=<epic-id> --roles=<roles>

# Show team status
npx claude-flow@alpha teammate team-status --epic=<epic-id>

# Trigger team sync
npx claude-flow@alpha teammate team-sync --epic=<epic-id>
```

---

## Best Practices

### 1. Start Simple

Begin with teammate mode disabled. Enable when you need:
- Multi-session projects
- Team coordination
- Persistent context

### 2. Use SPARC → Epic Flow

Let SPARC specification generate your epic structure:
```bash
npx claude-flow@alpha sparc run spec-pseudocode "feature" --generate-epic
```

### 3. Trust the Scoring

Let the algorithm assign work. Override only when necessary:
```bash
# Usually: let auto-assign work
npx claude-flow@alpha epic assign epic-123 --auto-assign

# Override only for special cases
npx claude-flow@alpha epic assign epic-123 --agent=security-expert --issues=security-audit
```

### 4. Sync Frequently

Enable webhooks for real-time sync, or poll regularly:
```bash
# Enable webhooks (recommended)
npx claude-flow@alpha teammate webhook-setup

# Or set short poll interval
export CLAUDE_FLOW_TEAMMATE_SYNC_INTERVAL=10000
```

### 5. Review the ADRs

Epic decisions are stored as ADRs. Review before major changes:
```bash
npx claude-flow@alpha epic decisions <epic-id>
```

---

## Troubleshooting

### Issue: Context Not Restoring

**Symptoms**: Agent starts without epic context
**Cause**: Epic sync not completed or memory expired
**Solution**:
```bash
# Force full sync
npx claude-flow@alpha epic sync <epic-id> --force

# Check memory TTL
npx claude-flow@alpha config get teammate.memory.ttl
```

### Issue: Assignment Conflicts

**Symptoms**: Multiple agents claim same issue
**Cause**: Race condition in auto-assignment
**Solution**:
```bash
# Use atomic assignment
npx claude-flow@alpha epic assign <epic-id> --atomic

# Or manually resolve
npx claude-flow@alpha epic resolve-conflict <epic-id> --issue=<number>
```

### Issue: GitHub Sync Failures

**Symptoms**: Changes not appearing in GitHub
**Cause**: Authentication or rate limiting
**Solution**:
```bash
# Check GitHub CLI auth
gh auth status

# Verify rate limits
gh api rate_limit

# Manual sync with retry
npx claude-flow@alpha epic sync <epic-id> --retry=3
```

---

## API Reference

See [SPARC-COMPLETE.md](../../docs/sparc/teammate-driven-agents/SPARC-COMPLETE.md) for full specification.

See [04-tooling-integration.md](../../docs/sparc/teammate-driven-agents/04-tooling-integration.md) for implementation details.

---

## Related Skills

- [sparc-methodology](../sparc-methodology/) - SPARC development framework
- [github-project-management](../github-project-management/) - GitHub project automation
- [hive-mind-advanced](../hive-mind-advanced/) - Advanced swarm coordination
- [swarm-orchestration](../swarm-orchestration/) - Multi-agent orchestration

---

## Version History

- **1.0.0** (2025-01): Initial release with core teammate features
- Based on SPARC specification in `/docs/sparc/teammate-driven-agents/`

---

**Note**: This is an OPTIONAL feature. Claude-flow works fully without teammate mode enabled. Enable only when your workflow benefits from persistent, GitHub-integrated agent coordination.
