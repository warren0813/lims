import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.LIMS_BACKEND_URL ?? 'http://127.0.0.1:8000';

const SKIP_HEADERS = new Set([
  'host',
  'connection',
  'transfer-encoding',
  'te',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
  'trailer',
]);

async function proxy(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const backendUrl = `${BACKEND}${url.pathname}${url.search}`;

  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (!SKIP_HEADERS.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(backendUrl, {
    method: request.method,
    headers: forwardHeaders,
    body,
    redirect: 'follow',
  });

  const responseHeaders = new Headers();
  for (const [key, value] of upstream.headers.entries()) {
    if (!SKIP_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
