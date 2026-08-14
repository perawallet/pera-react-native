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

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import { Decimal } from 'decimal.js'
import { useSelectedAccount } from '@perawallet/wallet-core-accounts'
import {
    isCollectible,
    isPureNft,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useBottomSheetResult } from '@modules/bottom-sheet'
import { useSendFunds } from '@modules/transactions/hooks'

type UseSendFundsContentResult = {
    selectedAccount: ReturnType<typeof useSelectedAccount>
    isReady: boolean
    handleFinished: () => void
}

export const useSendFundsContent = (
    assetId: Optional<string>,
): UseSendFundsContentResult => {
    const selectedAccount = useSelectedAccount()
    const {
        canSelectAsset,
        selectedAssetId,
        setSelectedAssetId,
        setCanSelectAsset,
        setAmount,
        setOnFinished,
        reset,
    } = useSendFunds()
    const { dismiss } = useBottomSheetResult<void>()

    const { data: assets } = useAssetsQuery(assetId ? [assetId] : [])
    const asset = assetId ? assets.get(assetId) : undefined

    const [isReady, setIsReady] = useState(assetId == null)
    // Prefill the NFT amount once per asset id rather than latching a boolean —
    // `setAmount(new Decimal(1))` builds a fresh Decimal every run, and this
    // component subscribes to `amount` via `useSendFunds`, so an unguarded
    // re-run (e.g. `asset` changing identity on refetch) would set a new
    // Decimal → re-render → set again → "Maximum update depth exceeded". Keying
    // on the id instead of a boolean still re-prefills if the user switches to
    // a different pure NFT without this component unmounting.
    const prefilledAssetIdRef = useRef<Optional<string>>(undefined)

    useLayoutEffect(() => {
        if (assetId != null) {
            if (canSelectAsset) {
                setCanSelectAsset(false)
            }

            if (selectedAssetId !== assetId) {
                setSelectedAssetId(assetId)
            }

            // Pure collectibles have a fixed quantity of 1, so prefill
            // the amount and skip the input screen entirely.
            if (
                prefilledAssetIdRef.current !== assetId &&
                asset &&
                isCollectible(asset) &&
                isPureNft(asset)
            ) {
                setAmount(new Decimal(1))
                prefilledAssetIdRef.current = assetId
            }

            setIsReady(true)
        }
    }, [
        assetId,
        asset,
        setCanSelectAsset,
        setSelectedAssetId,
        setAmount,
        canSelectAsset,
        selectedAssetId,
    ])

    const handleFinished = useCallback(() => {
        // `reset()` clears the store amount, so drop the prefill latch too —
        // otherwise re-selecting the same pure NFT on a surviving instance
        // would skip the prefill and leave the amount empty.
        prefilledAssetIdRef.current = undefined
        reset()
        dismiss()
    }, [reset, dismiss])

    useLayoutEffect(() => {
        setOnFinished(handleFinished)
    }, [handleFinished, setOnFinished])

    // The store is a module singleton that outlives this sheet, so clear it on
    // teardown and not only in `handleFinished` — `onFinished` is wired to the
    // ✕/Done buttons alone, and a backdrop press dismisses straight through
    // `remove()`. The leftover `canSelectAsset: false` then made the next Send
    // open on the previous transfer instead of asset selection, and a leftover
    // `destination` auto-advanced past the receiver picker (PERA-4894).
    // Teardown, not mount: the deeplink and account-actions callers prefill the
    // store *before* opening the sheet, so a mount-time reset would wipe them.
    useEffect(() => () => reset(), [reset])

    return {
        selectedAccount,
        isReady,
        handleFinished,
    }
}
