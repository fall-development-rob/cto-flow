# SPARC Pseudocode: Teammate-Driven Agent Management

**Project**: Claude-Flow Agent Orchestration Framework
**Feature**: Teammate-Driven Agent Management
**Phase**: Pseudocode
**Version**: 1.0.0
**Date**: 2025-12-09
**Status**: Complete

---

## Table of Contents

1. [Epic Context Container](#1-epic-context-container)
2. [Agent Self-Selection Algorithm](#2-agent-self-selection-algorithm)
3. [Peer Review Workflow](#3-peer-review-workflow)
4. [Context Persistence & Restoration](#4-context-persistence--restoration)
5. [Progress Tracking Engine](#5-progress-tracking-engine)
6. [GitHub Synchronization](#6-github-synchronization)

---

## 1. Epic Context Container

### 1.1 Epic Initialization

```pseudocode
FUNCTION initializeEpic(epicRequest):
    INPUT:
        epicRequest = {
            title: STRING,
            description: STRING,
            repository: STRING (owner/repo),
            labels: ARRAY[STRING],
            estimatedDuration: INTEGER (days),
            complexity: ENUM[low, medium, high, critical]
        }

    OUTPUT:
        EpicContext object with initialized state

    BEGIN:
        // 1. Validate input
        IF NOT validateRepository(epicRequest.repository):
            THROW InvalidRepositoryError

        // 2. Generate unique epic ID
        epicId = "epic-" + formatISO8601(NOW())

        // 3. Create GitHub issue for epic
        githubIssue = githubAPI.createIssue({
            owner: parseOwner(epicRequest.repository),
            repo: parseRepo(epicRequest.repository),
            title: "[EPIC] " + epicRequest.title,
            body: generateEpicTemplate(epicRequest),
            labels: ["epic"] + epicRequest.labels
        })

        IF githubIssue.error:
            THROW GitHubAPIError(githubIssue.error)

        // 4. Initialize epic context
        epicContext = NEW EpicContext({
            id: epicId,
            githubIssueNumber: githubIssue.number,
            repository: epicRequest.repository,
            state: "active",

            metadata: {
                createdAt: NOW(),
                lastUpdated: NOW(),
                version: 1,
                complexity: epicRequest.complexity
            },

            objectives: extractObjectives(epicRequest.description),
            constraints: { technical: [], business: [] },
            decisions: [],
            activeAgents: [],
            timeline: [],

            memoryNamespace: "epic:" + epicId
        })

        // 5. Persist to memory
        AWAIT memoryManager.store(
            namespace: epicContext.memoryNamespace,
            key: "context",
            value: epicContext,
            ttl: INFINITY  // Epic context never expires
        )

        // 6. Assign coordinator agent
        coordinator = AWAIT agentRegistry.findBestAgent(
            taskType: "coordinator",
            requiredCapabilities: getRequiredCapabilities(epicRequest)
        )

        IF coordinator:
            epicContext.coordinatorAgent = coordinator.id
            epicContext.activeAgents.append({
                agentId: coordinator.id,
                role: "coordinator",
                assignedAt: NOW()
            })

        // 7. Emit event for hooks
        eventEmitter.emit("epic:created", {
            epicId: epicId,
            repository: epicRequest.repository,
            coordinator: coordinator?.id
        })

        RETURN epicContext
    END
```

### 1.2 Epic State Machine

```pseudocode
CLASS EpicStateMachine:
    STATES = {
        UNINITIALIZED: "uninitialized",
        ACTIVE: "active",
        PAUSED: "paused",
        BLOCKED: "blocked",
        REVIEW: "review",
        COMPLETED: "completed",
        ARCHIVED: "archived"
    }

    TRANSITIONS = {
        UNINITIALIZED: [ACTIVE],
        ACTIVE: [PAUSED, BLOCKED, REVIEW],
        PAUSED: [ACTIVE, ARCHIVED],
        BLOCKED: [ACTIVE, PAUSED],
        REVIEW: [ACTIVE, COMPLETED],
        COMPLETED: [ARCHIVED],
        ARCHIVED: []  // Terminal state
    }

    FUNCTION canTransition(currentState, targetState):
        RETURN targetState IN TRANSITIONS[currentState]

    FUNCTION transition(epicContext, targetState, reason):
        IF NOT canTransition(epicContext.state, targetState):
            THROW InvalidTransitionError(
                "Cannot transition from {currentState} to {targetState}"
            )

        // Record transition in timeline
        epicContext.timeline.append({
            timestamp: NOW(),
            event: "state_transition",
            from: epicContext.state,
            to: targetState,
            reason: reason
        })

        // Execute transition actions
        MATCH targetState:
            CASE PAUSED:
                pauseAllAgents(epicContext)
                notifyStakeholders("Epic paused: " + reason)

            CASE BLOCKED:
                escalateToCoordinator(epicContext, reason)
                addBlockerLabel(epicContext)

            CASE REVIEW:
                triggerFinalValidation(epicContext)
                requestHumanApproval(epicContext)

            CASE COMPLETED:
                generateCompletionReport(epicContext)
                archiveEpicContext(epicContext)

            CASE ARCHIVED:
                moveToLongTermStorage(epicContext)

        // Update state
        epicContext.state = targetState
        epicContext.metadata.lastUpdated = NOW()
        epicContext.metadata.version += 1

        // Persist changes
        AWAIT memoryManager.store(
            namespace: epicContext.memoryNamespace,
            key: "context",
            value: epicContext
        )

        // Emit event
        eventEmitter.emit("epic:stateChanged", {
            epicId: epicContext.id,
            from: previousState,
            to: targetState,
            reason: reason
        })

        RETURN epicContext
```

---

## 2. Agent Self-Selection Algorithm

### 2.1 Issue-to-Agent Matching

```pseudocode
CLASS AutonomousTaskSelector:
    SCORING_WEIGHTS = {
        capabilityMatch: 0.40,
        performance: 0.20,
        availability: 0.20,
        specialization: 0.10,
        experience: 0.10
    }

    MINIMUM_SCORE_THRESHOLD = 50  // Out of 100

    FUNCTION selectBestIssue(agent, epicId):
        INPUT:
            agent: AgentState object with capabilities, metrics, preferences
            epicId: STRING identifier of target epic

        OUTPUT:
            BestMatch = { issue: Issue, score: NUMBER, context: Object } OR NULL

        BEGIN:
            // 1. Get epic context
            epicContext = AWAIT loadEpicContext(epicId)

            // 2. Get available issues (not assigned, dependencies met)
            availableIssues = AWAIT getReadyIssues(epicContext)

            IF availableIssues.isEmpty():
                RETURN NULL

            // 3. Score each issue for this agent
            scoredIssues = []

            FOR EACH issue IN availableIssues:
                requirements = extractRequirements(issue)
                score = calculateMatchScore(agent, requirements)

                scoredIssues.append({
                    issue: issue,
                    score: score.overall,
                    breakdown: score.breakdown,
                    confidence: score.confidence
                })

            // 4. Sort by score (highest first)
            scoredIssues.sortDescending(BY: score)

            // 5. Return best match if above threshold
            bestMatch = scoredIssues.first()

            IF bestMatch.score >= MINIMUM_SCORE_THRESHOLD:
                RETURN {
                    issue: bestMatch.issue,
                    score: bestMatch.score,
                    context: getIssueContext(bestMatch.issue, epicContext)
                }
            ELSE:
                RETURN NULL
        END

    FUNCTION calculateMatchScore(agent, requirements):
        BEGIN:
            breakdown = {}

            // 1. Capability Match (0-40 points)
            capMatch = scoreCapabilities(
                agentCapabilities: agent.capabilities,
                requiredCapabilities: requirements.requiredCapabilities,
                languages: requirements.languages,
                frameworks: requirements.frameworks
            )
            breakdown.capabilityMatch = capMatch * 40

            // 2. Performance Score (0-20 points)
            performanceScore = agent.metrics.successRate * 100
            breakdown.performance = (performanceScore / 100) * 20

            // 3. Availability Score (0-20 points)
            workloadFactor = 1.0 - agent.workload
            healthFactor = agent.health
            breakdown.availability = ((workloadFactor + healthFactor) / 2) * 20

            // 4. Specialization Score (0-10 points)
            breakdown.specialization = scoreSpecialization(agent, requirements)

            // 5. Experience Score (0-10 points)
            breakdown.experience = scoreExperience(agent, requirements)

            // Calculate overall score
            overall = SUM(breakdown.values())

            // Calculate confidence
            confidence = calculateConfidence(agent, requirements, breakdown)

            RETURN {
                overall: MIN(100, overall),
                breakdown: breakdown,
                confidence: confidence
            }
        END

    FUNCTION scoreCapabilities(agentCaps, requiredCaps, languages, frameworks):
        matchedCount = 0
        totalRequired = LEN(requiredCaps)

        // Check required capabilities
        FOR EACH cap IN requiredCaps:
            IF agentHasCapability(agentCaps, cap):
                matchedCount += 1

        // Check languages (partial credit)
        IF NOT languages.isEmpty():
            totalRequired += 1
            langMatch = ANY(lang IN agentCaps.languages FOR lang IN languages)
            IF langMatch: matchedCount += 0.8

        // Check frameworks (partial credit)
        IF NOT frameworks.isEmpty():
            totalRequired += 1
            fwMatch = ANY(fw IN agentCaps.frameworks FOR fw IN frameworks)
            IF fwMatch: matchedCount += 0.8

        IF totalRequired == 0:
            RETURN 0.5  // No requirements, neutral score

        RETURN matchedCount / totalRequired
```

### 2.2 Autonomous Issue Claiming

```pseudocode
FUNCTION claimIssue(agent, issue, epicContext):
    INPUT:
        agent: AgentState
        issue: Issue to claim
        epicContext: EpicContext

    OUTPUT:
        ClaimResult = { success: BOOLEAN, workPlan: Object }

    BEGIN:
        // 1. Check if issue still available (prevent race conditions)
        currentIssue = AWAIT refreshIssueStatus(issue.id)

        IF currentIssue.assignee IS NOT NULL:
            RETURN { success: FALSE, reason: "Already claimed" }

        // 2. Acquire distributed lock
        lockKey = "issue-claim:" + issue.id
        lock = AWAIT acquireLock(lockKey, timeout: 10_SECONDS)

        IF NOT lock.acquired:
            RETURN { success: FALSE, reason: "Lock timeout" }

        TRY:
            // 3. Generate work plan
            workPlan = generateWorkPlan(agent, issue, epicContext)

            // 4. Update GitHub issue
            AWAIT githubAPI.updateIssue(
                owner: epicContext.owner,
                repo: epicContext.repo,
                issueNumber: issue.githubIssueNumber,
                updates: {
                    assignees: [agent.id],
                    labels: ADD ["claimed-by-agent", "in-progress"]
                }
            )

            // 5. Post work plan comment
            commentBody = formatWorkPlanComment(agent, workPlan)
            AWAIT githubAPI.createIssueComment(
                owner: epicContext.owner,
                repo: epicContext.repo,
                issueNumber: issue.githubIssueNumber,
                body: commentBody
            )

            // 6. Update epic context
            epicContext.activeAgents.updateOrAdd({
                agentId: agent.id,
                currentIssue: issue.id,
                claimedAt: NOW(),
                workPlan: workPlan
            })

            // 7. Update agent workload
            agent.workload += calculateWorkloadIncrease(issue)

            // 8. Persist changes
            AWAIT memoryManager.store(
                namespace: epicContext.memoryNamespace,
                key: "context",
                value: epicContext
            )

            // 9. Emit claim event
            eventEmitter.emit("issue:claimed", {
                epicId: epicContext.id,
                issueId: issue.id,
                agentId: agent.id,
                workPlan: workPlan
            })

            RETURN {
                success: TRUE,
                workPlan: workPlan,
                context: getIssueContext(issue, epicContext)
            }

        FINALLY:
            releaseLock(lock)
        END TRY
    END
```

---

## 3. Peer Review Workflow

### 3.1 Review Assignment

```pseudocode
CLASS PeerReviewAssigner:
    FUNCTION selectReviewer(pr, epicContext):
        INPUT:
            pr: PullRequest with author, changedFiles, requirements
            epicContext: EpicContext with active agents

        OUTPUT:
            SelectedReviewer = { agent: Agent, score: NUMBER, reason: STRING }

        BEGIN:
            authorId = pr.author.id
            requiredCapabilities = extractReviewCapabilities(pr)

            // 1. Get candidate reviewers
            candidates = epicContext.activeAgents
                .filter(a => a.agentId != authorId)
                .filter(a => a.status == "active")

            IF candidates.isEmpty():
                // Fallback: get from global agent pool
                candidates = AWAIT agentRegistry.queryAgents({
                    status: "idle",
                    healthThreshold: 0.6,
                    excludeIds: [authorId]
                })

            // 2. Score candidates
            scoredCandidates = []

            FOR EACH candidate IN candidates:
                agent = AWAIT agentRegistry.getAgent(candidate.agentId)
                score = scoreReviewerFit(agent, pr, requiredCapabilities)

                scoredCandidates.append({
                    agent: agent,
                    score: score.overall,
                    factors: score.factors
                })

            // 3. Apply diversity factor (prefer different perspectives)
            FOR EACH scored IN scoredCandidates:
                IF hasReviewedAuthorBefore(scored.agent, authorId):
                    scored.score *= 0.9  // Slight penalty for repeat pairs

            // 4. Select best reviewer
            scoredCandidates.sortDescending(BY: score)
            selected = scoredCandidates.first()

            IF selected IS NULL OR selected.score < 40:
                // Escalate to human if no suitable agent
                RETURN {
                    escalateToHuman: TRUE,
                    reason: "No qualified agent reviewers available"
                }

            RETURN {
                agent: selected.agent,
                score: selected.score,
                reason: formatSelectionReason(selected.factors)
            }
        END

    FUNCTION scoreReviewerFit(agent, pr, requiredCapabilities):
        factors = {}

        // 1. Capability overlap (0-40)
        capOverlap = calculateCapabilityOverlap(
            agent.capabilities,
            requiredCapabilities
        )
        factors.capabilityMatch = capOverlap * 40

        // 2. Review quality history (0-25)
        reviewQuality = agent.metrics.reviewQualityScore OR 0.7
        factors.reviewHistory = reviewQuality * 25

        // 3. Current availability (0-20)
        pendingReviews = countPendingReviews(agent)
        availabilityScore = MAX(0, 1 - (pendingReviews / 5))
        factors.availability = availabilityScore * 20

        // 4. Same epic bonus (0-15)
        IF isActiveInEpic(agent, pr.epicId):
            factors.epicContext = 15
        ELSE:
            factors.epicContext = 5

        overall = SUM(factors.values())

        RETURN { overall: overall, factors: factors }
```

### 3.2 Review Execution

```pseudocode
FUNCTION executePeerReview(reviewAssignment, pr, epicContext):
    INPUT:
        reviewAssignment: { agent, score, reason }
        pr: PullRequest
        epicContext: EpicContext

    OUTPUT:
        ReviewResult = { decision, feedback, checks }

    BEGIN:
        reviewer = reviewAssignment.agent

        // 1. Load review context
        reviewContext = {
            epicObjectives: epicContext.objectives,
            architecturalDecisions: getRelevantDecisions(pr, epicContext),
            acceptanceCriteria: extractAcceptanceCriteria(pr.linkedIssue),
            codeStandards: epicContext.constraints.codeStandards
        }

        // 2. Run automated checks
        automatedChecks = {
            linting: AWAIT runLinting(pr),
            unitTests: AWAIT runTests(pr, "unit"),
            integrationTests: AWAIT runTests(pr, "integration"),
            securityScan: AWAIT runSecurityScan(pr),
            coverageCheck: AWAIT checkCoverage(pr)
        }

        // 3. Check for blocking automated failures
        hasBlockingFailures = ANY(
            check.status == "failed" AND check.blocking
            FOR check IN automatedChecks.values()
        )

        IF hasBlockingFailures:
            RETURN {
                decision: "changes_requested",
                feedback: {
                    blocking: formatBlockingIssues(automatedChecks),
                    suggestions: [],
                    praise: []
                },
                checks: automatedChecks
            }

        // 4. Perform manual review
        manualReview = AWAIT performManualReview(reviewer, pr, reviewContext)

        // 5. Validate against acceptance criteria
        criteriaValidation = AWAIT validateAcceptanceCriteria(
            pr,
            reviewContext.acceptanceCriteria
        )

        // 6. Calculate quality score
        qualityScore = calculateQualityScore({
            automatedChecks: automatedChecks,
            manualReview: manualReview,
            criteriaValidation: criteriaValidation
        })

        // 7. Determine decision
        decision = determineReviewDecision(qualityScore, manualReview)

        // 8. Generate feedback
        feedback = {
            blocking: manualReview.blockingIssues,
            suggestions: manualReview.suggestions,
            praise: manualReview.positives,
            criteriaStatus: criteriaValidation.status
        }

        // 9. Post review to GitHub
        AWAIT postGitHubReview(pr, reviewer, decision, feedback)

        // 10. Store review for learning
        AWAIT storeReviewOutcome({
            prId: pr.id,
            reviewerId: reviewer.id,
            authorId: pr.author.id,
            decision: decision,
            qualityScore: qualityScore,
            feedback: feedback
        })

        // 11. Update reviewer metrics
        AWAIT updateReviewerMetrics(reviewer, {
            reviewCompleted: TRUE,
            timeToReview: NOW() - reviewAssignment.assignedAt,
            thoroughness: calculateThoroughness(feedback)
        })

        RETURN {
            decision: decision,
            feedback: feedback,
            checks: automatedChecks,
            qualityScore: qualityScore
        }
    END
```

---

## 4. Context Persistence & Restoration

### 4.1 Context Storage

```pseudocode
CLASS EpicContextManager:
    FUNCTION storeContext(epicContext):
        BEGIN:
            // 1. Serialize context
            serialized = serializeContext(epicContext)

            // 2. Calculate hash for conflict detection
            contextHash = calculateHash(serialized)

            // 3. Store in memory with versioning
            AWAIT memoryManager.store(
                namespace: epicContext.memoryNamespace,
                key: "context",
                value: {
                    data: serialized,
                    hash: contextHash,
                    version: epicContext.metadata.version
                },
                ttl: INFINITY
            )

            // 4. Store in GitHub issue body (backup)
            compressedContext = compress(
                extractCriticalContext(epicContext)
            )

            AWAIT githubAPI.updateIssue(
                owner: epicContext.owner,
                repo: epicContext.repo,
                issueNumber: epicContext.githubIssueNumber,
                body: formatEpicBody(epicContext, compressedContext)
            )

            // 5. Add to timeline
            AWAIT storeTimelineEvent(epicContext, {
                type: "context_stored",
                version: epicContext.metadata.version,
                hash: contextHash
            })

            RETURN { success: TRUE, version: epicContext.metadata.version }
        END

    FUNCTION restoreContext(epicId, options):
        INPUT:
            epicId: STRING
            options: {
                strategy: ENUM[full, summary, recent, lazy],
                targetAgent: AgentId (optional),
                maxTokens: INTEGER (optional)
            }

        OUTPUT:
            RestoredContext object tailored to options

        BEGIN:
            namespace = "epic:" + epicId

            // 1. Try memory first (fastest)
            memoryContext = AWAIT memoryManager.retrieve(
                namespace: namespace,
                key: "context"
            )

            IF memoryContext IS NULL:
                // 2. Fallback to GitHub
                memoryContext = AWAIT restoreFromGitHub(epicId)

                IF memoryContext IS NULL:
                    THROW EpicNotFoundError(epicId)

            // 3. Deserialize
            epicContext = deserializeContext(memoryContext.data)

            // 4. Apply restoration strategy
            MATCH options.strategy:
                CASE "full":
                    restoredContext = epicContext

                CASE "summary":
                    restoredContext = generateContextSummary(epicContext)

                CASE "recent":
                    restoredContext = extractRecentContext(
                        epicContext,
                        daysBack: 7
                    )

                CASE "lazy":
                    restoredContext = extractMinimalContext(epicContext)
                    restoredContext.loadMore = () => loadFullContext(epicId)

            // 5. Apply agent-specific filtering if specified
            IF options.targetAgent:
                restoredContext = filterForAgent(
                    restoredContext,
                    options.targetAgent
                )

            // 6. Compress if exceeds token limit
            IF options.maxTokens AND estimateTokens(restoredContext) > options.maxTokens:
                restoredContext = compressToTokenLimit(
                    restoredContext,
                    options.maxTokens
                )

            // 7. Record restoration in timeline
            AWAIT storeTimelineEvent(epicContext, {
                type: "context_restored",
                strategy: options.strategy,
                targetAgent: options.targetAgent
            })

            RETURN restoredContext
        END
```

### 4.2 Decision Logging (ADR)

```pseudocode
CLASS ADRManager:
    FUNCTION createDecision(epicId, decisionData):
        INPUT:
            epicId: STRING
            decisionData: {
                title: STRING,
                context: STRING,
                decision: STRING,
                rationale: ARRAY[STRING],
                alternatives: ARRAY[Object],
                participants: ARRAY[AgentId],
                relatedIssues: ARRAY[IssueId]
            }

        OUTPUT:
            ADR object with unique ID

        BEGIN:
            epicContext = AWAIT loadEpicContext(epicId)

            // 1. Generate ADR number
            adrNumber = epicContext.decisions.length + 1
            adrId = "ADR-" + padLeft(adrNumber, 3, "0")

            // 2. Create ADR record
            adr = {
                id: adrId,
                epicId: epicId,
                version: 1,
                status: "proposed",

                title: decisionData.title,
                context: decisionData.context,
                decision: decisionData.decision,
                rationale: decisionData.rationale,

                alternatives: decisionData.alternatives.map(alt => ({
                    name: alt.name,
                    rejectedReason: alt.reason,
                    evaluatedBy: alt.evaluator
                })),

                consequences: {
                    positive: [],
                    negative: [],
                    risks: []
                },

                participants: decisionData.participants,
                relatedIssues: decisionData.relatedIssues,
                relatedDecisions: [],

                metadata: {
                    createdAt: NOW(),
                    updatedAt: NOW(),
                    supersedes: NULL,
                    supersededBy: NULL
                }
            }

            // 3. Store in epic context
            epicContext.decisions.append(adr)
            AWAIT storeContext(epicContext)

            // 4. Post to GitHub as comment
            adrMarkdown = formatADRAsMarkdown(adr)
            AWAIT githubAPI.createIssueComment(
                owner: epicContext.owner,
                repo: epicContext.repo,
                issueNumber: epicContext.githubIssueNumber,
                body: adrMarkdown
            )

            // 5. Update related issues
            FOR EACH issueId IN decisionData.relatedIssues:
                AWAIT linkDecisionToIssue(adr.id, issueId)

            // 6. Emit event
            eventEmitter.emit("decision:created", {
                epicId: epicId,
                adrId: adr.id,
                participants: adr.participants
            })

            RETURN adr
        END

    FUNCTION queryDecisions(epicId, filter):
        INPUT:
            epicId: STRING
            filter: {
                status: ARRAY[STRING] (optional),
                participants: ARRAY[AgentId] (optional),
                relatedIssues: ARRAY[IssueId] (optional),
                searchText: STRING (optional),
                dateRange: { from: DATE, to: DATE } (optional)
            }

        OUTPUT:
            ARRAY[ADR] matching filter criteria

        BEGIN:
            epicContext = AWAIT loadEpicContext(epicId)
            decisions = epicContext.decisions

            // Apply filters
            IF filter.status:
                decisions = decisions.filter(d => d.status IN filter.status)

            IF filter.participants:
                decisions = decisions.filter(d =>
                    ANY(p IN d.participants FOR p IN filter.participants)
                )

            IF filter.relatedIssues:
                decisions = decisions.filter(d =>
                    ANY(i IN d.relatedIssues FOR i IN filter.relatedIssues)
                )

            IF filter.searchText:
                decisions = decisions.filter(d =>
                    contains(d.title, filter.searchText) OR
                    contains(d.context, filter.searchText) OR
                    contains(d.decision, filter.searchText)
                )

            IF filter.dateRange:
                decisions = decisions.filter(d =>
                    d.metadata.createdAt >= filter.dateRange.from AND
                    d.metadata.createdAt <= filter.dateRange.to
                )

            RETURN decisions.sortDescending(BY: metadata.createdAt)
        END
```

---

## 5. Progress Tracking Engine

### 5.1 Real-Time Progress Updates

```pseudocode
CLASS ProgressTracker:
    FUNCTION updateProgress(epicId, progressEvent):
        INPUT:
            epicId: STRING
            progressEvent: {
                type: ENUM[issue_claimed, commit, pr_created, review_completed, merged],
                issueId: STRING,
                agentId: STRING,
                data: Object
            }

        BEGIN:
            epicContext = AWAIT loadEpicContext(epicId)

            // 1. Update issue status based on event
            issue = findIssue(epicContext, progressEvent.issueId)

            MATCH progressEvent.type:
                CASE "issue_claimed":
                    issue.status = "in_progress"
                    issue.assignee = progressEvent.agentId
                    issue.claimedAt = NOW()

                CASE "commit":
                    issue.lastCommit = progressEvent.data.commitSha
                    issue.lastActivity = NOW()

                CASE "pr_created":
                    issue.status = "in_review"
                    issue.prId = progressEvent.data.prId

                CASE "review_completed":
                    IF progressEvent.data.approved:
                        issue.status = "approved"
                    ELSE:
                        issue.status = "changes_requested"

                CASE "merged":
                    issue.status = "completed"
                    issue.completedAt = NOW()
                    issue.actualHours = calculateActualHours(issue)

            // 2. Calculate epic progress
            epicProgress = calculateEpicProgress(epicContext)
            epicContext.progress = epicProgress

            // 3. Update timeline
            epicContext.timeline.append({
                timestamp: NOW(),
                event: progressEvent.type,
                issueId: progressEvent.issueId,
                agentId: progressEvent.agentId,
                data: progressEvent.data
            })

            // 4. Persist changes
            AWAIT storeContext(epicContext)

            // 5. Update GitHub issue labels
            AWAIT updateGitHubIssueLabels(issue, progressEvent.type)

            // 6. Emit progress event
            eventEmitter.emit("progress:updated", {
                epicId: epicId,
                progress: epicProgress,
                event: progressEvent
            })

            RETURN epicProgress
        END

    FUNCTION calculateEpicProgress(epicContext):
        issues = epicContext.issues

        // Count by status
        statusCounts = {
            open: 0,
            in_progress: 0,
            in_review: 0,
            completed: 0
        }

        FOR EACH issue IN issues:
            statusCounts[issue.status] += 1

        totalIssues = issues.length
        completedIssues = statusCounts.completed

        // Calculate percentage
        percentage = (completedIssues / totalIssues) * 100

        // Calculate velocity (issues per day over last 7 days)
        recentCompletions = issues.filter(i =>
            i.completedAt AND
            i.completedAt > NOW() - 7_DAYS
        )
        velocity = recentCompletions.length / 7

        // Project completion date
        remainingIssues = totalIssues - completedIssues
        IF velocity > 0:
            daysRemaining = remainingIssues / velocity
            projectedCompletion = NOW() + daysRemaining
        ELSE:
            projectedCompletion = NULL

        // Identify risks
        risks = identifyRisks(epicContext, {
            velocity: velocity,
            statusCounts: statusCounts
        })

        RETURN {
            totalIssues: totalIssues,
            completed: completedIssues,
            inProgress: statusCounts.in_progress,
            inReview: statusCounts.in_review,
            open: statusCounts.open,
            percentage: ROUND(percentage, 1),
            velocity: ROUND(velocity, 2),
            projectedCompletion: projectedCompletion,
            risks: risks,
            lastUpdated: NOW()
        }
```

### 5.2 Agent Performance Analytics

```pseudocode
FUNCTION calculateAgentAnalytics(agentId, epicId):
    BEGIN:
        epicContext = AWAIT loadEpicContext(epicId)

        // Get agent's completed issues
        agentIssues = epicContext.issues.filter(i => i.assignee == agentId)
        completedIssues = agentIssues.filter(i => i.status == "completed")

        // Calculate productivity metrics
        productivity = {
            issuesCompleted: completedIssues.length,
            avgCompletionTime: calculateAvgCompletionTime(completedIssues),
            velocityTrend: calculateVelocityTrend(completedIssues)
        }

        // Calculate quality metrics
        reviews = AWAIT getAgentReviews(agentId, epicId)
        qualityMetrics = {
            peerReviewScore: calculateAvgReviewScore(reviews),
            reworkRate: calculateReworkRate(completedIssues),
            testCoverageAvg: calculateAvgCoverage(completedIssues)
        }

        // Calculate collaboration metrics
        reviewsGiven = AWAIT getReviewsGivenBy(agentId, epicId)
        collaboration = {
            reviewsGiven: reviewsGiven.length,
            reviewQualityScore: calculateReviewQuality(reviewsGiven),
            avgResponseTime: calculateAvgResponseTime(reviewsGiven)
        }

        // Track growth
        growth = {
            newCapabilities: detectNewCapabilities(agentId, epicId),
            capabilityDepth: assessCapabilityDepth(agentId)
        }

        RETURN {
            agentId: agentId,
            epicId: epicId,
            productivity: productivity,
            quality: qualityMetrics,
            collaboration: collaboration,
            growth: growth,
            calculatedAt: NOW()
        }
    END
```

---

## 6. GitHub Synchronization

### 6.1 Bidirectional Sync

```pseudocode
CLASS GitHubSynchronizer:
    SYNC_INTERVAL = 5_MINUTES
    CONFLICT_STRATEGY = "github_wins"  // or "memory_wins", "merge", "manual"

    FUNCTION syncEpic(epicId, direction):
        INPUT:
            epicId: STRING
            direction: ENUM[from_github, to_github, bidirectional]

        OUTPUT:
            SyncResult = { success, changes, conflicts }

        BEGIN:
            epicContext = AWAIT loadEpicContext(epicId)
            changes = []
            conflicts = []

            // 1. Fetch latest from GitHub
            githubData = AWAIT fetchGitHubState(epicContext)

            // 2. Compare with memory state
            diffs = calculateDiffs(epicContext, githubData)

            // 3. Process diffs based on direction
            FOR EACH diff IN diffs:
                MATCH direction:
                    CASE "from_github":
                        // GitHub is source of truth
                        applyGitHubChange(epicContext, diff)
                        changes.append(diff)

                    CASE "to_github":
                        // Memory is source of truth
                        AWAIT pushToGitHub(epicContext, diff)
                        changes.append(diff)

                    CASE "bidirectional":
                        // Merge based on timestamps
                        IF diff.hasConflict:
                            resolution = resolveConflict(diff, CONFLICT_STRATEGY)
                            IF resolution.manual:
                                conflicts.append(diff)
                            ELSE:
                                applyResolution(epicContext, resolution)
                                changes.append(resolution)
                        ELSE:
                            // Apply newer change
                            IF diff.githubTimestamp > diff.memoryTimestamp:
                                applyGitHubChange(epicContext, diff)
                            ELSE:
                                AWAIT pushToGitHub(epicContext, diff)
                            changes.append(diff)

            // 4. Update sync metadata
            epicContext.metadata.lastSyncAt = NOW()
            epicContext.metadata.syncVersion += 1

            // 5. Persist updated context
            AWAIT storeContext(epicContext)

            // 6. Log sync result
            AWAIT logSyncResult({
                epicId: epicId,
                direction: direction,
                changesApplied: changes.length,
                conflictsFound: conflicts.length,
                timestamp: NOW()
            })

            RETURN {
                success: conflicts.length == 0,
                changes: changes,
                conflicts: conflicts
            }
        END

    FUNCTION resolveConflict(diff, strategy):
        MATCH strategy:
            CASE "github_wins":
                RETURN {
                    field: diff.field,
                    value: diff.githubValue,
                    source: "github",
                    manual: FALSE
                }

            CASE "memory_wins":
                RETURN {
                    field: diff.field,
                    value: diff.memoryValue,
                    source: "memory",
                    manual: FALSE
                }

            CASE "merge":
                IF canAutoMerge(diff):
                    merged = autoMerge(diff.githubValue, diff.memoryValue)
                    RETURN {
                        field: diff.field,
                        value: merged,
                        source: "merged",
                        manual: FALSE
                    }
                ELSE:
                    RETURN { manual: TRUE, diff: diff }

            CASE "manual":
                RETURN { manual: TRUE, diff: diff }
```

### 6.2 Webhook Handler

```pseudocode
FUNCTION handleGitHubWebhook(event, payload):
    INPUT:
        event: STRING (issues, issue_comment, pull_request, etc.)
        payload: GitHub webhook payload

    BEGIN:
        // 1. Verify webhook signature
        IF NOT verifyWebhookSignature(payload):
            THROW UnauthorizedError("Invalid webhook signature")

        // 2. Extract epic ID from payload
        epicId = extractEpicId(payload)

        IF epicId IS NULL:
            // Not related to an epic, ignore
            RETURN { processed: FALSE, reason: "Not epic-related" }

        // 3. Process based on event type
        MATCH event:
            CASE "issues":
                AWAIT handleIssueEvent(epicId, payload)

            CASE "issue_comment":
                AWAIT handleCommentEvent(epicId, payload)

            CASE "pull_request":
                AWAIT handlePullRequestEvent(epicId, payload)

            CASE "pull_request_review":
                AWAIT handleReviewEvent(epicId, payload)

            CASE "push":
                AWAIT handlePushEvent(epicId, payload)

        // 4. Trigger sync
        AWAIT syncEpic(epicId, direction: "from_github")

        RETURN { processed: TRUE, event: event, epicId: epicId }
    END

FUNCTION handleIssueEvent(epicId, payload):
    action = payload.action
    issue = payload.issue

    MATCH action:
        CASE "opened":
            // New issue added to epic
            AWAIT addIssueToEpic(epicId, issue)

        CASE "closed":
            // Issue completed
            AWAIT updateProgress(epicId, {
                type: "merged",
                issueId: issue.number,
                data: { closedBy: payload.sender.login }
            })

        CASE "assigned":
            // Check if assigned by agent
            IF isAgentAssignment(payload):
                // Agent claimed issue
                AWAIT updateProgress(epicId, {
                    type: "issue_claimed",
                    issueId: issue.number,
                    agentId: payload.assignee.login
                })

        CASE "labeled":
            // Handle label changes
            AWAIT handleLabelChange(epicId, issue, payload.label)
```

---

## Appendix: Data Structures

### Epic Context Structure

```pseudocode
STRUCT EpicContext:
    id: STRING                          // Unique epic identifier
    githubIssueNumber: INTEGER          // GitHub issue number
    repository: STRING                  // owner/repo
    state: EpicState                    // Current lifecycle state

    metadata: {
        createdAt: TIMESTAMP,
        lastUpdated: TIMESTAMP,
        lastSyncAt: TIMESTAMP,
        version: INTEGER,
        complexity: ENUM[low, medium, high, critical]
    }

    objectives: ARRAY[STRING]           // High-level goals
    constraints: {
        technical: ARRAY[STRING],
        business: ARRAY[STRING],
        codeStandards: Object
    }

    decisions: ARRAY[ADR]               // Architectural decisions
    issues: ARRAY[Issue]                // Issues in this epic
    activeAgents: ARRAY[AgentAssignment]
    timeline: ARRAY[TimelineEvent]
    progress: EpicProgress

    coordinatorAgent: AgentId
    memoryNamespace: STRING             // Memory storage namespace
```

### Agent Assignment Structure

```pseudocode
STRUCT AgentAssignment:
    agentId: STRING
    role: STRING                        // coordinator, developer, reviewer, etc.
    currentIssue: STRING OR NULL
    claimedAt: TIMESTAMP OR NULL
    workPlan: WorkPlan OR NULL
    status: ENUM[active, idle, blocked]
```

### Issue Structure

```pseudocode
STRUCT Issue:
    id: STRING
    githubIssueNumber: INTEGER
    title: STRING
    description: STRING
    status: ENUM[open, in_progress, in_review, approved, completed]
    priority: ENUM[low, medium, high, critical]

    assignee: AgentId OR NULL
    requiredCapabilities: ARRAY[STRING]
    estimatedHours: FLOAT
    actualHours: FLOAT OR NULL

    dependencies: ARRAY[IssueId]
    prId: STRING OR NULL

    claimedAt: TIMESTAMP OR NULL
    completedAt: TIMESTAMP OR NULL
    lastActivity: TIMESTAMP
```

---

**Next Phase**: [03-architecture.md](./03-architecture.md)

**Status**: Ready for Architecture phase
