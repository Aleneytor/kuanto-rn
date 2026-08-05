export function requireCronAuth(request: Request): void {
  const expected = Deno.env.get('CRON_SECRET');
  const received = request.headers.get('x-cron-secret');

  if (!expected || !received || !constantTimeEqual(expected, received)) {
    throw new HttpError(401, 'Unauthorized');
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse({ success: false, error: error.message }, error.status);
  }
  console.error(error);
  return jsonResponse({ success: false, error: 'Internal ingestion error' }, 500);
}
