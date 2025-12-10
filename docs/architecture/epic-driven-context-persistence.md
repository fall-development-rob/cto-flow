# Epic-Driven Context Persistence - Technical Architecture

**Version:** 1.0
**Date:** 2025-12-09
**Status:** Design Phase
**Author:** System Architecture Designer

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Architecture Overview](#architecture-overview)
4. [Component Design](#component-design)
5. [Database Schema](#database-schema)
6. [API Contracts](#api-contracts)
7. [Context Lifecycle State Machine](#context-lifecycle-state-machine)
8. [Integration Points](#integration-points)
9. [Architecture Decision Records](#architecture-decision-records)
10. [Security & Performance](#security--performance)
11. [Implementation Roadmap](#implementation-roadmap)

---

## 1. Executive Summary

Epic-Driven Context Persistence (EDCP) solves the critical problem of context loss during long-running development workflows when Claude's context window is exhausted. By linking GitHub epics/issues to persistent memory stores, agents can maintain continuity across sessions, restore context on-demand, and track architectural decisions over time.

### Key Benefits
- **Context Continuity**: Agents resume work with full context after session restarts
- **Architectural Memory**: ADRs versioned and accessible across project lifetime
- **GitHub Integration**: Bidirectional sync keeps issues and memory aligned
- **Agent Coordination**: Shared context enables multi-agent collaboration
- **Cross-Session Learning**: Patterns and decisions persist beyond individual sessions

---

## 2. Problem Statement

### Current Pain Points

1. **Context Window Exhaustion**: Long development sessions lose critical context
2. **Session Isolation**: Each new session starts from scratch
3. **Decision Loss**: Architectural decisions scattered across chats and issues
4. **Agent Amnesia**: Agents cannot access decisions made in previous sessions
5. **GitHub Disconnect**: Issues updated but claude-flow memory not synchronized

### Requirements

**Must Have:**
- Persistent storage linking GitHub epics → claude-flow memory
- Bidirectional synchronization between GitHub and memory
- Context restoration capability for agents
- Architectural decision logging with versioning
- State machine for context lifecycle

**Should Have:**
- Automatic context summarization
- Cross-epic dependency tracking
- Performance metrics for context operations
- Conflict resolution for concurrent updates

**Could Have:**
- ML-based context relevance scoring
- Predictive context prefetching
- Visual context dependency graphs

---

## 3. Architecture Overview

### System Architecture Diagram (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Claude-Flow System                          │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Epic Context Layer (NEW)                      │ │
│  │                                                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │ EpicContext  │  │   Context    │  │     ADR      │    │ │
│  │  │   Manager    │──│ Synchronizer │──│   Manager    │    │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │ │
│  │         │                  │                  │             │ │
│  └─────────┼──────────────────┼──────────────────┼────────────┘ │
│            │                  │                  │               │
│  ┌─────────▼──────────────────▼──────────────────▼────────────┐ │
│  │        Existing Memory Layer (EXTENDED)                    │ │
│  │                                                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │   Unified    │  │   Swarm      │  │   SQLite     │    │ │
│  │  │   Memory     │──│   Memory     │──│    Store     │    │ │
│  │  │   Manager    │  │              │  │              │    │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │        Agent Layer (USES EPIC CONTEXT)                   │ │
│  │                                                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │
│  │  │    Agent     │  │    Agent     │  │   Swarm      │  │ │
│  │  │   Registry   │──│   Manager    │──│ Coordinator  │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                ┌─────────▼──────────┐
                │   GitHub API       │
                │   Integration      │
                │                    │
                │  • Issues API      │
                │  • Comments API    │
                │  • Labels API      │
                │  • GraphQL API     │
                └────────────────────┘
```

### Architectural Principles

1. **Separation of Concerns**: Epic context layer is independent but integrates cleanly
2. **Backwards Compatibility**: Existing memory systems continue working unchanged
3. **Event-Driven**: State changes emit events for loose coupling
4. **Fail-Safe**: Graceful degradation if GitHub sync fails
5. **Performance-First**: Caching and lazy-loading for large contexts

---

## 4. Component Design

### 4.1 EpicContext Class

**Purpose**: Persistent container linking GitHub epic → claude-flow context

**Location**: `/src/memory/epic-context.js`

**Class Structure**:

```javascript
export class EpicContext {
  constructor(options = {}) {
    this.epicId = options.epicId;              // GitHub issue number
    this.repository = options.repository;       // owner/repo
    this.memory = options.memory;              // UnifiedMemoryManager instance
    this.namespace = `epic:${epicId}`;         // Isolated namespace

    // State tracking
    this.state = 'uninitialized';             // State machine current state
    this.metadata = {
      createdAt: null,
      lastSyncAt: null,
      lastAccessedAt: null,
      contextVersion: 0,
      contextHash: null
    };

    // Context data
    this.contextData = {
      epic: null,                             // GitHub issue data
      tasks: [],                              // Sub-tasks from memory
      agents: [],                             // Agents working on this epic
      decisions: [],                          // ADR references
      files: new Set(),                       // Files touched
      dependencies: [],                       // Related epics
      timeline: []                            // Event timeline
    };

    // Cache
    this.cache = new Map();
    this.cacheTTL = 300000;                  // 5 minutes
  }

  // Lifecycle methods
  async initialize() { /* ... */ }
  async restore() { /* ... */ }
  async save() { /* ... */ }
  async archive() { /* ... */ }
  async destroy() { /* ... */ }

  // Context operations
  async addTask(task) { /* ... */ }
  async addAgent(agentId, role) { /* ... */ }
  async addDecision(adr) { /* ... */ }
  async addFile(filepath, operation) { /* ... */ }
  async addDependency(epicId, type) { /* ... */ }
  async recordEvent(event) { /* ... */ }

  // Query operations
  async getContext(includeArchived = false) { /* ... */ }
  async getTasksByStatus(status) { /* ... */ }
  async getActiveAgents() { /* ... */ }
  async getDecisionHistory() { /* ... */ }
  async getFileChanges() { /* ... */ }

  // Sync operations
  async syncFromGitHub() { /* ... */ }
  async syncToGitHub() { /* ... */ }
  async resolveConflicts(strategy) { /* ... */ }

  // State machine transitions
  transitionTo(newState) { /* ... */ }
  canTransitionTo(newState) { /* ... */ }

  // Compression and optimization
  async compressOldEvents() { /* ... */ }
  async summarizeContext() { /* ... */ }
}
```

**Key Design Decisions**:

- **Namespace Isolation**: Each epic gets isolated namespace preventing cross-contamination
- **Versioned Context**: Hash-based versioning detects concurrent modifications
- **Lazy Loading**: Context data loaded on-demand, not constructor time
- **Event Sourcing**: Timeline tracks all changes for debugging and rollback
- **Compression**: Old events automatically compressed to manage storage

### 4.2 ContextSynchronizer Class

**Purpose**: Bidirectional sync between GitHub issues and memory

**Location**: `/src/memory/context-synchronizer.js`

**Class Structure**:

```javascript
export class ContextSynchronizer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.githubAPI = options.githubAPI;       // GitHubAPIClient instance
    this.memory = options.memory;             // UnifiedMemoryManager instance
    this.syncInterval = options.syncInterval || 300000; // 5 minutes
    this.conflictStrategy = options.conflictStrategy || 'github-wins';

    // Sync state
    this.syncQueue = [];
    this.syncing = false;
    this.lastSyncTime = null;

    // Webhook support
    this.webhookEnabled = options.webhookEnabled || false;
    this.webhookSecret = options.webhookSecret;
  }

  // Lifecycle
  async start() { /* ... */ }
  async stop() { /* ... */ }

  // Sync operations
  async syncEpic(epicId, direction = 'bidirectional') { /* ... */ }
  async syncFromGitHub(epicId) { /* ... */ }
  async syncToGitHub(epicId) { /* ... */ }
  async syncBidirectional(epicId) { /* ... */ }

  // Conflict resolution
  async detectConflicts(epicId) { /* ... */ }
  async resolveConflict(conflict, strategy) { /* ... */ }

  // Webhook handling
  async handleWebhook(event, payload) { /* ... */ }
  async processIssueUpdate(issueData) { /* ... */ }
  async processCommentAdded(commentData) { /* ... */ }

  // Batch operations
  async syncAllEpics(repository) { /* ... */ }
  async syncEpicsByLabel(repository, label) { /* ... */ }

  // Monitoring
  getSyncStatus() { /* ... */ }
  getSyncMetrics() { /* ... */ }
}
```

**Sync Strategies**:

1. **github-wins**: GitHub issue is source of truth (default for external updates)
2. **memory-wins**: Memory is source of truth (default for agent updates)
3. **merge**: Intelligent merge based on timestamps and field types
4. **manual**: Flag conflict for human review

**Conflict Detection**:

```javascript
{
  conflictType: 'concurrent-update',
  field: 'description',
  githubValue: '...',
  githubUpdatedAt: '2025-12-09T10:00:00Z',
  memoryValue: '...',
  memoryUpdatedAt: '2025-12-09T10:05:00Z',
  resolution: null
}
```

### 4.3 ArchitecturalDecisionLog (ADR) Manager

**Purpose**: Versioned record of decisions accessible across sessions

**Location**: `/src/memory/adr-manager.js`

**Class Structure**:

```javascript
export class ADRManager {
  constructor(options = {}) {
    this.memory = options.memory;
    this.namespace = 'adrs';
    this.indexNamespace = 'adr-index';

    // ADR templates
    this.templates = {
      standard: ADRTemplate,
      lightweight: LightweightADRTemplate,
      madr: MADRTemplate
    };
  }

  // ADR operations
  async createADR(adrData) { /* ... */ }
  async updateADR(adrId, updates) { /* ... */ }
  async supersede(adrId, newAdrId, reason) { /* ... */ }
  async deprecate(adrId, reason) { /* ... */ }

  // Query operations
  async getADR(adrId, version = 'latest') { /* ... */ }
  async getADRsByStatus(status) { /* ... */ }
  async getADRsByContext(contextTags) { /* ... */ }
  async getADRHistory(adrId) { /* ... */ }
  async searchADRs(query) { /* ... */ }

  // Linking operations
  async linkToEpic(adrId, epicId) { /* ... */ }
  async linkToAgent(adrId, agentId) { /* ... */ }
  async linkRelatedADRs(adrId, relatedIds, relationship) { /* ... */ }

  // Export/Import
  async exportADR(adrId, format = 'markdown') { /* ... */ }
  async exportAllADRs(directory) { /* ... */ }
  async importADR(filepath) { /* ... */ }

  // Statistics
  async getADRStats() { /* ... */ }
}
```

**ADR Data Structure**:

```javascript
{
  id: 'adr-001',
  version: 3,
  status: 'accepted',                    // proposed|accepted|superseded|deprecated
  title: 'Use SQLite for persistent memory',
  context: 'Need persistent storage across sessions...',
  decision: 'We will use SQLite with better-sqlite3...',
  consequences: {
    positive: ['Fast queries', 'ACID compliance'],
    negative: ['File locking in concurrent scenarios'],
    risks: ['Database corruption on hard crashes']
  },
  alternatives: [
    { name: 'PostgreSQL', rejected_reason: 'Too heavy for local dev' },
    { name: 'JSON files', rejected_reason: 'No transaction support' }
  ],
  metadata: {
    createdAt: '2025-12-01T10:00:00Z',
    updatedAt: '2025-12-09T15:30:00Z',
    author: 'agent-architect-001',
    reviewers: ['agent-reviewer-001'],
    epicId: 'epic-123',
    tags: ['database', 'persistence', 'architecture'],
    supersedes: null,
    supersededBy: null
  },
  versionHistory: [
    { version: 1, timestamp: '...', changes: '...' },
    { version: 2, timestamp: '...', changes: '...' }
  ]
}
```

### 4.4 ContextRestoration Service

**Purpose**: Rebuild agent context from epic state on session start

**Location**: `/src/memory/context-restoration.js`

**Class Structure**:

```javascript
export class ContextRestoration {
  constructor(options = {}) {
    this.memory = options.memory;
    this.epicContextManager = options.epicContextManager;
    this.adrManager = options.adrManager;
    this.agentRegistry = options.agentRegistry;

    // Restoration strategy
    this.strategy = options.strategy || 'comprehensive';
    this.maxContextSize = options.maxContextSize || 100000; // chars
  }

  // Restoration operations
  async restoreEpicContext(epicId, targetAgent) { /* ... */ }
  async restorePartialContext(epicId, aspectsToRestore) { /* ... */ }
  async restoreMultiEpicContext(epicIds, targetAgent) { /* ... */ }

  // Context building
  async buildContextSummary(epicId) { /* ... */ }
  async buildTaskContext(tasks) { /* ... */ }
  async buildDecisionContext(adrs) { /* ... */ }
  async buildFileContext(files) { /* ... */ }

  // Context optimization
  async compressContext(context, targetSize) { /* ... */ }
  async prioritizeContext(context, agentRole) { /* ... */ }
  async estimateContextSize(context) { /* ... */ }

  // Agent injection
  async injectContextIntoAgent(agentId, context) { /* ... */ }
  async createContextPrompt(context, agentRole) { /* ... */ }

  // Validation
  async validateRestoredContext(epicId, context) { /* ... */ }

  // Metrics
  getRestorationMetrics() { /* ... */ }
}
```

**Restoration Strategies**:

1. **comprehensive**: Full context including all history
2. **summary**: Compressed summary for quick orientation
3. **recent**: Only recent activity (last N events)
4. **role-specific**: Context filtered by agent role
5. **lazy**: Minimal initial context, load on-demand

---

## 5. Database Schema

### 5.1 Schema Extensions to SQLite Store

**New Tables**:

```sql
-- Epic Contexts
CREATE TABLE epic_contexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epic_id TEXT NOT NULL,
  repository TEXT NOT NULL,
  state TEXT NOT NULL,                    -- uninitialized|active|archived|destroyed
  context_version INTEGER DEFAULT 0,
  context_hash TEXT,
  github_issue_data TEXT,                 -- JSON
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_sync_at INTEGER,
  last_accessed_at INTEGER,
  UNIQUE(epic_id, repository)
);

CREATE INDEX idx_epic_contexts_state ON epic_contexts(state);
CREATE INDEX idx_epic_contexts_repo ON epic_contexts(repository);
CREATE INDEX idx_epic_contexts_updated ON epic_contexts(updated_at);

-- Epic Tasks
CREATE TABLE epic_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epic_context_id INTEGER NOT NULL,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,                   -- pending|in_progress|completed|failed
  priority TEXT,
  assigned_agents TEXT,                   -- JSON array
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  completed_at INTEGER,
  metadata TEXT,                          -- JSON
  FOREIGN KEY (epic_context_id) REFERENCES epic_contexts(id) ON DELETE CASCADE
);

CREATE INDEX idx_epic_tasks_epic ON epic_tasks(epic_context_id);
CREATE INDEX idx_epic_tasks_status ON epic_tasks(status);

-- Epic Agents
CREATE TABLE epic_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epic_context_id INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,                   -- active|idle|removed
  joined_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_activity_at INTEGER,
  tasks_completed INTEGER DEFAULT 0,
  metadata TEXT,                          -- JSON
  FOREIGN KEY (epic_context_id) REFERENCES epic_contexts(id) ON DELETE CASCADE
);

CREATE INDEX idx_epic_agents_epic ON epic_agents(epic_context_id);
CREATE INDEX idx_epic_agents_status ON epic_agents(status);

-- Architectural Decision Records
CREATE TABLE adrs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adr_id TEXT NOT NULL UNIQUE,
  version INTEGER DEFAULT 1,
  status TEXT NOT NULL,                   -- proposed|accepted|superseded|deprecated
  title TEXT NOT NULL,
  context_description TEXT,
  decision TEXT NOT NULL,
  consequences TEXT,                      -- JSON
  alternatives TEXT,                      -- JSON
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  author TEXT,
  reviewers TEXT,                         -- JSON array
  supersedes TEXT,
  superseded_by TEXT,
  metadata TEXT                           -- JSON
);

CREATE INDEX idx_adrs_status ON adrs(status);
CREATE INDEX idx_adrs_created ON adrs(created_at);

-- ADR to Epic Links
CREATE TABLE adr_epic_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adr_id TEXT NOT NULL,
  epic_context_id INTEGER NOT NULL,
  relationship TEXT DEFAULT 'documents',  -- documents|implements|supersedes
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (epic_context_id) REFERENCES epic_contexts(id) ON DELETE CASCADE
);

CREATE INDEX idx_adr_epic_adr ON adr_epic_links(adr_id);
CREATE INDEX idx_adr_epic_epic ON adr_epic_links(epic_context_id);

-- Epic Dependencies
CREATE TABLE epic_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_epic_id INTEGER NOT NULL,
  target_epic_id INTEGER NOT NULL,
  dependency_type TEXT NOT NULL,          -- blocks|depends_on|relates_to|parent_of
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  metadata TEXT,                          -- JSON
  FOREIGN KEY (source_epic_id) REFERENCES epic_contexts(id) ON DELETE CASCADE,
  FOREIGN KEY (target_epic_id) REFERENCES epic_contexts(id) ON DELETE CASCADE
);

CREATE INDEX idx_epic_deps_source ON epic_dependencies(source_epic_id);
CREATE INDEX idx_epic_deps_target ON epic_dependencies(target_epic_id);

-- Epic File Changes
CREATE TABLE epic_file_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epic_context_id INTEGER NOT NULL,
  filepath TEXT NOT NULL,
  operation TEXT NOT NULL,                -- created|modified|deleted|renamed
  agent_id TEXT,
  task_id TEXT,
  timestamp INTEGER DEFAULT (strftime('%s', 'now')),
  metadata TEXT,                          -- JSON (includes old path for renames)
  FOREIGN KEY (epic_context_id) REFERENCES epic_contexts(id) ON DELETE CASCADE
);

