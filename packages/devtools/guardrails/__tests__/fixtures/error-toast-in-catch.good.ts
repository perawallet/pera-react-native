declare const showToast: (opts: {
    title?: string
    body?: string
    type: string
}) => void
declare const showError: (err: unknown, fallbackTitle?: string) => void
declare const doWork: () => Promise<void>
declare const validateAddress: (addr: string) => boolean

export const usesShowErrorInCatch = async () => {
    try {
        await doWork()
    } catch (err) {
        showError(err, 'Failed')
    }
}

export const usesShowErrorInPromiseCatch = () =>
    doWork().catch(err => showError(err, 'Failed'))

export const validationErrorOutsideCatch = (addr: string) => {
    if (!validateAddress(addr)) {
        showToast({ title: 'Invalid', body: 'Bad address', type: 'error' })
    }
}

export const successToastInCatchIsFine = async () => {
    try {
        await doWork()
    } catch {
        showToast({ title: 'Recovered', body: 'all good', type: 'success' })
    }
}

export const nestedFunctionInCatchNotFlagged = async () => {
    try {
        await doWork()
    } catch {
        // The showToast lives inside an inner function defined in the catch
        // block — at the time it runs, we're not lexically inside the catch
        // anymore, so treat it like a plain non-error toast and skip.
        const later = () => {
            showToast({ title: 'Later', body: 'unrelated', type: 'error' })
        }
        later()
    }
}

export const errorTypeWithoutCatchIsFine = () => {
    showToast({
        title: 'Heads up',
        body: 'something went wrong',
        type: 'error',
    })
}
