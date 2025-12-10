# Agent Autonomy and Self-Selection System
## Comprehensive Design for claude-flow

**Status**: Research Phase
**Version**: 1.0.0
**Author**: Research Agent
**Date**: 2025-12-09

---

## Executive Summary

This document outlines a comprehensive autonomous agent system that enables agents to:
1. Monitor GitHub for available work (epics/issues)
2. Self-evaluate their capability match for tasks
3. Self-assign appropriate work autonomously
4. Update progress and escalate when blocked
5. Coordinate across distributed agent pools

The design leverages existing infrastructure including:
- **AgentRegistry** with `findBestAgent()` capability matching
- **AgentManager** with 20+ specialized agent templates
- **GitHub API** integration with issue/PR management
- **Health scoring** system (responsiveness, performance, reliability, resource usage)
- **Agent pools** with auto-scaling

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Issue-to-Agent Matching Algorithm](#issue-to-agent-matching-algorithm)
3. [Workload Balancing Strategy](#workload-balancing-strategy)
4. [Priority Handling System](#priority-handling-system)
5. [Blocked Detection & Escalation](#blocked-detection--escalation)
6. [Progress Reporting Automation](#progress-reporting-automation)
7. [GitHub Monitoring Patterns](#github-monitoring-patterns)
8. [Implementation Roadmap](#implementation-roadmap)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Autonomous Agent System                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────┐      ┌─────────────────┐                 │
│  │ GitHub        │      │ Agent Registry  │                 │
│  │ Event Monitor │─────▶│ & Capability    │                 │
│  │               │      │ Matching        │                 │
│  └───────────────┘      └─────────────────┘                 │
│         │                        │                           │
│         │                        ▼                           │
│         │               ┌─────────────────┐                 │
│         └──────────────▶│ Autonomous      │                 │
│                         │ Task Selector   │                 │
│                         └─────────────────┘                 │
│                                 │                            │
│                                 ▼                            │
│                    ┌───────────────────────┐                │
│                    │ Agent Pool Manager    │                │
│                    │ - Workload Balancing  │                │
│                    │ - Auto-scaling        │                │
│                    │ - Health Monitoring   │                │
│                    └───────────────────────┘                │
│                                 │                            │
│                                 ▼                            │
│                    ┌───────────────────────┐                │
│                    │ Task Execution        │                │
│                    │ - Progress Tracking   │                │
│                    │ - Blocked Detection   │                │
│                    │ - Auto-escalation     │                │
│                    └───────────────────────┘                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Autonomous Task Selector**
- Monitors GitHub for available work
- Parses issue metadata (labels, title, description, requirements)
- Queries `AgentRegistry.findBestAgent()` for capability matches
- Evaluates agent availability and workload
- Makes autonomous assignment decisions

#### 2. **Capability Requirement Extractor**
- Analyzes issue content for technical requirements
- Extracts: languages, frameworks, domains, complexity, estimated duration
- Maps GitHub labels to capabilities (e.g., `bug` → `debugging`, `feature` → `codeGeneration`)
- Generates `TaskRequirements` object for matching

#### 3. **Workload Manager**
- Tracks active tasks per agent (`activeAssignments`)
- Enforces `maxConcurrentTasks` limits
- Implements fair distribution algorithms
- Coordinates with agent pools for scaling

#### 4. **Progress Monitor**
- Tracks task execution state via agent metrics
- Detects stalls (no activity for N minutes)
- Triggers escalation protocols
- Updates GitHub issues automatically

---

## Issue-to-Agent Matching Algorithm

### Algorithm: Multi-Factor Scoring System

Building on existing `AgentRegistry.selectBestAgent()` and `AgentCapabilitySystem.findBestAgents()`:

```typescript
interface IssueRequirements {
  // Extracted from GitHub issue
  issueNumber: number;
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  milestone?: string;

  // Parsed requirements
  requiredCapabilities: string[];
  preferredCapabilities: string[];
  languages: string[];
  frameworks: string[];
  domains: string[];
  complexity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedDuration: number; // minutes
  dependencies: string[]; // other issue numbers
}

interface AgentScore {
  agent: AgentState;
  overallScore: number;  // 0-100
  breakdown: {
    capabilityMatch: number;     // 0-40 points
    performance: number;          // 0-20 points
    availability: number;         // 0-20 points
    specialization: number;       // 0-10 points
    experienceMatch: number;      // 0-10 points
  };
  confidence: number;  // 0-1
  matchReason: string;
  missingCapabilities: string[];
}

class AutonomousTaskSelector {
  /**
   * Score and rank agents for an issue
   * Extends existing AgentRegistry.selectBestAgent with autonomous features
   */
  async scoreAgentsForIssue(issue: IssueRequirements): Promise<AgentScore[]> {
    // 1. Get available agents from registry
    const candidates = await this.agentRegistry.queryAgents({
      status: 'idle',
      healthThreshold: 0.6  // Only healthy agents
    });

    // 2. Extract requirements from issue
    const requirements = await this.extractRequirements(issue);

    // 3. Score each candidate
    const scores: AgentScore[] = [];
    for (const agent of candidates) {
      const score = await this.calculateAgentScore(agent, requirements);
      if (score.overallScore >= 50) {  // Minimum threshold
        scores.push(score);
      }
    }

    // 4. Sort by score (highest first)
    scores.sort((a, b) => b.overallScore - a.overallScore);

    return scores;
  }

  private async calculateAgentScore(
    agent: AgentState,
    requirements: IssueRequirements
  ): Promise<AgentScore> {
    const breakdown = {
      capabilityMatch: 0,
      performance: 0,
      availability: 0,
      specialization: 0,
      experienceMatch: 0
    };

    // 1. Capability Match (0-40 points)
    const capMatch = this.scoreCapabilityMatch(agent.capabilities, requirements);
    breakdown.capabilityMatch = capMatch * 40;

    // 2. Performance Score (0-20 points)
    breakdown.performance = agent.metrics.successRate * 20;

    // 3. Availability Score (0-20 points)
    const workloadFactor = 1 - agent.workload;
    const healthFactor = agent.health;
    breakdown.availability = (workloadFactor * 10) + (healthFactor * 10);

    // 4. Specialization Score (0-10 points)
    breakdown.specialization = this.scoreSpecialization(agent, requirements);

    // 5. Experience Match (0-10 points)
    breakdown.experienceMatch = this.scoreExperience(agent, requirements);

    // Calculate overall score
    const overallScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    // Calculate confidence
    const confidence = this.calculateConfidence(agent, requirements, breakdown);

    return {
      agent,
      overallScore: Math.min(100, overallScore),
      breakdown,
      confidence,
      matchReason: this.generateMatchReason(breakdown, overallScore),
      missingCapabilities: this.findMissingCapabilities(agent, requirements)
    };
  }

  private scoreCapabilityMatch(
    capabilities: AgentCapabilities,
    requirements: IssueRequirements
  ): number {
    let matched = 0;
    let total = requirements.requiredCapabilities.length;

    // Check required capabilities
    for (const required of requirements.requiredCapabilities) {
      if (this.agentHasCapability(capabilities, required)) {
        matched++;
      }
    }

    // Check language compatibility
    if (requirements.languages.length > 0) {
      total++;
      if (requirements.languages.some(lang => capabilities.languages.includes(lang))) {
        matched += 0.8;
      }
    }

    // Check framework compatibility
    if (requirements.frameworks.length > 0) {
      total++;
      if (requirements.frameworks.some(fw => capabilities.frameworks.includes(fw))) {
        matched += 0.8;
      }
    }

    return total > 0 ? matched / total : 0;
  }

  private scoreSpecialization(
    agent: AgentState,
    requirements: IssueRequirements
  ): number {
    let score = 0;

    // Check if agent type matches task type
    const typeMap: Record<string, string[]> = {
      'coder': ['feature', 'implementation', 'development'],
      'tester': ['bug', 'testing', 'qa'],
      'reviewer': ['code-review', 'security', 'quality'],
      'researcher': ['research', 'investigation', 'analysis'],
      'architect': ['architecture', 'design', 'system']
    };

    const agentTypes = typeMap[agent.type] || [];
    const labelMatch = requirements.labels.some(label =>
      agentTypes.some(type => label.toLowerCase().includes(type))
    );

    if (labelMatch) score += 5;

    // Check domain expertise
    const domainMatch = requirements.domains.some(domain =>
      agent.capabilities.domains.includes(domain)
    );
    if (domainMatch) score += 5;

    return score;
  }

  private scoreExperience(
    agent: AgentState,
    requirements: IssueRequirements
  ): number {
    let score = 0;

    // Tasks completed successfully
    if (agent.metrics.tasksCompleted > 10) score += 3;
    else if (agent.metrics.tasksCompleted > 5) score += 2;
    else if (agent.metrics.tasksCompleted > 0) score += 1;

    // Success rate
    if (agent.metrics.successRate >= 0.9) score += 3;
    else if (agent.metrics.successRate >= 0.8) score += 2;
    else if (agent.metrics.successRate >= 0.7) score += 1;

    // Average execution time vs estimated duration
    const avgTime = agent.metrics.averageExecutionTime;
    if (avgTime > 0 && avgTime < requirements.estimatedDuration * 60000) {
      score += 4;  // Agent typically completes faster than estimate
    }

    return score;
  }

  private calculateConfidence(
    agent: AgentState,
    requirements: IssueRequirements,
    breakdown: any
  ): number {
    // Base confidence on capability match
    let confidence = breakdown.capabilityMatch / 40;

    // Adjust for missing critical capabilities
    const missing = this.findMissingCapabilities(agent, requirements);
    const criticalMissing = missing.filter(cap =>
      requirements.requiredCapabilities.includes(cap)
    );

    if (criticalMissing.length > 0) {
      confidence *= (1 - (criticalMissing.length / requirements.requiredCapabilities.length) * 0.5);
    }

    // Boost confidence for high-performing agents
    if (agent.metrics.successRate >= 0.9 && agent.health >= 0.9) {
      confidence = Math.min(1.0, confidence * 1.1);
    }

    return confidence;
  }
}
```

### Requirement Extraction Strategy

```typescript
class RequirementExtractor {
  /**
   * Extract technical requirements from GitHub issue
   */
  async extractFromIssue(issue: GitHubIssue): Promise<IssueRequirements> {
    const requirements: IssueRequirements = {
      issueNumber: issue.number,
      title: issue.title,
      body: issue.body || '',
      labels: issue.labels.map(l => l.name),
      assignees: issue.assignees.map(a => a.login),
      milestone: issue.milestone?.title,
      requiredCapabilities: [],
      preferredCapabilities: [],
      languages: [],
      frameworks: [],
      domains: [],
      complexity: 'medium',
      priority: 'medium',
      estimatedDuration: 60,  // default 1 hour
      dependencies: []
    };

    // 1. Parse labels for capabilities
    for (const label of requirements.labels) {
      const labelLower = label.toLowerCase();

      // Map labels to capabilities
      if (labelLower.includes('bug')) {
        requirements.requiredCapabilities.push('debugging', 'testing');
        requirements.domains.push('bug-fixing');
      } else if (labelLower.includes('feature')) {
        requirements.requiredCapabilities.push('codeGeneration');
        requirements.domains.push('feature-development');
      } else if (labelLower.includes('documentation')) {
        requirements.requiredCapabilities.push('documentation');
      } else if (labelLower.includes('test')) {
        requirements.requiredCapabilities.push('testing');
      } else if (labelLower.includes('security')) {
        requirements.requiredCapabilities.push('security', 'codeReview');
      } else if (labelLower.includes('performance')) {
        requirements.requiredCapabilities.push('optimization', 'analysis');
      }

      // Extract priority
      if (labelLower.includes('critical') || labelLower.includes('urgent')) {
        requirements.priority = 'critical';
      } else if (labelLower.includes('high')) {
        requirements.priority = 'high';
      } else if (labelLower.includes('low')) {
        requirements.priority = 'low';
      }

      // Extract complexity
      if (labelLower.includes('complex') || labelLower.includes('hard')) {
        requirements.complexity = 'high';
      } else if (labelLower.includes('simple') || labelLower.includes('easy')) {
        requirements.complexity = 'low';
      }
    }

    // 2. Parse title and body for technical keywords
    const content = `${requirements.title} ${requirements.body}`.toLowerCase();

    // Extract languages
    const languages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'c++'];
    for (const lang of languages) {
      if (content.includes(lang)) {
        requirements.languages.push(lang);
      }
    }

    // Extract frameworks
    const frameworks = ['react', 'vue', 'angular', 'express', 'fastify', 'django', 'flask'];
    for (const framework of frameworks) {
      if (content.includes(framework)) {
        requirements.frameworks.push(framework);
      }
    }

    // Extract domains from keywords
    if (content.includes('api')) requirements.domains.push('api-development');
    if (content.includes('database')) requirements.domains.push('database');
    if (content.includes('ui') || content.includes('frontend')) requirements.domains.push('frontend');
    if (content.includes('backend')) requirements.domains.push('backend');
    if (content.includes('devops') || content.includes('ci/cd')) requirements.domains.push('devops');

    // 3. Parse issue description for structured requirements
    const estimateMatch = requirements.body.match(/estimate[d]?:\s*(\d+)\s*(hour|minute)/i);
    if (estimateMatch) {
      const value = parseInt(estimateMatch[1]);
      const unit = estimateMatch[2];
      requirements.estimatedDuration = unit === 'hour' ? value * 60 : value;
    }

    // 4. Extract dependencies (linked issues)
    const depMatches = requirements.body.matchAll(/#(\d+)/g);
    for (const match of depMatches) {
      requirements.dependencies.push(match[1]);
    }

    return requirements;
  }
}
```

---

## Workload Balancing Strategy

### Load Distribution Algorithm

```typescript
class WorkloadBalancer {
  private agentRegistry: AgentRegistry;
  private agentManager: AgentManager;
  private maxConcurrentTasksPerAgent: number = 3;
  private targetUtilization: number = 0.7;  // 70% target

  /**
   * Enforce workload limits and fair distribution
   */
  async selectAvailableAgent(
    candidates: AgentScore[],
    requirements: IssueRequirements
  ): Promise<AgentState | null> {
    // 1. Filter out overloaded agents
    const available = candidates.filter(scored => {
      const agent = scored.agent;
      const currentTasks = this.getCurrentTaskCount(agent.id.id);
      const maxTasks = agent.config.maxConcurrentTasks || this.maxConcurrentTasksPerAgent;

      return currentTasks < maxTasks && agent.workload < 0.9;
    });

    if (available.length === 0) {
      // Trigger scaling if all agents busy
      await this.triggerScaling(requirements);
      return null;
    }

    // 2. Apply fairness algorithm
    const fairnessScores = this.calculateFairnessScores(available.map(s => s.agent));

    // 3. Combine capability score + fairness score
    const finalScores = available.map((scored, index) => ({
      ...scored,
      finalScore: (scored.overallScore * 0.7) + (fairnessScores[index] * 0.3)
    }));

    // 4. Select agent with highest combined score
    finalScores.sort((a, b) => b.finalScore - a.finalScore);

    return finalScores[0]?.agent || null;
  }

  /**
   * Calculate fairness scores to ensure even distribution
   */
  private calculateFairnessScores(agents: AgentState[]): number[] {
    // Get current task counts
    const taskCounts = agents.map(agent => this.getCurrentTaskCount(agent.id.id));
    const avgTasks = taskCounts.reduce((sum, count) => sum + count, 0) / agents.length;

    // Agents with fewer tasks get higher fairness scores
    return taskCounts.map(count => {
      const deviation = avgTasks - count;
      return Math.max(0, Math.min(100, 50 + (deviation * 10)));
    });
  }

  /**
   * Trigger agent pool scaling when needed
   */
  private async triggerScaling(requirements: IssueRequirements): Promise<void> {
    // Find relevant pool
    const poolId = await this.findPoolForTask(requirements);
    if (!poolId) {
      console.warn('No suitable agent pool found for task');
      return;
    }

    const pool = this.agentManager.getPool(poolId);
    if (!pool || !pool.autoScale) {
      return;
    }

    // Check if we can scale up
    if (pool.currentSize < pool.maxSize) {
      const targetSize = Math.min(
        pool.currentSize + 1,
        pool.maxSize
      );

      console.log(`Scaling pool ${poolId} from ${pool.currentSize} to ${targetSize}`);
      await this.agentManager.scalePool(poolId, targetSize);
    }
  }

  /**
   * Periodic workload rebalancing
   */
  async rebalanceWorkload(): Promise<void> {
    const agents = this.agentManager.getAllAgents();

    // Identify overloaded and underloaded agents
    const overloaded = agents.filter(a => a.workload > 0.9);
    const underloaded = agents.filter(a => a.workload < 0.3 && a.status === 'idle');

    if (overloaded.length === 0 || underloaded.length === 0) {
      return;  // No rebalancing needed
    }

    // Move tasks from overloaded to underloaded agents
    for (const agent of overloaded) {
      const tasks = await this.getAgentTasks(agent.id.id);

      for (const task of tasks) {
        // Find best underloaded agent for this task
        const target = await this.selectBestTargetAgent(task, underloaded);

        if (target) {
          await this.reassignTask(task, agent.id.id, target.id.id);
          console.log(`Rebalanced task ${task.id} from ${agent.name} to ${target.name}`);
          break;  // One task at a time
        }
      }
    }
  }
}
```

### Pool Management Strategy

```typescript
interface PoolScalingPolicy {
  poolId: string;
  minSize: number;
  maxSize: number;
  scaleUpThreshold: number;   // Avg workload to trigger scale-up
  scaleDownThreshold: number; // Avg workload to trigger scale-down
  cooldownPeriod: number;     // Milliseconds between scaling operations
  lastScalingOperation: Date | null;
}

class PoolManager {
  private scalingPolicies: Map<string, PoolScalingPolicy> = new Map();

  /**
   * Auto-scale pools based on workload
   */
  async autoScalePools(): Promise<void> {
    for (const [poolId, policy] of this.scalingPolicies) {
      const pool = this.agentManager.getPool(poolId);
      if (!pool) continue;

      // Check cooldown period
      if (policy.lastScalingOperation) {
        const timeSinceLastScale = Date.now() - policy.lastScalingOperation.getTime();
        if (timeSinceLastScale < policy.cooldownPeriod) {
          continue;  // Still in cooldown
        }
      }

      // Calculate average workload
      const agents = pool.availableAgents.concat(pool.busyAgents);
      const workloads = await Promise.all(
        agents.map(async agentId => {
          const agent = await this.agentRegistry.getAgent(agentId.id);
          return agent?.workload || 0;
        })
      );
      const avgWorkload = workloads.reduce((sum, w) => sum + w, 0) / workloads.length;

      // Determine scaling action
      if (avgWorkload >= policy.scaleUpThreshold && pool.currentSize < policy.maxSize) {
        // Scale up
        const targetSize = Math.min(pool.currentSize + 1, policy.maxSize);
        await this.agentManager.scalePool(poolId, targetSize);
        policy.lastScalingOperation = new Date();
        console.log(`Scaled up pool ${poolId} to ${targetSize} agents`);

      } else if (avgWorkload <= policy.scaleDownThreshold && pool.currentSize > policy.minSize) {
        // Scale down
        const targetSize = Math.max(pool.currentSize - 1, policy.minSize);
        await this.agentManager.scalePool(poolId, targetSize);
        policy.lastScalingOperation = new Date();
        console.log(`Scaled down pool ${poolId} to ${targetSize} agents`);
      }
    }
  }
}
```

---

## Priority Handling System

### Priority Queue Implementation

```typescript
interface TaskPriority {
  issueNumber: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  score: number;  // Composite score
  timestamp: Date;
  dependencies: string[];
}

class PriorityQueue {
  private queue: TaskPriority[] = [];

  /**
   * Add task to priority queue
   */
  enqueue(task: TaskPriority): void {
    this.queue.push(task);
    this.queue.sort((a, b) => this.compareTaskPriority(b, a));
  }

  /**
   * Get next highest priority task
   */
  dequeue(): TaskPriority | null {
    return this.queue.shift() || null;
  }

  /**
   * Compare task priorities
   */
  private compareTaskPriority(a: TaskPriority, b: TaskPriority): number {
    // 1. Critical tasks always first
    if (a.priority === 'critical' && b.priority !== 'critical') return 1;
    if (b.priority === 'critical' && a.priority !== 'critical') return -1;

    // 2. High priority next
    if (a.priority === 'high' && b.priority === 'medium') return 1;
    if (b.priority === 'high' && a.priority === 'medium') return -1;

    // 3. Compare composite scores
    if (Math.abs(a.score - b.score) > 5) {
      return a.score - b.score;
    }

    // 4. Older tasks first (FIFO for same priority)
    return a.timestamp.getTime() - b.timestamp.getTime();
  }

  /**
   * Check if task dependencies are met
   */
  areDependenciesMet(task: TaskPriority, completedIssues: Set<string>): boolean {
    return task.dependencies.every(dep => completedIssues.has(dep));
  }
}

class PriorityManager {
  private queues: Map<string, PriorityQueue> = new Map();  // Per-repository queues
  private completedIssues: Map<string, Set<string>> = new Map();

  /**
   * Process priority queue and assign tasks
   */
  async processQueue(repositoryKey: string): Promise<void> {
    const queue = this.queues.get(repositoryKey);
    if (!queue) return;

    const completed = this.completedIssues.get(repositoryKey) || new Set();

    // Get next task with met dependencies
    let task: TaskPriority | null;
    while ((task = queue.dequeue()) !== null) {
      if (queue.areDependenciesMet(task, completed)) {
        // Assign to best available agent
        await this.assignTaskToAgent(task);
        break;
      } else {
        // Re-queue for later (dependencies not met)
        queue.enqueue(task);
        break;  // Avoid infinite loop
      }
    }
  }

  /**
   * Calculate composite priority score
   */
  calculatePriorityScore(issue: IssueRequirements): number {
    let score = 0;

    // Base priority score
    const priorityScores = {
      'critical': 100,
      'high': 75,
      'medium': 50,
      'low': 25
    };
    score += priorityScores[issue.priority];

    // Age factor (older issues get boost)
    const ageInDays = (Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.min(20, ageInDays * 2);

    // Complexity factor (critical complexity gets boost)
    if (issue.complexity === 'critical') score += 15;
    else if (issue.complexity === 'high') score += 10;

    // Blocked dependencies penalty
    score -= issue.dependencies.length * 5;

    return Math.max(0, Math.min(150, score));
  }
}
```

### Critical Issue Fast-Track

```typescript
class CriticalIssueHandler {
  /**
   * Fast-track critical issues
   */
  async handleCriticalIssue(issue: IssueRequirements): Promise<void> {
    console.warn(`CRITICAL ISSUE DETECTED: #${issue.issueNumber} - ${issue.title}`);

    // 1. Find best available agent immediately
    const agents = await this.agentRegistry.queryAgents({
      status: 'idle',
      healthThreshold: 0.7
    });

    if (agents.length === 0) {
      // 2. Pre-empt lower priority tasks if needed
      await this.preemptLowPriorityTasks();
      agents.push(...await this.agentRegistry.queryAgents({ status: 'idle' }));
    }

    if (agents.length === 0) {
      // 3. Emergency scaling
      await this.emergencyScaleUp(issue);
      return;
    }

    // 4. Assign to best agent immediately
    const bestAgent = agents[0];
    await this.assignTaskImmediately(issue, bestAgent);

    // 5. Notify stakeholders
    await this.notifyCriticalIssueAssigned(issue, bestAgent);
  }

  private async preemptLowPriorityTasks(): Promise<void> {
    // Find agents working on low-priority tasks
    const agents = this.agentManager.getAllAgents();

    for (const agent of agents) {
      if (agent.status !== 'busy') continue;

      const tasks = await this.getAgentTasks(agent.id.id);
      const lowPriorityTasks = tasks.filter(t => t.priority === 'low');

      if (lowPriorityTasks.length > 0) {
        // Pause low-priority task and free agent
        const task = lowPriorityTasks[0];
        await this.pauseTask(task.id);
        await this.updateAgentStatus(agent.id.id, 'idle');
        console.log(`Pre-empted low-priority task ${task.id} from agent ${agent.name}`);
        break;  // One agent is enough
      }
    }
  }
}
```

---

## Blocked Detection & Escalation

### Stall Detection

```typescript
interface BlockedTaskDetection {
  taskId: string;
  agentId: string;
  issueNumber: number;
  lastActivity: Date;
  stallDuration: number;  // milliseconds
  blockedReason: 'no_activity' | 'error_threshold' | 'dependency_wait' | 'resource_exhaustion';
  escalationLevel: number;
}

class BlockedDetector {
  private stallThresholds = {
    critical: 15 * 60 * 1000,  // 15 minutes
    high: 30 * 60 * 1000,      // 30 minutes
    medium: 60 * 60 * 1000,    // 1 hour
    low: 120 * 60 * 1000       // 2 hours
  };

  /**
   * Detect stalled/blocked tasks
   */
  async detectBlockedTasks(): Promise<BlockedTaskDetection[]> {
    const blockedTasks: BlockedTaskDetection[] = [];
    const agents = this.agentManager.getAgentsByStatus('busy');

    for (const agent of agents) {
      const tasks = await this.getAgentTasks(agent.id.id);

      for (const task of tasks) {
        const stall = await this.checkTaskStall(agent, task);
        if (stall) {
          blockedTasks.push(stall);
        }
      }
    }

    return blockedTasks;
  }

  private async checkTaskStall(
    agent: AgentState,
    task: any
  ): Promise<BlockedTaskDetection | null> {
    const now = Date.now();
    const lastActivity = agent.metrics.lastActivity.getTime();
    const stallDuration = now - lastActivity;

    // Get threshold based on priority
    const threshold = this.stallThresholds[task.priority] || this.stallThresholds.medium;

    if (stallDuration < threshold) {
      return null;  // Not stalled
    }

    // Determine blocked reason
    let blockedReason: BlockedTaskDetection['blockedReason'] = 'no_activity';

    // Check error rate
    if (agent.errorHistory.length > 5) {
      const recentErrors = agent.errorHistory.slice(-5);
      const errorRate = recentErrors.length / 5;
      if (errorRate > 0.6) {
        blockedReason = 'error_threshold';
      }
    }

    // Check resource exhaustion
    const health = this.agentManager.getAgentHealth(agent.id.id);
    if (health && health.components.resourceUsage < 0.3) {
      blockedReason = 'resource_exhaustion';
    }

    return {
      taskId: task.id,
      agentId: agent.id.id,
      issueNumber: task.issueNumber,
      lastActivity: agent.metrics.lastActivity,
      stallDuration,
      blockedReason,
      escalationLevel: 0
    };
  }
}
```

### Escalation Protocol

```typescript
class EscalationManager {
  /**
   * Escalate blocked tasks through multiple levels
   */
  async escalateBlockedTask(blocked: BlockedTaskDetection): Promise<void> {
    console.warn(`Escalating blocked task: #${blocked.issueNumber} (Level ${blocked.escalationLevel + 1})`);

    const escalationLevel = blocked.escalationLevel;

    switch (escalationLevel) {
      case 0:
        // Level 1: Notify agent, ask for status
        await this.requestAgentStatus(blocked.agentId);
        blocked.escalationLevel = 1;
        break;

      case 1:
        // Level 2: Attempt auto-recovery
        await this.attemptAutoRecovery(blocked);
        blocked.escalationLevel = 2;
        break;

      case 2:
        // Level 3: Reassign to different agent
        await this.reassignTask(blocked);
        blocked.escalationLevel = 3;
        break;

      case 3:
        // Level 4: Escalate to human
        await this.escalateToHuman(blocked);
        blocked.escalationLevel = 4;
        break;

      default:
        // Maximum escalation reached
        console.error(`Task #${blocked.issueNumber} requires manual intervention`);
    }

    // Update GitHub issue with escalation comment
    await this.updateIssueWithEscalation(blocked);
  }

  private async attemptAutoRecovery(blocked: BlockedTaskDetection): Promise<void> {
    const agent = await this.agentRegistry.getAgent(blocked.agentId);
    if (!agent) return;

    // Try different recovery strategies based on blocked reason
    switch (blocked.blockedReason) {
      case 'error_threshold':
        // Restart agent
        await this.agentManager.restartAgent(blocked.agentId, 'error_recovery');
        break;

      case 'resource_exhaustion':
        // Free up resources
        await this.freeAgentResources(blocked.agentId);
        break;

      case 'no_activity':
        // Send wake-up signal
        await this.sendWakeupSignal(blocked.agentId);
        break;

      case 'dependency_wait':
        // Check if dependencies are now available
        await this.recheckDependencies(blocked.taskId);
        break;
    }
  }

  private async reassignTask(blocked: BlockedTaskDetection): Promise<void> {
    console.log(`Reassigning task #${blocked.issueNumber} from agent ${blocked.agentId}`);

    // 1. Unassign from current agent
    await this.unassignTask(blocked.taskId, blocked.agentId);

    // 2. Find new agent
    const issue = await this.getIssueRequirements(blocked.issueNumber);
    const candidates = await this.taskSelector.scoreAgentsForIssue(issue);

    // Filter out the failed agent
    const alternatives = candidates.filter(c => c.agent.id.id !== blocked.agentId);

    if (alternatives.length > 0) {
      const newAgent = alternatives[0].agent;
      await this.assignTask(blocked.taskId, newAgent.id.id);

      // Update GitHub issue
      await this.githubAPI.addIssueComment(
        issue.owner,
        issue.repo,
        blocked.issueNumber,
        `Task reassigned to agent ${newAgent.name} due to: ${blocked.blockedReason}`
      );
    } else {
      // No alternative agents available
      await this.escalateToHuman(blocked);
    }
  }

  private async escalateToHuman(blocked: BlockedTaskDetection): Promise<void> {
    const issue = await this.getIssueRequirements(blocked.issueNumber);

    // Add labels to GitHub issue
    await this.githubAPI.addIssueLabels(
      issue.owner,
      issue.repo,
      blocked.issueNumber,
      ['needs-human-review', 'blocked']
    );

    // Create detailed comment
    const comment = `
## 🚨 Task Escalation Required

This task has been escalated to human review due to: **${blocked.blockedReason}**

**Escalation Details:**
- Agent: ${blocked.agentId}
- Stall Duration: ${Math.round(blocked.stallDuration / 60000)} minutes
- Last Activity: ${blocked.lastActivity.toISOString()}
- Escalation Level: ${blocked.escalationLevel}

**Recommended Actions:**
1. Review agent logs for errors
2. Check if task requirements are clear
3. Verify all dependencies are available
4. Consider breaking down into smaller tasks

cc @maintainers
    `;

    await this.githubAPI.addIssueComment(
      issue.owner,
      issue.repo,
      blocked.issueNumber,
      comment
    );

    // Send notification (Slack, email, etc.)
    await this.notifyHuman({
      type: 'task_escalation',
      severity: 'high',
      issue: blocked.issueNumber,
      reason: blocked.blockedReason
    });
  }
}
```

---

## Progress Reporting Automation

### Real-time Progress Tracking

```typescript
interface ProgressUpdate {
  issueNumber: number;
  agentId: string;
  status: 'assigned' | 'in_progress' | 'testing' | 'review' | 'blocked' | 'completed';
  percentComplete: number;
  milestone: string;
  lastUpdate: Date;
  estimatedCompletion: Date;
}

class ProgressTracker {
  private progressMap: Map<number, ProgressUpdate> = new Map();

  /**
   * Track agent progress on tasks
   */
  async trackProgress(issueNumber: number): Promise<void> {
    const progress = this.progressMap.get(issueNumber);
    if (!progress) return;

    const agent = await this.agentRegistry.getAgent(progress.agentId);
    if (!agent) return;

    // Calculate progress based on agent metrics
    const newPercent = this.calculateProgressPercent(agent, progress);

    if (Math.abs(newPercent - progress.percentComplete) >= 10) {
      // Significant progress change, update GitHub
      progress.percentComplete = newPercent;
      progress.lastUpdate = new Date();

      await this.updateGitHubProgress(progress);
    }
  }

  private calculateProgressPercent(
    agent: AgentState,
    progress: ProgressUpdate
  ): number {
    // Heuristic-based progress calculation
    const factors = {
      status: 0,
      activity: 0,
      time: 0
    };

    // Status-based progress
    const statusProgress = {
      'assigned': 5,
      'in_progress': 30,
      'testing': 70,
      'review': 90,
      'blocked': progress.percentComplete,  // No change if blocked
      'completed': 100
    };
    factors.status = statusProgress[progress.status];

    // Activity-based progress
    const timeSinceUpdate = Date.now() - progress.lastUpdate.getTime();
    if (timeSinceUpdate < 5 * 60 * 1000) {  // Active in last 5 minutes
      factors.activity = 10;
    }

    // Time-based progress (linear approximation)
    const elapsed = Date.now() - progress.lastUpdate.getTime();
    const estimated = progress.estimatedCompletion.getTime() - progress.lastUpdate.getTime();
    factors.time = Math.min(30, (elapsed / estimated) * 30);

    const total = factors.status + factors.activity + factors.time;
    return Math.min(100, Math.max(0, total));
  }

  private async updateGitHubProgress(progress: ProgressUpdate): Promise<void> {
    const issue = await this.getIssueDetails(progress.issueNumber);

    // Update issue body with progress
    const progressBar = this.generateProgressBar(progress.percentComplete);
    const comment = `
## Progress Update

${progressBar}

**Status**: ${progress.status}
**Progress**: ${progress.percentComplete}%
**Agent**: ${progress.agentId}
**Last Update**: ${progress.lastUpdate.toLocaleString()}
**Est. Completion**: ${progress.estimatedCompletion.toLocaleString()}

*This is an automated progress update from the autonomous agent system.*
    `;

    await this.githubAPI.addIssueComment(
      issue.owner,
      issue.repo,
      progress.issueNumber,
      comment
    );
  }

  private generateProgressBar(percent: number): string {
    const filled = Math.round(percent / 5);  // 20 blocks
    const empty = 20 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
  }
}
```

### Milestone Updates

```typescript
class MilestoneManager {
  /**
   * Automatically update issue milestones
   */
  async updateIssueMilestones(): Promise<void> {
    const activeIssues = await this.getActiveIssues();

    for (const issue of activeIssues) {
      const progress = this.progressTracker.getProgress(issue.number);
      if (!progress) continue;

      // Determine appropriate milestone based on progress
      let newMilestone: string | null = null;

      if (progress.percentComplete >= 90) {
        newMilestone = 'Ready for Review';
      } else if (progress.percentComplete >= 50) {
        newMilestone = 'In Progress';
      } else if (progress.percentComplete >= 10) {
        newMilestone = 'Started';
      } else {
        newMilestone = 'Backlog';
      }

      // Update if changed
      if (issue.milestone !== newMilestone) {
        await this.githubAPI.updateIssue(
          issue.owner,
          issue.repo,
          issue.number,
          { milestone: newMilestone }
        );
      }
    }
  }
}
```

---

## GitHub Monitoring Patterns

### Polling vs. Webhooks

#### Option 1: Polling (Simpler, Works Everywhere)

```typescript
class GitHubPoller {
  private pollInterval: number = 60000;  // 1 minute
  private lastPollTime: Map<string, Date> = new Map();

  /**
   * Poll GitHub for new/updated issues
   */
  async pollRepository(owner: string, repo: string): Promise<void> {
    const repoKey = `${owner}/${repo}`;
    const lastPoll = this.lastPollTime.get(repoKey) || new Date(0);

    // Get issues updated since last poll
    const issues = await this.githubAPI.listIssues(owner, repo, {
      state: 'open',
      sort: 'updated',
      direction: 'desc',
      since: lastPoll.toISOString()
    });

    if (!issues.success) {
      console.error(`Failed to poll ${repoKey}: ${issues.error}`);
      return;
    }

    // Process new/updated issues
    for (const issue of issues.data) {
      await this.processIssue(owner, repo, issue);
    }

    this.lastPollTime.set(repoKey, new Date());
  }

  /**
   * Start polling loop
   */
  startPolling(repositories: Array<{owner: string, repo: string}>): void {
    setInterval(async () => {
      for (const repo of repositories) {
        try {
          await this.pollRepository(repo.owner, repo.repo);
        } catch (error) {
          console.error(`Polling error for ${repo.owner}/${repo.repo}:`, error);
        }
      }
    }, this.pollInterval);
  }
}
```

#### Option 2: Webhooks (Real-time, Requires Server)

```typescript
class GitHubWebhookHandler {
  /**
   * Handle incoming webhook events
   */
  async handleWebhook(event: string, payload: any): Promise<void> {
    switch (event) {
      case 'issues':
        await this.handleIssueEvent(payload);
        break;

      case 'issue_comment':
        await this.handleIssueCommentEvent(payload);
        break;

      case 'pull_request':
        await this.handlePullRequestEvent(payload);
        break;

      case 'label':
        await this.handleLabelEvent(payload);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }
  }

  private async handleIssueEvent(payload: any): Promise<void> {
    const action = payload.action;
    const issue = payload.issue;

    if (action === 'opened' || action === 'labeled') {
      // New issue or label added - consider for assignment
      await this.considerIssueForAssignment(payload.repository, issue);

    } else if (action === 'closed') {
      // Issue closed - clean up
      await this.handleIssueClosed(issue.number);
    }
  }

  private async considerIssueForAssignment(repo: any, issue: any): Promise<void> {
    // Check if issue should be auto-assigned
    const labels = issue.labels.map((l: any) => l.name);

    // Only auto-assign if it has 'auto-assign' label or specific criteria
    if (!labels.includes('auto-assign') && !this.meetsAutoAssignCriteria(issue)) {
      return;
    }

    // Extract requirements and find best agent
    const requirements = await this.requirementExtractor.extractFromIssue(issue);
    const candidates = await this.taskSelector.scoreAgentsForIssue(requirements);

    if (candidates.length > 0 && candidates[0].overallScore >= 70) {
      const agent = candidates[0].agent;

      // Assign to agent
      await this.assignIssueToAgent(repo, issue, agent);

      // Update GitHub
      await this.githubAPI.addIssueComment(
        repo.owner.login,
        repo.name,
        issue.number,
        `🤖 Automatically assigned to agent **${agent.name}** (confidence: ${candidates[0].confidence.toFixed(2)})`
      );
    }
  }
}
```

### Hybrid Approach (Recommended)

```typescript
class HybridGitHubMonitor {
  private poller: GitHubPoller;
  private webhookHandler: GitHubWebhookHandler;
  private useWebhooks: boolean;

  constructor(config: { useWebhooks?: boolean }) {
    this.poller = new GitHubPoller();
    this.webhookHandler = new GitHubWebhookHandler();
    this.useWebhooks = config.useWebhooks || false;
  }

  /**
   * Start monitoring with fallback
   */
  async startMonitoring(repositories: Array<{owner: string, repo: string}>): Promise<void> {
    if (this.useWebhooks) {
      try {
        // Setup webhooks for real-time updates
        await this.setupWebhooks(repositories);
        console.log('Webhooks configured for real-time monitoring');

        // Still poll occasionally as backup
        this.poller.pollInterval = 5 * 60 * 1000;  // 5 minutes
        this.poller.startPolling(repositories);

      } catch (error) {
        console.warn('Webhook setup failed, falling back to polling:', error);
        this.useWebhooks = false;
        this.poller.pollInterval = 60000;  // 1 minute
        this.poller.startPolling(repositories);
      }
    } else {
      // Polling only
      this.poller.startPolling(repositories);
      console.log('Polling started for repositories');
    }
  }
}
```

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Weeks 1-2)

**Goal**: Implement basic autonomous selection and assignment

- [ ] Implement `AutonomousTaskSelector` class
- [ ] Implement `RequirementExtractor` for GitHub issues
- [ ] Integrate with existing `AgentRegistry.findBestAgent()`
- [ ] Add autonomous assignment logic
- [ ] Create basic polling mechanism for GitHub issues
- [ ] Unit tests for scoring algorithm

**Deliverable**: Agents can self-select and assign simple issues

### Phase 2: Workload & Priority (Weeks 3-4)

**Goal**: Implement fair distribution and priority handling

- [ ] Implement `WorkloadBalancer` class
- [ ] Add workload limits enforcement
- [ ] Implement `PriorityQueue` and priority scoring
- [ ] Add dependency tracking
- [ ] Integrate with agent pool auto-scaling
- [ ] Integration tests for workload balancing

**Deliverable**: Fair task distribution with priority handling

### Phase 3: Progress & Escalation (Weeks 5-6)

**Goal**: Implement progress tracking and blocked detection

- [ ] Implement `ProgressTracker` class
- [ ] Add GitHub progress comment automation
- [ ] Implement `BlockedDetector` for stall detection
- [ ] Create `EscalationManager` with multi-level escalation
- [ ] Add auto-recovery mechanisms
- [ ] E2E tests for escalation flows

**Deliverable**: Full progress tracking and automatic escalation

### Phase 4: GitHub Integration (Week 7)

**Goal**: Complete GitHub monitoring and updates

- [ ] Implement webhook handler (optional)
- [ ] Enhance polling mechanism with rate limiting
- [ ] Add milestone automation
- [ ] Implement label-based rules
- [ ] Add comment templates for different events
- [ ] GitHub integration tests

**Deliverable**: Complete GitHub integration with automation

### Phase 5: Optimization & Tuning (Week 8)

**Goal**: Fine-tune algorithms and performance

- [ ] Optimize scoring algorithms based on real data
- [ ] Tune thresholds (stall detection, scaling, etc.)
- [ ] Add telemetry and monitoring
- [ ] Performance benchmarks
- [ ] Load testing with multiple repositories
- [ ] Documentation and runbooks

**Deliverable**: Production-ready autonomous agent system

---

## Configuration Reference

### Environment Variables

```bash
# GitHub Configuration
GITHUB_TOKEN=ghp_xxxxx                    # GitHub API token
GITHUB_WEBHOOK_SECRET=secret123           # Webhook signature verification
GITHUB_POLL_INTERVAL=60000                # Polling interval (ms)

# Agent Configuration
MAX_AGENTS_PER_POOL=10                    # Maximum agents per pool
DEFAULT_AGENT_TIMEOUT=300000              # Default task timeout (ms)
AGENT_HEALTH_THRESHOLD=0.6                # Minimum health for assignment
TARGET_WORKLOAD=0.7                       # Target avg workload (70%)

# Autonomous Behavior
AUTO_ASSIGN_ENABLED=true                  # Enable autonomous assignment
AUTO_ASSIGN_THRESHOLD=70                  # Minimum score for auto-assignment
AUTO_SCALING_ENABLED=true                 # Enable pool auto-scaling
STALL_DETECTION_ENABLED=true              # Enable blocked detection

# Escalation
STALL_THRESHOLD_CRITICAL=900000           # 15 minutes for critical
STALL_THRESHOLD_HIGH=1800000              # 30 minutes for high
STALL_THRESHOLD_MEDIUM=3600000            # 1 hour for medium
AUTO_RECOVERY_ENABLED=true                # Enable auto-recovery attempts
MAX_ESCALATION_LEVEL=4                    # Maximum escalation levels

# Monitoring
PROGRESS_UPDATE_INTERVAL=300000           # Progress update frequency (5 min)
HEALTH_CHECK_INTERVAL=30000               # Agent health check (30 sec)
METRICS_RETENTION_DAYS=30                 # Metrics retention period
```

### Example Configuration File

```yaml
# autonomous-agents.yaml
repositories:
  - owner: "myorg"
    repo: "myproject"
    config:
      autoAssign: true
      autoAssignLabels: ["auto-assign", "good first issue"]
      priorityLabels:
        critical: ["urgent", "critical", "security"]
        high: ["bug", "regression"]
        medium: ["feature", "enhancement"]
        low: ["documentation", "cleanup"]

pools:
  - name: "backend-developers"
    template: "coder"
    minSize: 2
    maxSize: 10
    autoScale: true
    scaleUpThreshold: 0.8
    scaleDownThreshold: 0.3

  - name: "qa-engineers"
    template: "tester"
    minSize: 1
    maxSize: 5
    autoScale: true

escalation:
  enabled: true
  notifications:
    slack: "https://hooks.slack.com/services/XXX"
    email: "team@example.com"

monitoring:
  dashboardUrl: "https://metrics.example.com"
  alertingEnabled: true
```

---

## Appendix: Existing Infrastructure Analysis

### A. AgentRegistry Capabilities

The existing `AgentRegistry` provides:

1. **`findBestAgent(taskType, requiredCapabilities, preferredAgent?)`**
   - Multi-factor scoring (health 40%, success rate 30%, availability 20%, capability match 10%)
   - Returns single best agent match
   - Filters by health threshold (0.5) and availability

2. **`queryAgents(query)`**
   - Flexible filtering by type, status, health, tags, etc.
   - Cache with 60-second TTL
   - Persistent storage integration

3. **`searchByCapabilities(requiredCapabilities)`**
   - Searches across languages, frameworks, domains, tools
   - Case-insensitive matching

### B. AgentManager Features

1. **Agent Templates**: 20+ pre-configured templates including:
   - researcher, coder, analyst, tester, reviewer
   - requirements-engineer, design-architect, task-planner
   - system-architect, steering-author

2. **Agent Pools**:
   - `createAgentPool()` with min/max sizing
   - `scalePool()` for dynamic scaling
   - Auto-scale support with thresholds

3. **Health Monitoring**:
   - Real-time health checks every 30 seconds
   - Component scoring: responsiveness, performance, reliability, resource usage
   - Auto-restart on critical health issues

4. **Performance Tracking**:
   - Last 100 metrics per agent
   - Task completion rates
   - Resource utilization
   - Error history (last 50 errors)

### C. GitHub API Integration

1. **Issue Operations**:
   - `listIssues()`, `createIssue()`, `updateIssue()`
   - `addIssueLabels()`, `assignIssue()`
   - Supports filtering by state, labels, sort, pagination

2. **PR Operations**:
   - Full PR lifecycle management
   - Review automation
   - Merge coordination

3. **Webhook Support**:
   - Signature verification with `GITHUB_WEBHOOK_SECRET`
   - Event handlers for push, PR, issues, releases, workflows

4. **Rate Limiting**:
   - Built-in rate limit tracking
   - Automatic wait on rate limit exceeded
   - 5000 calls/hour limit

### D. Health Scoring System

Components of health score (0-1 scale):

1. **Responsiveness** (0-1):
   - Based on heartbeat timeliness
   - < 2x interval = 1.0, 2-3x = 0.5, > 3x = 0.0

2. **Performance** (0-1):
   - Based on average task completion time vs. expected
   - Normalized: expectedTime / avgTime

3. **Reliability** (0-1):
   - Success rate: tasksCompleted / (tasksCompleted + tasksFailed)

4. **Resource Usage** (0-1):
   - Inverse of resource consumption
   - (1 - memoryUsage) + (1 - cpuUsage) + (1 - diskUsage) / 3

**Overall Health** = (responsiveness + performance + reliability + resourceUsage) / 4

**Auto-restart triggered** when overall health < 0.3

---

## References

1. [AgentRegistry Source](/home/robert/cto_agentics/claude-flow/src/core/AgentRegistry.ts)
2. [AgentManager Source](/home/robert/cto_agentics/claude-flow/src/agents/agent-manager.ts)
3. [GitHub API Integration](/home/robert/cto_agentics/claude-flow/src/cli/simple-commands/github/github-api.js)
4. [Health Check System](/home/robert/cto_agentics/claude-flow/src/monitoring/health-check.ts)
5. [Capability System](/home/robert/cto_agentics/claude-flow/src/cli/agents/capabilities.ts)

---

**End of Document**

*This design provides a comprehensive framework for autonomous agent operation in claude-flow. Implementation should proceed in phases with thorough testing at each stage.*
