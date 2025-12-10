# Teammate-Driven Integration - Quick Reference

**Companion to:** [teammate-driven-integration-matrix.md](./teammate-driven-integration-matrix.md)

---

## System Integration at a Glance

### 🐝 Hive-Mind Integration
**Role:** Collective decision-making for architectural choices

- **Queen evaluates epic requirements** → Task decomposition → Worker assignment
- **Consensus mechanisms** approve architectural decisions before epic updates
- **Collective Memory** links to epic context in shared namespace
- **Worker Self-Selection** from epic issues based on capability matching

**Key Config:**
```json
{
  "queenType": "strategic",
  "consensusAlgorithm": "weighted",
  "workerSelfSelection": true
}
```

---

### 🎭 Maestro Integration
**Role:** Specs-driven topology and phase management

- **Epic body becomes living specification** → Auto-generates swarm topology
- **Epic milestones map to Maestro workflow phases**
- **Requirements Agent** analyzes epic → Structured spec
- **Steering documents** stored in epic memory for agent access

**Key Config:**
```json
{
  "autoCreateSpec": true,
  "livingDocumentation": true,
  "syncInterval": 300000
}
```

---

### ⚡ SPARC Integration
**Role:** Structured development methodology mapped to epic issues

- **Epic requirements → SPARC specification** → Requirement issues
- **Architectural decisions → ADRs** stored in epic memory
- **TDD implementation** tracked per epic issue with 90% coverage target
- **Epic closure → SPARC completion** → Integration and documentation

**Key Config:**
```json
{
  "autoGeneratePhases": true,
  "tddWorkflow": {
    "enabled": true,
    "coverageTarget": 90
  }
}
```

---

### 🔗 Swarm Coordination Integration
**Role:** Multi-agent orchestration patterns for epic work

- **Epic complexity → Auto-select topology** (star/hierarchical/mesh/adaptive)
- **Epic issues → Task graph** → Dynamic agent assignment
- **Capability-based matching** for optimal agent selection
- **Load balancing** across swarm with fault tolerance

**Key Config:**
```json
{
  "topologySelection": { "auto": true },
  "taskOrchestration": { "strategy": "adaptive" },
  "maxAgents": 12
}
```

---

### 💾 Memory Systems Integration
**Role:** Persistent context storage across sessions

- **Epic context** stored in dedicated `epic:{epicId}` namespace
- **Cross-session persistence** → Context survives restarts
- **SwarmMemory** → Shared knowledge across all epic agents
- **AgentDB** → Semantic vector search of architectural decisions

**Key Config:**
```json
{
  "namespace": "epic",
  "ttl": null,
  "enableAgentDB": true,
  "swarmMemory": { "ttl": 86400000 }
}
```

---

### 🪝 Hook System Integration
**Role:** Automated coordination and state management

- **Pre-Task Hook** → Restore epic context + ADRs before agent starts
- **Post-Task Hook** → Update epic memory + sync GitHub
- **Post-Edit Hook** → Track file changes to epic
- **Session Hooks** → Create checkpoints, persist/restore state

**Key Config:**
```json
{
  "preTask": { "restoreContext": true },
  "postTask": { "syncGitHub": true },
  "session": { "createCheckpoints": true }
}
```

---

### 🧠 Neural/Learning Integration
**Role:** Pattern recognition and optimization

- **Pattern Learning** → Successful epic completion patterns → Model training
- **Agent Performance Tracking** → Optimize future assignments
- **Duration Prediction** → Estimate epic timeline from historical data
- **Issue Auto-Classification** → Apply labels and priorities

**Key Config:**
```json
{
  "patternRecognition": {
    "patterns": ["task-sequences", "agent-assignments"],
    "confidenceThreshold": 0.7
  },
  "optimization": { "agentAssignment": true }
}
```

---

## Critical Data Flows

### 1. Epic Creation → Agent Assignment

```
GitHub Epic Created
  ↓
Memory: Store Context (epic:{epicId}:context)
  ↓
Maestro: Generate Spec (epic:{epicId}:maestro-spec)
  ↓
SPARC: Create Phase Issues (milestones)
  ↓
Swarm: Select Topology (based on complexity)
  ↓
Hive-Mind: Spawn Workers (based on capabilities)
  ↓
Agents: Self-Select Issues (fit score > 0.7)
  ↓
Memory: Store Assignments (epic:{epicId}:agents:{agentId})
```

### 2. Agent Completes Task

```
Agent: Task Completed
  ↓
Hooks: Post-Task Trigger
  ↓
Memory: Update (epic:{epicId}:tasks:{taskId})
  ↓
GitHub: Comment on Issue + Close if complete
  ↓
Neural: Extract Patterns for Learning
  ↓
Maestro: Check Phase Advancement
  ↓
SPARC: Advance to Next Phase (if criteria met)
```

### 3. Architectural Decision Required

```
Agent: Proposes Decision
  ↓
Hive-Mind: Build Consensus (weighted algorithm)
  ↓
Queen Vote (3x weight) + Worker Votes
  ↓
Consensus Reached (> 60% approval)
  ↓
ADR Manager: Create ADR
  ↓
Memory: Store (epic:{epicId}:decisions)
  ↓
AgentDB: Insert (vector embedding)
  ↓
GitHub: Update Epic Body with ADR link
```

---

## Memory Namespace Organization

