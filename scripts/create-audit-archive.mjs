import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const excludedTrackedPathPatterns = [
  /^node_modules\//,
  /^dist\//,
  /^build\//,
  /^\.expo\//,
  /^apps\/[^/]+\/dist\//,
  /^apps\/[^/]+\/build\//,
  /^apps\/mobile\/\.expo\//,
];

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: resolve(import.meta.dirname, '..'),
    encoding: 'utf8',
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
}

function parseOutputPath() {
  const outputFlagIndex = process.argv.findIndex((arg) => arg === '--output' || arg === '-o');
  if (outputFlagIndex >= 0) {
    const output = process.argv[outputFlagIndex + 1];
    if (!output) {
      throw new Error('Missing archive output path after --output');
    }

    return resolve(output);
  }

  const shortSha = runGit(['rev-parse', '--short', 'HEAD']).trim();
  return resolve('/tmp', `baas-mvp-audit-${shortSha}.zip`);
}

function assertNoTrackedGeneratedArtifacts() {
  const trackedFiles = runGit(['ls-files', '-z']).split('\0').filter(Boolean);
  const generatedFiles = trackedFiles.filter((filePath) =>
    excludedTrackedPathPatterns.some((pattern) => pattern.test(filePath)),
  );

  if (generatedFiles.length > 0) {
    throw new Error(
      [
        'Refusing to create audit archive because generated artifacts are tracked:',
        ...generatedFiles.map((filePath) => `- ${filePath}`),
      ].join('\n'),
    );
  }
}

function warnIfWorktreeDirty() {
  const status = runGit(['status', '--short']).trim();
  if (status.length > 0) {
    console.warn('Warning: working tree has uncommitted changes. The archive uses tracked HEAD contents only.');
  }
}

const outputPath = parseOutputPath();
assertNoTrackedGeneratedArtifacts();
warnIfWorktreeDirty();

const outputDirectory = dirname(outputPath);
if (!existsSync(outputDirectory)) {
  mkdirSync(outputDirectory, { recursive: true });
}

runGit(['archive', '--format=zip', '--output', outputPath, 'HEAD']);
console.log(`Created clean audit archive: ${outputPath}`);