CREATE INDEX idx_epic_files_epic ON epic_file_changes(epic_context_id);
CREATE INDEX idx_epic_files_path ON epic_file_changes(filepath);

-- Epic Timeline Events
CREATE TABLE epic_timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epic_context_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL,               -- JSON
  agent_id TEXT,
  timestamp INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (epic_context_id) REFERENCES epic_contexts(id) ON DELETE CASCADE
);

CREATE INDEX idx_epic_timeline_epic ON epic_timeline(epic_context_id);
CREATE INDEX idx_epic_timeline_timestamp ON epic_timeline(timestamp);

-- Sync Metadata
CREATE TABLE sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  epic_context_id INTEGER NOT NULL,
  sync_direction TEXT NOT NULL,           -- from_github|to_github|bidirectional
  sync_status TEXT NOT NULL,              -- success|failed|conflict
  started_at INTEGER DEFAULT (strftime('%s', 'now')),
  completed_at INTEGER,
  conflicts TEXT,                         -- JSON array
  error_message TEXT,
  FOREIGN KEY (epic_context_id) REFERENCES epic_contexts(id) ON DELETE CASCADE
);

CREATE INDEX idx_sync_meta_epic ON sync_metadata(epic_context_id);
CREATE INDEX idx_sync_meta_status ON sync_metadata(sync_status);
```

### 5.2 Namespace Extensions in Unified Memory

**New Namespaces**:

```javascript
const EPIC_NAMESPACES = {
  CONTEXTS: 'epic:contexts',
  TASKS: 'epic:tasks',
  AGENTS: 'epic:agents',
  DECISIONS: 'epic:decisions',
  FILES: 'epic:files',
  TIMELINE: 'epic:timeline',
  SYNC: 'epic:sync',
  CACHE: 'epic:cache'
};
```

---

## 6. API Contracts

### 6.1 EpicContext API

```javascript
// Initialize new epic context
POST /api/epic-context
{
  "epicId": "123",
  "repository": "owner/repo",
  "initialData": {
    "title": "...",
    "description": "..."
  }
}
→ { epicContextId, state: "active", namespace }

