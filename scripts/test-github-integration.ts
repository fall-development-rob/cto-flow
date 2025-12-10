/**
 * Test script for GitHub Projects integration
 *
 * Usage: npx ts-node scripts/test-github-integration.ts
 *
 * Tests the Octokit-based GitHub integration with a real repository.
 * Requires GITHUB_TOKEN in .env file or environment.
 */

// Load environment variables from .env
import { config } from 'dotenv';
config();

import {
  createUserProjectManager,
  GitHubProjectManager
} from '../dist/src/teammate-agents/github/project-manager.js';
import { OctokitClient, createOctokitClient } from '../dist/src/teammate-agents/github/octokit-client.js';

// Configuration
const OWNER = 'fall-development-rob';
const REPO = 'Test-repo';

async function testOctokitClient() {
  console.log('\n=== Testing OctokitClient ===\n');

  try {
    const client = createOctokitClient({ owner: OWNER, repo: REPO });
    console.log('✓ OctokitClient created successfully');

    // Test listing issues
    console.log('\nListing open issues...');
    const issues = await client.listIssues({ state: 'open', per_page: 5 });
    console.log(`✓ Found ${issues.length} open issues`);
    issues.forEach(i => console.log(`  - #${i.number}: ${i.title}`));

    // Test creating an issue
    console.log('\nCreating test issue...');
    const testIssue = await client.createIssue(
      '[Test] Octokit Integration Test',
      'This is a test issue created by the claude-flow GitHub integration test.\n\n**Created at**: ' + new Date().toISOString(),
      ['test', 'automated']
    );
    console.log(`✓ Created issue #${testIssue.number}: ${testIssue.url}`);

    // Test getting the issue
    console.log('\nFetching created issue...');
    const fetchedIssue = await client.getIssue(testIssue.number);
    if (fetchedIssue) {
      console.log(`✓ Fetched issue #${fetchedIssue.number}`);
      console.log(`  Title: ${fetchedIssue.title}`);
      console.log(`  State: ${fetchedIssue.state}`);
      console.log(`  Labels: ${fetchedIssue.labels.join(', ') || 'none'}`);
    }

    // Test adding a comment
    console.log('\nAdding comment...');
    await client.createComment(testIssue.number, 'Test comment from Octokit integration test.');
    console.log('✓ Comment added');

    // Test closing the issue
    console.log('\nClosing issue...');
    await client.closeIssue(testIssue.number);
    console.log('✓ Issue closed');

    return testIssue.number;
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    throw error;
  }
}

async function testProjectManager() {
  console.log('\n=== Testing GitHubProjectManager ===\n');

  try {
    const manager = createUserProjectManager(OWNER, REPO);
    console.log('✓ GitHubProjectManager created');

    // Test listing projects
    console.log('\nListing existing projects...');
    const projects = await manager.listProjects(5);
    console.log(`✓ Found ${projects.length} projects`);
    projects.forEach(p => console.log(`  - #${p.number}: ${p.title}`));

    // Test creating a project
    console.log('\nCreating test project...');
    const project = await manager.createProject({
      title: '[Test] Octokit Integration Test Project',
      description: 'Test project created by claude-flow integration test',
      epicId: 'test-epic-' + Date.now(),
      createStatusField: true
    });
    console.log(`✓ Created project #${project.number}: ${project.url}`);
    console.log(`  ID: ${project.id}`);
    console.log(`  Fields: ${project.fields.length}`);

    // List fields
    project.fields.forEach(f => {
      console.log(`    - ${f.name} (${f.dataType})`);
      if (f.options) {
        f.options.forEach(o => console.log(`      - ${o.name}`));
      }
    });

    return project;
  } catch (error: any) {
    console.error('✗ Error:', error.message);
    throw error;
  }
}

async function main() {
  console.log('GitHub Integration Test');
  console.log('=======================');
  console.log(`Owner: ${OWNER}`);
  console.log(`Repo: ${REPO}`);

  // Check for token
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    console.error('\n✗ Error: GITHUB_TOKEN or GH_TOKEN environment variable required');
    console.log('\nSet your token: export GITHUB_TOKEN=<your-token>');
    console.log('The token needs repo and project scopes.');
    process.exit(1);
  }

  try {
    // Test OctokitClient
    await testOctokitClient();

    // Test GitHubProjectManager
    await testProjectManager();

    console.log('\n=== All Tests Passed! ===\n');
  } catch (error: any) {
    console.error('\n=== Test Failed ===');
    console.error(error.message);
    process.exit(1);
  }
}

main();
