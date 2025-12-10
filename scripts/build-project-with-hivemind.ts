/**
 * Build a Complete Project with Hive-Mind Teammate Orchestration
 *
 * This script demonstrates the full SPARC workflow:
 * 1. Creates a new repository
 * 2. Defines an epic with SPARC-phased tasks
 * 3. Assigns agents intelligently based on skills
 * 4. Executes each task to build a complete project
 *
 * Project: micro-semantic-cache
 * A lightweight semantic caching library for AI applications
 */

import { config } from 'dotenv';
config();

import {
  createHiveMindOrchestrator,
  type EpicPlan,
} from '../dist/src/teammate-agents/integration/hive-mind-github.js';

// Configuration
const OWNER = 'fall-development-rob';
const PROJECT_NAME = 'micro-semantic-cache';

// Project specification
const PROJECT_SPEC = {
  name: PROJECT_NAME,
  description: 'Lightweight semantic caching for AI applications - reduce API costs by 40-60% with vector similarity matching',
  features: [
    'Vector-based similarity caching',
    'Configurable similarity threshold',
    'TTL-based cache expiration',
    'In-memory and Redis backends',
    'TypeScript-first with full type safety',
  ],
};

async function buildProjectWithHiveMind() {
  const timestamp = Date.now();
  const repoName = `${PROJECT_NAME}-${timestamp}`;

  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║       HIVE-MIND TEAMMATE PROJECT BUILDER                           ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\nProject: ${PROJECT_SPEC.name}`);
  console.log(`Description: ${PROJECT_SPEC.description}\n`);

  // Check for token
  if (!process.env.GITHUB_TOKEN && !process.env.GH_TOKEN) {
    console.error('Error: GITHUB_TOKEN required in .env');
    process.exit(1);
  }

  // ========================================================================
  // STEP 1: Initialize Orchestrator
  // ========================================================================
  console.log('┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 1: Initialize Hive-Mind Orchestrator                         │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  const orchestrator = createHiveMindOrchestrator({
    owner: OWNER,
    enableVectorSearch: true,
    enableLearning: true,
    autoCreateLabels: true,
  });

  await orchestrator.initialize();
  console.log('✓ Orchestrator initialized with default agents');

  // ========================================================================
  // STEP 2: Create Repository
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 2: Create Repository                                         │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  const repo = await orchestrator.createRepository({
    name: repoName,
    description: PROJECT_SPEC.description,
    private: false,
  });

  console.log(`✓ Repository created: ${repo.fullName}`);
  console.log(`  URL: ${repo.url}`);

  // Wait for GitHub to initialize
  await new Promise(resolve => setTimeout(resolve, 2000));

  // ========================================================================
  // STEP 3: Define SPARC Epic
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 3: Define SPARC Epic with Tasks                              │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  const epicPlan: EpicPlan = {
    title: `Build ${PROJECT_SPEC.name}`,
    description: `
## Project Overview
${PROJECT_SPEC.description}

## Key Features
${PROJECT_SPEC.features.map(f => `- ${f}`).join('\n')}

## Success Criteria
- [ ] Core caching functionality working
- [ ] Vector similarity matching implemented
- [ ] Full test coverage (>80%)
- [ ] TypeScript types exported
- [ ] README with usage examples
    `.trim(),
    objectives: [
      'Create a production-ready semantic caching library',
      'Implement efficient vector similarity matching',
      'Support multiple storage backends',
      'Provide excellent developer experience with TypeScript',
    ],
    constraints: [
      'Must be lightweight (<50KB bundle)',
      'Zero runtime dependencies for core',
      'Must work in Node.js and browsers',
      'MIT license',
    ],
    tasks: [
      // SPECIFICATION PHASE
      {
        title: 'Define API specification and interfaces',
        description: `Research and document the API design for the semantic cache library.

**Deliverables:**
- TypeScript interfaces for CacheConfig, CacheEntry, SimilarityResult
- API method signatures: get, set, getSimilar, clear, stats
- Configuration options documentation
- Error handling strategy`,
        phase: 'Specification',
        skills: ['research', 'api-design', 'typescript', 'documentation'],
        priority: 'critical',
      },
      // ARCHITECTURE PHASE
      {
        title: 'Design system architecture',
        description: `Create the architectural design for the semantic cache.

**Deliverables:**
- Component diagram showing Cache, VectorStore, StorageBackend
- Data flow for cache hit/miss scenarios
- Pluggable backend architecture
- Memory management strategy`,
        phase: 'Architecture',
        skills: ['architecture', 'design', 'system-design'],
        priority: 'critical',
      },
      // REFINEMENT PHASE - Core Implementation
      {
        title: 'Implement vector similarity engine',
        description: `Build the core vector similarity matching engine.

**Deliverables:**
- Simple embedding generator (hash-based for demo)
- Cosine similarity calculation
- K-nearest neighbors search
- Similarity threshold filtering`,
        phase: 'Refinement',
        skills: ['typescript', 'algorithms', 'math', 'optimization'],
        priority: 'critical',
      },
      {
        title: 'Implement semantic cache core',
        description: `Build the main SemanticCache class.

**Deliverables:**
- SemanticCache class with constructor
- get(key) - exact + similarity lookup
- set(key, value, embedding?)
- getSimilar(query, k, threshold)
- clear() and stats() methods`,
        phase: 'Refinement',
        skills: ['typescript', 'nodejs', 'caching', 'data-structures'],
        priority: 'critical',
      },
      {
        title: 'Implement storage backends',
        description: `Create pluggable storage backend system.

**Deliverables:**
- StorageBackend interface
- InMemoryBackend implementation
- TTL expiration support
- Backend factory function`,
        phase: 'Refinement',
        skills: ['typescript', 'nodejs', 'design-patterns'],
        priority: 'high',
      },
      // COMPLETION PHASE
      {
        title: 'Write comprehensive tests',
        description: `Create test suite for all functionality.

**Deliverables:**
- Unit tests for vector similarity
- Unit tests for SemanticCache
- Integration tests for backends
- Edge case coverage`,
        phase: 'Completion',
        skills: ['testing', 'jest', 'typescript', 'tdd'],
        priority: 'high',
      },
      {
        title: 'Create documentation and examples',
        description: `Write README and usage documentation.

**Deliverables:**
- README.md with installation, usage, API reference
- Code examples for common use cases
- Performance benchmarks
- Contributing guidelines`,
        phase: 'Completion',
        skills: ['documentation', 'technical-writing', 'examples'],
        priority: 'high',
      },
      {
        title: 'Setup project configuration',
        description: `Configure TypeScript, build tools, and package.json.

**Deliverables:**
- package.json with scripts
- tsconfig.json
- Build configuration (esbuild/swc)
- NPM publish preparation`,
        phase: 'Completion',
        skills: ['nodejs', 'typescript', 'tooling', 'devops'],
        priority: 'medium',
      },
    ],
    metadata: {
      methodology: 'SPARC',
      team: 'Hive-Mind',
    },
  };

  console.log(`Creating epic: "${epicPlan.title}"`);
  console.log(`Tasks: ${epicPlan.tasks.length}`);

  // Listen for task creation events
  orchestrator.on('task:created', (data) => {
    const title = data.title || 'Task';
    const displayTitle = title.length > 40 ? title.substring(0, 40) + '...' : title;
    console.log(`  ✓ #${data.issueNumber}: ${displayTitle} → ${data.agent || 'unassigned'}`);
  });

  const epic = await orchestrator.createEpic(epicPlan);

  console.log(`\n✓ Epic created!`);
  console.log(`  Epic ID: ${epic.epicId}`);
  console.log(`  Project: ${epic.projectUrl}`);
  console.log(`  Issues: #${epic.epicIssueNumber} (epic) + ${epic.tasks.length} tasks`);

  // ========================================================================
  // STEP 4: Display Task Assignments
  // ========================================================================
  console.log('\n┌──────────────────────────────────────────────────────────────────┐');
  console.log('│ STEP 4: Task Assignments (Vector-Based Matching)                  │');
  console.log('└──────────────────────────────────────────────────────────────────┘');

  console.log('\n┌───────┬─────────────────┬────────────────────────────┬──────────┐');
  console.log('│ Issue │ SPARC Phase     │ Assigned Agent             │ Score    │');
  console.log('├───────┼─────────────────┼────────────────────────────┼──────────┤');

  for (const task of epic.tasks) {
    const issue = `#${task.issueNumber}`.padEnd(5);
    const phase = task.phase.padEnd(15);
    const agent = (task.assignedAgent?.name || 'Unassigned').padEnd(26);
    const score = task.assignmentScore ? `${task.assignmentScore.toFixed(1)}%` : 'N/A';
    console.log(`│ ${issue} │ ${phase} │ ${agent} │ ${score.padStart(6)}  │`);
  }
  console.log('└───────┴─────────────────┴────────────────────────────┴──────────┘');

  // ========================================================================
  // STEP 5: Return project info for agent execution
  // ========================================================================
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    PROJECT SETUP COMPLETE                           ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  console.log(`
┌─────────────────────────────────────────────────────────────────────┐
│ Repository Ready for Development                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Repo:    ${repo.url.padEnd(55)} │
│ Project: ${epic.projectUrl.padEnd(55)} │
│ Clone:   git clone ${repo.cloneUrl.padEnd(43)} │
└─────────────────────────────────────────────────────────────────────┘

Next Steps:
  1. Clone the repository
  2. Agents will implement each task following SPARC phases
  3. Code will be committed as each task completes
  4. Final review and merge

Tasks by Phase:
  - Specification: ${epic.tasks.filter(t => t.phase === 'Specification').length} tasks
  - Architecture:  ${epic.tasks.filter(t => t.phase === 'Architecture').length} tasks
  - Refinement:    ${epic.tasks.filter(t => t.phase === 'Refinement').length} tasks
  - Completion:    ${epic.tasks.filter(t => t.phase === 'Completion').length} tasks
`);

  await orchestrator.shutdown();

  return {
    repo,
    epic,
    repoName,
    cloneUrl: repo.cloneUrl,
  };
}

// Run
buildProjectWithHiveMind()
  .then((result) => {
    console.log('✓ Project setup completed successfully!\n');
    console.log(`Repository: ${result.repo.url}`);
    console.log(`Clone command: git clone ${result.cloneUrl}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