```
epic:{epicId}:context                    # Core epic metadata
epic:{epicId}:maestro-spec              # Maestro specification
epic:{epicId}:sparc-spec                # SPARC specification
epic:{epicId}:steering                  # Steering documents
epic:{epicId}:current-phase             # Current Maestro phase
epic:{epicId}:decisions                 # Architectural decisions
epic:{epicId}:tasks:{taskId}            # Task completion data
epic:{epicId}:agents:{agentId}          # Agent assignments
epic:{epicId}:files:{filepath}          # File change tracking
epic:{epicId}:checkpoint:latest         # Latest checkpoint
epic:{epicId}:metrics                   # Performance metrics

swarm:{swarmId}:epic:{epicId}:*         # Swarm-specific data
learned:epic-patterns:{epicId}          # Neural learned patterns
```

---

## GitHub Event → System Handler Mapping

| GitHub Event | Primary Handler | Systems Triggered |
|-------------|-----------------|-------------------|
| `issues.opened` (epic) | `EpicCoordinator.createEpicFromIssue()` | Memory → Maestro → SPARC → Swarm → Hive-Mind |
| `issues.edited` | `ContextSynchronizer.syncFromGitHub()` | Memory → Maestro |
| `issues.closed` | `EpicCoordinator.closeEpic()` | All (cleanup + learning) |
| `issues.assigned` | `SwarmCoordinator.updateAssignments()` | Swarm → Memory |
| `pull_request.opened` | `PeerValidator.routeReviewRequest()` | Hive-Mind (consensus) |
| `milestone.closed` | `MaestroCoordinator.advancePhase()` | Maestro → SPARC |

---

## Configuration Checklist

### Essential Settings

- [ ] **GitHub Integration**: Webhook URL, secret, repo configured
- [ ] **Memory**: Epic namespace enabled, AgentDB configured
- [ ] **Hive-Mind**: Queen type set to "strategic", consensus enabled
- [ ] **Maestro**: Specs directory configured, auto-create enabled
- [ ] **SPARC**: Phase auto-generation enabled, TDD workflow active
- [ ] **Swarm**: Auto-topology enabled, max agents set
- [ ] **Hooks**: Epic hooks enabled, context restoration active
- [ ] **Neural**: Pattern recognition enabled, optimization active

### Master Config File

**Location:** `.claude-flow/epic-integration-config.json`

```json
{
  "version": "1.0.0",
  "epicIntegration": {
    "enabled": true,
    "githubRepo": "owner/repo",
    "epicLabel": "epic",
    "webhookEnabled": true
  },
  "systems": {
    "hiveMind": { "enabled": true, "queenType": "strategic" },
    "maestro": { "enabled": true, "autoCreateSpec": true },
    "sparc": { "enabled": true, "tddWorkflow": { "enabled": true } },
    "swarm": { "enabled": true, "maxAgents": 12 },
    "memory": { "enabled": true, "enableAgentDB": true },
    "hooks": { "enabled": true },
    "neural": { "enabled": true }
  }
}
```

---

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- Epic Context Manager
- GitHub API extensions
- Memory namespace

### Phase 2: Hive-Mind (Weeks 3-4)
- Queen evaluation
- Consensus mechanisms
- Worker self-selection

### Phase 3: Maestro & SPARC (Weeks 5-6)
- Spec generation
- Phase management
- TDD workflows

### Phase 4: Swarm (Weeks 7-8)
- Topology selection
- Task orchestration
- Dynamic assignment

### Phase 5: Hooks & Neural (Weeks 9-10)
- Hook handlers
- Pattern learning
- Performance optimization

### Phase 6: Integration (Weeks 11-12)
- End-to-end testing
- Performance tuning
- Production deployment

---

## Key Architectural Principles

1. **Epic-Centric Context**: All systems read/write to `epic:{epicId}` namespace
2. **Agent Autonomy**: Self-selection based on capability fit scores
3. **Peer Coordination**: Hive-Mind consensus for architectural decisions
4. **Persistent Memory**: All context survives session boundaries
5. **Event-Driven Sync**: GitHub webhooks trigger bidirectional synchronization
6. **Pattern Learning**: Neural systems optimize based on historical data
7. **Phase-Based Progress**: Maestro/SPARC phases tied to epic milestones

---

## Success Metrics

### Epic Workflow Efficiency
- **Agent Self-Selection Rate**: >80% of issues self-assigned within 1 hour
- **Consensus Speed**: Architectural decisions reached within 30 minutes
- **Context Restoration**: <5 seconds to restore full epic context
- **Phase Advancement**: Automatic phase progression within 1 hour of completion

### Quality Metrics
- **Test Coverage**: 90%+ on all epic implementations
- **ADR Documentation**: 100% of architectural decisions documented
- **Peer Review Rate**: 100% of PRs reviewed before merge
- **Pattern Learning**: 85%+ accuracy in duration predictions after 10 epics

### Performance Metrics
- **Memory Efficiency**: <100MB per active epic in memory
- **GitHub Sync Latency**: <10 seconds from event to memory update
- **Agent Assignment Time**: <30 seconds from issue creation to assignment
- **Neural Prediction Accuracy**: >80% within 20% of actual duration

---

## Related Documentation

- **Full Integration Matrix**: [teammate-driven-integration-matrix.md](./teammate-driven-integration-matrix.md)
- **Epic-Driven Context Persistence**: [epic-driven-context-persistence.md](./epic-driven-context-persistence.md)
- **Strategic Vision**: [../../teammate-driven-agents-strategic-vision.md](../../docs/teammate-driven-agents-strategic-vision.md)
- **Epic SDK Integration**: [../../claude-flow/docs/integrations/epic-sdk/epic-sdk-integration.md](../../claude-flow/docs/integrations/epic-sdk/epic-sdk-integration.md)

---

**Version:** 1.0.0
**Last Updated:** 2025-12-09
**Next Review:** 2026-01-09
