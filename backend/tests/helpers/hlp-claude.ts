// A fake Claude transport for svc-claude's own tests (feature tests spyOn svc-claude instead).
// Replies are queued in order; every request is recorded so a test can assert exactly what
// would have been sent. parse() mimics the SDK: it runs the request's output format parser on
// the reply text, throwing AnthropicError when the text doesn't fit the schema.
import type Anthropic from '@anthropic-ai/sdk';
import { setClaudeTransport, type ParsedReply } from '@/services/common/svc-claude-transport';

type Usage = Partial<Pick<Anthropic.Usage, 'input_tokens' | 'output_tokens' | 'cache_read_input_tokens' | 'cache_creation_input_tokens'>>;

/** A Message with overridable fields (cast: the SDK type carries many optional extras). */
export const message = (content: Anthropic.ContentBlock[], stop_reason: Anthropic.StopReason = 'end_turn', usage: Usage = {}): Anthropic.Message =>
    ({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-test',
        content,
        stop_reason,
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...usage },
    }) as unknown as Anthropic.Message;

/** A text block. */
export const text = (value: string): Anthropic.ContentBlock => ({ type: 'text', text: value, citations: null }) as unknown as Anthropic.ContentBlock;

/** A tool_use block. */
export const toolUse = (id: string, name: string, input: unknown): Anthropic.ContentBlock => ({ type: 'tool_use', id, name, input }) as unknown as Anthropic.ContentBlock;

export interface FakeTransport {
    requests: Anthropic.MessageCreateParamsNonStreaming[];
    restore: () => void;
}

/** Installs a transport that answers each call with the next queued reply (a Message, or an
    Error to throw). Call restore() in afterEach. */
export const installFakeClaude = (replies: (Anthropic.Message | Error)[]): FakeTransport => {
    const queue = [...replies];
    const requests: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const next = (params: Anthropic.MessageCreateParamsNonStreaming): Anthropic.Message => {
        // Snapshot the messages array: the tool loop appends to it after the call returns.
        requests.push({ ...params, messages: [...params.messages] });
        const reply = queue.shift();
        if (!reply) throw new Error('fake Claude: no reply queued');
        if (reply instanceof Error) throw reply;
        return reply;
    };
    setClaudeTransport({
        create: async (params) => next(params),
        parse: async (params): Promise<ParsedReply> => {
            const reply = next(params);
            const format = params.output_config?.format as { parse?: (content: string) => unknown } | undefined;
            const body = reply.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
            const parsed_output = body && format?.parse ? format.parse(body.text) : null;
            return { ...reply, parsed_output };
        },
    });
    return { requests, restore: () => setClaudeTransport(null) };
};
