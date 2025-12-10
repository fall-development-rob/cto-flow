/**
 * SPARC + Hive-Mind + GitHub Projects Integration Test
 *
 * This test demonstrates the full CTO workflow:
 * 1. Create a GitHub Project linked to the repo
 * 2. Create an epic tracking issue
 * 3. Create task issues mapped to SPARC phases
 * 4. Score agents for task assignment (Hive-Mind pattern)
 * 5. Add all issues to the project
 * 6. Show coordination patterns
 *
 * Usage: node --experimental-strip-types scripts/test-sparc-hivemind-integration.ts
 */

import { config } from 'dotenv';
config();

// Import GitHub integration
import { createUserProjectManager } from '../dist/src/teammate-agents/github/project-manager.js';
import { createOctokitClient } from '../dist/src/teammate-agents/github/octokit-client.js';

// Simple scoring function (avoiding complex scorer API issues)
function simpleScore(agentSkills: string[], requiredSkills: string[]): number {
  const matches = agentSkills.filter(s => requiredSkills.some(r =>
    s.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(s.toLowerCase())
  ));
  const skillScore = (matches.length / Math.max(requiredSkills.length, 1)) * 60;
  const baseScore = 40; // Base availability score
  return Math.min(100, skillScore + baseScore);
}

// Configuration
const OWNER = 'fall-development-rob';
const REPO = 'Test-repo';

// Simulated agent profiles for scoring (Hive-Mind workers)
const AGENTS = [
  {
    id: 'agent-researcher',
    name: 'Research Agent',
    type: 'researcher',
    capabilities: {
      skills: ['research', 'analysis', 'documentation', 'requirements'],
      domains: ['backend', 'architecture', 'security'],
      tools: ['search', 'read', 'write'],
    },
    workload: { activeTasks: 1, completedToday: 3, maxConcurrent: 3 },
  },
  {
    id: 'agent-coder',
    name: 'Coder Agent',
    type: 'coder',
    capabilities: {
      skills: ['typescript', 'nodejs', 'api', 'database', 'testing'],
      domains: ['backend', 'frontend', 'database'],
      tools: ['edit', 'bash', 'test'],
    },
    workload: { activeTasks: 2, completedToday: 5, maxConcurrent: 4 },
  },
  {
    id: 'agent-tester',
    name: 'Tester Agent',
    type: 'tester',
    capabilities: {
      skills: ['testing', 'jest', 'integration', 'e2e', 'security-testing'],
      domains: ['testing', 'qa', 'security'],
      tools: ['bash', 'test', 'read'],
    },
    workload: { activeTasks: 0, completedToday: 2, maxConcurrent: 3 },
  },
  {
    id: 'agent-reviewer',
    name: 'Reviewer Agent',
    type: 'reviewer',
    capabilities: {
      skills: ['code-review', 'security', 'best-practices', 'documentation'],
      domains: ['backend', 'frontend', 'security'],
      tools: ['read', 'grep', 'search'],
    },
    workload: { activeTasks: 1, completedToday: 4, maxConcurrent: 5 },
  },
];

// Tasks with requirements for agent matching - mapped to SPARC phases
const TASKS = [
  {
    title: 'Analyze authentication requirements',
    description: 'Research and document authentication requirements including OAuth, JWT, and session management.',
    requirements: {
      skills: ['research', 'analysis', 'documentation'],
      domains: ['security', 'backend'],
      priority: 'high' as const,
      estimatedComplexity: 3,
    },
    labels: ['research', 'specification'],
    sparcPhase: 'Specification',
  },
  {
    title: 'Design authentication architecture',
    description: 'Create pseudocode and architecture diagrams for the auth system.',
    requirements: {
      skills: ['architecture', 'design', 'documentation'],
      domains: ['backend', 'security'],
      priority: 'high' as const,
      estimatedComplexity: 4,
    },
    labels: ['architecture', 'design'],
    sparcPhase: 'Pseudocode-Architecture',
  },
  {
    title: 'Implement user registration API',
    description: 'Build POST /api/auth/register with validation, hashing, and DB storage.',
    requirements: {
      skills: ['typescript', 'nodejs', 'api', 'database'],
      domains: ['backend'],
      priority: 'high' as const,
      estimatedComplexity: 5,
    },
    labels: ['backend', 'api', 'implementation'],
    sparcPhase: 'Refinement',
  },
  {
    title: 'Write authentication tests',
    description: 'Create unit and integration tests for all auth endpoints.',
    requirements: {
      skills: ['testing', 'jest', 'integration'],
      domains: ['testing', 'backend'],
      priority: 'high' as const,
      estimatedComplexity: 4,
    },
    labels: ['testing', 'tdd'],
    sparcPhase: 'Refinement',
  },
  {
    title: 'Security review and hardening',
    description: 'Review auth implementation for vulnerabilities and apply security best practices.',
    requirements: {
      skills: ['security', 'code-review', 'best-practices'],
      domains: ['security', 'backend'],
      priority: 'critical' as const,
      estimatedComplexity: 5,
    },
    labels: ['security', 'review'],
    sparcPhase: 'Completion',
  },
];

