/**
 * Command line entry: `npm run sim -- --hours <n> [--auto] [--seed <n>]`.
 */
import { formatReport, parseArgs, runHeadless } from './run';

try {
  console.log(formatReport(runHeadless(parseArgs(process.argv.slice(2)))));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
