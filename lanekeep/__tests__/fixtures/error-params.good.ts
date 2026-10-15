export const satisfied = {
    messageKey: 'dapp.approval.request_origin',
    params: { origin: 'x' },
}

export const extraParamsAreLogContext = {
    messageKey: 'dapp.approval.request_origin',
    params: { origin: 'x', requestId: 'abc' },
}

declare const i18nKey: (key: string) => string
declare const other: (key: string) => string

export const callFormSatisfied = {
    messageKey: i18nKey('dapp.approval.request_origin'),
    params: { origin: 'x' },
}

export const otherCallIsNotAKey = {
    messageKey: other('dapp.approval.request_origin'),
}
