declare const params: Record<string, unknown>
declare const base: Record<string, unknown>

export const missingParam = {
    messageKey: 'dapp.approval.request_origin',
    params: { unrelated: 1 },
}

export const noParamsAtAll = {
    messageKey: 'dapp.approval.request_origin',
}

export const shorthandIsUnverifiable = {
    messageKey: 'dapp.approval.request_origin',
    params,
}

export const containerSpreadIsUnverifiable = {
    ...base,
    messageKey: 'dapp.approval.request_origin',
}

export const paramsSpreadIsUnverifiable = {
    messageKey: 'dapp.approval.request_origin',
    params: { ...base },
}
