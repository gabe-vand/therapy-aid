// Queries on app_settings (key/value). One narrow function per query.
import { eq } from 'drizzle-orm';
import { app_settings } from '@/db/schema/app-settings';
import { db } from '@/services/common/svc-db';

export type SettingRow = typeof app_settings.$inferSelect;

/** One setting, or null when it was never saved. */
export const selectSetting = (key: string): SettingRow | null => db.select().from(app_settings).where(eq(app_settings.key, key)).get() ?? null;

/** Creates or replaces one setting (idempotent upsert) and returns the stored row. */
export const upsertSetting = (key: string, value: string): SettingRow => {
    const updated_at = new Date().toISOString();
    return db
        .insert(app_settings)
        .values({ key, value, updated_at })
        .onConflictDoUpdate({ target: app_settings.key, set: { value, updated_at } })
        .returning()
        .get();
};
