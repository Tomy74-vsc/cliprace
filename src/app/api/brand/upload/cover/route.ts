import { NextResponse } from 'next/server';
import { assertCsrf } from '@/lib/csrf';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { enforceBrandRateLimit, BRAND_LIMIT_CRITICAL } from '@/lib/brand/rate-limit';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const BUCKET_NAME = 'contest_assets';

export async function POST(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  const csrfHeader = req.headers.get('x-csrf');

  try {
    assertCsrf(cookieHeader, csrfHeader);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }

  const supabase = await getSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await enforceBrandRateLimit(req, user.id, BRAND_LIMIT_CRITICAL);

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: 'Invalid file type' },
      { status: 422 },
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: 'File too large (max 5MB)' },
      { status: 422 },
    );
  }

  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const path = `contest-covers/${user.id}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

  return NextResponse.json({ success: true, url: publicUrl });
}