// Restore epic context
GET /api/epic-context/:epicId/restore
?strategy=comprehensive&agentId=agent-123
→ { context, metadata, restorationMetrics }

// Add task to epic
POST /api/epic-context/:epicId/tasks
{
  "taskId": "task-456",
  "title": "...",
  "assignedAgents": ["agent-123"]
}
→ { taskId, added: true }

// Record decision
POST /api/epic-context/:epicId/decisions
{
  "adrId": "adr-001",
  "relationship": "implements"
}
→ { linked: true }

// Get epic context
GET /api/epic-context/:epicId
?includeArchived=false&depth=full
→ { contextData, metadata, state }

// Sync with GitHub
POST /api/epic-context/:epicId/sync
{
  "direction": "bidirectional",
  "conflictStrategy": "merge"
}
→ { synced: true, conflicts: [], syncedAt }

// Archive epic
POST /api/epic-context/:epicId/archive
{
  "reason": "completed",
  "preserveData": true
}
→ { archived: true, archiveLocation }
```

### 6.2 ContextSynchronizer API

```javascript
// Start synchronizer
POST /api/sync/start
{
  "syncInterval": 300000,
  "webhookEnabled": true
}
→ { started: true, syncId }

// Sync single epic
POST /api/sync/epic/:epicId
{
  "direction": "from_github",
  "force": false
}
→ { synced: true, changes: [...] }

