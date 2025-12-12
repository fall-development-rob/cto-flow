# CTO-Flow AI Code Review Workflow

## Overview

This GitHub Actions workflow provides automated AI-powered code review using a swarm of specialized reviewer agents. It triggers on pull requests and provides comprehensive analysis across security, code quality, architecture, and test coverage.

## Workflow File

- **Location:** `.github/workflows/cto-flow-review.yml`
- **Trigger:** PR opened, synchronized, or labeled with "review-ready"
- **Duration:** ~3-5 minutes per review

## Features

### 🤖 AI Review Swarm

The workflow spawns four specialized reviewer agents:

1. **Security Reviewer (35% weight)**
   - Scans for hardcoded secrets and credentials
   - Detects SQL injection and XSS vulnerabilities
   - Reviews authentication/authorization logic
   - Checks for insecure dependencies

2. **Code Quality Reviewer (25% weight)**
   - Analyzes code complexity and maintainability
   - Checks naming conventions and readability
   - Detects code duplication
   - Validates error handling patterns

3. **Architecture Reviewer (25% weight)**
   - Evaluates architectural patterns
   - Assesses separation of concerns
   - Reviews module coupling and cohesion
   - Identifies technical debt

4. **Test Coverage Reviewer (15% weight)**
   - Measures unit test coverage (target: >80%)
   - Evaluates test quality and assertions
   - Checks edge case coverage
   - Reviews test maintainability

### 🎯 Intelligent Triggering

The workflow automatically detects:

- **CTO-Flow Worker PRs:** Auto-generated PRs from `cto-flow/*` branches
- **Manual Reviews:** PRs labeled with "review-ready"
- **Review Status:** Skips already-reviewed PRs unless forced
- **PR Source:** Identifies bot-created vs. human-created PRs

### ✅ Consensus Decision-Making

Reviews use a weighted consensus algorithm:

- **Overall Score:** Weighted average of all reviewers
- **Approval Threshold:** Configurable (default: 85%)
- **Minimum Approvals:** Configurable (default: 3/4 reviewers)
- **Security Priority:** Security reviews have highest weight (35%)

### 🔄 Auto-Merge Capability

When enabled and all criteria are met:

1. AI review swarm approves (score ≥ threshold)
2. All required CI checks pass
3. No merge conflicts exist
4. PR is automatically merged with squash commit

## Configuration

### Required Secrets

```yaml
ANTHROPIC_API_KEY: Your Anthropic API key for Claude AI
GITHUB_TOKEN: Automatically provided by GitHub Actions
```

### Environment Variables

Configure these in repository settings under **Settings > Secrets and variables > Variables**:

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_MERGE_ENABLED` | `false` | Enable automatic merging of approved PRs |
| `REVIEW_THRESHOLD` | `0.85` | Minimum score (0-1) required for approval |
| `MIN_APPROVALS` | `3` | Minimum number of reviewer approvals needed |

### Setting Variables

1. Go to repository **Settings**
2. Navigate to **Secrets and variables > Actions**
3. Click **Variables** tab
4. Click **New repository variable**
5. Add each variable with desired value

## Usage

### Automatic Review Triggers

The workflow automatically runs when:

1. **New PR from CTO-Flow Worker:**
   - Branch matches `cto-flow/*` or `*/worker-*`
   - Title includes `[CTO-Flow]` or `[Auto-Generated]`

2. **Manual Review Request:**
   - Add label "review-ready" to any PR
   - Workflow runs immediately

3. **Manual Workflow Dispatch:**
   ```bash
   gh workflow run cto-flow-review.yml \
     -f pr_number=123 \
     -f force_review=true
   ```

### Interpreting Review Results

The workflow posts a detailed comment with:

```markdown
## ✅ AI Code Review Swarm Complete

**Overall Decision:** APPROVED
**Composite Score:** 89.2% (threshold: 85.0%)
**Reviewer Approvals:** 4/4 (minimum: 3)

### 📊 Review Breakdown

| Reviewer | Score | Status |
|----------|-------|--------|
| 🔒 Security | 92.0% | ✅ |
| ✨ Code Quality | 88.0% | ✅ |
| 🏗️ Architecture | 90.0% | ✅ |
| 🧪 Test Coverage | 85.0% | ✅ |
```

### Review Labels

The workflow manages these labels:

- `review-ready`: Added manually to request review (removed after review)
- `reviewed`: Added after review completion
- `ai-approved`: Added when review approves PR
- `changes-requested`: Added when review requests changes

## Integration with CTO-Flow

### Worker PR Detection

The workflow detects CTO-Flow worker PRs by:

1. **Branch Naming:**
   - `cto-flow/*` branches
   - `*/worker-*` branches

2. **PR Title:**
   - Contains `[CTO-Flow]`
   - Contains `[Auto-Generated]`

3. **Author:**
   - GitHub bot accounts
   - Automated service accounts

### Coordination Hooks

The workflow uses Claude-Flow hooks for coordination:

```bash
# Before each review
npx claude-flow@alpha hooks pre-task \
  --description "Security review for PR #123" \
  --agent-type "security-reviewer"

