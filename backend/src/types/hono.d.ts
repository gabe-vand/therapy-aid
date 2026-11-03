// Typed Hono context variables. md-auth sets `login` on every authenticated request, so any
// router behind it can read c.get('login') as a string.
import 'hono';

declare module 'hono' {
    interface ContextVariableMap {
        login: string;
    }
}
