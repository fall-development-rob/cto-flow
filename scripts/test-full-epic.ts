/**
 * Full Epic Test - Creates a complete epic with project and tasks
 *
 * Usage: node --experimental-strip-types scripts/test-full-epic.ts
 *
 * This test simulates the full CTO workflow:
 * 1. Creates a GitHub Project linked to the repo
 * 2. Creates an epic tracking issue
 * 3. Creates task issues
 * 4. Adds all issues to the project
 * 5. Sets initial status
 */

import { config } from 'dotenv';
config();

import { createUserProjectManager } from '../dist/src/teammate-agents/github/project-manager.js';
import { createOctokitClient } from '../dist/src/teammate-agents/github/octokit-client.js';

// Configuration
const OWNER = 'fall-development-rob';
const REPO = 'Test-repo';

interface Task {
  title: string;
  description: string;
  labels: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

async function createFullEpic() {
  console.log('='.repeat(60));
  console.log('Full Epic Creation Test');
  console.log('='.repeat(60));
  console.log(`\nRepo: ${OWNER}/${REPO}\n`);

  // Check for token
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    console.error('Error: GITHUB_TOKEN required in .env');
    process.exit(1);
  }

  const client = createOctokitClient({ owner: OWNER, repo: REPO });
  const manager = createUserProjectManager(OWNER, REPO);

  // Epic details
  const epicId = `epic-${Date.now()}`;
  const epicTitle = 'Implement User Authentication System';
  const epicDescription = `
## Overview
Implement a complete user authentication system with login, registration, and password reset functionality.

## Goals
- Secure user authentication
- Session management
- Password reset flow
- OAuth support (future)

## Acceptance Criteria
- [ ] Users can register with email/password
- [ ] Users can login/logout
- [ ] Password reset via email works
- [ ] Sessions are secure and properly managed
`;

  // Tasks for this epic
  const tasks: Task[] = [
    {
      title: 'Design authentication database schema',
      description: 'Create database schema for users, sessions, and password reset tokens.',
      labels: ['database', 'design'],
      priority: 'high'
    },
    {
      title: 'Implement user registration endpoint',
      description: 'Create POST /api/auth/register endpoint with validation.',
      labels: ['backend', 'api'],
      priority: 'high'
    },
    {
      title: 'Implement login/logout endpoints',
      description: 'Create POST /api/auth/login and POST /api/auth/logout endpoints.',
      labels: ['backend', 'api'],
      priority: 'high'
    },
    {
      title: 'Add password reset flow',
      description: 'Implement forgot password and reset password endpoints with email.',
      labels: ['backend', 'email'],
      priority: 'medium'
    },
    {
      title: 'Create login UI component',
      description: 'Build React login form with validation.',
      labels: ['frontend', 'ui'],
      priority: 'medium'
    },
    {
      title: 'Write authentication tests',
      description: 'Unit and integration tests for all auth endpoints.',
      labels: ['testing'],
      priority: 'medium'
    }
  ];

  try {
    // Step 1: Create GitHub Project linked to repo
    console.log('Step 1: Creating GitHub Project...');
    const project = await manager.createProject({
      title: `[Epic] ${epicTitle}`,
      description: epicDescription,
      epicId,
      createStatusField: true,
      statusOptions: ['Backlog', 'In Progress', 'Review', 'Done']
    });
    console.log(`✓ Project created: #${project.number}`);
    console.log(`  URL: ${project.url}`);
    console.log(`  Linked to: ${OWNER}/${REPO}`);

    // Step 2: Create epic tracking issue
    console.log('\nStep 2: Creating epic tracking issue...');
    const epicLabels = [`epic:${epicId}`, 'epic', 'tracking'];

    // Ensure labels exist
    for (const label of epicLabels) {
      try {
        await client.ensureLabel(label, label.startsWith('epic:') ? '7057ff' : 'c5def5');
      } catch (e) {
        // Label might already exist
      }
    }

    const epicIssue = await client.createIssue(
      `[EPIC] ${epicTitle}`,
      `${epicDescription}\n\n---\n**Epic ID**: \`${epicId}\`\n**Project**: #${project.number}\n\n_Managed by Teammate-Agents_`,
      epicLabels
    );
    console.log(`✓ Epic issue created: #${epicIssue.number}`);
    console.log(`  URL: ${epicIssue.url}`);

    // Add epic issue to project
    const epicNodeId = await client.getIssueNodeId(epicIssue.number);
    await client.addIssueToProject(project.id, epicNodeId);
    console.log('✓ Epic issue added to project');

    // Step 3: Create task issues
    console.log('\nStep 3: Creating task issues...');
    const taskIssues: Array<{ number: number; title: string }> = [];

    for (const task of tasks) {
      // Ensure labels exist
      const taskLabels = [
        `epic:${epicId}`,
        'task:child',
        `priority:${task.priority}`,
        ...task.labels
      ];

      for (const label of taskLabels) {
        try {
          let color = 'ededed';
          if (label.startsWith('priority:high')) color = 'd73a4a';
          else if (label.startsWith('priority:medium')) color = 'fbca04';
          else if (label.startsWith('priority:low')) color = '0e8a16';
          else if (label.startsWith('epic:')) color = '7057ff';
          else if (label === 'task:child') color = 'bfd4f2';

          await client.ensureLabel(label, color);
        } catch (e) {
          // Label might already exist
        }
      }

      const taskBody = `${task.description}\n\n---\n**Parent Epic**: #${epicIssue.number}\n**Epic ID**: \`${epicId}\`\n**Priority**: ${task.priority}\n\n_Task managed by Teammate-Agents_`;

      const taskIssue = await client.createIssue(task.title, taskBody, taskLabels);
      taskIssues.push({ number: taskIssue.number, title: task.title });
      console.log(`✓ Task #${taskIssue.number}: ${task.title}`);

      // Add task to project
      const taskNodeId = await client.getIssueNodeId(taskIssue.number);
      await client.addIssueToProject(project.id, taskNodeId);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Epic Created Successfully!');
    console.log('='.repeat(60));
    console.log(`\nProject: ${project.url}`);
    console.log(`Epic Issue: ${epicIssue.url}`);
    console.log(`\nTasks (${taskIssues.length}):`);
    taskIssues.forEach(t => {
      console.log(`  - #${t.number}: ${t.title}`);
    });
    console.log(`\nView all in project: ${project.url}`);

    return {
      project,
      epicIssue,
      taskIssues
    };

  } catch (error: any) {
    console.error('\n✗ Error:', error.message);
    if (error.errors) {
      console.error('GraphQL errors:', JSON.stringify(error.errors, null, 2));
    }
    throw error;
  }
}

// Run
createFullEpic()
  .then(() => {
    console.log('\n✓ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  });
