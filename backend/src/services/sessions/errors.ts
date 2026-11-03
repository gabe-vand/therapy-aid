// The ways a sessions operation can be refused, as typed errors. Services never see Hono, so they
// throw these and the routes translate each into the right rsp() status (404 / 409 / 400).

/** No session with that id. → 404 */
export class SessionNotFoundError extends Error {
    constructor(id: number) {
        super(`Session ${id} was not found.`);
        this.name = new.target.name;
    }
}

/** The session is in the wrong state for the operation (e.g. retrying one that is not failed). → 409 */
export class SessionStateError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}

/** A chunk arrived out of order. `expected` is the seq the server wants next. → 409 { expected } */
export class ChunkOrderError extends Error {
    constructor(public readonly expected: number) {
        super(`Out-of-order chunk: the next expected seq is ${expected}.`);
        this.name = new.target.name;
    }
}

/** finalize was told a chunk count that does not match what landed. → 409 { received } */
export class ChunkCountError extends Error {
    constructor(
        public readonly received: number,
        claimed: number,
    ) {
        super(`Expected ${claimed} chunks but ${received} arrived.`);
        this.name = new.target.name;
    }
}

/** The input is unusable in a way the zod schema could not see (empty chunk, nothing recorded). → 400 */
export class SessionInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = new.target.name;
    }
}
