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

const createPath = (account: number, keyIndex: number) => {
	//m / purpose (bip44) / coin type (algorand) / account / change / address index
	return [44, 283, account, 0, keyIndex]
}

const createMnemonic = () => {
	return bip39.generateMnemonic(256)
}

const deriveKey = async ({
	mnemonic,
	account = 0,
	keyIndex = 0,
	derivationType = BIP32DerivationTypes.Peikert,
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

const mnemonicToRootKey = async (mnemonic: string) => {
	const seed = await bip39.mnemonicToSeed(mnemonic)
	return fromSeed(seed)
}

const signTransaction = (
	mnemonic: string,
	hdWalletDetails: HDWalletDetails,
	transaction: Buffer,
) => {
	const seed = bip39.mnemonicToSeedSync(mnemonic)
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
	mnemonic: string,
	hdWalletDetails: HDWalletDetails,
	data: Buffer,
) => {
	const seed = bip39.mnemonicToSeedSync(mnemonic)
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
	createMnemonic,
	deriveKey,
	mnemonicToRootKey,
	signTransaction,
	signData,
})
