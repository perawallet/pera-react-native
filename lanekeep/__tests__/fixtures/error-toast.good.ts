declare const showToast: (o: { type: string; title: string }) => void
declare const showError: (e: unknown, t: string) => void
declare const errorToast: (title: string, body: string) => void
declare const risky: () => Promise<void>

export async function usesShowError(): Promise<void> {
    try {
        await risky()
    } catch (error) {
        showError(error, 'failed')
    }
}

export function usesErrorToast(): void {
    errorToast('invalid', '')
}

export function successToastIsFine(): void {
    showToast({ type: 'success', title: 'done' })
}

export function warningToastIsFine(): void {
    showToast({ type: 'warning', title: 'careful' })
}
