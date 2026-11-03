// The one seam between svc-claude and the network. Production gets a thin wrapper over a single
// Anthropic client (created lazily, only when ANTHROPIC_API_KEY is set); svc-claude's own tests
// install a fake with setClaudeTransport() so they never touch the network and never need
// mock.module. Feature tests don't come here — they spyOn svc-claude's exported functions.
import Anthropic from '@anthropic-ai/sdk';
import { app_env } from './svc-env';

/** Base class for every AI failure; `message` is always safe to show Gabe (it becomes a
    session's `error`, an inline chat error, …). */
export class AiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

/** Thrown by every AI call while ANTHROPIC_API_KEY is unset. */
export class AiNotConfiguredError extends AiError {
    constructor() {
        super('AI is not configured. Set ANTHROPIC_API_KEY in the API environment (on the Pi: ~/therapy-aid.env) and restart.');
    }
}

/** A parsed message: the SDK's Message plus the structured-output result (null when absent). */
export type ParsedReply = Anthropic.Message & { parsed_output: unknown };

/** The two SDK calls svc-claude makes — exactly client.messages.create / client.messages.parse. */
export interface ClaudeTransport {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
    parse(params: Anthropic.MessageCreateParamsNonStreaming): Promise<ParsedReply>;
}

let injected: ClaudeTransport | null = null;
let real: ClaudeTransport | null = null;

/** Installs a fake transport (tests, or a script that wants to record calls); null restores
    the real one. */
export const setClaudeTransport = (transport: ClaudeTransport | null): void => {
    injected = transport;
};

/** True when a real call could be made (key set) or a fake is installed. */
export const isAiConfigured = (): boolean => injected !== null || app_env.anthropic_api_key.length > 0;

/** The transport to use for this call. Throws AiNotConfiguredError when there is no key. */
export const getClaudeTransport = (): ClaudeTransport => {
    if (injected) return injected;
    if (!app_env.anthropic_api_key) throw new AiNotConfiguredError();
    if (!real) {
        const client = new Anthropic({ apiKey: app_env.anthropic_api_key });
        real = {
            create: (params) => client.messages.create(params),
            parse: (params) => client.messages.parse(params),
        };
    }
    return real;
};
