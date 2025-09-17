import type { HDWalletDetails } from './types'
import {
	BIP32DerivationType,
	Encoding,
	fromSeed,
	KeyContext,
	XHDWalletAPI
} from '@algorandfoundation/xhd-wallet-api'
import * as bip39 from 'bip39'
import messageSchema from './schema/message-schema.json'

// Services relating to HD Wallets
export const useHDWallet = () => {
	const api = new XHDWalletAPI()

	const base64EncodeKey = (key: ArrayBufferLike) => {
		const decoder = new TextDecoder()
		return Buffer.from(decoder.decode(key)).toString('base64')
	}

    const createPath = (account: number, keyIndex: number) => {
		//m / purpose (bip44) / coin type (algorand) / account / change / address index
        return [44, 283, account, 0, keyIndex]
    }

	return {
		createMnemonic: () => {
			return bip39.generateMnemonic()
		},
		deriveKey: async ({
			mnemonic,
			account = 0,
			keyIndex = 0,
			derivationType = BIP32DerivationType.Peikert,
		}: {
			mnemonic: string
			account?: number
			keyIndex?: number
			derivationType?: BIP32DerivationType
		}) => {
			const seed = bip39.mnemonicToSeedSync(mnemonic)
			const rootKey = fromSeed(seed)
			const path = createPath(account, keyIndex)
			const key = await api.deriveKey(rootKey, path, true, derivationType)
			const address = await api.keyGen(
				rootKey,
				KeyContext.Address,
				account,
				keyIndex,
				derivationType,
			)
			const base64Key = base64EncodeKey(key)
			const base64Address = base64EncodeKey(address)
			return {
				address: base64Address,
				privateKey: base64Key,
			}
		},
		mnemonicToRootKey: async (mnemonic: string) => {
			const seed = await bip39.mnemonicToSeed(mnemonic)
			return fromSeed(seed)
		},
        signTransaction: (mnemonic: string, hdWalletDetails: HDWalletDetails, transaction: Buffer) => {
			const seed = bip39.mnemonicToSeedSync(mnemonic)
			const rootKey = fromSeed(seed)
            return api.signAlgoTransaction(rootKey, KeyContext.Address, hdWalletDetails.account, hdWalletDetails.keyIndex, transaction, BIP32DerivationType.Peikert)
        },
        signData: (mnemonic: string, hdWalletDetails: HDWalletDetails, data: Buffer) => {
			const seed = bip39.mnemonicToSeedSync(mnemonic)
			const rootKey = fromSeed(seed)
            const metadata = {
                encoding: Encoding.BASE64,
                schema: messageSchema
            }
            return api.signData(rootKey, KeyContext.Address, hdWalletDetails.account, hdWalletDetails.keyIndex, data, metadata, BIP32DerivationType.Peikert)
        }
	}
}
