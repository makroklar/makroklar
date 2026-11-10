import type { NextRequest } from 'next/server';
import { updateSession } from '@/shared/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ['/business/:path*'],
};
