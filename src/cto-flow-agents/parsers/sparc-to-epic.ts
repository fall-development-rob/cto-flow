/**
 * SPARC Output Parser for Epic Generation
 *
 * Parses SPARC planning output (specification, pseudocode, architecture phases)
 * and extracts structured data for GitHub Epic creation.
 *
 * Part of the CTO-Flow Agent Management system
 */

/**
 * Parsed Epic structure from SPARC output
 */
export interface ParsedEpic {
  title: string;
  description: string;
  tasks: ParsedTask[];
  metadata: {
    sparcPhase: string;
    timestamp: string;
    source: string;
  };
}

/**
 * Parsed Task structure with dependencies and metadata
 */
export interface ParsedTask {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  dependencies: string[]; // task titles this depends on
  estimatedComplexity: 'low' | 'medium' | 'high';
  labels: string[];
}

/**
 * Internal representation of raw task data before dependency resolution
 */
interface RawTask {
  title: string;
  description: string;
  acceptanceCriteria: string[];
  estimatedComplexity?: 'low' | 'medium' | 'high';
  labels: string[];
  phase?: string;
  order?: number;
}

/**
 * SPARC phase patterns for detecting output structure
 */
const SPARC_PHASE_PATTERNS = {
  specification: /(?:requirements|specifications?|user stories)/i,
  pseudocode: /(?:pseudocode|algorithm|process flow)/i,
  architecture: /(?:architecture|design|modules?|components?)/i,
  refinement: /(?:refinement|implementation|development)/i,
  completion: /(?:completion|integration|deployment)/i,
};

/**
 * Pattern for extracting markdown sections
 */
const MARKDOWN_SECTION_PATTERN = /^#+\s+(.+)$/gm;

/**
 * Pattern for extracting checklist items
 */
const CHECKLIST_PATTERN = /^[-*]\s+\[[ x]\]\s+(.+)$/gm;

/**
 * Pattern for extracting numbered lists
 */
const NUMBERED_LIST_PATTERN = /^\d+\.\s+(.+)$/gm;

/**
 * Pattern for extracting task details from markdown
 */
const TASK_DETAIL_PATTERN = /^[-*]\s+(.+?)\s*(?:\((.+?)\))?$/;

/**
 * Pattern for extracting code blocks
 */
const CODE_BLOCK_PATTERN = /```(?:\w+)?\n([\s\S]*?)```/g;

/**
 * Parse SPARC output into structured epic data
 *
 * Handles various SPARC output formats:
 * - Markdown with headers and sections
 * - Checklists and bullet points
 * - Numbered task lists
 * - Code blocks with pseudocode
 *
 * @param output - Raw SPARC output text
 * @returns Parsed epic structure
 */
export function parseSparcOutput(output: string): ParsedEpic {
  // Detect SPARC phase from content
  const phase = detectSparcPhase(output);

  // Extract title from first header or generate from content
  const title = extractTitle(output) || 'SPARC Epic';

  // Extract description (content before first major section)
  const description = extractDescription(output);

  // Extract tasks from architecture/specification output
  const tasks = extractTasks(output);

  // Detect and resolve task dependencies
  const tasksWithDependencies = detectDependencies(tasks);

  return {
    title,
    description,
    tasks: tasksWithDependencies,
    metadata: {
      sparcPhase: phase,
      timestamp: new Date().toISOString(),
      source: 'sparc-parser',
    },
  };
}

/**
 * Extract tasks from SPARC architecture or specification output
 *
 * Parses various task formats:
 * - User stories (As a... I want... So that...)
 * - Requirements lists
 * - Module specifications
 * - Implementation steps
 *
 * @param architectureOutput - SPARC output containing task information
 * @returns Array of parsed tasks
 */
