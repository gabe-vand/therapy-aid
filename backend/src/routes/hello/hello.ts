// Hello-world smoke test endpoints. Thin router: call the service, answer through rsp().
import { Hono } from 'hono';
import { rsp } from '@/services/common/svc-response';
import { getHelloStatus, recordVisit } from '@/services/hello/hello';

export const router_hello = new Hono();

router_hello.get('/', (c) => rsp(c, getHelloStatus()));

router_hello.post('/visits', (c) => rsp(c, recordVisit()));
