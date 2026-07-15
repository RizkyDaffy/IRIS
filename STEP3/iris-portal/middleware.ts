import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJwt } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Public paths
  if (
    pathname.startsWith('/login') || 
    pathname.startsWith('/daftar') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('jwt')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload: any = await verifyJwt(token);

  if (!payload) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Handle PENDING queue
  if (payload.status === 'PENDING' && pathname !== '/queue') {
    return NextResponse.redirect(new URL('/queue', request.url));
  }
  
  if (payload.status === 'ACTIVE' && pathname === '/queue') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Inject user info into headers for server components if needed
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.id);
  requestHeaders.set('x-user-role', payload.role);
  requestHeaders.set('x-user-email', payload.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
