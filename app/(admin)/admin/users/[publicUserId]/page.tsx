import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { requireRole } from "@/lib/session"
import { platformCan } from "@/lib/access/page"
import { getUserDetail, DETAIL_ACTIVITY, DETAIL_SESSIONS } from "@/lib/admin-user-detail"
import { assignmentPlace, assignmentState, sessionState } from "@/lib/user-detail"
import { USER_STATUS_LABEL, type UserStatusValue } from "@/lib/user-status"
import { describeActivity } from "@/lib/activity-format"
import { daysLeft } from "@/lib/account-deletion"
import { timeAgo } from "@/lib/time-ago"
import { Role } from "@/app/generated/prisma/enums"
import { checkTarget } from "@/lib/impersonation"
import ViewAsButton from "@/components/admin/ViewAsButton"

export const metadata: Metadata = { title: "User" }

const card = "rounded-xl border border-zinc-200 bg-white p-5"
const heading = "text-sm font-semibold text-zinc-900"
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—")

export default function AdminUserDetailPage({ params }: { params: Promise<{ publicUserId: string }> }) {
    return (
        <div className="space-y-6">
            <Link href="/admin/users" className="text-sm text-zinc-500 hover:text-zinc-900">← All users</Link>
            <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-200" />}>
                <Detail params={params} />
            </Suspense>
        </div>
    )
}

async function Detail({ params }: { params: Promise<{ publicUserId: string }> }) {
    await connection()
    const me = await requireRole([Role.ADMIN])
    const perms = await platformCan(["user.account.view", "impersonation.session.start_readonly"] as const)
    if (!perms["user.account.view"]) {
        return <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">You do not have access to user accounts.</p>
    }
    const { publicUserId } = await params
    const u = await getUserDetail(publicUserId)
    if (!u) notFound()

    const status = u.status as UserStatusValue
    // "View as" is offered only when the route would accept it (the route checks again)
    const canView =
        perms["impersonation.session.start_readonly"] &&
        checkTarget(me.id ?? "", { id: u.id, status: u.status, role: u.role, deletedAt: u.deletedAt, hasPlatformRole: u.assignments.some((a) => a.scope === "PLATFORM") }).ok
    const now = new Date()
    const facts: [string, string][] = [
        ["Email", u.email],
        ["Phone", u.phone ?? "—"],
        ["Role (dashboard)", u.role],
        ["Email verified", u.emailVerified ? day(u.emailVerified) : "No"],
        ["Password sign-in", u.hasPassword ? "Yes" : "No (not set, or a reset is pending)"],
        ["Password changed", day(u.passwordChangedAt)],
        ["Joined", day(u.createdAt)],
        ["Last sign-in", u.lastLoginAt ? timeAgo(u.lastLoginAt, now) : "—"],
        ["Terms accepted", u.termsAcceptedAt ? `${day(u.termsAcceptedAt)}${u.termsVersion ? ` (version ${u.termsVersion})` : ""}` : "Not recorded"],
        ["Language / time zone", [u.locale, u.timezone].filter(Boolean).join(" / ") || "—"],
    ]

    return (
        <>
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{u.name || u.email}</h1>
                <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">{USER_STATUS_LABEL[status]}</span>
                {u.deletedAt && <span className="inline-flex rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white">Anonymised</span>}
                {canView && <div className="ml-auto"><ViewAsButton publicUserId={u.publicUserId} name={u.name || u.email} /></div>}
            </div>

            {(status === "SUSPENDED" || status === "BANNED") && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {status === "BANNED" ? "Banned" : "Suspended"}{u.suspendedReason ? `: ${u.suspendedReason}` : ""}. Lift it from the Users list.
                </p>
            )}
            {status === "PENDING_DELETION" && u.deletionRequestedAt && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Asked to delete the account on {day(u.deletionRequestedAt)}. It is erased in {daysLeft(u.deletionRequestedAt, now)} day(s) unless they sign in first.
                </p>
            )}

            <section className={card}>
                <h2 className={heading}>Profile</h2>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {facts.map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 border-b border-zinc-100 py-1.5">
                            <dt className="text-zinc-500">{k}</dt>
                            <dd className="text-right text-zinc-900 break-all">{v}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            <section className={card}>
                <h2 className={heading}>Roles</h2>
                {u.assignments.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500">No team or staff roles.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                        {u.assignments.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                <span className="text-zinc-900">{a.role.name} <span className="text-zinc-500">at {assignmentPlace(a)}</span></span>
                                <span className="text-xs text-zinc-500">{assignmentState(a, now)}{a.expiresAt ? `, until ${day(a.expiresAt)}` : ""}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className={card}>
                <h2 className={heading}>Shops applied for</h2>
                {u.shops.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500">None.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                        {u.shops.map((s) => (
                            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                                <span className="text-zinc-900">{s.name}</span>
                                <span className="text-xs text-zinc-500">{s.status.charAt(0) + s.status.slice(1).toLowerCase()}, {day(s.createdAt)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className={card}>
                <h2 className={heading}>Sign-in sessions <span className="font-normal text-zinc-400">(latest {DETAIL_SESSIONS})</span></h2>
                {u.sessions.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500">No sessions.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                        {u.sessions.map((s) => (
                            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                <span className="text-zinc-900">
                                    {s.deviceLabel ?? "Web browser"}
                                    {s.ip && <span className="ml-2 text-xs text-zinc-400">{s.ip}</span>}
                                </span>
                                <span className="text-xs text-zinc-500">
                                    {sessionState(s) === "open" ? `Open, active ${timeAgo(s.lastActiveAt, now)}` : `Ended ${timeAgo(s.revokedAt!, now)}`}
                                    {" · signed in "}{day(s.createdAt)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className={card}>
                <h2 className={heading}>Account activity <span className="font-normal text-zinc-400">(latest {DETAIL_ACTIVITY})</span></h2>
                {u.activity.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500">Nothing recorded.</p>
                ) : (
                    <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                        {u.activity.map((row) => {
                            const line = describeActivity(row)
                            return (
                                <li key={row.id} className="py-2">
                                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                                        <span className="text-zinc-900">{line.title}</span>
                                        <span className="text-xs text-zinc-400" title={row.createdAt.toISOString()}>{timeAgo(row.createdAt, now)}</span>
                                    </div>
                                    {line.detail && <p className="text-xs text-zinc-500">{line.detail}</p>}
                                    <p className="text-xs text-zinc-400">
                                        {row.actorName ?? "System"}{row.actorRole ? ` (${row.actorRole})` : ""}
                                        {row.onBehalfOfId ? ", acting as someone else" : ""}
                                    </p>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>
        </>
    )
}