# After each review
npx claude-flow@alpha hooks post-task \
  --task-id "security-review"
```

## Customization

### Adjusting Review Weights

Edit the weights in the "Swarm Consensus & Decision" step:

```javascript
const weights = {
  security: 0.35,      // 35% weight
  quality: 0.25,       // 25% weight
  architecture: 0.25,  // 25% weight
  coverage: 0.15       // 15% weight
};
```

### Adding Custom Reviewers

Add new review steps following this pattern:

```yaml
- name: Performance Review
  id: performance
  run: |
    npx claude-flow@alpha hooks pre-task \
      --description "Performance review for PR #${{ needs.detect-pr-source.outputs.pr_number }}" \
      --agent-type "perf-analyzer"

    # Run performance analysis
    PERF_SCORE=0.90
    echo "score=${PERF_SCORE}" >> $GITHUB_OUTPUT

    npx claude-flow@alpha hooks post-task --task-id "performance-review"
```

### Disabling Auto-Merge

Set repository variable:

```bash
gh variable set AUTO_MERGE_ENABLED --body "false"
```

Or remove the `auto-merge` job entirely from the workflow.

## Troubleshooting

### Review Not Triggering

**Check:**
1. PR is targeting `main` or `develop` branch
2. Label "review-ready" is spelled correctly
3. PR is not already labeled "reviewed"
4. Workflow file is on default branch

### Review Failing

**Common Issues:**
1. **Missing ANTHROPIC_API_KEY:** Add to repository secrets
2. **npm install failures:** Check Node.js version compatibility
3. **Git diff errors:** Ensure base branch exists

**View Logs:**
```bash
gh run list --workflow=cto-flow-review.yml
gh run view <run-id> --log
```

### Auto-Merge Not Working

**Requirements:**
1. `AUTO_MERGE_ENABLED` variable set to `true`
2. All CI checks must pass
3. PR must be mergeable (no conflicts)
4. Review score must meet threshold

**Check Status:**
```bash
gh pr checks <pr-number>
gh pr view <pr-number> --json mergeable
```

## Best Practices

### 1. Start with Manual Reviews

Begin with `AUTO_MERGE_ENABLED=false` to build confidence:

```bash
gh variable set AUTO_MERGE_ENABLED --body "false"
```

### 2. Adjust Threshold Gradually

Start with a lower threshold and increase:

```bash
# Start conservative
gh variable set REVIEW_THRESHOLD --body "0.75"

# Increase after monitoring results
gh variable set REVIEW_THRESHOLD --body "0.85"
```

### 3. Monitor Review Accuracy

Track false positives/negatives:

```bash
# View recent review results
gh run list --workflow=cto-flow-review.yml --limit 10

# Analyze specific review
gh run view <run-id> --log | grep "Consensus"
```

### 4. Combine with Branch Protection

Enable required reviews in addition to AI reviews:

1. Go to **Settings > Branches**
2. Add rule for `main` branch
3. Require pull request reviews: 1 human + AI review
4. Require status checks: All CI + AI review

## Performance Metrics

Typical workflow performance:

- **Setup:** ~30-45 seconds
- **Security Review:** ~30-45 seconds
- **Quality Review:** ~30-45 seconds
- **Architecture Review:** ~30-45 seconds
- **Coverage Review:** ~30-45 seconds
- **Consensus & Reporting:** ~15-30 seconds

**Total Duration:** 3-5 minutes per review

## Security Considerations

### Secret Management

- Never commit `ANTHROPIC_API_KEY` to repository
- Use GitHub Secrets for sensitive values
- Rotate API keys regularly

### Code Access

- Review runs with PR code checked out
- Uses `pull_request` event (runs in fork context for safety)
- Limited `GITHUB_TOKEN` permissions

### Auto-Merge Safety

- Requires all CI checks to pass
- Requires minimum approval threshold
- Can be disabled per repository
- Respects branch protection rules

## Support

For issues or questions:

1. **Workflow Issues:** Check GitHub Actions logs
2. **Claude-Flow Issues:** https://github.com/ruvnet/claude-flow/issues
3. **Configuration Help:** Review this README and repository variables

## Example Output

<details>
<summary>View sample review comment</summary>

```markdown
## ✅ AI Code Review Swarm Complete

**Overall Decision:** APPROVED
**Composite Score:** 89.2% (threshold: 85.0%)
**Reviewer Approvals:** 4/4 (minimum: 3)

### 📊 Review Breakdown

| Reviewer | Score | Status |
|----------|-------|--------|
| 🔒 Security | 92.0% | ✅ |
| ✨ Code Quality | 88.0% | ✅ |
| 🏗️ Architecture | 90.0% | ✅ |
| 🧪 Test Coverage | 85.0% | ✅ |

### 📈 PR Statistics

- **Files Changed:** 12
- **Lines Added:** +453
- **Lines Deleted:** -127
- **Net Change:** 326 lines

### ✅ Approval Criteria Met

All review criteria have been satisfied. This PR is ready to merge.

---

*Swarm ID: `review-pr-123-1702401234`*
*Powered by CTO-Flow AI Review Swarm*
```

</details>

## License

This workflow is part of the CTO-Flow project and follows the same license.
