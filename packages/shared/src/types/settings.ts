// Settings: the "About me" profile every prompt includes.

/** GET/PUT /settings/profile. updated_at is null until the profile is first saved. */
export interface Profile {
    profile: string;
    updated_at: string | null;
}
