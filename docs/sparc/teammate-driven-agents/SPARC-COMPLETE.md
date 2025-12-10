# SPARC Complete: Teammate-Driven Agent Management for Claude-Flow

**Feature**: Transform agents from automatons into collaborative teammates
**Status**: Planning Complete - Ready for Implementation
**Date**: 2025-12-09
**Hivemind Swarm ID**: swarm_1765300692557_zb93aqa1r, swarm_1765303935396_gktxeo0cj
**Version**: 2.1.0 (with SPARC→Epic Integration + Optional Skill)

> **IMPORTANT**: This is an **OPTIONAL** enhancement to claude-flow. The system works fully without teammate mode enabled. See [05-optional-configuration.md](05-optional-configuration.md) for enable/disable options.

## Claude Code Skill

This feature is available as a Claude Code Skill: **`teammate-agents`**

**Location**: `~/.claude/skills/teammate-agents/SKILL.md`

**Activation**: When Claude detects queries about:
- Persistent agent context across sessions
- GitHub Epic-based project coordination
- Team-like agent collaboration
- Multi-agent work assignment and peer review

---

## Executive Summary

This document consolidates the comprehensive planning output from the Hivemind swarm session, designing a system that transforms Claude-Flow agents from task-execution automatons into collaborative teammates using GitHub Epics as persistent context containers.

### Core Innovation

> "Great tech leaders don't micromanage. They set clear objectives, establish workflows, remove blockers, and trust their teams to deliver."

This feature applies decades of engineering management wisdom to AI agent orchestration:

1. **GitHub Epics as Project Memory** - Three-week projects stay coherent from day one to deployment
2. **Agent Autonomy** - Agents self-select work based on capability matching
3. **Peer Validation** - Agents review each other's work before merging
4. **Continuous Progress** - Automatic issue and epic updates
5. **SPARC→Epic Generation** - Automatic GitHub Epic creation from SPARC Specification phase

---

## Planning Artifacts Generated

### 1. Strategic Vision (Queen Coordinator)
**Location**: `/docs/teammate-driven-agents-strategic-vision.md`

Key deliverables:
- 5 Core Architectural Principles
- 5 Major System Integrations
- 6 Success Metrics with targets
- 12-Week Implementation Roadmap

### 2. Technical Architecture (System Architect)
**Location**: `/docs/architecture/epic-driven-context-persistence.md`

Key deliverables:
- EpicContext class design
- ContextSynchronizer for bidirectional GitHub sync
- ADRManager for architectural decision tracking
- 8 new database tables
- State machine with 6 states
- C4 Level 2 architecture diagrams

### 3. Agent Autonomy Design (Researcher)
**Location**: `/claude-flow/docs/architecture/AGENT-AUTONOMY-DESIGN.md`

Key deliverables:
- Issue-to-Agent matching algorithm (6-factor scoring)
- Workload balancing strategy
- Priority queue implementation
- Blocked detection & 4-level escalation
- Progress reporting automation
- GitHub monitoring patterns (polling + webhooks)

### 4. Peer Review System (Reviewer)
**Location**: `/docs/systems/peer-review/`

Key deliverables (10 documents, 261KB total):
- ReviewAssignment Engine
- AcceptanceCriteriaValidator
- FeedbackLoop & Learning System
- QualityScoring Engine (5 configurable profiles)
- CourseCorrection Mechanism

### 5. SPARC Specification (Specification Agent)
**Location**: `/docs/sparc/teammate-driven-agents/01-specification.md`

Key deliverables:
- Problem statement with business impact
- 5 functional requirement groups (48 acceptance criteria)
- Non-functional requirements (performance, reliability, security)
- Constraints and mitigations
- 6 success metrics
- 5 use cases
- Complete data model and API specifications

### 6. SPARC Pseudocode
**Location**: `/docs/sparc/teammate-driven-agents/02-pseudocode.md`

Key deliverables:
- Epic initialization and state machine
- Agent self-selection algorithm
- Peer review workflow
- Context persistence & restoration
- Progress tracking engine
- GitHub bidirectional synchronization

### 7. SPARC→Epic Integration Architecture
**Location**: `/docs/sparc/teammate-driven-agents/03-sparc-epic-integration.md`

Key deliverables:
- SparcEpicExporter class for automatic epic generation
- Phase-to-Milestone mapping (5 SPARC phases → 5 GitHub milestones)
- Bidirectional sync with webhook + polling support
- Integration with Hive-Mind, Maestro, Swarm, Memory, and Hooks
- CLI commands with `--generate-epic` flag
- Conflict resolution strategies

### 8. Tooling Integration Specification (Implementation Ready)
**Location**: `/docs/sparc/teammate-driven-agents/04-tooling-integration.md`