// Batch sync
POST /api/sync/batch
{
  "repository": "owner/repo",
  "label": "epic",
  "direction": "bidirectional"
}
→ { synced: 5, failed: 0, conflicts: [...] }

// Handle webhook
POST /api/sync/webhook
Headers: X-GitHub-Event, X-Hub-Signature-256
Body: GitHub webhook payload
→ { processed: true, epicId, action }

// Get sync status
GET /api/sync/status
→ { syncing, lastSyncTime, queueSize, metrics }

// Resolve conflict
POST /api/sync/conflicts/:conflictId/resolve
{
  "strategy": "github-wins",
  "manualResolution": null
}
→ { resolved: true, appliedValue }
```

### 6.3 ADRManager API

```javascript
// Create ADR
POST /api/adr
{
  "title": "...",
  "context": "...",
  "decision": "...",
  "consequences": {...},
  "author": "agent-123",
  "epicId": "epic-456"
}
→ { adrId, version: 1, status: "proposed" }

// Update ADR
PATCH /api/adr/:adrId
{
  "status": "accepted",
  "reviewers": ["agent-789"]
}
→ { adrId, version: 2, updated: true }

// Get ADR with history
GET /api/adr/:adrId
?includeHistory=true&version=latest
→ { adr, versionHistory: [...] }

// Search ADRs
GET /api/adr/search
?query=database&status=accepted&tags=architecture
→ { results: [...], total: 5 }

// Link ADR to epic
POST /api/adr/:adrId/link/epic/:epicId
{
  "relationship": "implements"
}
→ { linked: true }

// Export ADR
GET /api/adr/:adrId/export
?format=markdown
→ File download or markdown string

// Get ADR statistics
GET /api/adr/stats
→ { total, byStatus, byTag, avgDecisionTime }
```

### 6.4 ContextRestoration API

```javascript
// Restore context for agent
POST /api/restore/epic/:epicId/agent/:agentId
{
  "strategy": "role-specific",
  "maxContextSize": 50000,
  "aspects": ["tasks", "decisions", "files"]
}
→ { context, summary, estimatedTokens }

// Restore multi-epic context
POST /api/restore/multi-epic
{
  "epicIds": ["epic-1", "epic-2"],
  "agentId": "agent-123",
  "strategy": "summary"
}
→ { consolidatedContext, sources: [...] }

// Get context summary
GET /api/restore/epic/:epicId/summary
→ { summary, keyPoints, recentActivity }

// Validate restored context
POST /api/restore/validate
{
  "epicId": "epic-123",
  "context": {...}
}
→ { valid: true, warnings: [], completeness: 0.95 }

