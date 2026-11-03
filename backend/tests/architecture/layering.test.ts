import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// The layered architecture: routes → services → repositories → entities. Each layer's import
// bans are checked file by file, so a shortcut fails the suite instead of a code review.
//
//   routes        never see the database, drizzle, or a repository
//   services      never see drizzle, svc-db, or Hono (services/common is the infra exemption)
//   repositories  never see services (bar svc-db) or Hono — the ONLY place a query lives
//   db/schema     imports nothing but drizzle-orm

const ROOT = join(import.meta.dir, '..', '..');
const SRC = join(ROOT, 'src');

/** Recursively collect .ts files under a dir; [] when the dir doesn't exist yet. */
const ts_files = (dir: string): string[] => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return ts_files(full);
        return name.endsWith('.ts') ? [full] : [];
    });
};

/** Every import / export-from specifier in a file. */
const import_specs = (file: string): string[] => {
    const src = readFileSync(file, 'utf8');
    return [...src.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!);
};

const is_drizzle = (spec: string) => spec === 'drizzle-orm' || spec.startsWith('drizzle-orm/');
const is_hono = (spec: string) => spec === 'hono' || spec.startsWith('hono/');
const is_svc_db = (spec: string) => spec.endsWith('/svc-db');
const is_repository = (spec: string) => spec.startsWith('@/repositories');

/** "<file>: <spec>" for every import in `files` that `banned` matches. */
const violations = (files: string[], banned: (spec: string) => boolean): string[] =>
    files.flatMap((file) => import_specs(file).filter(banned).map((spec) => `${relative(ROOT, file)}: ${spec}`));

const feature_services = ts_files(join(SRC, 'services')).filter((f) => !f.includes(join('services', 'common')));

describe('layering', () => {
    it('routes never touch the database layer', () => {
        expect(violations(ts_files(join(SRC, 'routes')), (s) => is_drizzle(s) || is_svc_db(s) || is_repository(s))).toEqual([]);
    });

    it('routes live in one folder per module — no naked files under src/routes/', () => {
        const naked = readdirSync(join(SRC, 'routes')).filter((name) => !statSync(join(SRC, 'routes', name)).isDirectory());
        expect(naked).toEqual([]);
    });

    it('feature services never see drizzle, svc-db or Hono', () => {
        expect(violations(feature_services, (s) => is_drizzle(s) || is_svc_db(s) || is_hono(s))).toEqual([]);
    });

    it('repositories never see services (bar svc-db) or Hono', () => {
        const banned = (s: string) => is_hono(s) || (s.startsWith('@/services') && !is_svc_db(s));
        expect(violations(ts_files(join(SRC, 'repositories')), banned)).toEqual([]);
    });

    it('schema files import nothing but drizzle-orm', () => {
        expect(violations(ts_files(join(SRC, 'db', 'schema')), (s) => !is_drizzle(s))).toEqual([]);
    });
});
