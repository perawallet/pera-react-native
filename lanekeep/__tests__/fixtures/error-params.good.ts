declare const params: Record<string, unknown>
declare const base: Record<string, unknown>

export const satisfied = {
    messageKey: 'dapp.enable.peer_origin_claim',
    params: { origin: 'x' },
}

export const extraParamsAreLogContext = {
    messageKey: 'dapp.enable.peer_origin_claim',
    params: { origin: 'x', requestId: 'abc' },
}

export const shorthandIsUnverifiable = {
    messageKey: 'dapp.enable.peer_origin_claim',
    params,
}

export const spreadIsUnverifiable = {
    ...base,
    messageKey: 'dapp.enable.peer_origin_claim',
}
