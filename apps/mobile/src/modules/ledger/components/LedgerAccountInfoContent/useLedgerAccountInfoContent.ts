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

import { useMemo } from 'react'
import { Decimal } from 'decimal.js'
import {
    useLedgerAccountPreview,
    AccountTypes,
    type AssetWithAccountBalance,
    type WalletAccount,
    type HardwareWalletAccount,
    type WatchAccount,
} from '@perawallet/wallet-core-accounts'
import type { AccountDisplayState } from '@modules/accounts/components/AccountIcon'
import { useLanguage } from '@hooks/useLanguage'

export type LedgerInfoListItem =
    | { kind: 'sectionHeader'; key: string; title: string }
    | {
          kind: 'account'
          key: string
          account: WalletAccount
          algoBalance: Decimal
          algoUsdPrice: Decimal
          // Forced because the synth account isn't yet in the store, so
          // AccountIcon can't derive signability from canSignWith.
          displayStateOverride?: AccountDisplayState
      }
    | {
          kind: 'asset'
          key: string
          accountBalance: AssetWithAccountBalance
          usdPrice: Decimal
          /** False when metadata is missing — the row shows no balance. */
          hasKnownDecimals: boolean
      }
    | {
          kind: 'rekeyAddress'
          key: string
          account: WalletAccount
          displayStateOverride?: AccountDisplayState
      }

type UseLedgerAccountInfoContentResult = {
    title: string
    items: LedgerInfoListItem[]
    isLoading: boolean
    isError: boolean
    refetch: () => void
}

export const useLedgerAccountInfoContent = (
    address: string,
    accountIndex: number,
    /** When provided, used as the sheet title instead of the default `Ledger #N` label. */
    titleOverride?: string,
): UseLedgerAccountInfoContentResult => {
    const { t } = useLanguage()
    const { preview, isLoading, isError, refetch } =
        useLedgerAccountPreview(address)

    const items = useMemo<LedgerInfoListItem[]>(() => {
        if (!preview) return []

        // Build the synth account for the sheet's own address.
        // If the account is rekeyed to an auth address, render it as a watch
        // account with rekeyAddress set. Otherwise render it as a hardware
        // Ledger account so AccountDisplay/AccountIcon show the correct icon.
        const synthAccount: WalletAccount =
            preview.rekey.kind === 'rekeyedTo'
                ? ({
                      // Display-only synth account, keyed by its address.
                      id: preview.address,
                      type: AccountTypes.watch,
                      address: preview.address,
                      rekeyAddress: preview.rekey.authAddress,
                  } satisfies WatchAccount)
                : ({
                      id: preview.address,
                      type: AccountTypes.hardware,
                      address: preview.address,
                      hardwareDetails: {
                          manufacturer: 'ledger',
                          deviceId: '',
                          deviceName: '',
                          accountIndex,
                          transportType: 'ble',
                      },
                  } satisfies HardwareWalletAccount)

        // Extract usdPrice from the ALGO preview asset for the account row.
        const algoPreviewAsset = preview.assets.find(a => a.isAlgo)
        const algoUsdPrice = algoPreviewAsset?.usdPrice ?? new Decimal(0)

        const list: LedgerInfoListItem[] = [
            {
                kind: 'sectionHeader',
                key: 'h-details',
                title: t('ledger.account_info.account_details'),
            },
            {
                kind: 'account',
                key: 'account',
                account: synthAccount,
                algoBalance: preview.algoBalance,
                algoUsdPrice,
                // For the rekeyed-to case the synth is a watch + rekey,
                // and the auth Ledger isn't in the store yet — force the
                // signable icon. For the plain Ledger case the base type
                // already yields the right icon, no override needed.
                ...(preview.rekey.kind === 'rekeyedTo'
                    ? { displayStateOverride: 'rekeyedSignable' as const }
                    : {}),
            },
            {
                kind: 'sectionHeader',
                key: 'h-assets',
                title: t('ledger.account_info.assets'),
            },
            ...preview.assets.map(
                (asset): LedgerInfoListItem => ({
                    kind: 'asset',
                    key: `asset-${asset.assetId}`,
                    accountBalance: {
                        assetId: asset.assetId,
                        amount: asset.amount,
                        isFrozen: asset.isFrozen,
                        // Holding value in ALGOs (display units):
                        // amount * usdPrice / algoUsdPrice. Falls back to 0
                        // when the ALGO USD price is unknown (avoids /0).
                        algoValue: algoUsdPrice.isZero()
                            ? new Decimal(0)
                            : asset.amount
                                  .times(asset.usdPrice)
                                  .div(algoUsdPrice),
                    } satisfies AssetWithAccountBalance,
                    usdPrice: asset.usdPrice,
                    hasKnownDecimals: asset.hasKnownDecimals,
                }),
            ),
        ]

        if (preview.rekey.kind === 'rekeyedTo') {
            // Build a synth hardware account for the auth address (it's a Ledger
            // signing key). accountIndex 0 is a safe placeholder — AccountDisplay
            // only reads type/address/name for display.
            const authSynthAccount: HardwareWalletAccount = {
                id: preview.rekey.authAddress,
                type: AccountTypes.hardware,
                address: preview.rekey.authAddress,
                hardwareDetails: {
                    manufacturer: 'ledger',
                    deviceId: '',
                    deviceName: '',
                    accountIndex: 0,
                    transportType: 'ble',
                },
            }
            list.push(
                {
                    kind: 'sectionHeader',
                    key: 'h-rekey',
                    title: t('ledger.account_info.can_be_signed_by'),
                },
                {
                    kind: 'rekeyAddress',
                    key: `rekey-${preview.rekey.authAddress}`,
                    account: authSynthAccount,
                    // synth is hardware — base icon resolves to Ledger.
                },
            )
        } else if (preview.rekey.kind === 'canSignFor') {
            list.push({
                kind: 'sectionHeader',
                key: 'h-rekey',
                title: t('ledger.account_info.can_sign_for'),
            })
            preview.rekey.addresses.forEach(addr => {
                // These rekeyed addresses are watch accounts (no key on this device).
                const watchSynth: WatchAccount = {
                    id: addr,
                    type: AccountTypes.watch,
                    address: addr,
                }
                list.push({
                    kind: 'rekeyAddress',
                    key: `rekey-${addr}`,
                    account: watchSynth,
                    // Address is rekeyed to this Ledger — display as
                    // signable even though the synth carries no rekey.
                    displayStateOverride: 'rekeyedSignable',
                })
            })
        }

        return list
    }, [preview, t, accountIndex])

    return {
        title:
            titleOverride ??
            t('ledger.account_info.default_title', { index: accountIndex }),
        items,
        isLoading,
        isError,
        refetch,
    }
}