Key deliverables:
- **Hive-Mind Memory**: 5 epic namespaces, memory key patterns, store/retrieve code
- **Hive-Mind Agent**: EpicAwareAgent class with 6-factor scoring, issue claiming, peer review
- **Hive-Mind Queen**: ADR recording, consensus voting integration
- **SPARC CLI**: `sparc epic` and `sparc resume-epic` commands with full TypeScript
- **Maestro**: `create-epic` and `sync-epic` commands, workflow state mapping
- **Hook System**: 3 new epic lifecycle hooks (pre-epic, post-epic-phase, post-specification)
- **Agent Registry**: EpicAwareAgentRegistry with capability scoring, epic assignment tracking
- **GitHub Integration**: Complete SparcEpicExporter and EpicSyncService implementations
- **MCP Tools**: 6 new MCP tools for epic management

### 9. Optional Configuration & Graceful Degradation
**Location**: `/docs/sparc/teammate-driven-agents/05-optional-configuration.md`

Key deliverables:
- **Master Toggle**: `teammate.enabled` configuration option (default: false)
- **Environment Variables**: `CLAUDE_FLOW_TEAMMATE_MODE`, `CLAUDE_FLOW_TEAMMATE_GITHUB_*`
- **CLI Flags**: `--teammate-mode` / `--no-teammate-mode` per-command override
- **Graceful Degradation**: Feature comparison table for enabled vs disabled modes
- **Fallback Chains**: Multi-level fallback for context loading
- **Feature Detection**: `canUseTeammateMode()` utility function
- **Validation**: Configuration validation with errors and warnings
- **Migration**: `migrateToTeammateMode()` for upgrading existing projects

### 10. Claude Code Skill Definition
**Location**: `~/.claude/skills/teammate-agents/SKILL.md`

Key deliverables:
- **Skill YAML Frontmatter**: Name, description with trigger conditions
- **Quick Start**: Enable/disable instructions, CLI flags
- **Configuration Schema**: Full TypeScript interface with defaults
- **Workflows**: SPARC→Epic, Agent Team Coordination, Context Recovery, Peer Review
- **Integration Points**: Memory, Hooks, Swarm, SPARC connections
- **Troubleshooting**: Common issues and solutions

---

## SPARC→Epic Integration (NEW SECTION)

### Automatic Epic Generation Flow

Epics are automatically generated at the end of the SPARC Specification phase:

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

### Data Transformation: SPARC → GitHub

| SPARC Element | GitHub Equivalent |
|---------------|-------------------|
| `taskDescription` | Epic Issue Title: `[EPIC] {taskDescription}` |
| `requirements[]` | Epic body requirements checklist |
| `userStories[]` | Child Issues (one per story) |
| `acceptanceCriteria[]` | Epic + child issue acceptance criteria |
| `phases[]` | GitHub Milestones |
| `estimatedEffort` | Story points labels |

### Phase-to-Milestone Mapping

```yaml
milestones:
  specification:   "SPARC: Requirements Complete"
  pseudocode:      "SPARC: Design Complete"
  architecture:    "SPARC: Architecture Approved"
  refinement:      "SPARC: Implementation Complete"
  completion:      "SPARC: Ready for Release"
```

### Integration with Claude-Flow Systems

| System | Integration |
|--------|-------------|
| **Hive-Mind** | Queen reads epic context for architectural decisions; consensus votes stored as ADRs |
| **Maestro** | Epic body becomes Maestro specification; determines optimal swarm topology |
| **Swarm** | Epic child issues become swarm task graph with dependency edges |
| **Memory** | Unified namespace `epic:{epicId}:*` for context, decisions, sync state |
| **Hooks** | `post-specification` hook triggers epic generation; `post-task` syncs to GitHub |

### Memory Namespace Structure

```yaml
epic:{epicId}:
  context:           # Core epic metadata (permanent)
  sparc-spec:        # SPARC specification output
  maestro-spec:      # Maestro specification (derived)
  decisions:         # Architectural Decision Records
  tasks:{taskId}:    # Task completion tracking
  sync:              # Bidirectional sync state
```

### New CLI Commands for SPARC+Epic

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

