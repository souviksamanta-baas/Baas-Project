import { existsSync, rmSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = resolve(import.meta.dirname, '..');
const isDryRun = process.argv.includes('--dry-run');
const isConfirmed = process.argv.includes('--yes');

const generatedArtifactPaths = [
  'node_modules',
  'dist',
  'build',
  '.expo',
  '.audit',
  'apps/api/node_modules',
  'apps/api/dist',
  'apps/api/build',
  'apps/api/.expo',
  'apps/mobile/node_modules',
  'apps/mobile/dist',
  'apps/mobile/build',
  'apps/mobile/.expo',
  'apps/ui-mockups/node_modules',
  'apps/ui-mockups/dist',
  'apps/ui-mockups/build',
];

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
}

function assertInsideRepo(path) {
  const relativePath = relative(repoRoot, path);
  if (relativePath === '' || relativePath.startsWith('..') || relativePath.includes(`..${sep}`)) {
    throw new Error(`Refusing to remove path outside repository: ${path}`);
  }
}

function assertNoTrackedFiles(artifactPath) {
  const trackedFiles = runGit(['ls-files', '-z', '--', artifactPath]).split('\0').filter(Boolean);
  if (trackedFiles.length > 0) {
    throw new Error(
      [
        `Refusing to remove ${artifactPath} because it contains tracked files:`,
        ...trackedFiles.map((filePath) => `- ${filePath}`),
      ].join('\n'),
    );
  }
}

if (!isDryRun && !isConfirmed) {
  throw new Error('Refusing to remove generated artifacts without --yes. Use --dry-run to preview.');
}

const existingArtifactPaths = generatedArtifactPaths
  .filter((artifactPath) => existsSync(resolve(repoRoot, artifactPath)))
  .sort((left, right) => right.split('/').length - left.split('/').length);

if (existingArtifactPaths.length === 0) {
  console.log('No generated artifact folders found.');
  process.exit(0);
}

for (const artifactPath of existingArtifactPaths) {
  assertInsideRepo(resolve(repoRoot, artifactPath));
  assertNoTrackedFiles(artifactPath);
}

if (isDryRun) {
  console.log('Generated artifact folders that would be removed:');
  for (const artifactPath of existingArtifactPaths) {
    console.log(`- ${artifactPath}`);
  }
  process.exit(0);
}

for (const artifactPath of existingArtifactPaths) {
  rmSync(resolve(repoRoot, artifactPath), {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  console.log(`Removed ${artifactPath}`);
}
