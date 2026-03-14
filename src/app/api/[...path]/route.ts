import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

type AllowedMethod = (typeof ALLOWED_METHODS)[number]

function getBackendOrigin(): string | null {
  const backendOrigin = (process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_URL || '').trim()
  if (backendOrigin.startsWith('http://') || backendOrigin.startsWith('https://')) {
    return backendOrigin.replace(/\/$/, '')
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'http://localhost:8000'
  }

  return 'https://web-production-3afc5.up.railway.app'
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
  const headers = new Headers()
  const allowed = [
    'accept',
    'accept-language',
    'authorization',
    'content-type',
    'cookie',
    'user-agent',
    'x-correlation-id',
  ]

  for (const headerName of allowed) {
    const value = request.headers.get(headerName)
    if (value) {
      headers.set(headerName, value)
    }
  }

  if (!headers.get('x-correlation-id')) {
    headers.set('x-correlation-id', randomUUID())
  }
  return headers
}

async function proxy(request: NextRequest, pathSegments: string[], method: AllowedMethod): Promise<Response> {
  let correlationId: string = randomUUID()
  try {
    const targetUrl = buildTargetUrl(request, pathSegments)
    if (!targetUrl) {
      return Response.json(
        { error: 'Missing BACKEND_ORIGIN environment variable' },
        { status: 500 }
      )
    }

    const requestHeaders = forwardRequestHeaders(request)
    correlationId = requestHeaders.get('x-correlation-id') || randomUUID()
    const init: RequestInit & { duplex?: 'half' } = {
      method,
      headers: requestHeaders,
      redirect: 'manual',
      cache: 'no-store',
    }

    if (method !== 'GET') {
      init.body = request.body
      init.duplex = 'half'
    }

    const upstreamResponse = await fetch(targetUrl, init)
    const responseHeaders = new Headers(upstreamResponse.headers)
    responseHeaders.set('x-correlation-id', correlationId)
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    responseHeaders.set('Pragma', 'no-cache')
    responseHeaders.set('Expires', '0')

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
  params:
    | {
        path: string[]
      }
    | Promise<{
    path: string[]
      }>
}

async function resolvePathSegments(context: RouteContext): Promise<string[]> {
  const params = await context.params
  const path = params?.path
  return Array.isArray(path) ? path : []
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const pathSegments = await resolvePathSegments(context)
  return proxy(request, pathSegments, 'GET')
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const pathSegments = await resolvePathSegments(context)
  return proxy(request, pathSegments, 'POST')
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  const pathSegments = await resolvePathSegments(context)
  return proxy(request, pathSegments, 'PUT')
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  const pathSegments = await resolvePathSegments(context)
  return proxy(request, pathSegments, 'PATCH')
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const pathSegments = await resolvePathSegments(context)
  return proxy(request, pathSegments, 'DELETE')
}
