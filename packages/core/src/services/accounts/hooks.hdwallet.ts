import type { HDWalletDetails } from './types'
import {
    BIP32DerivationTypes,
    type BIP32DerivationType,
    Encodings,
    fromSeed,
    KeyContexts,
    XHDWalletAPI,
} from '@perawallet/xhdwallet'
import * as bip39 from 'bip39'
import messageSchema from './schema/message-schema.json'

const api = new XHDWalletAPI()

const HD_PURPOSE = 44
const HD_COIN_TYPE = 283
const HD_MNEMONIC_LENGTH = 256


const createPath = (account: number, keyIndex: number) => {
    //m / purpose (bip44) / coin type (algorand) / account / change / address index
    return [HD_PURPOSE, HD_COIN_TYPE, account, 0, keyIndex]
}

//TODO use a specific word list here
const generateMasterKey = async (mnemonic?: string) => {
    const storableMnemonic = mnemonic ?? bip39.generateMnemonic(HD_MNEMONIC_LENGTH)
    const seed = await bip39.mnemonicToSeed(storableMnemonic)
    const entropy = await bip39.mnemonicToEntropy(storableMnemonic)
    return {
        seed,
        entropy
    }
}

const entropyToMnemonic = (entropy: Buffer) => {
    return bip39.entropyToMnemonic(entropy)
}

const deriveKey = async ({
    seed,
    account = 0,
    keyIndex = 0,
    derivationType = BIP32DerivationTypes.Peikert,
}: {
    seed: Buffer
    account?: number
    keyIndex?: number
    derivationType?: BIP32DerivationType
}) => {
    const rootKey = fromSeed(seed)
    const path = createPath(account, keyIndex)
    const key = await api.deriveKey(rootKey, path, true, derivationType)
    const address = await api.keyGen(
        rootKey,
        KeyContexts.Address,
        account,
        keyIndex,
        derivationType,
    )
    return {
        address: address,
        privateKey: key,
    }
}

const signTransaction = (
    seed: Buffer,
    hdWalletDetails: HDWalletDetails,
    transaction: Buffer,
) => {
    const rootKey = fromSeed(seed)
    return api.signAlgoTransaction(
        rootKey,
        KeyContexts.Address,
        hdWalletDetails.account,
        hdWalletDetails.keyIndex,
        transaction,
        BIP32DerivationTypes.Peikert,
    )
}

const signData = (
    seed: Buffer,
    hdWalletDetails: HDWalletDetails,
    data: Buffer,
) => {
    const rootKey = fromSeed(seed)
    const metadata = {
        encoding: Encodings.BASE64,
        schema: messageSchema,
    }
    return api.signData(
        rootKey,
        KeyContexts.Address,
        hdWalletDetails.account,
        hdWalletDetails.keyIndex,
        data,
        metadata,
        BIP32DerivationTypes.Peikert,
    )
}

export const useHDWallet = () => ({
    generateMasterKey,
    entropyToMnemonic,
    deriveKey,
    signTransaction,
    signData,
})