# Create epic from existing SPARC specification
npx claude-flow epic create-from-sparc ./sparc-artifacts/specification.md
```

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  Teammate-Driven Agent Management                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────┐     ┌──────────────────┐                   │
│  │   GitHub Epic   │◄───►│  Epic Context    │                   │
│  │   (Source of    │     │  Manager         │                   │
│  │    Truth)       │     │                  │                   │
│  └─────────────────┘     └──────────────────┘                   │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌─────────────────┐     ┌──────────────────┐                   │
│  │   GitHub Sync   │     │  Memory Manager  │                   │
│  │   (Webhook +    │     │  (SQLite/MD)     │                   │
│  │    Polling)     │     └──────────────────┘                   │
│  └─────────────────┘              │                              │
│           │                       │                              │
│           ▼                       ▼                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Autonomous Task Selector                    │    │
│  │  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │  │ Capability    │  │ Workload     │  │ Priority     │ │    │
│  │  │ Matching      │  │ Balancing    │  │ Queue        │ │    │
│  │  └───────────────┘  └──────────────┘  └──────────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Agent Pool                            │    │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐          │    │
│  │  │Coder│  │Test │  │Review│  │Arch │  │Coord│          │    │
│  │  │Agent│  │Agent│  │Agent │  │Agent│  │Agent│          │    │
│  │  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Peer Review System                          │    │
│  │  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │  │ Review        │  │ Acceptance   │  │ Course       │ │    │
│  │  │ Assignment    │  │ Validation   │  │ Correction   │ │    │
│  │  └───────────────┘  └──────────────┘  └──────────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Progress & Analytics                        │    │
│  │  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │  │ Real-time     │  │ Agent        │  │ ADR          │ │    │
│  │  │ Dashboard     │  │ Analytics    │  │ Manager      │ │    │
│  │  └───────────────┘  └──────────────┘  └──────────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Algorithms

### 1. Issue-to-Agent Matching (6-Factor Scoring)

```
Score = Σ(factor × weight)

Factors:
├── Capability Match:    40% - Required skills vs agent capabilities
├── Performance:         20% - Historical success rate
├── Availability:        20% - Current workload + health
├── Specialization:      10% - Agent type vs task type
├── Experience:          10% - Past performance on similar tasks
└── Minimum Threshold:   50 points required for assignment
```

### 2. Epic State Machine

```
UNINITIALIZED → ACTIVE ⟷ PAUSED
                  ↓
              BLOCKED ⟷ ACTIVE
                  ↓
              REVIEW → COMPLETED → ARCHIVED
```

### 3. Peer Review Decision Tree

```
PR Created
    │
    ▼
Run Automated Checks
    │
    ├─[Blocking Failures]→ Request Changes
    │
    ▼
Select Peer Reviewer
    │
    ▼
Validate Acceptance Criteria
    │
    ├─[Criteria Failed]→ Request Changes
    │
    ▼
Calculate Quality Score
    │
    ├─[Score < Threshold]→ Course Correction
    │
    ▼
Approve & Merge
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] EpicContext class with state machine
- [ ] Basic GitHub sync (create epic, track issues)
- [ ] Memory integration for context persistence

### Phase 2: Agent Autonomy (Weeks 3-4)
- [ ] Issue-to-Agent matching algorithm
- [ ] Autonomous issue claiming
- [ ] Workload balancing
- [ ] GitHub monitoring (polling)

### Phase 3: Peer Validation (Weeks 5-6)
- [ ] Review assignment engine
- [ ] Acceptance criteria validation
- [ ] Course correction mechanism
- [ ] Feedback integration

### Phase 4: Progress Tracking (Weeks 7-8)
- [ ] Real-time dashboard
- [ ] Agent performance analytics
- [ ] ADR management
- [ ] Risk detection

### Phase 5: Advanced Features (Weeks 9-10)
- [ ] Webhook integration
- [ ] Knowledge graph
- [ ] Neural training from outcomes
- [ ] Multi-epic context

### Phase 6: Optimization (Weeks 11-12)
- [ ] Performance tuning
- [ ] Scale testing
- [ ] Documentation
- [ ] Production deployment

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Context Persistence | 95%+ after 2+ weeks | Track epic coherence |
| Agent Autonomy | 80%+ self-selected work | Issue assignment source |
| Peer Review Coverage | 100% | PR metadata |
| Architectural Drift | <5% | ADR compliance checks |
| Daily Progress Updates | 90%+ | GitHub activity |
| Review Rework Reduction | 20%+ | Feedback resolution time |
| Epic Generation Time | < 30 seconds | From spec completion to GitHub epic |
| Sync Latency | < 10 seconds | GitHub change to memory update |
| Phase Progression Accuracy | 100% | Milestone completions advance SPARC phase |
| Traceability | 100% | All requirements linked to issues |

---

## New Files/Modules Required

### Core Modules (`/src/teammate/`)
```
/src/teammate/
├── epic-context.ts          # Epic state management
├── epic-state-machine.ts    # Lifecycle transitions
├── context-synchronizer.ts  # GitHub ↔ Memory sync
├── autonomous-selector.ts   # Issue-agent matching
├── workload-balancer.ts     # Fair distribution
├── peer-review-engine.ts    # Review workflow
├── progress-tracker.ts      # Real-time updates
├── adr-manager.ts           # Decision logging
└── github-monitor.ts        # Webhook + polling
```