// Get restoration metrics
GET /api/restore/metrics
→ { avgRestorationTime, avgContextSize, successRate }
```

---

## 7. Context Lifecycle State Machine

### 7.1 States

```
┌─────────────────┐
│ UNINITIALIZED   │ ──create──> ┌──────────┐
└─────────────────┘             │  ACTIVE  │
                                └────┬─────┘
                                     │
                     ┌───────────────┼───────────────┐
                     │               │               │
                  pause           archive         error
                     │               │               │
                     ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │  PAUSED  │    │ ARCHIVED │    │  ERROR   │
              └────┬─────┘    └────┬─────┘    └────┬─────┘
                   │               │               │
                resume          restore         recover
                   │               │               │
                   └───────────────┴───────────────┘
                                   │
                                destroy
                                   │
                                   ▼
                            ┌──────────┐
                            │DESTROYED │
                            └──────────┘
```

### 7.2 State Definitions

| State | Description | Allowed Operations | Next States |
|-------|-------------|-------------------|-------------|
| **UNINITIALIZED** | Epic context created but not initialized | initialize, destroy | ACTIVE, DESTROYED |
| **ACTIVE** | Normal operational state | add*, update*, sync, query, pause, archive, error | PAUSED, ARCHIVED, ERROR |
| **PAUSED** | Temporarily inactive (agent idle) | resume, archive, destroy | ACTIVE, ARCHIVED, DESTROYED |
| **ARCHIVED** | Long-term storage, read-only | restore, query, destroy | ACTIVE, DESTROYED |
| **ERROR** | Recoverable error state | recover, archive, destroy | ACTIVE, ARCHIVED, DESTROYED |
| **DESTROYED** | Permanently removed | none (terminal) | none |

### 7.3 State Transition Logic

```javascript
class EpicContextStateMachine {
  static STATES = {
    UNINITIALIZED: 'uninitialized',
    ACTIVE: 'active',
    PAUSED: 'paused',
    ARCHIVED: 'archived',
    ERROR: 'error',
    DESTROYED: 'destroyed'
  };

  static TRANSITIONS = {
    [this.STATES.UNINITIALIZED]: {
      initialize: this.STATES.ACTIVE,
      destroy: this.STATES.DESTROYED
    },
    [this.STATES.ACTIVE]: {
      pause: this.STATES.PAUSED,
      archive: this.STATES.ARCHIVED,
      error: this.STATES.ERROR
    },
    [this.STATES.PAUSED]: {
      resume: this.STATES.ACTIVE,
      archive: this.STATES.ARCHIVED,
      destroy: this.STATES.DESTROYED
    },
    [this.STATES.ARCHIVED]: {
      restore: this.STATES.ACTIVE,
      destroy: this.STATES.DESTROYED
    },
    [this.STATES.ERROR]: {
      recover: this.STATES.ACTIVE,
      archive: this.STATES.ARCHIVED,
      destroy: this.STATES.DESTROYED
    },
    [this.STATES.DESTROYED]: {}
  };

  static canTransition(currentState, action) {
    const allowedTransitions = this.TRANSITIONS[currentState];
    return allowedTransitions && allowedTransitions.hasOwnProperty(action);
  }

  static getNextState(currentState, action) {
    if (!this.canTransition(currentState, action)) {
      throw new Error(`Invalid transition: ${currentState} -> ${action}`);
    }
    return this.TRANSITIONS[currentState][action];
  }
}
```

### 7.4 State Change Events

```javascript
// Emitted on state transitions
{
  event: 'epic:stateChanged',
  epicId: 'epic-123',
  oldState: 'active',
  newState: 'archived',
  reason: 'epic completed',
  timestamp: '2025-12-09T16:00:00Z',
  triggeredBy: 'agent-456'
}
```

---

## 8. Integration Points

### 8.1 Integration with Existing Memory Systems

**UnifiedMemoryManager Integration**:

```javascript
// Extend UnifiedMemoryManager
export class UnifiedMemoryManager {
  constructor(options = {}) {
    // ... existing code ...

    // NEW: Epic context support
    this.epicContextManager = null;
    this.epicEnabled = options.epicEnabled !== false;
  }

  async initialize() {
    await super.initialize();

    // NEW: Initialize epic context manager
    if (this.epicEnabled) {
      this.epicContextManager = new EpicContextManager({
        memory: this,
        githubAPI: options.githubAPI
      });
      await this.epicContextManager.initialize();
    }
  }

  // NEW: Epic-aware storage
  async store(key, value, options = {}) {
    // If epicId provided, store in epic namespace
    if (options.epicId) {
      const epicContext = await this.epicContextManager.getOrCreateContext(options.epicId);
      return await epicContext.storeInContext(key, value, options);
    }

    // Otherwise use existing logic
    return await super.store(key, value, options);
  }

  // NEW: Epic-aware retrieval
  async retrieve(key, options = {}) {
    if (options.epicId) {
      const epicContext = await this.epicContextManager.getContext(options.epicId);
      return epicContext ? await epicContext.retrieveFromContext(key, options) : null;
    }

    return await super.retrieve(key, options);
  }
}
```

**SwarmMemory Integration**:

```javascript
export class SwarmMemory extends SharedMemory {
  // NEW: Link swarm tasks to epics
  async storeTask(taskId, taskData) {
    const enrichedData = {
      ...taskData,
      epicId: taskData.epicId || null  // NEW: Epic reference
    };

    await super.storeTask(taskId, enrichedData);

    // NEW: If epic linked, update epic context
    if (enrichedData.epicId) {
      const epicContext = await this.epicContextManager.getContext(enrichedData.epicId);
      if (epicContext) {
        await epicContext.addTask({
          taskId,
          ...enrichedData
        });
      }
    }
  }
}
```

**AgentRegistry Integration**:

```javascript
export class AgentRegistry extends EventEmitter {
  // NEW: Register agent with epic context
  async registerAgent(agent, tags = []) {
    await super.registerAgent(agent, tags);

    // NEW: If agent working on epic, register in epic context
    if (agent.currentEpicId) {
      const epicContext = await this.epicContextManager.getContext(agent.currentEpicId);
      if (epicContext) {
        await epicContext.addAgent(agent.id.id, agent.type);
      }
    }
  }
}
```

### 8.2 Integration with GitHub API

**Event-Driven Sync**:

```javascript
// GitHub webhook handler in github-api.js
async handleIssuesEvent(eventData) {
  const action = eventData.action;
  const issue = eventData.issue;

  // NEW: If issue has epic label, trigger sync
  if (this.isEpicIssue(issue)) {
    await this.contextSynchronizer.syncFromGitHub(issue.number);
  }

  // Existing logic...
}

