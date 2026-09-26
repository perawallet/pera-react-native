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
import { useCardStore } from '@perawallet/wallet-core-chain-algorand/card'
import { useOnChainAccountInformationQuery } from '@perawallet/wallet-core-accounts'
import { getKnownAssetId, useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    baseUnitsToDisplayUnits,
    useNetwork,
} from '@perawallet/wallet-core-blockchain'
import { USDC_FALLBACK_DECIMALS } from '../utils/usdc'

const ZERO_BALANCE = new Decimal(0)

export type UseCardEscrowBalanceResult = {
    /** USDC sitting on the card, in display units. */
    balance: Decimal
    isLoading: boolean
}

/**
 * The card's own USDC, read from the escrow account on chain.
 *
 * Baanx reports the same figure on `GET /v1/wallet/internal`, but serves that
 * route to custodial platforms only, so the chain is the sole source Pera has.
 */
export const useCardEscrowBalance = (): UseCardEscrowBalanceResult => {
    const { network } = useNetwork()
    const escrowCardAddress = useCardStore(state => state.escrowCardAddress)
    const usdcAssetId = useMemo(
        () => getKnownAssetId('USDC', network),
        [network],
    )

    const { data: accountInformation, isPending } =
        useOnChainAccountInformationQuery(escrowCardAddress ?? '')
    const { data: assets } = useAssetsQuery(usdcAssetId ? [usdcAssetId] : [])

    const balance = useMemo(() => {
        if (usdcAssetId === null) return ZERO_BALANCE
        const holding = accountInformation?.assets.find(
            asset => String(asset.assetId) === usdcAssetId,
        )
        if (holding === undefined) return ZERO_BALANCE
        return baseUnitsToDisplayUnits(
            holding.amount,
            assets.get(usdcAssetId)?.decimals ?? USDC_FALLBACK_DECIMALS,
        )
    }, [accountInformation, assets, usdcAssetId])

    return {
        balance,
        isLoading: escrowCardAddress !== null && isPending,
    }
}
