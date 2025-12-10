/**
 * Teammate-Driven Agent Management - CLI Command Integration
 *
 * Bridges the claude-flow CLI to the teammate-agents module,
 * providing epic management, context restoration, and teammate mode control.
 *
 * @module cli/commands/teammate
 */

import { CLI, success, error, warning, info } from '../cli-core.js';
import type { CommandContext } from '../cli-core.js';
import chalk from 'chalk';

// Dynamic import for teammate-agents module (optional feature)
let teammateModule: any = null;

async function getTeammateModule() {
  if (!teammateModule) {
    try {
      teammateModule = await import('../../teammate-agents/index.js');
    } catch (err) {
      return null;
    }
  }
  return teammateModule;
}

/**
 * Check if teammate mode is enabled
 */
function isTeammateModeEnabled(flags: Record<string, any>): boolean {
  // Check flag override first
  if (flags['teammate-mode'] === true) return true;
  if (flags['no-teammate-mode'] === true) return false;

  // Check environment variable
  const envVar = process.env.TEAMMATE_MODE || process.env.CLAUDE_FLOW_TEAMMATE_MODE;
  if (envVar) {
    return envVar.toLowerCase() === 'true' || envVar === '1';
  }

  // Default: disabled
  return false;
}

/**
 * Show message when teammate mode is disabled
 */
function showTeammateModeDisabledMessage(command: string): void {
  console.log(chalk.yellow('\nTeammate Mode is currently disabled\n'));
  console.log(chalk.dim('To enable teammate mode, you can:'));
  console.log(chalk.dim('  1. Set in config: ') + chalk.cyan('npx claude-flow config set teammate.enabled true'));
  console.log(chalk.dim('  2. Use flag: ') + chalk.cyan(`${command} --teammate-mode`));
  console.log(chalk.dim('  3. Set environment: ') + chalk.cyan('TEAMMATE_MODE=true'));
  console.log();
}

/**
 * Setup teammate-related CLI commands
 */
