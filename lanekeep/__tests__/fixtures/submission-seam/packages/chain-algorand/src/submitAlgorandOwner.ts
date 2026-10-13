export const submit = (algod: any, bytes: Uint8Array) =>
    algod.sendRawTransaction(bytes).do()