export function extractTasks(architectureOutput: string): ParsedTask[] {
  const rawTasks: RawTask[] = [];

  // Extract tasks from different sections
  rawTasks.push(...extractUserStories(architectureOutput));
  rawTasks.push(...extractRequirements(architectureOutput));
  rawTasks.push(...extractModules(architectureOutput));
  rawTasks.push(...extractImplementationSteps(architectureOutput));

  // Convert raw tasks to parsed tasks with defaults
  return rawTasks.map((rawTask, index) => ({
    title: rawTask.title,
    description: rawTask.description,
    acceptanceCriteria: rawTask.acceptanceCriteria,
    dependencies: [], // Will be filled by detectDependencies
    estimatedComplexity: rawTask.estimatedComplexity || estimateComplexity(rawTask),
    labels: [...rawTask.labels, rawTask.phase || 'refinement'],
  }));
}

/**
 * Detect task dependencies from architecture output
 *
 * Analyzes tasks for:
 * - Explicit dependency mentions (e.g., "depends on X", "requires Y")
 * - Sequential ordering (task N depends on task N-1)
 * - Component relationships (UI depends on API)
 * - Common dependency keywords
 *
 * @param tasks - Array of parsed tasks
 * @returns Tasks with detected dependencies
 */
export function detectDependencies(tasks: ParsedTask[]): ParsedTask[] {
  const tasksWithDeps = [...tasks];

  // Dependency keywords to look for
  const dependencyKeywords = [
    /depends?\s+on\s+(.+)/i,
    /requires?\s+(.+)/i,
    /needs?\s+(.+)/i,
    /after\s+(.+)/i,
    /once\s+(.+)\s+is\s+complete/i,
  ];

  // Build a map of task titles for quick lookup
  const taskTitleMap = new Map<string, number>();
  tasks.forEach((task, index) => {
    taskTitleMap.set(task.title.toLowerCase(), index);
    // Also store simplified version (remove special chars)
    const simplified = task.title.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    taskTitleMap.set(simplified, index);
  });

  // Analyze each task for dependencies
  tasksWithDeps.forEach((task, currentIndex) => {
    const dependencies: string[] = [];

    // Check description and acceptance criteria for dependency mentions
    const textToAnalyze = [
      task.description,
      ...task.acceptanceCriteria,
    ].join(' ');

    // Look for explicit dependency mentions
    dependencyKeywords.forEach((pattern) => {
      const matches = textToAnalyze.matchAll(new RegExp(pattern.source, 'gi'));
      for (const match of matches) {
        const dependencyText = match[1];
        // Try to find matching task
        const matchingTaskIndex = findMatchingTask(dependencyText, taskTitleMap);
        if (matchingTaskIndex !== -1 && matchingTaskIndex !== currentIndex) {
          dependencies.push(tasks[matchingTaskIndex].title);
        }
      }
    });

    // Detect implicit sequential dependencies
    if (currentIndex > 0 && dependencies.length === 0) {
      // Check if this task logically follows the previous one
      const prevTask = tasks[currentIndex - 1];
      if (isSequentialDependency(task, prevTask)) {
        dependencies.push(prevTask.title);
      }
    }

    // Detect component-level dependencies
    const componentDeps = detectComponentDependencies(task, tasks);
    dependencies.push(...componentDeps);

    // Remove duplicates and assign
    task.dependencies = [...new Set(dependencies)];
  });

  return tasksWithDeps;
}

/**
 * Detect SPARC phase from output content
 */
function detectSparcPhase(output: string): string {
  for (const [phase, pattern] of Object.entries(SPARC_PHASE_PATTERNS)) {
    if (pattern.test(output)) {
      return phase;
    }
  }
  return 'specification'; // Default phase
}

/**
 * Extract title from first header or content
 */
