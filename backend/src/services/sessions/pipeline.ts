// Stub — replaced by BE-SESSIONS; see SPEC §7.5
// Exists now so index.ts can call recoverStuckSessions() at boot and the app compiles before the
// sessions module lands. The real processSession never throws (it records failures on the row).

/** Boot recovery: re-queue sessions stuck mid-pipeline. Stub: does nothing. */
export const recoverStuckSessions = (): void => {};

/** Runs (or resumes) one session's pipeline. Stub: always rejects. */
export const processSession = async (_id: number): Promise<void> => {
    throw new Error('not implemented');
};