isEpicIssue(issue) {
  return issue.labels.some(label =>
    label.name === 'epic' || label.name.startsWith('epic:')
  );
}
```

**Polling Fallback**:

```javascript
// If webhooks not available, use polling
class PollingSync {
  constructor(githubAPI, syncInterval = 300000) {
    this.githubAPI = githubAPI;
    this.syncInterval = syncInterval;
    this.intervalId = null;
  }

  start() {
    this.intervalId = setInterval(async () => {
      const epics = await this.githubAPI.listIssues('owner/repo', {
        labels: 'epic',
        state: 'open'
      });

      for (const epic of epics.data) {
        await this.contextSynchronizer.syncFromGitHub(epic.number);
      }
    }, this.syncInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
```

### 8.3 Integration with Agent Workflows

**Hook Integration**:

```javascript
// Pre-task hook: Restore epic context
async function preTaskHook(taskData) {
  if (taskData.epicId) {
    const contextRestoration = new ContextRestoration({
      memory: unifiedMemory,
      epicContextManager
    });

    const context = await contextRestoration.restoreEpicContext(
      taskData.epicId,
      taskData.agentId
    );

    // Inject context into agent's working memory
    await contextRestoration.injectContextIntoAgent(taskData.agentId, context);
  }
}

// Post-task hook: Update epic context
async function postTaskHook(taskResult) {
  if (taskResult.epicId) {
    const epicContext = await epicContextManager.getContext(taskResult.epicId);

    // Record task completion
    await epicContext.addEvent({
      type: 'task_completed',
      taskId: taskResult.taskId,
      agentId: taskResult.agentId,
      result: taskResult.summary
    });

    // Update files touched
    if (taskResult.filesModified) {
      for (const file of taskResult.filesModified) {
        await epicContext.addFile(file.path, file.operation);
      }
    }
  }
}
```

---

## 9. Architecture Decision Records

### ADR-001: Use SQLite for Epic Context Storage

**Status**: Accepted
**Date**: 2025-12-09

**Context**:
Need persistent storage for epic contexts that survives process restarts and supports complex queries.

**Decision**:
Extend existing SQLite store with new tables for epic contexts, maintaining consistency with current architecture.

**Consequences**:
- **Positive**: Reuses proven storage layer, ACID compliance, fast queries
- **Negative**: File locking in concurrent scenarios, migration complexity
- **Risks**: Database corruption on crashes (mitigated by WAL mode)

**Alternatives Considered**:
1. **Separate PostgreSQL database**: Rejected - too heavy for local development
2. **JSON files per epic**: Rejected - no transaction support, poor query performance
3. **In-memory only**: Rejected - doesn't solve persistence problem

---

### ADR-002: Bidirectional Sync with GitHub

**Status**: Accepted
**Date**: 2025-12-09

**Context**:
Epics updated both in GitHub (by humans) and in claude-flow memory (by agents). Need to keep both in sync.

**Decision**:
Implement bidirectional synchronization with conflict detection and pluggable resolution strategies.

**Consequences**:
- **Positive**: Flexibility for different workflows, handles both directions
- **Negative**: Complexity in conflict resolution, potential data races
- **Risks**: Sync failures causing data drift (mitigated by retry logic and manual review)

**Alternatives Considered**:
1. **GitHub as single source of truth**: Rejected - loses agent-generated context
2. **Memory as single source of truth**: Rejected - loses external updates
3. **Manual sync only**: Rejected - high friction, error-prone

---

### ADR-003: Event Sourcing for Timeline

**Status**: Accepted
**Date**: 2025-12-09

**Context**:
Need to track all changes to epic context for debugging, rollback, and audit.

**Decision**:
Use event sourcing pattern: store all events in timeline, reconstruct state from events.

**Consequences**:
- **Positive**: Complete audit trail, enables rollback, facilitates debugging
- **Negative**: Storage grows over time, slower reads for large histories
- **Risks**: Event replay bugs (mitigated by snapshotting for old contexts)

**Alternatives Considered**:
1. **State-only storage**: Rejected - no history, can't debug or rollback
2. **Diff-based versioning**: Rejected - complex implementation, limited query capability
3. **Hybrid (events + snapshots)**: Deferred to future optimization phase

---

### ADR-004: Namespace Isolation Per Epic

**Status**: Accepted
**Date**: 2025-12-09

**Context**:
Multiple epics might have overlapping task IDs or agent assignments. Need to prevent cross-contamination.

**Decision**:
Each epic gets isolated namespace `epic:{epicId}` for all storage operations.

**Consequences**:
- **Positive**: Clear separation, no ID conflicts, easier cleanup
- **Negative**: Can't easily query across all epics (need multi-namespace queries)
- **Risks**: Namespace leakage if not enforced (mitigated by API encapsulation)

**Alternatives Considered**:
1. **Global namespace with epic prefix**: Rejected - easier to make mistakes
2. **Separate databases per epic**: Rejected - excessive overhead
3. **Epic ID as column only**: Rejected - doesn't prevent ID collisions

---

### ADR-005: Lazy Loading for Context Restoration

**Status**: Accepted
**Date**: 2025-12-09

**Context**:
Large epic contexts could exceed token limits if loaded entirely. Need smart loading strategy.

**Decision**:
Implement lazy loading: load summary first, load details on-demand as agent needs them.

**Consequences**:
- **Positive**: Fits within token limits, faster initial restoration
- **Negative**: Complexity in managing partial state, potential cache misses
- **Risks**: Agent missing critical context (mitigated by prioritization algorithm)

**Alternatives Considered**:
1. **Always load full context**: Rejected - exceeds token limits for large epics
2. **Aggressive compression**: Rejected - loses important details
3. **External context store accessed by agents**: Deferred - requires major agent refactor

---

## 10. Security & Performance

### 10.1 Security Considerations

**Threat Model**:

| Threat | Mitigation |
|--------|-----------|
| **Unauthorized access to epic contexts** | Implement access control based on agent permissions |
| **GitHub token exposure** | Store tokens encrypted, use env vars, never log |
| **Webhook payload tampering** | Verify HMAC signature before processing |
| **SQL injection in queries** | Use parameterized queries exclusively |
| **Context data exfiltration** | Audit all external sync operations |
| **Malicious ADR content** | Sanitize markdown, validate schema |

**Access Control**:

```javascript
class EpicAccessControl {
  static async canAccess(agentId, epicId, operation) {
    const agent = await agentRegistry.getAgent(agentId);
    const epic = await epicContextManager.getContext(epicId);

    // Check agent permissions
    if (operation === 'read') {
      return agent.capabilities.includes('read-epic-context');
    }

    if (operation === 'write') {
      // Only agents assigned to epic can write
      const assignedAgents = await epic.getActiveAgents();
      return assignedAgents.some(a => a.id === agentId);
    }

    if (operation === 'destroy') {
      // Only coordinator agents can destroy
      return agent.type === 'coordinator';
    }

    return false;
  }
}
```

### 10.2 Performance Optimization

**Caching Strategy**:

```javascript
class EpicContextCache {
  constructor() {
    this.l1Cache = new Map();        // In-memory, 5-minute TTL
    this.l2Cache = null;             // Future: Redis for distributed
    this.maxL1Size = 100;            // LRU eviction
  }

  async get(epicId, key) {
    // Try L1 cache
    const l1Key = `${epicId}:${key}`;
    if (this.l1Cache.has(l1Key)) {
      const entry = this.l1Cache.get(l1Key);
      if (Date.now() - entry.timestamp < 300000) {
        return entry.value;
      }
      this.l1Cache.delete(l1Key);
    }

    // Cache miss - load from DB
    const value = await this.loadFromDB(epicId, key);
    this.set(epicId, key, value);
    return value;
  }

  set(epicId, key, value) {
    // LRU eviction if cache full
    if (this.l1Cache.size >= this.maxL1Size) {
      const oldestKey = this.l1Cache.keys().next().value;
      this.l1Cache.delete(oldestKey);
    }

    this.l1Cache.set(`${epicId}:${key}`, {
      value,
      timestamp: Date.now()
    });
  }

  invalidate(epicId, key = null) {
    if (key) {
      this.l1Cache.delete(`${epicId}:${key}`);
    } else {
      // Invalidate all keys for epic
      for (const cacheKey of this.l1Cache.keys()) {
        if (cacheKey.startsWith(`${epicId}:`)) {
          this.l1Cache.delete(cacheKey);
        }
      }
    }
  }
}
```

**Query Optimization**:

```sql
-- Optimize timeline queries with composite index
CREATE INDEX idx_epic_timeline_epic_type_time
ON epic_timeline(epic_context_id, event_type, timestamp DESC);

-- Optimize file lookups
CREATE INDEX idx_epic_files_epic_path
ON epic_file_changes(epic_context_id, filepath);

-- Optimize ADR searches
CREATE INDEX idx_adrs_status_created
ON adrs(status, created_at DESC);
```

**Batch Operations**:

```javascript
// Batch sync multiple epics efficiently
async batchSyncEpics(epicIds) {
  // Fetch all GitHub issues in one API call
  const issues = await this.githubAPI.batchGetIssues(epicIds);

  // Batch database writes
  const statements = [];
  for (const issue of issues) {
    const epicContext = await this.getContext(issue.number);
    statements.push(epicContext.prepareSyncStatement(issue));
  }

  // Execute all writes in single transaction
  await this.memory.db.transaction(() => {
    for (const stmt of statements) {
      stmt.run();
    }
  });
}
```

**Performance Targets**:

| Operation | Target Latency | Notes |
|-----------|----------------|-------|
| Initialize epic context | < 100ms | Includes DB write |
| Restore context (summary) | < 200ms | 10KB context |
| Restore context (full) | < 500ms | 50KB context |
| Add task/event | < 50ms | Single DB insert |
| Sync from GitHub (single epic) | < 1s | Network dependent |
| Sync to GitHub (single epic) | < 1.5s | Network + rate limits |
| ADR creation | < 100ms | Includes versioning |
| Query ADRs (search) | < 200ms | With proper indexing |
| Cache hit | < 5ms | In-memory lookup |

---

## 11. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Deliverables**:
- [ ] Database schema migration scripts
- [ ] `EpicContext` class implementation
- [ ] Basic state machine implementation
- [ ] Unit tests for core functionality
- [ ] Integration with UnifiedMemoryManager

**Success Criteria**:
- Can create and restore epic contexts
- State transitions work correctly
- 90%+ test coverage

### Phase 2: GitHub Integration (Weeks 3-4)

**Deliverables**:
- [ ] `ContextSynchronizer` implementation
- [ ] Webhook handler integration
- [ ] Conflict detection and resolution
- [ ] Polling fallback mechanism
- [ ] Integration tests with GitHub API

**Success Criteria**:
- Bidirectional sync works reliably
- Conflicts detected and resolved
- Webhook events processed correctly

### Phase 3: ADR System (Week 5)

**Deliverables**:
- [ ] `ADRManager` implementation
- [ ] ADR templates and validation
- [ ] Version control for ADRs
- [ ] Export/import functionality
- [ ] Search and query capabilities

**Success Criteria**:
- ADRs can be created and versioned
- Linking to epics works
- Export formats (markdown, JSON) work

### Phase 4: Context Restoration (Week 6)

**Deliverables**:
- [ ] `ContextRestoration` service
- [ ] Multiple restoration strategies
- [ ] Context compression algorithms
- [ ] Agent injection mechanisms
- [ ] Hook integration

**Success Criteria**:
- Agents successfully restored with context
- Token limits respected
- Restoration time < 500ms

### Phase 5: Integration & Optimization (Weeks 7-8)

**Deliverables**:
- [ ] SwarmMemory integration
- [ ] AgentRegistry integration
- [ ] Performance optimization (caching, indexing)
- [ ] End-to-end testing
- [ ] Documentation and examples

**Success Criteria**:
- All integrations working
- Performance targets met
- Production-ready

### Phase 6: Advanced Features (Weeks 9-10)

**Deliverables**:
- [ ] Multi-epic context support
- [ ] Context dependency graphs
- [ ] Advanced conflict resolution
- [ ] Metrics and monitoring
- [ ] CLI tools for epic management

**Success Criteria**:
- Complex workflows supported
- Monitoring dashboard functional
- CLI tools documented

---

## Appendix A: Component Interaction Diagram

```
┌─────────────┐
│  CLI/API    │
│  Request    │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────┐
│     EpicContextManager (Facade)          │
│  - Coordinates all epic operations       │
└──────────┬───────────────────────────────┘
           │
           ├──────> ┌─────────────────────┐
           │        │   EpicContext       │
           │        │  (State Machine)    │
           │        └──────────┬──────────┘
           │                   │
           │                   ├──> addTask()
           │                   ├──> addAgent()
           │                   ├──> addDecision()
           │                   └──> recordEvent()
           │
           ├──────> ┌─────────────────────┐
           │        │ ContextSynchronizer  │
           │        │ (GitHub Sync)        │
           │        └──────────┬──────────┘
           │                   │
           │                   ├──> GitHubAPI
           │                   └──> ConflictResolver
           │
           ├──────> ┌─────────────────────┐
           │        │    ADRManager        │
           │        │ (Decision Records)   │
           │        └──────────┬──────────┘
           │                   │
           │                   ├──> createADR()
           │                   └──> linkToEpic()
           │
           └──────> ┌─────────────────────┐
                    │ ContextRestoration   │
                    │ (Agent Context)      │
                    └──────────┬──────────┘
                               │
                               ├──> buildSummary()
                               └──> injectContext()

All components use:
       │
       ▼
┌─────────────────────┐     ┌─────────────────────┐
│ UnifiedMemoryManager│────>│  SQLite Database    │
│  (Storage Layer)    │     │  (Persistence)      │
└─────────────────────┘     └─────────────────────┘
```

---

## Appendix B: Data Flow Examples

### Example 1: Agent Starting Work on Epic

```
1. Agent assigned to epic-123 via GitHub issue
   └─> GitHub webhook triggers ContextSynchronizer

2. ContextSynchronizer.syncFromGitHub(epic-123)
   ├─> Fetch issue data from GitHub API
   ├─> Detect changes (new assignee)
   └─> Update EpicContext

3. Pre-task hook triggered for agent
   └─> ContextRestoration.restoreEpicContext(epic-123, agent-456)
       ├─> Load epic metadata
       ├─> Load recent tasks (last 10)
       ├─> Load relevant ADRs (last 5)
       ├─> Build context summary
       └─> Inject into agent's working memory

4. Agent begins work with full context
   └─> Agent can query additional context on-demand
```

### Example 2: Agent Makes Architectural Decision

```
1. Agent completes analysis and makes decision
   └─> ADRManager.createADR({
       title: "Use Redis for caching",
       decision: "...",
       author: "agent-456"
     })

2. ADR created and versioned
   └─> adr-005 v1 created in database

3. Link ADR to epic
   └─> ADRManager.linkToEpic(adr-005, epic-123)

4. Update epic context
   └─> EpicContext.addDecision(adr-005)
       └─> Record timeline event

5. Sync to GitHub (optional)
   └─> ContextSynchronizer.syncToGitHub(epic-123)
       └─> Add comment to issue with ADR link
```

### Example 3: Resolving Sync Conflict

```
1. Agent updates epic description in memory
   └─> EpicContext.updateMetadata({ description: "New desc" })

2. Human updates same field in GitHub
   └─> GitHub webhook triggers sync

3. ContextSynchronizer detects conflict
   └─> Conflict: {
       field: "description",
       githubValue: "Human desc",
       memoryValue: "New desc",
       githubUpdatedAt: "10:05",
       memoryUpdatedAt: "10:03"
     }

4. Apply conflict resolution strategy (github-wins)
   └─> Use GitHub value as authoritative
   └─> Update memory to match GitHub
   └─> Notify agent of overwrite

5. Record conflict in sync metadata
   └─> Store for analysis and improvement
```

---

## Appendix C: Configuration Examples

```javascript
// Initialize Epic Context System
const epicSystem = new EpicContextManager({
  memory: unifiedMemory,
  githubAPI: new GitHubAPIClient(process.env.GITHUB_TOKEN),

  // Sync configuration
  sync: {
    enabled: true,
    interval: 300000,              // 5 minutes
    conflictStrategy: 'github-wins',
    webhookEnabled: true,
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET
  },

  // Restoration configuration
  restoration: {
    defaultStrategy: 'role-specific',
    maxContextSize: 100000,
    cacheEnabled: true,
    cacheTTL: 300000
  },

  // ADR configuration
  adr: {
    defaultTemplate: 'standard',
    versionControl: true,
    autoExport: true,
    exportPath: './docs/adr'
  },

  // Performance configuration
  performance: {
    caching: {
      enabled: true,
      maxSize: 100,
      ttl: 300000
    },
    compression: {
      enabled: true,
      threshold: 10000,           // Compress contexts > 10KB
      algorithm: 'gzip'
    },
    batch: {
      enabled: true,
      maxBatchSize: 10
    }
  },

  // Monitoring configuration
  monitoring: {
    metricsEnabled: true,
    metricsInterval: 60000,       // 1 minute
    logLevel: 'info'
  }
});

await epicSystem.initialize();
```

---

## Document Metadata

**Document Version**: 1.0
**Last Updated**: 2025-12-09
**Review Date**: 2026-01-09
**Reviewers**: Architecture Team, Agent Developers
**Status**: Approved for Implementation

**Change Log**:
- 2025-12-09: Initial architecture design (v1.0)

**Related Documents**:
- `/docs/architecture/memory-architecture.md`
- `/docs/architecture/agent-coordination.md`
- `/docs/api/epic-context-api.md`
