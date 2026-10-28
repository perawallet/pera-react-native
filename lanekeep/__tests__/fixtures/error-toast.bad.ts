declare const showToast: (
    o: { type: string; title: string },
    options?: { notifier?: unknown },
) => void
declare const toasts: { showToast: typeof showToast }
declare const risky: () => Promise<void>
declare const isValid: (value: string) => boolean

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

export function onValidationPath(value: string): void {
    if (!isValid(value)) {
        showToast({ type: 'error', title: 'invalid' })
    }
}

export function withOptions(): void {
    showToast({ title: 'failed', type: 'error' }, { notifier: undefined })
}

export function spreadCopy(copy: { title: string }): void {
    showToast({ ...copy, type: 'error' })
}

export function throughMember(): void {
    toasts.showToast({ type: 'error', title: 'failed' })
}

export async function nestedFunctionInCatch(): Promise<void> {
    try {
        await risky()
    } catch {
        const later = function reporter(): void {
            showToast({ type: 'error', title: 'nested' })
        }
        later()
    }
}

export function withAsConst(): void {
    showToast({ type: 'error' as const, title: 'failed' })
}
