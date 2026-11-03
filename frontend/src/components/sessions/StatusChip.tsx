import type { SessionStatus } from '@therapy-aid/shared';
import { Chip, type ChipTone } from '@/components/ui/Card';

/* One place that says how a session status reads and which colour it wears, so the list, Home's
   last-session card and the detail page never disagree. */

export const STATUS_LABEL: Record<SessionStatus, string> = { recording: 'Recording', uploaded: 'Queued', transcribing: 'Transcribing', summarizing: 'Summarizing', ready: 'Ready', failed: 'Failed' };

const STATUS_TONE: Record<SessionStatus, ChipTone> = { recording: 'warn', uploaded: 'accent', transcribing: 'accent', summarizing: 'accent', ready: 'ok', failed: 'danger' };

export const StatusChip = ({ status }: { status: SessionStatus }) => <Chip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Chip>;

export const SOURCE_LABEL = { recording: 'Recorded', notes: 'Notes' } as const;
