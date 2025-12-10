/**
 * Full Project Lifecycle Test
 *
 * Tests the complete CTO workflow from scratch:
 * 1. Create a new repository
 * 2. Create a GitHub Project linked to the repo
 * 3. Create an epic tracking issue
 * 4. Create task issues mapped to SPARC phases
 * 5. Score agents for task assignment (Hive-Mind pattern)
 * 6. Add all issues to the project
 * 7. Simulate work progression through phases
 * 8. Complete and close the epic
 *
 * Usage: node --experimental-strip-types scripts/test-full-project-lifecycle.ts
 */

import { config } from 'dotenv';
config();

import { createOctokitClient } from '../dist/src/teammate-agents/github/octokit-client.js';
import { createUserProjectManager } from '../dist/src/teammate-agents/github/project-manager.js';

// Configuration
const OWNER = 'fall-development-rob';
const REPO_PREFIX = 'sparc-test';

// Simple scoring function
function simpleScore(agentSkills: string[], requiredSkills: string[]): number {
  const matches = agentSkills.filter(s => requiredSkills.some(r =>
    s.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(s.toLowerCase())
  ));
  const skillScore = (matches.length / Math.max(requiredSkills.length, 1)) * 60;
  const baseScore = 40;
  return Math.min(100, skillScore + baseScore);
}

// Agent profiles
const AGENTS = [
  {
    id: 'agent-researcher',
    name: 'Research Agent',
    type: 'researcher',
    skills: ['research', 'analysis', 'documentation', 'requirements'],
  },
  {
    id: 'agent-architect',
    name: 'Architect Agent',
    type: 'architect',
    skills: ['architecture', 'design', 'systems', 'patterns'],
  },
  {
    id: 'agent-coder',
    name: 'Coder Agent',
    type: 'coder',
    skills: ['typescript', 'nodejs', 'api', 'database', 'implementation'],
  },
  {
    id: 'agent-tester',
    name: 'Tester Agent',
    type: 'tester',
    skills: ['testing', 'jest', 'integration', 'e2e', 'tdd'],
  },
  {
    id: 'agent-reviewer',
    name: 'Reviewer Agent',
    type: 'reviewer',
    skills: ['code-review', 'security', 'best-practices', 'documentation'],
  },
];

