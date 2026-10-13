export const viaAlgod = (algod: any, bytes: Uint8Array) =>
    algod.sendRawTransaction(bytes).do()
export const viaHelper = (client: any, bytes: Uint8Array[]) =>
    submitRawSignedTransactionGroup(client, bytes)
import { submitSignedTransactionGroup } from '@perawallet/wallet-core-chain-algorand/signing'
export const { sendRawTransaction } = {} as any