async function runIntegrationTest() {
  console.log('='.repeat(70));
  console.log('SPARC + Hive-Mind + GitHub Projects Integration Test');
  console.log('='.repeat(70));
  console.log(`\nTarget Repository: ${OWNER}/${REPO}\n`);

  // Check for token
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    console.error('Error: GITHUB_TOKEN required in .env');
    process.exit(1);
  }

  const client = createOctokitClient({ owner: OWNER, repo: REPO });
  const manager = createUserProjectManager(OWNER, REPO);

  // Step 1: Create GitHub Project
  console.log('Step 1: Creating GitHub Project (linked to repo)...');
  const epicId = `sparc-epic-${Date.now()}`;

  const project = await manager.createProject({
    title: '[SPARC Epic] Implement Secure Authentication System',
    description: `SPARC Methodology Epic for authentication implementation.

## SPARC Phases
- Specification: Requirements analysis
- Pseudocode: Algorithm design
- Architecture: System design
- Refinement: TDD implementation
- Completion: Integration & review`,
    epicId,
    createStatusField: true,
    statusOptions: ['Backlog', 'Specification', 'Design', 'In Progress', 'Review', 'Done'],
  });

  console.log(`✓ Project created: #${project.number}`);
  console.log(`  URL: ${project.url}`);

  // Step 2: Create Epic tracking issue
  console.log('\nStep 2: Creating epic tracking issue...');

  // Ensure labels exist
  const epicLabels = [`epic:${epicId}`, 'epic', 'sparc', 'tracking'];
  for (const label of epicLabels) {
    try {
      await client.ensureLabel(label, label.startsWith('epic:') ? '7057ff' : 'c5def5');
    } catch (e) { /* ignore */ }
  }

  const epicIssue = await client.createIssue(
    '[SPARC EPIC] Implement Secure Authentication System',
    `## SPARC Specification

### Overview
Implement a comprehensive authentication system following SPARC methodology.

### SPARC Phases
1. **Specification** - Define requirements and constraints
2. **Pseudocode** - Design algorithms and flows
3. **Architecture** - System design and component structure
4. **Refinement** - TDD implementation
5. **Completion** - Integration and security review

### Requirements
- User registration with email verification
- Secure login/logout with JWT
- Password reset via email
- Rate limiting and brute force protection

### Constraints
- Must use bcrypt for password hashing
- JWT tokens expire in 24h
- All endpoints require HTTPS

---
**Epic ID**: \`${epicId}\`
**Project**: #${project.number}
**Methodology**: SPARC

_Managed by Teammate-Agents + Hive-Mind_`,
    epicLabels
  );

  console.log(`✓ Epic issue created: #${epicIssue.number}`);

  // Add epic to project
  const epicNodeId = await client.getIssueNodeId(epicIssue.number);
  await client.addIssueToProject(project.id, epicNodeId);
  console.log('✓ Epic added to project');

  // Step 3: Score agents for tasks (Hive-Mind agent selection)
  console.log('\nStep 3: Hive-Mind Agent Scoring & Selection...');
  const taskAssignments: Array<{ task: typeof TASKS[0]; agent: typeof AGENTS[0]; score: number }> = [];

  for (const task of TASKS) {
    // Score each agent using simple scoring function
    const scores = AGENTS.map(agent => {
      const score = simpleScore(agent.capabilities.skills, task.requirements.skills);
      return { agent, score };
    });

    // Best match
    scores.sort((a, b) => b.score - a.score);
    const best = scores[0];

    taskAssignments.push({ task, agent: best.agent, score: best.score });

    console.log(`\n  Task: ${task.title}`);
    console.log(`  SPARC Phase: ${task.sparcPhase}`);
    console.log(`  Best Agent: ${best.agent.name} (score: ${best.score.toFixed(1)}/100)`);
  }

  // Step 4: Create task issues and add to project
  console.log('\nStep 4: Creating task issues with SPARC phases...');
  const createdTasks: Array<{ number: number; title: string; agent: string; phase: string }> = [];

  for (const assignment of taskAssignments) {
    const { task, agent, score } = assignment;

    // Ensure labels
    const taskLabels = [
      `epic:${epicId}`,
      'task:child',
      `priority:${task.requirements.priority}`,
      `sparc:${task.sparcPhase.toLowerCase()}`,
      `agent:${agent.type}`,
      ...task.labels,
    ];

    for (const label of taskLabels) {
      try {
        let color = 'ededed';
        if (label.startsWith('priority:critical')) color = 'd73a4a';
        else if (label.startsWith('priority:high')) color = 'ff6b6b';
        else if (label.startsWith('priority:medium')) color = 'fbca04';
        else if (label.startsWith('sparc:')) color = '0366d6';
        else if (label.startsWith('agent:')) color = '28a745';
        else if (label.startsWith('epic:')) color = '7057ff';

        await client.ensureLabel(label, color);
      } catch (e) { /* ignore */ }
    }

    const taskBody = `${task.description}

---
## Hive-Mind Assignment
**Assigned Agent**: ${agent.name} (\`${agent.type}\`)
**Match Score**: ${score.toFixed(1)}/100
**Agent Skills**: ${agent.capabilities.skills.join(', ')}

## SPARC Metadata
**Phase**: ${task.sparcPhase}
**Parent Epic**: #${epicIssue.number}
**Epic ID**: \`${epicId}\`
**Priority**: ${task.requirements.priority}
**Complexity**: ${task.requirements.estimatedComplexity}/5

_Task managed by Teammate-Agents + Hive-Mind Coordination_`;

    const taskIssue = await client.createIssue(task.title, taskBody, taskLabels);

    // Add to project
    const taskNodeId = await client.getIssueNodeId(taskIssue.number);
    await client.addIssueToProject(project.id, taskNodeId);

    createdTasks.push({
      number: taskIssue.number,
      title: task.title,
      agent: agent.name,
      phase: task.sparcPhase,
    });

    console.log(`✓ #${taskIssue.number}: ${task.title} → ${agent.name}`);
  }

  // Step 5: Display coordination patterns
  console.log('\n' + '='.repeat(70));
  console.log('SPARC Phase → Epic State Mapping');
  console.log('='.repeat(70));
  console.log(`
  ┌─────────────────────┬────────────────────┬─────────────────┐
  │ SPARC Phase         │ Project Status     │ Agent Type      │
  ├─────────────────────┼────────────────────┼─────────────────┤
  │ Specification       │ Specification      │ Researcher      │
  │ Pseudocode          │ Design             │ Architect       │
  │ Architecture        │ Design             │ Architect       │
  │ Refinement (TDD)    │ In Progress        │ Coder + Tester  │
  │ Completion          │ Review → Done      │ Reviewer        │
  └─────────────────────┴────────────────────┴─────────────────┘
  `);

  console.log('='.repeat(70));
  console.log('Hive-Mind Coordination Pattern');
  console.log('='.repeat(70));
  console.log(`
  ┌────────────────────────────────────────────────────────────────┐
  │                     QUEEN COORDINATOR                          │
  │            (TeammateManager + SPARC Orchestrator)              │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  ┌────────────┐  ┌────────────┐  ┌──────────┐  ┌────────────┐ │
  │  │ Researcher │  │   Coder    │  │  Tester  │  │  Reviewer  │ │
  │  │   Agent    │  │   Agent    │  │  Agent   │  │   Agent    │ │
  │  │            │  │            │  │          │  │            │ │
  │  │ Score: ${taskAssignments.find(a => a.agent.type === 'researcher')?.score.toFixed(0) || 'N/A'}  │  │ Score: ${taskAssignments.find(a => a.agent.type === 'coder')?.score.toFixed(0) || 'N/A'}  │  │Score: ${taskAssignments.find(a => a.agent.type === 'tester')?.score.toFixed(0) || 'N/A'} │  │ Score: ${taskAssignments.find(a => a.agent.type === 'reviewer')?.score.toFixed(0) || 'N/A'}  │ │
  │  └─────┬──────┘  └─────┬──────┘  └────┬─────┘  └─────┬──────┘ │
  │        │               │              │              │        │
  │        └───────────────┴──────────────┴──────────────┘        │
  │                          │                                    │
  │               ┌──────────┴──────────┐                         │
  │               │   GitHub Projects   │                         │
  │               │   (Shared State)    │                         │
  │               │   Project #${project.number}        │                         │
  │               └─────────────────────┘                         │
  └────────────────────────────────────────────────────────────────┘
  `);

  // Summary
  console.log('='.repeat(70));
  console.log('Integration Test Summary');
  console.log('='.repeat(70));
  console.log(`
✓ GitHub Project: ${project.url}
✓ Epic Issue: https://github.com/${OWNER}/${REPO}/issues/${epicIssue.number}
✓ Tasks Created: ${createdTasks.length}

Task Assignments:
${createdTasks.map(t => `  #${t.number}: ${t.title.substring(0, 35)}... → ${t.agent} [${t.phase}]`).join('\n')}

View Results:
  - Project Board: ${project.url}
  - All Issues: https://github.com/${OWNER}/${REPO}/issues?q=epic:${epicId}
  `);

  console.log('✓ SPARC + Hive-Mind + GitHub Projects integration test completed!\n');

  return { project, epicIssue, tasks: createdTasks };
}

// Run
runIntegrationTest()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
