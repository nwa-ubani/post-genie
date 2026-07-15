import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getAdminOverview, isAdminCheck } from '@/lib/admin.functions'
import { supabase } from '@/integrations/supabase/client'

export const Route = createFileRoute('/_authenticated/admin')({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser()
    if (data.user?.email?.toLowerCase() !== 'a.faithnwaubani@gmail.com') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminPage,
})

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    pending: 'bg-amber-100 text-amber-800',
    draft: 'bg-gray-100 text-gray-800',
  }
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-800'}`}>{status}</span>
}

function scheduleSummary(user: any): string {
  const sched = user.posting_schedule as Record<string, string[]> | null
  if (sched && typeof sched === 'object' && Object.keys(sched).length) {
    const days = Object.keys(sched).map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Number(d)]).join(', ')
    const totalSlots = Object.values(sched).reduce((s, arr) => s + arr.length, 0)
    return `${days} · ${totalSlots} slot${totalSlots === 1 ? '' : 's'}`
  }
  const days = user.posting_days?.length ? `${user.posting_days.length} days/wk` : 'Every day'
  const times = user.posting_times?.length ?? (user.posting_time ? 1 : 0)
  return `${days} · ${times} time${times === 1 ? '' : 's'}/day`
}

function AdminPage() {
  const navigate = useNavigate()
  const fetchOverview = useServerFn(getAdminOverview)
  const checkAdmin = useServerFn(isAdminCheck)
  const [filter, setFilter] = useState<'all' | 'failed' | 'published'>('all')

  // Belt-and-suspenders server check
  useQuery({
    queryKey: ['is-admin'],
    queryFn: async () => {
      const r = await checkAdmin()
      if (!r.isAdmin) navigate({ to: '/dashboard' })
      return r
    },
  })

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => fetchOverview(),
  })

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>
  if (error) return <div className="text-sm text-red-600">Error: {(error as Error).message}</div>
  if (!data) return null

  const filteredPosts = data.posts.filter((p: any) =>
    filter === 'all' ? true : p.status === filter
  )

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl">Admin</h1>
        <p className="text-sm text-muted-foreground">All-user overview.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active users" value={data.stats.activeUsers} />
        <StatCard label="Published today" value={data.stats.publishedToday} />
        <StatCard label="Failed today" value={data.stats.failedToday} tone={data.stats.failedToday > 0 ? 'red' : undefined} />
        <StatCard label="Tokens expiring <7d" value={data.stats.expiringSoon} tone={data.stats.expiringSoon > 0 ? 'amber' : undefined} />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">Recent posts</h2>
          <div className="flex gap-2 text-sm">
            {(['all', 'failed', 'published'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded px-3 py-1 ${filter === f ? 'bg-foreground text-background' : 'bg-muted'}`}
              >{f}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">User</th>
                <th className="p-2">Type</th>
                <th className="p-2">Status</th>
                <th className="p-2">Preview / error</th>
                <th className="p-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredPosts.map((p: any) => (
                <tr key={p.id} className={`border-t ${p.status === 'failed' ? 'bg-red-50' : ''}`}>
                  <td className="p-2">{p.email ?? p.user_id.slice(0, 8)}</td>
                  <td className="p-2">{p.post_type}</td>
                  <td className="p-2"><StatusBadge status={p.status} /></td>
                  <td className="p-2 max-w-md">
                    {p.status === 'failed' && p.error ? (
                      <span className="text-red-700">{p.error}</span>
                    ) : (
                      <span className="text-muted-foreground">{(p.content ?? '').slice(0, 80)}{(p.content ?? '').length > 80 ? '…' : ''}</span>
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap text-muted-foreground">{new Date(p.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl">Users</h2>
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Active</th>
                <th className="p-2">Onboarded</th>
                <th className="p-2">Timezone</th>
                <th className="p-2">Schedule</th>
                <th className="p-2">LinkedIn</th>
                <th className="p-2">Last post</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u: any) => {
                const expiresAt = u.linkedin_expires_at ? new Date(u.linkedin_expires_at) : null
                const daysToExpire = expiresAt ? (expiresAt.getTime() - Date.now()) / 86400000 : null
                return (
                  <tr key={u.user_id} className="border-t">
                    <td className="p-2">{u.name ?? '—'}</td>
                    <td className="p-2">{u.email ?? '—'}</td>
                    <td className="p-2">{u.active ? 'Yes' : 'No'}</td>
                    <td className="p-2">{u.onboarding_complete ? 'Yes' : 'No'}</td>
                    <td className="p-2">{u.timezone ?? '—'}</td>
                    <td className="p-2 whitespace-nowrap">{scheduleSummary(u)}</td>
                    <td className="p-2 whitespace-nowrap">
                      {expiresAt ? (
                        <span className={daysToExpire !== null && daysToExpire < 7 ? 'text-red-700 font-medium' : ''}>
                          {expiresAt.toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not connected</span>
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {u.last_post ? (
                        <span className="flex items-center gap-2">
                          {new Date(u.last_post.created_at).toLocaleDateString()}
                          <StatusBadge status={u.last_post.status} />
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'red' | 'amber' }) {
  const toneClass = tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : ''
  return (
    <div className="rounded border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-display ${toneClass}`}>{value}</div>
    </div>
  )
}
