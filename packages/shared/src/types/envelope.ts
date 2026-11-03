/** The one response shape every backend route returns (built by rsp() in svc-response.ts). */
export interface ApiEnvelope<T = unknown> {
    data: T;
    status_code: number;
    message: string;
}
