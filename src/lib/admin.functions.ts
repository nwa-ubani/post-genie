import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const ADMIN_EMAIL = 'a.faithnwaubani@gmail.com'

async function assertAdmin(context: { supabase: any; claims: any; userId: string }) {
  const email = (context.claims?.email as string | undefined)?.toLowerCase()
  if (email !== ADMIN_EMAIL) throw new Error('Forbidden')
}

export const getAdminOverview = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context)
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)
    const startIso = startOfDay.toISOString()
    const in7Days = new Date(Date.now() + 7 * 86400000).toISOString()

    const [postsRes, profilesRes, tokensRes, publishedTodayRes, failedTodayRes, activeUsersRes, expiringSoonRes] = await Promise.all([
      supabaseAdmin
        .from('posts')
        .select('id, user_id, post_type, status, content, error, created_at, published_at')
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('profiles')
        .select('user_id, name, active, onboarding_complete, timezone, posting_schedule, posting_days, posting_times, posting_time')
        .order('name', { ascending: true }),
      supabaseAdmin
        .from('linkedin_tokens')
        .select('user_id, expires_at'),
      supabaseAdmin
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .gte('published_at', startIso),
      supabaseAdmin
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('created_at', startIso),
      supabaseAdmin
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('active', true),
      supabaseAdmin
        .from('linkedin_tokens')
        .select('user_id', { count: 'exact', head: true })
        .lte('expires_at', in7Days)
        .gt('expires_at', new Date().toISOString()),
    ])

    // Attach emails from auth.users
    const userIds = new Set<string>()
    ;(postsRes.data ?? []).forEach((p: any) => userIds.add(p.user_id))
    ;(profilesRes.data ?? []).forEach((p: any) => userIds.add(p.user_id))

    const emails: Record<string, string> = {}
    // getUserById is fine for a small admin dashboard
    await Promise.all(
      Array.from(userIds).map(async (uid) => {
        try {
          const { data } = await supabaseAdmin.auth.admin.getUserById(uid)
          if (data?.user?.email) emails[uid] = data.user.email
        } catch {}
      })
    )

    // Last post per user
    const lastPostByUser: Record<string, { created_at: string; status: string }> = {}
    ;(postsRes.data ?? []).forEach((p: any) => {
      if (!lastPostByUser[p.user_id]) lastPostByUser[p.user_id] = { created_at: p.created_at, status: p.status }
    })

    const tokenByUser: Record<string, string> = {}
    ;(tokensRes.data ?? []).forEach((t: any) => {
      if (t.expires_at) tokenByUser[t.user_id] = t.expires_at
    })

    return {
      posts: (postsRes.data ?? []).map((p: any) => ({
        ...p,
        email: emails[p.user_id] ?? null,
      })),
      users: (profilesRes.data ?? []).map((p: any) => ({
        ...p,
        email: emails[p.user_id] ?? null,
        linkedin_expires_at: tokenByUser[p.user_id] ?? null,
        last_post: lastPostByUser[p.user_id] ?? null,
      })),
      stats: {
        activeUsers: activeUsersRes.count ?? 0,
        publishedToday: publishedTodayRes.count ?? 0,
        failedToday: failedTodayRes.count ?? 0,
        expiringSoon: expiringSoonRes.count ?? 0,
      },
    }
  })

export const isAdminCheck = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims?.email as string | undefined)?.toLowerCase()
    return { isAdmin: email === ADMIN_EMAIL, email: email ?? null }
  })