function extractTitle(output: string): string | null {
  // Try to find first H1 or H2 header
  const headerMatch = output.match(/^#\s+(.+)$/m);
  if (headerMatch) {
    return headerMatch[1].trim();
  }

  // Try H2
  const h2Match = output.match(/^##\s+(.+)$/m);
  if (h2Match) {
    return h2Match[1].trim();
  }

  // Try to extract from task description pattern
  const taskMatch = output.match(/Task:\s*"?(.+?)"?[\n\r]/);
  if (taskMatch) {
    return taskMatch[1].trim();
  }

  return null;
}

/**
 * Extract description from content before first major section
 */
function extractDescription(output: string): string {
  // Get content before first H2 header
  const firstH2 = output.search(/^##\s+/m);
  if (firstH2 === -1) {
    // No sections found, use first paragraph
    const firstParagraph = output.match(/^(.+?)(?:\n\n|\n#)/s);
    return firstParagraph ? firstParagraph[1].trim() : output.slice(0, 300);
  }

  const description = output.slice(0, firstH2).trim();
  // Remove title if present
  return description.replace(/^#\s+.+$/m, '').trim();
}

/**
 * Extract user stories from output
 */
function extractUserStories(output: string): RawTask[] {
  const stories: RawTask[] = [];
  const userStoryPattern = /As\s+a\s+(.+?),?\s*I\s+want\s+(.+?),?\s*(?:so\s+that|to)\s+(.+?)(?:\n|$)/gi;

  let match;
  while ((match = userStoryPattern.exec(output)) !== null) {
    const [fullMatch, role, want, benefit] = match;

    stories.push({
      title: `${want.trim()}`,
      description: `As a ${role.trim()}, I want ${want.trim()}, so that ${benefit.trim()}.`,
      acceptanceCriteria: extractNearbyAcceptanceCriteria(output, match.index),
      labels: ['user-story', 'specification'],
      phase: 'specification',
    });
  }

  return stories;
}

/**
 * Extract requirements from output
 */
function extractRequirements(output: string): RawTask[] {
  const requirements: RawTask[] = [];

  // Look for requirements sections
  const reqSectionMatch = output.match(/##\s+(?:Functional\s+)?Requirements([\s\S]*?)(?=\n##|\n#|$)/i);
  if (!reqSectionMatch) return requirements;

  const reqSection = reqSectionMatch[1];

  // Extract bullet points or numbered items
  const bulletPattern = /^[-*]\s+(.+?)(?:\n|$)/gm;
  let match;

  while ((match = bulletPattern.exec(reqSection)) !== null) {
    const reqText = match[1].trim();
    if (reqText.length < 10) continue; // Skip very short items

    requirements.push({
      title: truncateTitle(reqText),
      description: reqText,
      acceptanceCriteria: [],
      labels: ['requirement', 'specification'],
      phase: 'specification',
    });
  }

  return requirements;
}

/**
 * Extract modules/components from architecture output
 */
function extractModules(output: string): RawTask[] {
  const modules: RawTask[] = [];

  // Look for module/component sections
  const moduleSectionMatch = output.match(/##\s+(?:Modules?|Components?|Architecture)([\s\S]*?)(?=\n##|\n#|$)/i);
  if (!moduleSectionMatch) return modules;

  const moduleSection = moduleSectionMatch[1];

  // Extract subsections (H3) as modules
  const modulePattern = /###\s+(.+?)\n([\s\S]*?)(?=\n###|\n##|$)/g;
  let match;

  while ((match = modulePattern.exec(moduleSection)) !== null) {
    const [, moduleName, moduleContent] = match;

    modules.push({
      title: `Implement ${moduleName.trim()}`,
      description: moduleContent.trim(),
      acceptanceCriteria: extractBulletPoints(moduleContent),
      labels: ['module', 'architecture'],
      phase: 'architecture',
      estimatedComplexity: estimateComplexityFromContent(moduleContent),
    });
  }

  return modules;
}

/**
 * Extract implementation steps from output
 */
function extractImplementationSteps(output: string): RawTask[] {
  const steps: RawTask[] = [];

  // Look for implementation/development sections
  const implSectionMatch = output.match(/##\s+(?:Implementation|Development|Steps?|Tasks?)([\s\S]*?)(?=\n##|\n#|$)/i);
  if (!implSectionMatch) return steps;

  const implSection = implSectionMatch[1];

  // Extract numbered steps
  const stepPattern = /^(\d+)\.\s+(.+?)(?:\n|$)/gm;
  let match;

  while ((match = stepPattern.exec(implSection)) !== null) {
    const [, stepNum, stepText] = match;

    steps.push({
      title: stepText.trim(),
      description: stepText.trim(),
      acceptanceCriteria: [],
      labels: ['implementation', 'refinement'],
      phase: 'refinement',
      order: parseInt(stepNum, 10),
    });
  }

  return steps;
}

/**
 * Extract acceptance criteria near a specific position
 */
function extractNearbyAcceptanceCriteria(text: string, position: number): string[] {
  // Look for acceptance criteria in next 500 characters
  const nearby = text.slice(position, position + 500);

  const criteria: string[] = [];
  const criteriaPattern = /^[-*]\s+\[[ x]\]\s+(.+?)(?:\n|$)/gm;
  let match;

  while ((match = criteriaPattern.exec(nearby)) !== null) {
    criteria.push(match[1].trim());
  }

  return criteria;
}

/**
 * Extract bullet points from text
 */
function extractBulletPoints(text: string): string[] {
  const points: string[] = [];
  const bulletPattern = /^[-*]\s+(.+?)(?:\n|$)/gm;
  let match;

  while ((match = bulletPattern.exec(text)) !== null) {
    const point = match[1].trim();
    if (point.length > 5) {
      points.push(point);
    }
  }

  return points;
}

/**
 * Estimate complexity from task structure
 */
function estimateComplexity(task: RawTask): 'low' | 'medium' | 'high' {
  const descLength = task.description.length;
  const criteriaCount = task.acceptanceCriteria.length;

  // High complexity indicators
  if (descLength > 500 || criteriaCount > 5) {
    return 'high';
  }

  // Low complexity indicators
  if (descLength < 100 && criteriaCount < 2) {
    return 'low';
  }

  return 'medium';
}

/**
 * Estimate complexity from content analysis
 */
function estimateComplexityFromContent(content: string): 'low' | 'medium' | 'high' {
  const complexityIndicators = {
    high: ['integration', 'distributed', 'scalable', 'complex', 'advanced'],
    medium: ['implement', 'create', 'build', 'develop'],
    low: ['simple', 'basic', 'straightforward', 'minimal'],
  };

  const lowerContent = content.toLowerCase();

  // Check for high complexity indicators
  if (complexityIndicators.high.some(word => lowerContent.includes(word))) {
    return 'high';
  }

  // Check for low complexity indicators
  if (complexityIndicators.low.some(word => lowerContent.includes(word))) {
    return 'low';
  }

  return 'medium';
}

/**
 * Truncate title to reasonable length
 */
function truncateTitle(text: string, maxLength: number = 80): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to break at word boundary
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Find matching task from dependency text
 */
function findMatchingTask(dependencyText: string, taskTitleMap: Map<string, number>): number {
  const lowerText = dependencyText.toLowerCase().trim();

  // Try exact match first
  if (taskTitleMap.has(lowerText)) {
    return taskTitleMap.get(lowerText)!;
  }

  // Try simplified match
  const simplified = lowerText.replace(/[^a-z0-9\s]/g, '');
  if (taskTitleMap.has(simplified)) {
    return taskTitleMap.get(simplified)!;
  }

  // Try partial match (dependency text contains task title)
  for (const [title, index] of taskTitleMap.entries()) {
    if (lowerText.includes(title) || title.includes(lowerText)) {
      return index;
    }
  }

  return -1;
}

/**
 * Check if two tasks have sequential dependency
 */
function isSequentialDependency(currentTask: ParsedTask, previousTask: ParsedTask): boolean {
  // Tasks in the same phase with consecutive order
  const currentPhase = currentTask.labels.find(l => l.match(/specification|architecture|refinement/));
  const prevPhase = previousTask.labels.find(l => l.match(/specification|architecture|refinement/));

  if (currentPhase !== prevPhase) {
    return false;
  }

  // Check for sequential keywords
  const sequentialKeywords = [
    'then', 'next', 'after', 'following', 'subsequently',
  ];

  const description = currentTask.description.toLowerCase();
  return sequentialKeywords.some(keyword => description.includes(keyword));
}

/**
 * Detect component-level dependencies (e.g., UI depends on API)
 */
function detectComponentDependencies(task: ParsedTask, allTasks: ParsedTask[]): string[] {
  const dependencies: string[] = [];

  const componentPatterns = {
    ui: ['frontend', 'ui', 'interface', 'component', 'view'],
    api: ['api', 'endpoint', 'service', 'backend', 'server'],
    database: ['database', 'schema', 'model', 'migration'],
    auth: ['authentication', 'authorization', 'auth', 'login'],
  };

  // Determine current task's component type
  const taskTitle = task.title.toLowerCase();
  const taskDesc = task.description.toLowerCase();
  const taskText = taskTitle + ' ' + taskDesc;

  let taskComponent: string | null = null;
  for (const [component, keywords] of Object.entries(componentPatterns)) {
    if (keywords.some(keyword => taskText.includes(keyword))) {
      taskComponent = component;
      break;
    }
  }

  if (!taskComponent) return dependencies;

  // UI depends on API
  if (taskComponent === 'ui') {
    const apiTask = allTasks.find(t => {
      const tText = (t.title + ' ' + t.description).toLowerCase();
      return componentPatterns.api.some(keyword => tText.includes(keyword));
    });
    if (apiTask) {
      dependencies.push(apiTask.title);
    }
  }

  // API depends on database
  if (taskComponent === 'api') {
    const dbTask = allTasks.find(t => {
      const tText = (t.title + ' ' + t.description).toLowerCase();
      return componentPatterns.database.some(keyword => tText.includes(keyword));
    });
    if (dbTask) {
      dependencies.push(dbTask.title);
    }
  }

  // Everything might depend on auth
  const authTask = allTasks.find(t => {
    const tText = (t.title + ' ' + t.description).toLowerCase();
    return componentPatterns.auth.some(keyword => tText.includes(keyword));
  });
  if (authTask && taskText.includes('secure') || taskText.includes('protected')) {
    dependencies.push(authTask.title);
  }

  return dependencies;
}

/**
 * Utility: Parse SPARC specification into SparcSpecification format
 *
 * Converts parsed epic into the format expected by SparcEpicExporter
 */
export function convertToSparcSpecification(
  parsedEpic: ParsedEpic,
  taskId: string
): import('../github/sparc-epic-exporter').SparcSpecification {
  return {
    taskId,
    taskDescription: parsedEpic.title,
    requirements: [],
    userStories: parsedEpic.tasks.map((task, index) => ({
      id: `story-${index + 1}`,
      title: task.title,
      description: task.description,
      asA: 'user', // Default, should be extracted from user stories
      iWant: task.title,
      soThat: 'complete the epic',
      acceptanceCriteria: task.acceptanceCriteria,
      priority: task.estimatedComplexity === 'high' ? 'high' :
                task.estimatedComplexity === 'low' ? 'low' : 'medium',
      estimatedEffort: task.estimatedComplexity === 'high' ? 8 :
                       task.estimatedComplexity === 'low' ? 2 : 5,
      requiredCapabilities: task.labels,
      technicalNotes: task.description,
      phase: parsedEpic.metadata.sparcPhase as any,
      labels: task.labels,
    })),
    acceptanceCriteria: [],
    metadata: {
      parsedFrom: parsedEpic.metadata.source,
      parsedAt: parsedEpic.metadata.timestamp,
    },
  };
}
