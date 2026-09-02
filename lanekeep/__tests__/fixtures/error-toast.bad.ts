declare const showToast: (o: { type: string; title: string }) => void
declare const risky: () => Promise<void>

export async function inTryCatch(): Promise<void> {
    try {
        await risky()
    } catch {
        showToast({ type: 'error', title: 'failed' })
    }
}

export function inCatchCallback(): void {
    void risky().catch(() => {
        showToast({ type: 'error', title: 'failed' })
    })
}
