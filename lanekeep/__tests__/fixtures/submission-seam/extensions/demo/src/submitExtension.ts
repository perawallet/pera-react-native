export const send = (algod: any, bytes: Uint8Array) =>
    algod.sendRawTransaction(bytes)
