/**
 * Test Retrospective Task Completion with Existing Repo
 *
 * This script tests the ability of Hive-Mind to:
 * 1. Load an existing epic from GitHub
 * 2. Auto-detect completed tasks based on file existence
 * 3. Retrospectively close issues and update project board
 */

import { config } from 'dotenv';
config();

import { createHiveMindOrchestrator } from '../dist/src/teammate-agents/integration/hive-mind-github.js';

// Configuration - use the existing repo
const OWNER = 'fall-development-rob';
const REPO = 'micro-semantic-cache-1765387768698';
const WORKING_DIR = '/tmp/micro-semantic-cache-1765387768698';

async function testRetrospectiveCompletion() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       RETROSPECTIVE TASK COMPLETION TEST                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\nRepository: ${OWNER}/${REPO}`);
  console.log(`Working Directory: ${WORKING_DIR}`);

  // Check for token
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    console.error('Error: GITHUB_TOKEN required in .env');
    process.exit(1);
  }

  // ========================================================================
  // STEP 1: Initialize Orchestrator
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 1: Initialize Hive-Mind Orchestrator                         │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  const orchestrator = createHiveMindOrchestrator({
    owner: OWNER,
    enableVectorSearch: true,
    enableLearning: true,
  });

  await orchestrator.initialize();
  console.log('✓ Orchestrator initialized');

  // ========================================================================
  // STEP 2: Load Existing Epic from GitHub
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 2: Load Existing Epic from GitHub                            │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  // Listen for events
  orchestrator.on('epic:loaded', (data) => {
    console.log(`  ✓ Epic loaded: ${data.epicId}`);
    console.log(`    Tasks: ${data.taskCount}`);
    console.log(`    Project: #${data.projectNumber}`);
  });

  orchestrator.on('task:completed', (data) => {
    console.log(`  ✅ Completed: #${data.issueNumber} → ${data.status}`);
  });

  const epic = await orchestrator.loadEpicFromGitHub(REPO);

  if (!epic) {
    console.error('Failed to load epic from repository');
    process.exit(1);
  }

  console.log(`\n✓ Loaded Epic: ${epic.epicId}`);
  console.log(`  Epic Issue: #${epic.epicIssueNumber}`);
  console.log(`  Project: ${epic.projectUrl}`);
  console.log(`  Tasks: ${epic.tasks.length}`);

  console.log('\nLoaded Tasks:');
  for (const task of epic.tasks) {
    const hasItemId = task.projectItemId ? '✓' : '✗';
    console.log(`  #${task.issueNumber}: [${task.phase}] ${task.title}`);
    console.log(`    Agent: ${task.assignedAgent?.name || 'None'} | Project Item: ${hasItemId}`);
  }

  // ========================================================================
  // STEP 3: Auto-Detect Completed Tasks
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 3: Auto-Detect Completed Tasks                               │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  console.log(`\nScanning working directory: ${WORKING_DIR}`);

  const detected = await orchestrator.autoDetectCompletedTasks(epic.epicId, WORKING_DIR);

  console.log(`\n✓ Detection Results:`);
  console.log(`  Completed: ${detected.completed.length} tasks`);
  console.log(`  Pending: ${detected.pending.length} tasks`);

  if (detected.completed.length > 0) {
    console.log('\nCompleted Tasks (files exist):');
    for (const task of detected.completed) {
      console.log(`  ✅ #${task.issueNumber}: ${task.title}`);
    }
  }

  if (detected.pending.length > 0) {
    console.log('\nPending Tasks (files missing):');
    for (const task of detected.pending) {
      console.log(`  ⏳ #${task.issueNumber}: ${task.title}`);
    }
  }

  // ========================================================================
  // STEP 4: Sync Completion Status to GitHub
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 4: Sync Completion Status to GitHub                          │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  if (detected.completed.length === 0) {
    console.log('\nNo completed tasks detected. Nothing to sync.');
  } else {
    console.log(`\nSyncing ${detected.completed.length} completed tasks to GitHub...`);

    const syncResult = await orchestrator.syncCompletionStatus(
      epic.epicId,
      WORKING_DIR,
      { completedBy: 'Hive-Mind Retrospective Sync' }
    );

    console.log(`\n✓ Sync Complete:`);
    console.log(`  Successfully closed: ${syncResult.results.length} issues`);
    console.log(`  Project items moved to Done: ${syncResult.results.filter(r => r.status === 'Done').length}`);

    if (syncResult.results.length > 0) {
      console.log('\nCompletion Details:');
      for (const result of syncResult.results) {
        console.log(`  #${result.issueNumber}: ${result.success ? '✅ Closed' : '❌ Failed'} (${result.completionTime}ms)`);
      }
    }
  }

  // ========================================================================
  // STEP 5: Final Summary
  // ========================================================================
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    SYNC COMPLETE                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  console.log(`
Summary:
  - Loaded epic from: ${OWNER}/${REPO}
  - Found ${epic.tasks.length} tasks in epic
  - Detected ${detected.completed.length} completed tasks
  - Detected ${detected.pending.length} pending tasks

View Results:
  - Repository: https://github.com/${OWNER}/${REPO}
  - Project Board: ${epic.projectUrl}
  - Epic Issue: ${epic.epicIssueUrl}
`);

  await orchestrator.shutdown();
  console.log('✓ Test completed successfully!');
}

// Run
testRetrospectiveCompletion()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