export function setupTeammateCommands(cli: CLI): void {
  // Epic management command
  cli.command({
    name: 'epic',
    description: 'Manage epics in teammate-driven agent system',
    options: [
      {
        name: 'teammate-mode',
        description: 'Enable teammate mode for this command',
        type: 'boolean',
      },
      {
        name: 'no-teammate-mode',
        description: 'Disable teammate mode for this command',
        type: 'boolean',
      },
    ],
    action: async (ctx: CommandContext) => {
      const subcommand = ctx.args[0];

      if (!isTeammateModeEnabled(ctx.flags)) {
        showTeammateModeDisabledMessage('npx claude-flow epic');
        return;
      }

      const module = await getTeammateModule();
      if (!module) {
        error('Teammate-agents module not available. Please ensure it is properly installed.');
        return;
      }

      const { TeammateManager } = module;
      const manager = new TeammateManager();

      switch (subcommand) {
        case 'create': {
          const title = ctx.args.slice(1).join(' ');
          if (!title) {
            error('Usage: epic create <title> [--repo owner/repo]');
            return;
          }

          try {
            const epic = await manager.createEpic({
              title,
              repository: ctx.flags.repo as string,
              description: ctx.flags.description as string,
            });

            success('Epic created successfully!');
            console.log(chalk.bold.cyan(`\nEpic: ${epic.title}`));
            console.log(chalk.dim('ID:'), epic.id);
            console.log(chalk.dim('State:'), epic.state);
            console.log();
          } catch (err: any) {
            error(`Failed to create epic: ${err.message}`);
          }
          break;
        }

        case 'list': {
          try {
            const epics = await manager.listEpics({
              state: ctx.flags.status as string,
              repository: ctx.flags.repo as string,
            });

            if (epics.length === 0) {
              warning('No epics found matching the criteria.');
              console.log(chalk.dim('\nCreate a new epic with:'));
              console.log(chalk.cyan('  npx claude-flow epic create "Epic Title"'));
              return;
            }

            success(`Found ${epics.length} epics:`);
            console.log();

            for (const epic of epics) {
              const stateEmoji = {
                active: '🟢',
                paused: '🟡',
                completed: '✅',
                cancelled: '❌',
              }[epic.state] || '⚪';

              console.log(`${stateEmoji} ${chalk.bold(epic.title)}`);
              console.log(chalk.dim(`   ID: ${epic.id} | Phase: ${epic.currentPhase || 'N/A'} | Issues: ${epic.childIssues?.length || 0}`));
            }
            console.log();
          } catch (err: any) {
            error(`Failed to list epics: ${err.message}`);
          }
          break;
        }

        case 'show': {
          const epicId = ctx.args[1];
          if (!epicId) {
            error('Usage: epic show <epic-id>');
            return;
          }

          try {
            const epic = await manager.getEpic(epicId);
            if (!epic) {
              error(`Epic not found: ${epicId}`);
              return;
            }

            console.log(chalk.bold.cyan(`\nEpic: ${epic.title}\n`));
            console.log(chalk.dim('ID:'), epic.id);
            console.log(chalk.dim('State:'), epic.state);
            console.log(chalk.dim('Phase:'), epic.currentPhase || 'Not started');
            console.log(chalk.dim('Repository:'), epic.repository || 'N/A');
            console.log(chalk.dim('Created:'), new Date(epic.createdAt).toLocaleString());

            if (epic.description) {
              console.log(chalk.bold('\nDescription:'));
              console.log(chalk.dim(epic.description));
            }

            if (epic.childIssues?.length > 0) {
              console.log(chalk.bold(`\nChild Issues (${epic.childIssues.length}):`));
              for (const issue of epic.childIssues.slice(0, 10)) {
                console.log(`  - #${issue.number || 'N/A'}: ${issue.title}`);
              }
              if (epic.childIssues.length > 10) {
                console.log(chalk.dim(`  ... and ${epic.childIssues.length - 10} more`));
              }
            }
            console.log();
          } catch (err: any) {
            error(`Failed to show epic: ${err.message}`);
          }
          break;
        }

        case 'update': {
          const epicId = ctx.args[1];
          if (!epicId) {
            error('Usage: epic update <epic-id> --state <state> | --phase <phase>');
            return;
          }

          try {
            const updates: any = {};
            if (ctx.flags.state) updates.state = ctx.flags.state;
            if (ctx.flags.phase) updates.currentPhase = ctx.flags.phase;
            if (ctx.flags.title) updates.title = ctx.flags.title;

            if (Object.keys(updates).length === 0) {
              error('No updates provided. Use --state, --phase, or --title');
              return;
            }

            const epic = await manager.updateEpic(epicId, updates);
            success('Epic updated successfully!');
            console.log(chalk.dim('ID:'), epic.id);
            console.log(chalk.dim('State:'), epic.state);
            console.log();
          } catch (err: any) {
            error(`Failed to update epic: ${err.message}`);
          }
          break;
        }

        case 'sync': {
          const epicId = ctx.args[1];
          if (!epicId) {
            error('Usage: epic sync <epic-id>');
            return;
          }

          try {
            info('Syncing epic with GitHub...');
            await manager.syncEpic(epicId, {
              direction: ctx.flags.direction as string || 'bidirectional',
              force: ctx.flags.force as boolean,
            });
            success('Epic synced successfully!');
          } catch (err: any) {
            error(`Failed to sync epic: ${err.message}`);
          }
          break;
        }

        case 'assign': {
          const epicId = ctx.args[1];
          if (!epicId) {
            error('Usage: epic assign <epic-id> --auto-assign | --agent <agent-id> --issue <number>');
            return;
          }

          try {
            if (ctx.flags['auto-assign']) {
              const assignments = await manager.autoAssignAgents(epicId, {
                strategy: ctx.flags.strategy as string || 'capability',
              });
              success(`Auto-assigned ${assignments.length} agents!`);
              for (const a of assignments) {
                console.log(`  - Issue #${a.issueNumber} -> ${a.agentId} (${Math.round(a.matchScore * 100)}% match)`);
              }
            } else if (ctx.flags.agent && ctx.flags.issue) {
              await manager.assignAgent(epicId, parseInt(ctx.flags.issue as string), ctx.flags.agent as string);
              success(`Assigned agent ${ctx.flags.agent} to issue #${ctx.flags.issue}`);
            } else {
              error('Use --auto-assign or provide --agent and --issue');
            }
          } catch (err: any) {
            error(`Failed to assign agents: ${err.message}`);
          }
          break;
        }

        default: {
          console.log(chalk.bold('\nEpic Commands:\n'));
          console.log('  ' + chalk.cyan('epic create <title>') + '     Create a new epic');
          console.log('  ' + chalk.cyan('epic list') + '              List all epics');
          console.log('  ' + chalk.cyan('epic show <epic-id>') + '    Show epic details');
          console.log('  ' + chalk.cyan('epic update <epic-id>') + '  Update epic properties');
          console.log('  ' + chalk.cyan('epic sync <epic-id>') + '    Sync with GitHub');
          console.log('  ' + chalk.cyan('epic assign <epic-id>') + '  Assign agents to issues');
          console.log();
          console.log(chalk.dim('Options:'));
          console.log(chalk.dim('  --teammate-mode     Enable teammate mode'));
          console.log(chalk.dim('  --repo <owner/repo> GitHub repository'));
          console.log(chalk.dim('  --status <state>    Filter by state (list)'));
          console.log(chalk.dim('  --auto-assign       Auto-assign agents (assign)'));
          console.log();
        }
      }
    },
  });

  // Teammate context management command
  cli.command({
    name: 'teammate',
    description: 'Manage teammate mode and context restoration',
    options: [
      {
        name: 'teammate-mode',
        description: 'Enable teammate mode for this command',
        type: 'boolean',
      },
      {
        name: 'no-teammate-mode',
        description: 'Disable teammate mode for this command',
        type: 'boolean',
      },
    ],
    action: async (ctx: CommandContext) => {
      const subcommand = ctx.args[0];

      if (!isTeammateModeEnabled(ctx.flags)) {
        showTeammateModeDisabledMessage('npx claude-flow teammate');
        return;
      }

      const module = await getTeammateModule();
      if (!module) {
        error('Teammate-agents module not available. Please ensure it is properly installed.');
        return;
      }

      const { TeammateManager } = module;
      const manager = new TeammateManager();

      switch (subcommand) {
        case 'context-restore': {
          const epicId = ctx.flags.epic as string;
          if (!epicId) {
            error('Usage: teammate context-restore --epic <epic-id>');
            return;
          }

          try {
            info('Restoring context...');
            const context = await manager.restoreContext(epicId, {
              strategy: ctx.flags.strategy as string || 'summary',
              targetAgent: ctx.flags.agent as string,
              maxTokens: parseInt(ctx.flags['max-tokens'] as string || '4000'),
            });

            success('Context restored successfully!');
            console.log(chalk.dim('Epic:'), context.epicId);
            console.log(chalk.dim('Token Count:'), context.tokenCount);
            if (context.summary) {
              console.log(chalk.bold('\nSummary:'));
              console.log(chalk.dim(context.summary.substring(0, 300) + '...'));
            }
            console.log();
          } catch (err: any) {
            error(`Failed to restore context: ${err.message}`);
          }
          break;
        }

        case 'context-save': {
          const epicId = ctx.flags.epic as string;
          if (!epicId) {
            error('Usage: teammate context-save --epic <epic-id> --data <json> | --file <path>');
            return;
          }

          try {
            let contextData: any;
            if (ctx.flags.file) {
              const fs = await import('fs-extra');
              contextData = await fs.readJSON(ctx.flags.file as string);
            } else if (ctx.flags.data) {
              contextData = JSON.parse(ctx.flags.data as string);
            } else {
              error('Provide context data via --data or --file');
              return;
            }

            await manager.saveContext(epicId, contextData);
            success('Context saved successfully!');
          } catch (err: any) {
            error(`Failed to save context: ${err.message}`);
          }
          break;
        }

        case 'context-clear': {
          const epicId = ctx.flags.epic as string;
          if (!epicId) {
            error('Usage: teammate context-clear --epic <epic-id> [--confirm]');
            return;
          }

          if (!ctx.flags.confirm) {
            warning(`This will clear all context for epic ${epicId}`);
            console.log(chalk.dim('Use --confirm to proceed'));
            return;
          }

          try {
            await manager.clearContext(epicId);
            success('Context cleared successfully!');
          } catch (err: any) {
            error(`Failed to clear context: ${err.message}`);
          }
          break;
        }

        case 'status': {
          try {
            const status = await manager.getStatus();
            console.log(chalk.bold.cyan('\nTeammate Mode Status\n'));
            console.log(chalk.dim('Enabled:'), status.enabled ? chalk.green('Yes') : chalk.red('No'));
            console.log(chalk.dim('Active Epics:'), status.activeEpics || 0);
            console.log(chalk.dim('Total Agents:'), status.totalAgents || 0);
            console.log();
          } catch (err: any) {
            error(`Failed to get status: ${err.message}`);
          }
          break;
        }

        default: {
          console.log(chalk.bold('\nTeammate Commands:\n'));
          console.log('  ' + chalk.cyan('teammate context-restore') + '  Restore epic context for an agent');
          console.log('  ' + chalk.cyan('teammate context-save') + '     Save context to epic memory');
          console.log('  ' + chalk.cyan('teammate context-clear') + '    Clear epic context from memory');
          console.log('  ' + chalk.cyan('teammate status') + '           Show teammate mode status');
          console.log();
          console.log(chalk.dim('Options:'));
          console.log(chalk.dim('  --epic <epic-id>       Epic to operate on'));
          console.log(chalk.dim('  --strategy <strategy>  Restoration strategy (full|summary|selective)'));
          console.log(chalk.dim('  --agent <agent-id>     Target agent for context'));
          console.log(chalk.dim('  --teammate-mode        Enable teammate mode'));
          console.log();
        }
      }
    },
  });
}
