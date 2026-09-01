declare const params: Record<string, unknown>
declare const base: Record<string, unknown>

export const missingParam = {
    messageKey: 'dapp.enable.peer_origin_claim',
    params: { unrelated: 1 },
}

export const noParamsAtAll = {
    messageKey: 'dapp.enable.peer_origin_claim',
}

export const shorthandIsUnverifiable = {
    messageKey: 'dapp.enable.peer_origin_claim',
    params,
}

export const containerSpreadIsUnverifiable = {
    ...base,
    messageKey: 'dapp.enable.peer_origin_claim',
}

export const paramsSpreadIsUnverifiable = {
    messageKey: 'dapp.enable.peer_origin_claim',
    params: { ...base },
}
