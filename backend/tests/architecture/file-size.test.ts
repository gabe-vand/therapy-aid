import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Hard rule 1 (CLAUDE.md): every file stays below 200 lines. Checked across the whole workspace
// from here — source, scripts, the docs pages and features.html — so the frontend and the docs
// are held to it by the same suite.

const REPO = join(import.meta.dir, '..', '..', '..');
const SCANNED = ['backend/src', 'backend/tests', 'frontend/src', 'frontend/tests', 'packages/shared/src', 'scripts', 'docs'];
const SCANNED_FILES = ['features.html'];
const CODE = /\.(ts|tsx|css|sql|html)$/;
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
