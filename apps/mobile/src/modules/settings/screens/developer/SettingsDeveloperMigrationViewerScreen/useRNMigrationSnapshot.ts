/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useEffect, useState } from 'react'
import {
    useAccountsStore,
    type AccountSortMode,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetPreferencesStore,
    useCollectiblePreferencesStore,
    type AssetSortMode,
    type CollectibleSortMode,
    type GalleryLayout,
} from '@perawallet/wallet-core-assets'
import {
    useContactsStore,
    type Contact,
} from '@perawallet/wallet-core-contacts'
import { useCurrenciesStore } from '@perawallet/wallet-core-currencies'
import { Networks } from '@perawallet/wallet-core-config'
import {
    useDeviceStore,
    type DeviceIdOrigin,
} from '@perawallet/wallet-core-device'
import { useNotificationsStore } from '@perawallet/wallet-core-messages'
import { withSecret } from '@perawallet/wallet-core-kms'
import {
    BIOMETRIC_BLOB_KEY_ID,
    PIN_RECORD_KEY_ID,
    parsePinRecord,
} from '@perawallet/wallet-core-security'
import {
    useSettingsStore,
    type ThemeMode,
} from '@perawallet/wallet-core-settings'
import { useSwapsStore } from '@perawallet/wallet-core-swaps'

export type RNAuthSnapshot = {
    hasPin: boolean
    pinRecordVersion: number | null
    pinRecordBytes: number | null
    hasBiometric: boolean
    biometricBytes: number | null
}

export type RNMigrationSnapshot = {
    preferences: {
        theme: ThemeMode
        currency: string
        privacyMode: boolean
        assetFilterZeroBalance: boolean
        assetFilterDisplayNFT: boolean
        assetFilterDisplayOptedInNFT: boolean
        collectibleFilterNotOwned: boolean
        nftFilterDisplayWatchAccountNFTs: boolean
        nftListingViewType: GalleryLayout
        accountSortPreference: AccountSortMode
        assetSortPreference: AssetSortMode
        collectibleSortPreference: CollectibleSortMode
        swapSlippageTolerance: number | null
        swapTermsAccepted: boolean
    }
    auth: RNAuthSnapshot
    accountsByAddress: Map<string, WalletAccount>
    manualAccountOrder: string[]
    contactsByAddress: Map<string, Contact>
    notificationDisabledAccounts: Set<string>
    deviceIDs: { mainnet: string | null; testnet: string | null }
    deviceIdOrigins: {
        mainnet: DeviceIdOrigin | null
        testnet: DeviceIdOrigin | null
    }
    legacyStash: Record<string, string | number | boolean>
}

export const useRNMigrationSnapshot = (): RNMigrationSnapshot => {
    const theme = useSettingsStore(s => s.theme)
    const privacyMode = useSettingsStore(s => s.privacyMode)
    const preferences = useSettingsStore(s => s.preferences)
    const preferredCurrency = useCurrenciesStore(s => s.preferredCurrency)
    const hideZeroBalance = useAssetPreferencesStore(s => s.hideZeroBalance)
    const displayNfts = useAssetPreferencesStore(s => s.displayNfts)
    const displayOptedInNfts = useAssetPreferencesStore(
        s => s.displayOptedInNfts,
    )
    const assetSortMode = useAssetPreferencesStore(s => s.assetSortMode)
    const showOptedIn = useCollectiblePreferencesStore(s => s.showOptedIn)
    const showWatchAccounts = useCollectiblePreferencesStore(
        s => s.showWatchAccounts,
    )
    const galleryLayout = useCollectiblePreferencesStore(s => s.galleryLayout)
    const collectibleSortMode = useCollectiblePreferencesStore(
        s => s.collectibleSortMode,
    )
    const accounts = useAccountsStore(s => s.accounts)
    const sortMode = useAccountsStore(s => s.sortMode)
    const manualAccountOrder = useAccountsStore(s => s.manualAccountOrder)
    const contacts = useContactsStore(s => s.contacts)
    const notificationDisabled = useNotificationsStore(
        s => s.notificationDisabledAccounts,
    )
    const deviceIDs = useDeviceStore(s => s.deviceIDs)
    const deviceIdOrigins = useDeviceStore(s => s.deviceIdOrigins)
    const slippage = useSwapsStore(s => s.slippage)

    const [auth, setAuth] = useState<RNAuthSnapshot>({
        hasPin: false,
        pinRecordVersion: null,
        pinRecordBytes: null,
        hasBiometric: false,
        biometricBytes: null,
    })

    useEffect(() => {
        let cancelled = false
        void (async () => {
            const pinData = await withSecret(PIN_RECORD_KEY_ID, bytes => ({
                version: parsePinRecord(bytes)?.version ?? null,
                byteLength: bytes.length,
            }))
            const biometricBytes = await withSecret(
                BIOMETRIC_BLOB_KEY_ID,
                bytes => bytes.length,
            )
            if (cancelled) return
            setAuth({
                hasPin: pinData !== null,
                pinRecordVersion: pinData?.version ?? null,
                pinRecordBytes: pinData?.byteLength ?? null,
                hasBiometric: biometricBytes !== null,
                biometricBytes: biometricBytes ?? null,
            })
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const legacyStash: Record<string, string | number | boolean> = {}
    for (const [key, value] of Object.entries(preferences)) {
        if (key.startsWith('legacy.')) legacyStash[key] = value
    }

    return {
        preferences: {
            theme,
            currency: preferredCurrency,
            privacyMode,
            assetFilterZeroBalance: hideZeroBalance,
            assetFilterDisplayNFT: displayNfts,
            assetFilterDisplayOptedInNFT: displayOptedInNfts,
            collectibleFilterNotOwned: !showOptedIn,
            nftFilterDisplayWatchAccountNFTs: showWatchAccounts,
            nftListingViewType: galleryLayout,
            accountSortPreference: sortMode,
            assetSortPreference: assetSortMode,
            collectibleSortPreference: collectibleSortMode,
            swapSlippageTolerance:
                slippage !== null &&
                slippage !== '' &&
                Number.isFinite(Number(slippage))
                    ? Number(slippage)
                    : null,
            swapTermsAccepted: !!preferences['swap-introduction-seen'],
        },
        auth,
        accountsByAddress: new Map(accounts.map(a => [a.address, a] as const)),
        manualAccountOrder,
        contactsByAddress: new Map(
            contacts.map(c => [c.address.toLowerCase(), c] as const),
        ),
        notificationDisabledAccounts: new Set(notificationDisabled),
        deviceIDs: {
            mainnet: deviceIDs.get(Networks.mainnet) ?? null,
            testnet: deviceIDs.get(Networks.testnet) ?? null,
        },
        deviceIdOrigins: {
            mainnet: deviceIdOrigins[Networks.mainnet] ?? null,
            testnet: deviceIdOrigins[Networks.testnet] ?? null,
        },
        legacyStash,
    }
}
