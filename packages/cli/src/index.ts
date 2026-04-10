import prompts from 'prompts';
import pc from 'picocolors';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { presets, formatEventsAsCode } from './presets.js';
import { generateFiles, allDeps, type Framework, type Database, type TemplateContext } from './templates.js';

const LOGO = `
  ╔╦╗┬─┐┌─┐┌─┐┬┌─┌─┐┌─┐┬ ┬
   ║ ├┬┘├─┤│  ├┴┐├─┘├─┤│││
   ╩ ┴└─┴ ┴└─┘┴ ┴┴  ┴ ┴└┴┘
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'init') {
    await runInit(args.slice(1));
  } else if (command === 'events') {
    listEvents(args[1]);
  } else {
    printHelp();
  }
}

function printHelp() {
  console.log(pc.cyan(LOGO));
  console.log(`  ${pc.bold('Usage:')}`);
  console.log(`    trackpaw init             Interactive setup`);
  console.log(`    trackpaw init --preset saas --framework express --db sqlite`);
  console.log(`    trackpaw events saas      List standard events for a preset`);
  console.log(`    trackpaw events ecommerce`);
  console.log(`    trackpaw events media`);
  console.log();
  console.log(`  ${pc.bold('Presets:')}`);
  for (const [key, preset] of Object.entries(presets)) {
    console.log(`    ${pc.green(key.padEnd(12))} ${preset.description}`);
  }
  console.log();
}

function listEvents(presetName?: string) {
  if (!presetName || !presets[presetName]) {
    console.log(pc.red(`Unknown preset. Available: ${Object.keys(presets).join(', ')}`));
    process.exit(1);
  }
  const preset = presets[presetName]!;
  console.log(pc.cyan(`\n  ${preset.name} — Standard Events\n`));
  for (const event of preset.events) {
    const props = event.properties.length > 0 ? pc.dim(` (${event.properties.join(', ')})`) : '';
    console.log(`  ${pc.green('●')} ${pc.bold(event.name)}${props}`);
    console.log(`    ${pc.dim(event.description)}`);
  }
  console.log();
}

function parseFlags(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--') && i + 1 < args.length) {
      flags[arg.slice(2)] = args[i + 1]!;
      i++;
    }
  }
  return flags;
}

async function runInit(args: string[]) {
  console.log(pc.cyan(LOGO));
  console.log(`  ${pc.dim('Set up Trackpaw analytics in your project')}\n`);

  const flags = parseFlags(args);

  // If all flags provided, skip prompts
  const isNonInteractive = flags['framework'] && flags['db'] && flags['preset'];

  let framework: Framework;
  let database: Database;
  let presetName: string;

  if (isNonInteractive) {
    framework = flags['framework'] as Framework;
    database = flags['db'] as Database;
    presetName = flags['preset']!;
  } else {
    const answers = await prompts(
      [
        {
          type: 'select',
          name: 'framework',
          message: 'What framework are you using?',
          choices: [
            { title: 'Express', value: 'express', description: 'Express.js server' },
            { title: 'Next.js', value: 'nextjs', description: 'Next.js App Router' },
            { title: 'Standalone', value: 'standalone', description: 'Dedicated analytics server' },
          ],
          initial: flags['framework'] ? ['express', 'nextjs', 'standalone'].indexOf(flags['framework']) : 0,
        },
        {
          type: 'select',
          name: 'database',
          message: 'Which database?',
          choices: [
            { title: 'SQLite', value: 'sqlite', description: 'Zero config, great for dev & small scale' },
            { title: 'PostgreSQL', value: 'postgres', description: 'Production-ready relational DB' },
            { title: 'MySQL', value: 'mysql', description: 'Popular relational database' },
            { title: 'ClickHouse', value: 'clickhouse', description: 'High-performance analytics DB' },
          ],
          initial: flags['db'] ? ['sqlite', 'postgres', 'mysql', 'clickhouse'].indexOf(flags['db']) : 0,
        },
        {
          type: 'select',
          name: 'preset',
          message: 'What kind of product are you building?',
          choices: [
            { title: 'SaaS', value: 'saas', description: 'Sign ups, subscriptions, feature usage' },
            { title: 'E-Commerce', value: 'ecommerce', description: 'Products, carts, checkouts' },
            { title: 'Media / Content', value: 'media', description: 'Articles, videos, subscriptions' },
            { title: 'Custom', value: 'custom', description: 'Start with no preset events' },
          ],
          initial: flags['preset'] ? ['saas', 'ecommerce', 'media', 'custom'].indexOf(flags['preset']) : 0,
        },
      ],
      {
        onCancel: () => {
          console.log(pc.dim('\n  Cancelled.\n'));
          process.exit(0);
        },
      }
    );

    framework = answers.framework;
    database = answers.database;
    presetName = answers.preset;
  }

  const apiKey = flags['api-key'] || randomBytes(16).toString('hex');
  const port = Number(flags['port']) || (framework === 'standalone' ? 3001 : 3000);
  const preset = presets[presetName];
  const events = preset ? preset.events : [];

  const ctx: TemplateContext = {
    framework,
    database,
    presetName: preset ? preset.name : 'Custom',
    events,
    apiKey,
    port,
  };

  // Generate files
  const files = generateFiles(ctx);
  console.log();
  console.log(pc.bold('  Creating files:\n'));

  for (const file of files) {
    const fullPath = join(process.cwd(), file.path);
    const dir = dirname(fullPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (existsSync(fullPath)) {
      console.log(`  ${pc.yellow('skip')}  ${file.path} ${pc.dim('(already exists)')}`);
    } else {
      writeFileSync(fullPath, file.content);
      console.log(`  ${pc.green('create')}  ${file.path} ${pc.dim(`— ${file.description}`)}`);
    }
  }

  // Install dependencies
  console.log();
  const deps = allDeps(database);
  const pm = detectPackageManager();
  const installCmd = pm === 'yarn' ? 'yarn add' : pm === 'pnpm' ? 'pnpm add' : 'npm install';

  console.log(pc.bold('  Installing dependencies:\n'));
  console.log(`  ${pc.dim(`$ ${installCmd} ${deps.join(' ')}`)}\n`);

  try {
    execSync(`${installCmd} ${deps.join(' ')}`, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
    console.log();
    console.log(`  ${pc.green('✓')} Dependencies installed`);
  } catch {
    console.log();
    console.log(`  ${pc.yellow('!')} Auto-install failed. Run manually:`);
    console.log(`    ${pc.cyan(`${installCmd} ${deps.join(' ')}`)}`);
  }

  // Done!
  console.log();
  console.log(pc.green(pc.bold('  ✓ Trackpaw is ready!\n')));

  if (framework === 'express') {
    console.log(`  ${pc.bold('Next steps:')}`);
    console.log(`    1. ${pc.cyan('Copy the analytics setup from trackpaw-server.js into your app')}`);
    console.log(`    2. ${pc.cyan('Add the tracker snippet to your frontend')}`);
    console.log(`    3. ${pc.cyan(`Visit http://localhost:${port}/analytics/v1/health`)}`);
  } else if (framework === 'nextjs') {
    console.log(`  ${pc.bold('Next steps:')}`);
    console.log(`    1. ${pc.cyan('The server singleton is at lib/analytics-server.ts')}`);
    console.log(`    2. ${pc.cyan('API routes are at app/api/analytics/[...path]/route.ts')}`);
    console.log(`    3. ${pc.cyan("Import getTracker() from lib/analytics.ts in your components")}`);
  } else {
    console.log(`  ${pc.bold('Next steps:')}`);
    console.log(`    1. ${pc.cyan(`node trackpaw-server.js`)}`);
    console.log(`    2. ${pc.cyan(`Visit http://localhost:${port}/v1/health`)}`);
  }

  if (events.length > 0) {
    console.log();
    console.log(`  ${pc.dim(`Check ${framework === 'nextjs' ? 'lib/trackpaw-events.ts' : 'trackpaw-events.ts'} for your ${presetName} standard events.`)}`);
  }

  console.log(`\n  ${pc.dim(`API Key: ${apiKey}`)}`);
  console.log();
}

function detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
  if (existsSync(join(process.cwd(), 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(process.cwd(), 'yarn.lock'))) return 'yarn';
  return 'npm';
}

main().catch((err) => {
  console.error(pc.red(`\n  Error: ${err.message}\n`));
  process.exit(1);
});
