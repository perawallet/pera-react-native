declare const showToast: (o: { type: string; title: string }) => void
declare const showError: (e: unknown, t: string) => void
declare const risky: () => Promise<void>

export async function usesShowError(): Promise<void> {
    try {
        await risky()
    } catch (error) {
        showError(error, 'failed')
    }
}

export function successToastIsFine(): void {
    showToast({ type: 'success', title: 'done' })
}

export async function nestedFunctionResetsScope(): Promise<void> {
    try {
        await risky()
    } catch {
        const later = function reporter(): void {
            showToast({ type: 'error', title: 'not in catch scope' })
        }
        later()
    }
}
