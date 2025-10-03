import { useAppStore } from '../../store'
import { useSecureStorageService } from '../storage'
import type { WalletAccount } from './types'
import { BIP32DerivationTypes } from '@perawallet/xhdwallet'
import { v7 as uuidv7 } from 'uuid'
import { useHDWallet } from './hooks.hdwallet'
import { decodeFromBase64, encodeToBase64 } from '../../utils/strings'
import { encodeAlgorandAddress } from '../blockchain'
import { useLookupAccountByID } from '../../api/generated/indexer'
import {
    useV1AssetsList,
    useV1DevicesPartialUpdate,
    type AssetSerializerResponse,
} from '../../api/generated/backend'
import Decimal from 'decimal.js'
import { useDeviceInfoService } from '../device'

// Services relating to locally stored accounts
export const useAllAccounts = () => {
    const accounts = useAppStore(state => state.accounts)
    return accounts
}

export const useHasAccounts = () => {
    const accounts = useAppStore(state => state.accounts)
    return !!accounts?.length
}

export const useHasNoAccounts = () => {
    const accounts = useAppStore(state => state.accounts)
    return !accounts?.length
}

export const useFindAccountbyAddress = (address: string) => {
    const accounts = useAppStore(state => state.accounts)
    return accounts.find(a => a.address === address) ?? null
}

