import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

type AllowedMethod = (typeof ALLOWED_METHODS)[number]

function getBackendOrigin(): string | null {
  const backendOrigin = (process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || '').trim()
  if (!backendOrigin) {
    return null
  }
  return backendOrigin.replace(/\/$/, '')
}

function buildTargetUrl(request: NextRequest, pathSegments: string[]): string | null {
  const backendOrigin = getBackendOrigin()
  if (!backendOrigin) {
    return null
  }

  const normalizedPath = pathSegments.map((segment) => encodeURIComponent(segment)).join('/')
  return `${backendOrigin}/api/${normalizedPath}${request.nextUrl.search}`
}

function forwardRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers)
  headers.delete('host')
  if (!headers.get('x-correlation-id')) {
    headers.set('x-correlation-id', randomUUID())
  }
  return headers
}

async function proxy(request: NextRequest, pathSegments: string[], method: AllowedMethod): Promise<Response> {
  const targetUrl = buildTargetUrl(request, pathSegments)
  if (!targetUrl) {
    return Response.json(
      { error: 'Missing BACKEND_ORIGIN environment variable' },
      { status: 500 }
    )
  }

  const requestHeaders = forwardRequestHeaders(request)
  const correlationId = requestHeaders.get('x-correlation-id') || randomUUID()
  const init: RequestInit = {
    method,
    headers: requestHeaders,
    redirect: 'manual',
  }

  if (method !== 'GET') {
    init.body = await request.arrayBuffer()
  }

  try {
    const upstreamResponse = await fetch(targetUrl, init)
    const responseHeaders = new Headers(upstreamResponse.headers)
    responseHeaders.set('x-correlation-id', correlationId)

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    return Response.json(
      {
        error: 'Proxy request failed',
        detail: error instanceof Error ? error.message : 'Unknown error',
        correlation_id: correlationId,
      },
      { status: 502 }
    )
  }
}

interface RouteContext {
  params: {
    path: string[]
  }
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxy(request, context.params.path, 'GET')
}

export async function POST(request: NextRequest, { params }: RouteContext): Promise<Response> {
  return proxy(request, params.path, 'POST')
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxy(request, context.params.path, 'PUT')
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxy(request, context.params.path, 'PATCH')
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxy(request, context.params.path, 'DELETE')
}
