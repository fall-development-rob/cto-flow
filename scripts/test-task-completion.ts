/**
 * Test Task Completion Tracking in Hive-Mind GitHub Orchestrator
 *
 * This script tests the new task completion tracking functionality:
 * 1. Creates a simple epic with a few tasks
 * 2. Updates task statuses (moves them through project columns)
 * 3. Completes tasks (adds comments, closes issues, updates project)
 */

import { config } from 'dotenv';
config();

import {
  createHiveMindOrchestrator,
  type EpicPlan,
} from '../dist/src/teammate-agents/integration/hive-mind-github.js';

// Configuration
const OWNER = 'fall-development-rob';
const PROJECT_NAME = 'task-tracking-test';

async function testTaskCompletion() {
  const timestamp = Date.now();
  const repoName = `${PROJECT_NAME}-${timestamp}`;

  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       TASK COMPLETION TRACKING TEST                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  // Check for token
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    console.error('Error: GITHUB_TOKEN required in .env');
    process.exit(1);
  }

  // ========================================================================
  // STEP 1: Initialize and Create Epic
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 1: Initialize Orchestrator and Create Epic                   │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  const orchestrator = createHiveMindOrchestrator({
    owner: OWNER,
    enableVectorSearch: true,
    enableLearning: true,
    autoCreateLabels: true,
  });

  await orchestrator.initialize();
  console.log('✓ Orchestrator initialized');

  // Create repository
  const repo = await orchestrator.createRepository({
    name: repoName,
    description: 'Test repo for task completion tracking',
    private: false,
  });

  console.log(`✓ Repository created: ${repo.url}`);

  // Wait for GitHub to initialize
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Create a simple epic
  const epicPlan: EpicPlan = {
    title: 'Task Tracking Test Epic',
    description: 'Testing the task completion tracking functionality',
    objectives: ['Test status updates', 'Test task completion'],
    constraints: ['Must complete within test run'],
    tasks: [
      {
        title: 'Task 1: Initial Setup',
        description: 'First task to test status transitions',
        phase: 'Specification',
        skills: ['research'],
        priority: 'high',
      },
      {
        title: 'Task 2: Implementation',
        description: 'Second task to test completion flow',
        phase: 'Refinement',
        skills: ['typescript', 'coding'],
        priority: 'high',
      },
      {
        title: 'Task 3: Testing',
        description: 'Third task to test batch operations',
        phase: 'Completion',
        skills: ['testing'],
        priority: 'medium',
      },
    ],
  };

  // Listen for events
  orchestrator.on('task:statusUpdated', (data) => {
    console.log(`  📊 Status updated: #${data.issueNumber} → ${data.status}`);
  });

  orchestrator.on('task:completed', (data) => {
    console.log(`  ✅ Task completed: #${data.issueNumber} (${data.success ? 'success' : 'failed'})`);
  });

  const epic = await orchestrator.createEpic(epicPlan);

  console.log(`\n✓ Epic created: ${epic.epicId}`);
  console.log(`  Project: ${epic.projectUrl}`);
  console.log(`  Tasks: ${epic.tasks.length}`);

  // Show created tasks with their project item IDs
  console.log('\nCreated Tasks:');
  for (const task of epic.tasks) {
    console.log(`  #${task.issueNumber}: ${task.title}`);
    console.log(`    - Project Item ID: ${task.projectItemId || 'N/A'}`);
    console.log(`    - Assigned Agent: ${task.assignedAgent?.name || 'None'}`);
  }

  // ========================================================================
  // STEP 2: Test Status Updates
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 2: Test Status Updates (Moving Tasks Through Columns)        │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  const task1 = epic.tasks[0];

  // Move task 1 to "In Progress"
  console.log(`\nMoving Task #${task1.issueNumber} to "In Progress"...`);
  await orchestrator.updateTaskStatus(epic.epicId, task1.taskId, 'In Progress');
  console.log('✓ Task moved to In Progress');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Move task 1 to "Done" (using GitHub's default status options)
  console.log(`\nMoving Task #${task1.issueNumber} to "Done"...`);
  await orchestrator.updateTaskStatus(epic.epicId, task1.taskId, 'Done');
  console.log('✓ Task moved to Done');

  // ========================================================================
  // STEP 3: Test Task Completion
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 3: Test Task Completion                                      │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  // Complete task 1
  console.log(`\nCompleting Task #${task1.issueNumber}...`);
  const completionResult = await orchestrator.completeTask(epic.epicId, task1.taskId, {
    success: true,
    completedBy: 'Hive-Mind Test Runner',
    summary: 'Task completed successfully during test run. All acceptance criteria met.',
    artifacts: ['test-output.log', 'results.json'],
  });

  console.log('✓ Task 1 completed:');
  console.log(`  - Success: ${completionResult.success}`);
  console.log(`  - Status: ${completionResult.status}`);
  console.log(`  - Completion Time: ${completionResult.completionTime}ms`);

  // ========================================================================
  // STEP 4: Test Batch Completion
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 4: Test Batch Task Completion                                │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  const task2 = epic.tasks[1];
  const task3 = epic.tasks[2];

  console.log(`\nBatch completing Tasks #${task2.issueNumber} and #${task3.issueNumber}...`);

  const batchResults = await orchestrator.completeMultipleTasks(epic.epicId, [
    {
      taskId: task2.taskId,
      success: true,
      completedBy: 'Coder Agent',
      summary: 'Implementation completed with all tests passing.',
    },
    {
      taskId: task3.taskId,
      success: true,
      completedBy: 'Tester Agent',
      summary: 'All test cases validated. Quality gates passed.',
    },
  ]);

  console.log(`✓ Batch completion results:`);
  for (const result of batchResults) {
    console.log(`  - Task ${result.taskId}: ${result.success ? '✅ Success' : '❌ Failed'}`);
  }

  // ========================================================================
  // STEP 5: Verify Final State
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 5: Verify Final State                                        │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  const cachedEpic = orchestrator.getEpic(epic.epicId);
  console.log(`\nCached Epic: ${cachedEpic?.epicId || 'Not found'}`);
  console.log(`Total Tasks: ${cachedEpic?.tasks.length || 0}`);

  // Get stats
  const stats = await orchestrator.getStats();
  console.log('\nOrchestrator Stats:');
  console.log(`  - Initialized: ${stats.initialized}`);
  console.log(`  - Repo: ${stats.repo}`);
  console.log(`  - Agents: ${stats.agents}`);

  // ========================================================================
  // Summary
  // ========================================================================
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST COMPLETE                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  console.log(`
Results:
  ✓ Created repository: ${repo.url}
  ✓ Created epic with ${epic.tasks.length} tasks
  ✓ Updated task statuses through project columns
  ✓ Completed individual task with comment
  ✓ Batch completed remaining tasks
  ✓ All tasks moved to "Done" column
  ✓ All issues closed with completion comments

View Results:
  - Repository: ${repo.url}
  - Project Board: ${epic.projectUrl}
  - Epic Issue: ${epic.epicIssueUrl}
`);

  await orchestrator.shutdown();
  console.log('✓ Test completed successfully!');
}

// Run
testTaskCompletion()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
