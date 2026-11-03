// The "About me" profile: free text about Gabe that every AI prompt includes (it opens the
// context pack). Stored as app_settings key 'profile'. Editable in Settings, seeded by the import CLI.
import type { Profile } from '@therapy-aid/shared';
import * as repo_settings from '@/repositories/settings';

const PROFILE_KEY = 'profile';

/** The saved profile; an empty profile with updated_at null before the first save. */
export const getProfile = (): Profile => {
    const row = repo_settings.selectSetting(PROFILE_KEY);
    return row ? { profile: row.value, updated_at: row.updated_at } : { profile: '', updated_at: null };
};

/** Replaces the profile (trailing whitespace trimmed) and returns what was stored. */
export const putProfile = (profile: string): Profile => {
    const row = repo_settings.upsertSetting(PROFILE_KEY, profile.trimEnd());
    return { profile: row.value, updated_at: row.updated_at };
};
