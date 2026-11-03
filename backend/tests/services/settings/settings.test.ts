import { beforeEach, describe, expect, it } from 'bun:test';
import { getProfile, putProfile } from '@/services/settings/settings';
import { resetDatabase } from '../../helpers/hlp-db';

beforeEach(() => resetDatabase());

describe('profile', () => {
    it('is empty with no timestamp before the first save', () => {
        expect(getProfile()).toEqual({ profile: '', updated_at: null });
    });

    it('saves, trims trailing whitespace, and replaces on the next save', () => {
        const first = putProfile('I study CS.\n\n');
        expect(first.profile).toBe('I study CS.');
        expect(first.updated_at).not.toBeNull();
        putProfile('Second version');
        expect(getProfile().profile).toBe('Second version');
    });
});
