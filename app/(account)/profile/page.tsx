"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

type SessionRow = {
    id: string
    deviceLabel: string
    userAgent: string | null
    ip: string | null
    createdAt: string
    lastActiveAt: string
    isCurrent: boolean
}

export default function ProfilePage() {
    const { data: session, update } = useSession()
    const [name, setName] = useState("")
    const [phone, setPhone] = useState("")
    const [email, setEmail] = useState("")
    const [profileLoading, setProfileLoading] = useState(true)
    const [profileMsg, setProfileMsg] = useState("")
    const [profileError, setProfileError] = useState("")

    // Password
    const [currentPassword, setCurrentPassword] = useState("")
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [pwLoading, setPwLoading] = useState(false)
    const [pwError, setPwError] = useState("")
    const [showRevokeModal, setShowRevokeModal] = useState(false)

    // Sessions
    const [sessions, setSessions] = useState<SessionRow[]>([])
    const [sessionsLoading, setSessionsLoading] = useState(true)

    // Forgot while logged in
    const [resetEmailSent, setResetEmailSent] = useState(false)
    const [resetLoading, setResetLoading] = useState(false)

    useEffect(() => {
        async function load() {
            try {
                const [profileRes, sessionsRes] = await Promise.all([
                    fetch("/api/profile"),
                    fetch("/api/profile/sessions"),
                ])
                const profileData = await profileRes.json()
                const sessionsData = await sessionsRes.json()

                if (profileData.user) {
                    setName(profileData.user.name || "")
                    setPhone(profileData.user.phone || "")
                    setEmail(profileData.user.email || "")
                }
                if (sessionsData.sessions) {
                    setSessions(sessionsData.sessions)
                }
            } catch {
                setProfileError("Failed to load profile")
            } finally {
                setProfileLoading(false)
                setSessionsLoading(false)
            }
        }
        load()
    }, [])

    async function handleSaveProfile(e: React.FormEvent) {
        e.preventDefault()
        setProfileMsg("")
        setProfileError("")
        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, phone }),
            })
            const data = await res.json()
            if (!res.ok) {
                setProfileError(data.error || "Failed to update")
                return
            }
            setProfileMsg("Profile updated")
            await update() // refresh session name if needed
        } catch {
            setProfileError("Something went wrong")
        }
    }

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault()
        setPwError("")

        if (newPassword !== confirmPassword) {
            setPwError("New passwords do not match")
            return
        }
        if (newPassword.length < 6) {
            setPwError("Password must be at least 6 characters")
            return
        }

        setPwLoading(true)
        try {
            const res = await fetch("/api/profile/password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            })
            const data = await res.json()
            if (!res.ok) {
                setPwError(data.error || "Failed to change password")
                return
            }
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            setShowRevokeModal(true)
        } catch {
            setPwError("Something went wrong")
        } finally {
            setPwLoading(false)
        }
    }

    async function handleRevokeOthers() {
        try {
            await fetch("/api/profile/sessions/revoke-others", { method: "POST" })
            // Refresh sessions list
            const res = await fetch("/api/profile/sessions")
            const data = await res.json()
            if (data.sessions) setSessions(data.sessions)
        } catch {
            // ignore
        } finally {
            setShowRevokeModal(false)
        }
    }

    async function handleSendResetLink() {
        if (!email) return
        setResetLoading(true)
        setResetEmailSent(false)
        try {
            await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })
            setResetEmailSent(true)
        } catch {
            // still show success-style message to avoid enumeration
            setResetEmailSent(true)
        } finally {
            setResetLoading(false)
        }
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleString()
    }

    if (profileLoading) {
        return <p className="text-sm text-zinc-500">Loading profile...</p>
    }

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                    Profile
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                    Manage your account details and security
                </p>
            </div>

            {/* Basic info */}
            <section className="rounded-xl border border-zinc-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-zinc-900 mb-4">
                    Account information
                </h2>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-zinc-700">
                            Email
                        </label>
                        <input
                            type="email"
                            disabled
                            value={email}
                            className="w-full h-11 px-3.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-500 text-[15px]"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-zinc-700">
                            Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-zinc-700">
                            Phone
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+216 ..."
                            className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                        />
                    </div>
                    {profileMsg && (
                        <p className="text-sm text-emerald-600">{profileMsg}</p>
                    )}
                    {profileError && (
                        <p className="text-sm text-red-600">{profileError}</p>
                    )}
                    <button
                        type="submit"
                        className="h-10 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800"
                    >
                        Save changes
                    </button>
                </form>
            </section>

            {/* Change password */}
            <section className="rounded-xl border border-zinc-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-zinc-900 mb-1">
                    Change password
                </h2>
                <p className="text-xs text-zinc-500 mb-4">
                    Enter your current password and choose a new one.
                </p>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-zinc-700">
                            Current password
                        </label>
                        <input
                            type="password"
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-zinc-700">
                            New password
                        </label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-zinc-700">
                            Confirm new password
                        </label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full h-11 px-3.5 rounded-lg border border-zinc-250 bg-white text-zinc-900 text-[15px] focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
                        />
                    </div>
                    {pwError && <p className="text-sm text-red-600">{pwError}</p>}
                    <button
                        type="submit"
                        disabled={pwLoading}
                        className="h-10 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
                    >
                        {pwLoading ? "Updating..." : "Update password"}
                    </button>
                </form>

                <div className="mt-6 pt-5 border-t border-zinc-100">
                    <p className="text-sm text-zinc-600 mb-2">
                        Forgot your current password?
                    </p>
                    <button
                        type="button"
                        onClick={handleSendResetLink}
                        disabled={resetLoading}
                        className="text-sm font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-600 disabled:opacity-50"
                    >
                        {resetLoading ? "Sending..." : "Send a reset link to my email"}
                    </button>
                    {resetEmailSent && (
                        <p className="mt-2 text-xs text-emerald-600">
                            If the email exists, a reset link was sent. In development check the
                            server console. You can use the link without logging out.
                        </p>
                    )}
                </div>
            </section>

            {/* Active sessions */}
            <section className="rounded-xl border border-zinc-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-zinc-900 mb-1">
                    Active sessions
                </h2>
                <p className="text-xs text-zinc-500 mb-4">
                    Devices where you are currently logged in
                </p>
                {sessionsLoading ? (
                    <p className="text-sm text-zinc-500">Loading sessions...</p>
                ) : sessions.length === 0 ? (
                    <p className="text-sm text-zinc-500">No active sessions found.</p>
                ) : (
                    <ul className="divide-y divide-zinc-100">
                        {sessions.map((s) => (
                            <li
                                key={s.id}
                                className="py-3 flex items-start justify-between gap-4"
                            >
                                <div>
                                    <p className="text-sm font-medium text-zinc-900">
                                        {s.deviceLabel}
                                        {s.isCurrent && (
                                            <span className="ml-2 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                This device
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        Last active: {formatDate(s.lastActiveAt)}
                                    </p>
                                    <p className="text-xs text-zinc-400">
                                        Signed in: {formatDate(s.createdAt)}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Modal: revoke other sessions after password change */}
            {showRevokeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-zinc-900">
                            Password updated
                        </h3>
                        <p className="mt-2 text-sm text-zinc-600">
                            Do you want to log out all other devices? This device will stay
                            signed in.
                        </p>
                        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setShowRevokeModal(false)}
                                className="h-10 px-4 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                            >
                                Keep other sessions
                            </button>
                            <button
                                type="button"
                                onClick={handleRevokeOthers}
                                className="h-10 px-4 rounded-lg bg-zinc-900 text-sm font-medium text-white hover:bg-zinc-800"
                            >
                                Log out other devices
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}