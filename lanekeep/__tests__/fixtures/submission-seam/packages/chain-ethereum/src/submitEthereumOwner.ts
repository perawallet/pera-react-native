export const submit = (client: any, hex: string) =>
    client.sendRawTransaction({ serializedTransaction: hex })
