import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Hard rule 1 (CLAUDE.md): every file stays below 200 lines. Checked across the whole workspace
// from here — source, tests, the DDL, scripts (TypeScript and shell), the docs pages, the deploy
// config, the skills and CLAUDE.md itself — so everything the rule covers is held to it by the same
// suite, not just the code.

const REPO = join(import.meta.dir, '..', '..', '..');
const SCANNED = ['backend/src', 'backend/tests', 'backend/db-schemas', 'frontend/src', 'frontend/tests', 'packages/shared/src', 'scripts', 'docs', 'deploy', '.claude/skills'];
const SCANNED_FILES = ['features.html', 'CLAUDE.md', 'docker-compose.yml', 'frontend/nginx.conf', 'frontend/index.html', 'frontend/vite.config.ts', 'backend/.env.example', 'backend/Dockerfile', 'frontend/Dockerfile'];
const CODE = /\.(ts|tsx|css|sql|html|sh|md|yml|yaml|conf|json)$/;
const LIMIT = 200;

/** Recursively collect source files under a dir. */
const files_under = (dir: string): string[] => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return name === 'node_modules' ? [] : files_under(full);
        return CODE.test(name) ? [full] : [];
    });
};

describe('file size', () => {
    it(`every source file is below ${LIMIT} lines`, () => {
        const files = [...SCANNED.flatMap((dir) => files_under(join(REPO, dir))), ...SCANNED_FILES.map((file) => join(REPO, file)).filter((file) => existsSync(file))];
        const too_long = files
            .map((file) => ({ file: relative(REPO, file), lines: readFileSync(file, 'utf8').split('\n').length }))
            .filter(({ lines }) => lines >= LIMIT)
            .map(({ file, lines }) => `${file}: ${lines}`);
        expect(too_long).toEqual([]);
    });
});