### SPARC→Epic Integration Modules (`/src/epic/`)
```
/src/epic/
├── sparc-epic-exporter.ts      # Main exporter class
├── epic-sync-service.ts        # Bidirectional sync
├── phase-milestone-mapper.ts   # SPARC phase → milestone
└── epic-body-formatter.ts      # Format epic body from spec
```

### Hook Extensions (`/src/hooks/`)
```
/src/hooks/
└── epic-hooks.ts               # Epic-specific hooks
    ├── post-specification      # Trigger epic generation
    ├── pre-task               # Restore epic context
    └── post-task              # Sync to GitHub, check phase
```

### Database Schema Extensions
```sql
-- 8 new tables
CREATE TABLE epic_contexts (...);
CREATE TABLE epic_tasks (...);
CREATE TABLE epic_agents (...);
CREATE TABLE adrs (...);
CREATE TABLE adr_epic_links (...);
CREATE TABLE epic_dependencies (...);
CREATE TABLE epic_file_changes (...);
CREATE TABLE epic_timeline (...);
```

### CLI Commands
```bash
# Epic management
claude-flow epic create "<title>" --repo owner/repo
claude-flow epic resume <epic-id>
claude-flow epic status <epic-id>
claude-flow epic pause <epic-id>
claude-flow epic complete <epic-id>

# Agent autonomy
claude-flow agent claim-issue <epic-id>
claude-flow agent register --capabilities "nodejs,jwt"

# Review workflow
claude-flow review request <pr-number>
claude-flow review submit <pr-number> --decision approve
```

---

## Integration with Existing Claude-Flow Systems

### Extended Systems
| System | Extension |
|--------|-----------|
| AgentRegistry | Add epic assignment tracking |
| AgentManager | Add autonomous claiming support |
| MemoryManager | Add epic namespace isolation |
| GitHubAPI | Add webhook handlers |
| SwarmCoordinator | Add epic-scoped coordination |
| HookManager | Add epic lifecycle hooks |

### New MCP Tools
```
mcp__claude-flow__epic_create
mcp__claude-flow__epic_claim_issue
mcp__claude-flow__epic_request_review
mcp__claude-flow__epic_progress
mcp__claude-flow__epic_decision
mcp__claude-flow__sparc_generate_epic    # NEW: Generate epic from SPARC spec
mcp__claude-flow__epic_sync              # NEW: Bidirectional sync
mcp__claude-flow__epic_phase_status      # NEW: SPARC phase tracking
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| GitHub API Rate Limits | Aggressive caching, request batching, multiple tokens |
| Context Window Limits | Intelligent summarization, lazy loading |
| Agent Conflicts | Distributed locking, conflict resolution strategies |
| Stalled Agents | 4-level escalation protocol, auto-recovery |
| Data Inconsistency | Bidirectional sync, optimistic locking, audit trail |

---

## Next Steps

1. **Review & Approve** - Stakeholder review of this SPARC plan
2. **Create GitHub Epic** - Use this system to build this system (dogfooding)
3. **Phase 1 Sprint** - Begin EpicContext and GitHub sync implementation
4. **Implement SparcEpicExporter** - Enable automatic epic generation from SPARC
5. **Add Epic Hooks** - Integrate `post-specification` hook for epic creation
6. **Implement Bidirectional Sync** - Webhook + polling for GitHub ↔ Memory
7. **Iterative Delivery** - Ship incrementally with feedback loops

---

## References

### Planning Documents
- [Strategic Vision](/docs/teammate-driven-agents-strategic-vision.md)
- [Architecture Design](/docs/architecture/epic-driven-context-persistence.md)
- [Agent Autonomy Design](/claude-flow/docs/architecture/AGENT-AUTONOMY-DESIGN.md)
- [Peer Review System](/docs/systems/peer-review/README.md)
- [SPARC Specification](/docs/sparc/teammate-driven-agents/01-specification.md)
- [SPARC Pseudocode](/docs/sparc/teammate-driven-agents/02-pseudocode.md)
- [SPARC→Epic Integration](/docs/sparc/teammate-driven-agents/03-sparc-epic-integration.md)
- [Tooling Integration Specification](/docs/sparc/teammate-driven-agents/04-tooling-integration.md) (NEW - Implementation Ready)

### Claude-Flow Documentation
- https://github.com/ruvnet/claude-flow

---

**Generated by Hivemind Swarm**
- Queen Coordinator: Strategic vision and orchestration
- System Architect: Technical architecture design
- Researcher: Agent autonomy algorithms + SPARC integration research
- Reviewer: Peer review system design
- Specification Agent: SPARC specification
- Integration Architects: SPARC→Epic architecture design (3 agents)
- Tooling Integration Specialists: Concrete code patterns from claude-flow codebase (6 agents)

*Swarm Topology: mesh | Strategy: Adaptive | Agents: 6*
*Swarm ID: swarm_1765303935396_gktxeo0cj*
*Updated with Complete Tooling Integration: 2025-12-09*
