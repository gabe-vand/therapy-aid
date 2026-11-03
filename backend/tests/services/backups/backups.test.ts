import { Database } from 'bun:sqlite';
import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordVisit } from '@/services/hello/hello';
import { hasRecentSnapshot, listSnapshots, pruneSnapshots, snapshotName, takeDailySnapshot } from '@/services/backups/backups';
import { dbMigrate } from '@/services/common/svc-migrate';

// Runs against the real (in-memory) database: VACUUM INTO and integrity_check are the point.

const NOW = new Date('2026-11-03T12:00:00Z');
let dir: string;

beforeAll(() => {
    dbMigrate();
    recordVisit();
});

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'backups-test-'));
});

describe('takeDailySnapshot', () => {
    it("writes today's snapshot, a readable copy of the live data", () => {
        expect(takeDailySnapshot(dir, NOW)).toBe('therapy-aid-2026-11-03.sqlite');

        const copy = new Database(join(dir, 'therapy-aid-2026-11-03.sqlite'), { readonly: true });
        const row = copy.query('select count(*) as n from visits').get() as { n: number };
        copy.close();
        expect(row.n).toBeGreaterThan(0);
    });

    it('is idempotent within a day', () => {
        takeDailySnapshot(dir, NOW);
        expect(takeDailySnapshot(dir, NOW)).toBeNull();
        expect(listSnapshots(dir)).toEqual(['therapy-aid-2026-11-03.sqlite']);
    });

    it('replaces a .tmp left by a crashed pass and leaves no .tmp behind', () => {
        writeFileSync(join(dir, `${snapshotName(NOW)}.tmp`), 'half-written');
        expect(takeDailySnapshot(dir, NOW)).toBe(snapshotName(NOW));
        expect(readdirSync(dir)).toEqual([snapshotName(NOW)]);
    });

    it('creates the backup folder if it is missing', () => {
        const nested = join(dir, 'not', 'yet');
        takeDailySnapshot(nested, NOW);
        expect(existsSync(join(nested, snapshotName(NOW)))).toBe(true);
    });
});

describe('pruneSnapshots', () => {
    it('keeps the newest N and ignores unrelated files', () => {
        for (const day of ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']) writeFileSync(join(dir, `therapy-aid-${day}.sqlite`), '');
        writeFileSync(join(dir, 'notes.txt'), '');

        expect(pruneSnapshots(dir, 2)).toEqual(['therapy-aid-2026-10-30.sqlite', 'therapy-aid-2026-10-31.sqlite']);
        expect(readdirSync(dir).sort()).toEqual(['notes.txt', 'therapy-aid-2026-11-01.sqlite', 'therapy-aid-2026-11-02.sqlite']);
        expect(pruneSnapshots(dir, 2)).toEqual([]);
    });
});

describe('hasRecentSnapshot', () => {
    it('is false with no snapshots, true for today or yesterday, false when stale', () => {
        expect(hasRecentSnapshot(dir, NOW)).toBe(false);
        writeFileSync(join(dir, 'therapy-aid-2026-11-02.sqlite'), '');
        expect(hasRecentSnapshot(dir, NOW)).toBe(true);
        expect(hasRecentSnapshot(dir, new Date('2026-11-05T00:00:00Z'))).toBe(false);
    });
});