// SPARC Phase Tasks
const SPARC_TASKS = [
  {
    phase: 'Specification',
    title: 'Define API requirements and constraints',
    description: 'Research and document comprehensive API requirements including authentication, authorization, rate limiting, and data validation.',
    skills: ['research', 'analysis', 'documentation', 'requirements'],
    priority: 'high',
  },
  {
    phase: 'Pseudocode',
    title: 'Design authentication flow algorithms',
    description: 'Create detailed pseudocode for login, registration, token refresh, and password reset flows.',
    skills: ['design', 'algorithms', 'documentation'],
    priority: 'high',
  },
  {
    phase: 'Architecture',
    title: 'Design system architecture',
    description: 'Create architecture diagrams, define component boundaries, and document API contracts.',
    skills: ['architecture', 'design', 'systems', 'patterns'],
    priority: 'high',
  },
  {
    phase: 'Refinement',
    title: 'Implement authentication endpoints',
    description: 'Build REST API endpoints for /auth/register, /auth/login, /auth/logout, /auth/refresh using TDD.',
    skills: ['typescript', 'nodejs', 'api', 'implementation'],
    priority: 'critical',
  },
  {
    phase: 'Refinement',
    title: 'Write comprehensive test suite',
    description: 'Create unit tests, integration tests, and e2e tests for all authentication flows.',
    skills: ['testing', 'jest', 'integration', 'tdd'],
    priority: 'high',
  },
  {
    phase: 'Completion',
    title: 'Security review and documentation',
    description: 'Perform security audit, address vulnerabilities, and complete API documentation.',
    skills: ['code-review', 'security', 'best-practices', 'documentation'],
    priority: 'critical',
  },
];

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFullLifecycleTest() {
  const timestamp = Date.now();
  const repoName = `${REPO_PREFIX}-${timestamp}`;
  const epicId = `epic-${timestamp}`;

  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║           FULL PROJECT LIFECYCLE TEST - SPARC + HIVE-MIND          ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\nTimestamp: ${new Date().toISOString()}`);
  console.log(`Owner: ${OWNER}`);
  console.log(`Repository: ${repoName}\n`);

  // Check for token
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    console.error('Error: GITHUB_TOKEN required in .env');
    process.exit(1);
  }

  // Initialize client with placeholder repo (will be updated)
  const client = createOctokitClient({ owner: OWNER, repo: 'placeholder' });

  try {
    // ========================================================================
    // PHASE 1: Create Repository
    // ========================================================================
    console.log('┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ PHASE 1: Repository Creation                                      │');
    console.log('└──────────────────────────────────────────────────────────────────┘');

    console.log(`Creating repository: ${repoName}...`);
    const repo = await client.createRepository({
      name: repoName,
      description: 'SPARC + Hive-Mind Integration Test - Automated project lifecycle demo',
      private: false,
      autoInit: true,
    });

    console.log(`✓ Repository created: ${repo.fullName}`);
    console.log(`  URL: ${repo.url}`);
    console.log(`  Clone: ${repo.cloneUrl}`);

    // Wait for GitHub to fully initialize the repo
    await sleep(2000);

    // ========================================================================
    // PHASE 2: Create GitHub Project
    // ========================================================================
    console.log('\n┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ PHASE 2: GitHub Project Creation                                  │');
    console.log('└──────────────────────────────────────────────────────────────────┘');

    const manager = createUserProjectManager(OWNER, repoName);

    const project = await manager.createProject({
      title: '[SPARC Epic] Secure Authentication API',
      description: `Complete authentication system following SPARC methodology.

## SPARC Phases
- **Specification**: Requirements and constraints
- **Pseudocode**: Algorithm design
- **Architecture**: System design
- **Refinement**: TDD implementation
- **Completion**: Review and documentation

## Hive-Mind Coordination
Tasks are automatically assigned to specialized agents based on skill matching.

Epic ID: \`${epicId}\``,
      epicId,
      createStatusField: true,
      statusOptions: ['Backlog', 'Specification', 'Pseudocode', 'Architecture', 'In Progress', 'Review', 'Done'],
    });

    console.log(`✓ Project created: #${project.number}`);
    console.log(`  URL: ${project.url}`);

    // ========================================================================
    // PHASE 3: Create Epic Issue
    // ========================================================================
    console.log('\n┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ PHASE 3: Epic Issue Creation                                      │');
    console.log('└──────────────────────────────────────────────────────────────────┘');

    // Ensure labels
    const epicLabels = [`epic:${epicId}`, 'epic', 'sparc', 'hive-mind'];
    for (const label of epicLabels) {
      try {
        await client.ensureLabel(label, label.startsWith('epic:') ? '7057ff' : 'c5def5');
      } catch (e) { /* ignore */ }
    }

    const epicIssue = await client.createIssue(
      '[SPARC EPIC] Implement Secure Authentication API',
      `## Epic Overview

Implement a production-ready authentication API using SPARC methodology with Hive-Mind agent coordination.

## Objectives
- [ ] Define comprehensive requirements (Specification)
- [ ] Design authentication algorithms (Pseudocode)
- [ ] Create system architecture (Architecture)
- [ ] Implement with TDD (Refinement)
- [ ] Security review and docs (Completion)

## Technical Stack
- Node.js + TypeScript
- JWT + bcrypt
- PostgreSQL
- Jest for testing

## Success Criteria
- All endpoints documented and tested
- Security audit passed
- 90%+ test coverage
- Performance benchmarks met

---
**Epic ID**: \`${epicId}\`
**Project**: #${project.number}
**Methodology**: SPARC
**Coordination**: Hive-Mind

_Managed by Teammate-Agents_`,
      epicLabels
    );

    console.log(`✓ Epic issue created: #${epicIssue.number}`);
    console.log(`  URL: ${epicIssue.url}`);

    // Add epic to project
    const epicNodeId = await client.getIssueNodeId(epicIssue.number);
    await client.addIssueToProject(project.id, epicNodeId);
    console.log('✓ Epic added to project');

    // ========================================================================
    // PHASE 4: Agent Scoring & Task Assignment
    // ========================================================================
    console.log('\n┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ PHASE 4: Hive-Mind Agent Scoring & Task Assignment                │');
    console.log('└──────────────────────────────────────────────────────────────────┘');

    const taskAssignments: Array<{
      task: typeof SPARC_TASKS[0];
      agent: typeof AGENTS[0];
      score: number;
    }> = [];

    console.log('\nScoring agents for each task...\n');
    console.log('  ┌─────────────────────────────────────┬─────────────────┬───────┐');
    console.log('  │ Task                                │ Best Agent      │ Score │');
    console.log('  ├─────────────────────────────────────┼─────────────────┼───────┤');

    for (const task of SPARC_TASKS) {
      const scores = AGENTS.map(agent => ({
        agent,
        score: simpleScore(agent.skills, task.skills),
      }));
      scores.sort((a, b) => b.score - a.score);
      const best = scores[0];

      taskAssignments.push({ task, agent: best.agent, score: best.score });

      const taskName = task.title.substring(0, 35).padEnd(35);
      const agentName = best.agent.name.padEnd(15);
      console.log(`  │ ${taskName} │ ${agentName} │ ${best.score.toFixed(0).padStart(3)}%  │`);
    }
    console.log('  └─────────────────────────────────────┴─────────────────┴───────┘');

    // ========================================================================
    // PHASE 5: Create Task Issues
    // ========================================================================
    console.log('\n┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ PHASE 5: Task Issue Creation                                      │');
    console.log('└──────────────────────────────────────────────────────────────────┘');

    const createdTasks: Array<{
      number: number;
      title: string;
      phase: string;
      agent: string;
      itemId?: string;
    }> = [];

    for (const assignment of taskAssignments) {
      const { task, agent, score } = assignment;

      const taskLabels = [
        `epic:${epicId}`,
        'task:child',
        `priority:${task.priority}`,
        `sparc:${task.phase.toLowerCase()}`,
        `agent:${agent.type}`,
      ];

      // Ensure labels
      for (const label of taskLabels) {
        try {
          let color = 'ededed';
          if (label.startsWith('priority:critical')) color = 'd73a4a';
          else if (label.startsWith('priority:high')) color = 'ff6b6b';
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
**Agent Skills**: ${agent.skills.join(', ')}

## SPARC Metadata
**Phase**: ${task.phase}
**Parent Epic**: #${epicIssue.number}
**Epic ID**: \`${epicId}\`
**Priority**: ${task.priority}

## Acceptance Criteria
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Code reviewed
- [ ] Documentation updated

_Task managed by Teammate-Agents + Hive-Mind Coordination_`;

      const taskIssue = await client.createIssue(task.title, taskBody, taskLabels);

      // Add to project
      const taskNodeId = await client.getIssueNodeId(taskIssue.number);
      const { itemId } = await client.addIssueToProject(project.id, taskNodeId);

      createdTasks.push({
        number: taskIssue.number,
        title: task.title,
        phase: task.phase,
        agent: agent.name,
        itemId,
      });

      console.log(`✓ #${taskIssue.number}: [${task.phase}] ${task.title.substring(0, 40)}...`);
    }

    // ========================================================================
    // PHASE 6: Simulate Work Progression
    // ========================================================================
    console.log('\n┌──────────────────────────────────────────────────────────────────┐');
    console.log('│ PHASE 6: Simulating SPARC Phase Progression                       │');
    console.log('└──────────────────────────────────────────────────────────────────┘');

    // Get the Status field from the project
    const projectData = await client.getProject(project.number);
    const statusField = projectData?.fields.nodes.find(
      (f: any) => f.name === 'SPARC Status' || f.name === 'Status'
    );

    if (statusField && statusField.options) {
      console.log('\nMoving tasks through SPARC phases...\n');

      // Map phases to status options
      const phaseToStatus: Record<string, string> = {
        'Specification': 'Specification',
        'Pseudocode': 'Pseudocode',
        'Architecture': 'Architecture',
        'Refinement': 'In Progress',
        'Completion': 'Review',
      };

      for (const task of createdTasks) {
        const targetStatus = phaseToStatus[task.phase] || 'Backlog';
        const statusOption = statusField.options.find((o: any) => o.name === targetStatus);

        if (statusOption && task.itemId) {
          try {
            await client.updateProjectItemField(
              project.id,
              task.itemId,
              statusField.id,
              statusOption.id
            );
            console.log(`  ✓ #${task.number} → ${targetStatus}`);
          } catch (e: any) {
            console.log(`  ⚠ #${task.number}: Could not update status (${e.message})`);
          }
        }
      }
    } else {
      console.log('  Status field not found in project');
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    console.log('\n╔════════════════════════════════════════════════════════════════════╗');
    console.log('║                    PROJECT LIFECYCLE COMPLETE                       ║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');

    console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│ Created Resources                                                    │
├─────────────────────────────────────────────────────────────────────┤
│ Repository: ${repo.url.padEnd(53)} │
│ Project:    ${project.url.padEnd(53)} │
│ Epic:       ${epicIssue.url.padEnd(53)} │
│ Tasks:      ${createdTasks.length} issues created                                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Task Summary                                                         │
├───────┬─────────────────┬────────────────────────────────────────────┤
│ Issue │ SPARC Phase     │ Assigned Agent                             │
├───────┼─────────────────┼────────────────────────────────────────────┤`);

    for (const task of createdTasks) {
      console.log(`│ #${task.number.toString().padEnd(4)} │ ${task.phase.padEnd(15)} │ ${task.agent.padEnd(42)} │`);
    }

    console.log(`└───────┴─────────────────┴────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ Hive-Mind Coordination Pattern                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                        ┌─────────────────┐                           │
│                        │     QUEEN       │                           │
│                        │  (Orchestrator) │                           │
│                        └────────┬────────┘                           │
│                                 │                                    │
│         ┌───────────┬───────────┼───────────┬───────────┐            │
│         ▼           ▼           ▼           ▼           ▼            │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│   │Researcher│ │ Architect│ │  Coder   │ │  Tester  │ │ Reviewer │  │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│        │            │            │            │            │         │
│        └────────────┴────────────┴────────────┴────────────┘         │
│                                 │                                    │
│                        ┌────────┴────────┐                           │
│                        │ GitHub Projects │                           │
│                        │ (Shared State)  │                           │
│                        └─────────────────┘                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

View your project: ${project.url}
`);

    return {
      repo,
      project,
      epicIssue,
      tasks: createdTasks,
    };

  } catch (error: any) {
    console.error('\n╔════════════════════════════════════════════════════════════════════╗');
    console.error('║                           ERROR                                     ║');
    console.error('╚════════════════════════════════════════════════════════════════════╝');
    console.error(`\nError: ${error.message}`);
    if (error.errors) {
      console.error('GraphQL errors:', JSON.stringify(error.errors, null, 2));
    }
    throw error;
  }
}

// Run
runFullLifecycleTest()
  .then((result) => {
    console.log('✓ Full project lifecycle test completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  });