export const useCreateAccount = () => {
    const accounts = useAppStore(state => state.accounts)
    const { createMnemonic, deriveKey } = useHDWallet()
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)
    const deviceID = useAppStore(state => state.deviceID)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useV1DevicesPartialUpdate()

    return async ({
        walletId,
        account,
        keyIndex,
    }: {
        walletId?: string
        account: number
        keyIndex: number
    }) => {
        const rootWalletId = walletId ?? uuidv7()
        const rootKeyLocation = `rootkey-${rootWalletId}`
        let mnemonic = await secureStorage.getItem(rootKeyLocation)
        if (!mnemonic) {
            const generatedMnemonic = createMnemonic()
            const base64Mnemonic = encodeToBase64(
                Buffer.from(generatedMnemonic),
            )
            await secureStorage.setItem(rootKeyLocation, base64Mnemonic)
            mnemonic = base64Mnemonic
        }

        const { address, privateKey } = await deriveKey({
            mnemonic: decodeFromBase64(mnemonic).toString(),
            account,
            keyIndex,
            derivationType: BIP32DerivationTypes.Peikert,
        })

        const id = uuidv7()
        const keyStoreLocation = `pk-${id}`
        await secureStorage.setItem(
            keyStoreLocation,
            encodeToBase64(privateKey),
        )
        const newAccount: WalletAccount = {
            id: uuidv7(),
            address: encodeAlgorandAddress(address),
            type: 'standard',
            hdWalletDetails: {
                walletId: rootWalletId,
                account: account,
                change: 0,
                keyIndex: keyIndex,
                derivationType: BIP32DerivationTypes.Peikert,
            },
            privateKeyLocation: keyStoreLocation,
        }

        accounts.push(newAccount)
        setAccounts([...accounts])

        if (deviceID) {
            updateDeviceOnBackend({
                device_id: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
        return newAccount
    }
}

export const useImportWallet = () => {
    const accounts = useAppStore(state => state.accounts)
    const { deriveKey } = useHDWallet()
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)
    const deviceID = useAppStore(state => state.deviceID)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useV1DevicesPartialUpdate()

    return async ({
        walletId,
        mnemonic,
    }: {
        walletId?: string
        mnemonic: string
    }) => {
        const rootWalletId = walletId ?? uuidv7()
        const rootKeyLocation = `rootkey-${rootWalletId}`
        const base64Mnemonic = encodeToBase64(Buffer.from(mnemonic))
        secureStorage.setItem(rootKeyLocation, base64Mnemonic)

        //TODO: we currently just create the 0/0 account but we really should scan the blockchain
        //and look for accounts that might match (see old app logic - we want to scan iteratively
        //until we find 5 empty keyindexes and 5 empty accounts (I think)
        const { address, privateKey } = await deriveKey({
            mnemonic: mnemonic,
            account: 0,
            keyIndex: 0,
            derivationType: BIP32DerivationTypes.Peikert,
        })

        const id = uuidv7()
        const keyStoreLocation = `pk-${id}`
        await secureStorage.setItem(
            keyStoreLocation,
            encodeToBase64(privateKey),
        )
        const newAccount: WalletAccount = {
            id: uuidv7(),
            address: encodeAlgorandAddress(address),
            type: 'standard',
            hdWalletDetails: {
                walletId: rootWalletId,
                account: 0,
                change: 0,
                keyIndex: 0,
                derivationType: BIP32DerivationTypes.Peikert,
            },
            privateKeyLocation: keyStoreLocation,
        }

        accounts.push(newAccount)
        setAccounts([...accounts])

        if (deviceID) {
            updateDeviceOnBackend({
                device_id: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
        return newAccount
    }
}

export const useUpdateAccount = () => {
    const accounts = useAppStore(state => state.accounts)
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)
    const deviceID = useAppStore(state => state.deviceID)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useV1DevicesPartialUpdate()

    return (account: WalletAccount, privateKey?: string) => {
        const index =
            accounts.findIndex(a => a.address === account.address) ?? null
        accounts[index] = account
        setAccounts([...accounts])

        if (privateKey) {
            const storageKey = `pk-${account.address}`
            secureStorage.setItem(storageKey, privateKey)
        }

        if (deviceID) {
            updateDeviceOnBackend({
                device_id: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
    }
}

export const useAddAccount = () => {
    const accounts = useAppStore(state => state.accounts)
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)
    const deviceID = useAppStore(state => state.deviceID)
    const deviceInfo = useDeviceInfoService()
    const { mutateAsync: updateDeviceOnBackend } = useV1DevicesPartialUpdate()

    return (account: WalletAccount, privateKey?: string) => {
        accounts.push(account)
        setAccounts([...accounts])

        if (privateKey) {
            const storageKey = `pk-${account.address}`
            secureStorage.setItem(storageKey, privateKey)
        }

        if (deviceID) {
            updateDeviceOnBackend({
                device_id: deviceID,
                data: {
                    platform: deviceInfo.getDevicePlatform(),
                    accounts: accounts.map(a => a.address),
                },
            })
        }
    }
}

export const useRemoveAccountById = () => {
    const accounts = useAppStore(state => state.accounts)
    const secureStorage = useSecureStorageService()
    const setAccounts = useAppStore(state => state.setAccounts)

    return (id: string) => {
        const account = accounts.find(a => a.id === id)
        if (account && account.privateKeyLocation) {
            const storageKey = `pk-${account.address}`
            secureStorage.removeItem(storageKey)
        }
        const remaining = accounts.filter(a => a.id !== id)
        setAccounts([...remaining])
    }
}

export const useAccountBalances = (account: WalletAccount) => {
    //TODO: this may need to be revisited - not sure if the react query hooks will cause a rerender form in here
    //when something changes, and if not, the calculations will not work correctly
    const { data: accountInfo, isPending } = useLookupAccountByID(
        {
            accountId: account.id ?? '',
            params: {
                exclude: ['created-apps', 'created-assets'],
            },
        },
        {
            query: {
                enabled: !!account.id,
                notifyOnChangeProps: ['data', 'isPending'],
            },
        },
    )

    const { data: assetDetails } = useV1AssetsList(
        {
            params: {
                asset_ids: [
                    '0',
                    accountInfo?.account.assets?.map(a =>
                        a['asset-id'].toString(),
                    ),
                ].join(','),
            },
        },
        {
            query: {
                enabled: !!accountInfo?.account.assets?.length && !isPending,
                notifyOnChangeProps: ['data', 'isPending'],
            },
        },
    )

    const assetDetailsMap = new Map<number, AssetSerializerResponse>()
    assetDetails?.results.forEach(a => {
        assetDetailsMap.set(a.asset_id, a)
    })
    const algoAsset = assetDetailsMap.get(0)

    let usdAmount = Decimal(0)
    accountInfo?.account.assets?.map(a => {
        const asset = assetDetailsMap.get(a['asset-id'])
        if (asset) {
            usdAmount = usdAmount.plus(
                Decimal(asset.usd_value ?? 0)
                    .times(Decimal(a.amount))
                    .div(10 ** asset.fraction_decimals),
            )
        }
    })

    if (algoAsset) {
        const microalgos = Decimal(
            accountInfo?.account.amount.microAlgos().microAlgos ?? 0,
        )
        usdAmount = usdAmount.plus(
            Decimal(algoAsset.usd_value ?? 0)
                .times(Decimal(microalgos))
                .div(10 ** algoAsset.fraction_decimals),
        )
    }

    if (!usdAmount || usdAmount?.equals(0)) {
        return {
            usdAmount: Decimal(usdAmount),
            algoAmount: Decimal(
                accountInfo?.account?.amount?.microAlgos().microAlgos ?? 0,
            ).div(10 ** 6),
        }
    }

    let algoAmount = Decimal(0)
    if (algoAsset) {
        algoAmount = usdAmount.div(Decimal(algoAsset.usd_value ?? 0))
    }

    return {
        algoAmount,
        usdAmount,
    }
}
