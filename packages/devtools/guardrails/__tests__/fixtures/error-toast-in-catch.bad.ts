declare const showToast: (opts: {
    title?: string
    body?: string
    type: string
}) => void
declare const doWork: () => Promise<void>

export const inCatchClause = async () => {
    try {
        await doWork()
    } catch (err) {
        showToast({ title: 'Failed', body: String(err), type: 'error' })
    }
}

export const inPromiseCatch = () => {
    doWork().catch(err => {
        showToast({ title: 'Failed', body: String(err), type: 'error' })
    })
}

export const inPromiseCatchExpression = () =>
    doWork().catch(err =>
        showToast({ title: 'Failed', body: String(err), type: 'error' }),
    )

export const inNestedBlockInCatch = async () => {
    try {
        await doWork()
    } catch (err) {
        if (err) {
            showToast({ title: 'Failed', body: 'oops', type: 'error' })
        }
    }
}
