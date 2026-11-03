// /search?q= — full-text hits over sessions and journal entries for the command palette. The
// same index chat grounds on; an empty or unsearchable query answers []. Mounted at /search.
import { Hono } from 'hono';
import type { SearchResult } from '@therapy-aid/shared';
import { rsp } from '@/services/common/svc-response';
import { searchDocuments } from '@/services/search/search';

export const router_search = new Hono();

const MAX_QUERY = 200;
const LIMIT = 12;

router_search.get('/', (c) => {
    const q = (c.req.query('q') ?? '').slice(0, MAX_QUERY).trim();
    const hits: SearchResult[] = q ? searchDocuments(q, { limit: LIMIT }) : [];
    return rsp(c, hits);
});
