/**
 * Cleanup Test Data Script
 *
 * Closes all test issues and deletes test projects from the repository.
 *
 * Usage: node --experimental-strip-types scripts/cleanup-test-data.ts
 */

import { config } from 'dotenv';
config();

import { createOctokitClient } from '../dist/src/teammate-agents/github/octokit-client.js';
import { graphql } from '@octokit/graphql';

const OWNER = 'fall-development-rob';
const REPO = 'Test-repo';

async function cleanup() {
  console.log('='.repeat(60));
  console.log('Cleanup Test Data');
  console.log('='.repeat(60));
  console.log(`\nRepository: ${OWNER}/${REPO}\n`);

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN required in .env');
    process.exit(1);
  }

  const client = createOctokitClient({ owner: OWNER, repo: REPO });
  const graphqlWithAuth = graphql.defaults({
    headers: { authorization: `token ${token}` }
  });

  // Step 1: Close all open issues
  console.log('Step 1: Closing all open issues...');
  try {
    const issues = await client.listIssues({ state: 'open', per_page: 100 });
    console.log(`Found ${issues.length} open issues`);

    for (const issue of issues) {
      await client.closeIssue(issue.number);
      console.log(`  ✓ Closed issue #${issue.number}: ${issue.title.substring(0, 50)}...`);
    }

    if (issues.length === 0) {
      console.log('  No open issues to close');
    }
  } catch (error: any) {
    console.error('  Error closing issues:', error.message);
  }

  // Step 2: Delete all user projects
  console.log('\nStep 2: Deleting user projects...');
  try {
    // List user projects
    const listQuery = `
      query($login: String!) {
        user(login: $login) {
          projectsV2(first: 50) {
            nodes {
              id
              number
              title
              closed
            }
          }
        }
      }
    `;

    const result: any = await graphqlWithAuth(listQuery, { login: OWNER });
    const projects = result.user?.projectsV2?.nodes || [];
    console.log(`Found ${projects.length} projects`);

    // Delete each project
    const deleteMutation = `
      mutation($projectId: ID!) {
        deleteProjectV2(input: { projectId: $projectId }) {
          projectV2 {
            id
          }
        }
      }
    `;

    for (const project of projects) {
      try {
        await graphqlWithAuth(deleteMutation, { projectId: project.id });
        console.log(`  ✓ Deleted project #${project.number}: ${project.title}`);
      } catch (err: any) {
        console.log(`  ✗ Could not delete project #${project.number}: ${err.message}`);
      }
    }

    if (projects.length === 0) {
      console.log('  No projects to delete');
    }
  } catch (error: any) {
    console.error('  Error listing/deleting projects:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Cleanup Complete!');
  console.log('='.repeat(60));
}

cleanup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n✗ Cleanup failed:', error.message);
    process.exit(1);
  });
