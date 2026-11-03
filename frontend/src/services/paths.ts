/* Every in-app URL, built in one place so links, navigate() calls and the route table in App.tsx
   cannot drift. Pages link with these instead of string literals. */
export const paths = {
    home: '/',
    sessions: '/sessions',
    session: (id: number | string) => `/sessions/${id}`,
    record: '/sessions/record',
    upload_notes: '/sessions/notes',
    problems: '/problems',
    problem: (id: number | string) => `/problems/${id}`,
    journal: '/journal',
    journal_entry: (id: number | string) => `/journal/${id}`,
    chat: '/chat',
    chat_thread: (id: number | string) => `/chat/${id}`,
    settings: '/settings',
} as const;
