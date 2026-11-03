import { useCallback, useRef, useState } from 'react';
import { uploadAPI } from '@/services/api';

/* The recorder's upload queue: audio chunks leave the phone strictly one at a time, in order (the
   server rejects a chunk that is not the next one). Each chunk stays in memory until the server
   acks it, and gets MAX_ATTEMPTS tries with BACKOFF_MS between them. When a chunk runs out of
   tries the queue pauses ("stalled") instead of dropping audio; the next chunk arriving, or an
   explicit resume(), starts it again. Split from use-recorder so each file does one job. */

export const MAX_ATTEMPTS = 3;
export const BACKOFF_MS = 2000;

type Chunk = { seq: number; blob: Blob };
type Target = { session_id: number; mime: string };

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const useChunkUpload = () => {
    const queue = useRef<Chunk[]>([]);
    const target = useRef<Target | null>(null);
    const running = useRef<Promise<void> | null>(null);
    const [uploaded, set_uploaded] = useState(0);
    const [total, set_total] = useState(0);
    const [stalled, set_stalled] = useState<string | null>(null);

    // One chunk, with retries. A 409 whose `expected` is already past this seq means the server has
    // it (our ack was lost on the way back), which counts as delivered.
    const send = useCallback(async ({ seq, blob }: Chunk): Promise<string | null> => {
        const { session_id, mime } = target.current!;
        let failure = 'Upload failed.';
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            const res = await uploadAPI<{ expected?: number }>(`sessions/${session_id}/chunks?seq=${seq}`, blob, mime);
            if (res.status_code === 200) return null;
            if (res.status_code === 409 && typeof res.data?.expected === 'number' && res.data.expected > seq) return null;
            failure = res.message;
            if (attempt < MAX_ATTEMPTS) await wait(BACKOFF_MS);
        }
        return failure;
    }, []);

    // Drains the queue head-first; a failed head stays put. Concurrent callers share one run.
    const drain = useCallback((): Promise<void> => {
        if (running.current) return running.current;
        set_stalled(null);
        running.current = (async () => {
            while (queue.current.length > 0) {
                const failure = await send(queue.current[0]!);
                if (failure !== null) {
                    set_stalled(failure);
                    return;
                }
                queue.current.shift();
                set_uploaded((n) => n + 1);
            }
        })().finally(() => {
            running.current = null;
        });
        return running.current;
    }, [send]);

    // Point the queue at a fresh recording and zero the counters.
    const begin = useCallback((session_id: number, mime: string) => {
        target.current = { session_id, mime };
        queue.current = [];
        set_uploaded(0);
        set_total(0);
        set_stalled(null);
    }, []);

    const enqueue = useCallback(
        (seq: number, blob: Blob) => {
            queue.current.push({ seq, blob });
            set_total((n) => n + 1);
            void drain();
        },
        [drain],
    );

    const pending = useCallback(() => queue.current.length, []);

    return { uploaded, total, stalled, begin, enqueue, drain, pending };
};
