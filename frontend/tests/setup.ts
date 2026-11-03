import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';

/* Each test stubs fetch for exactly the responses it needs (tests/helpers/hlp-fetch.ts); this
   puts the real one back so a stub never leaks into the next file. */
afterEach(() => {
    vi.unstubAllGlobals();
});
