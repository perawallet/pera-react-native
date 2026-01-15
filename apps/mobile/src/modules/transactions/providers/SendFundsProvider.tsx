/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import Decimal from 'decimal.js'
import { createContext, PropsWithChildren, useState } from 'react'

export type SendFundsState = {
    selectedAsset?: AssetWithAccountBalance
    canSelectAsset?: boolean
    amount?: Decimal
    note?: string
    destination?: string
    setCanSelectAsset: (canSelect: boolean) => void
    setSelectedAsset: (asset?: AssetWithAccountBalance) => void
    setAmount: (amount?: Decimal) => void
    setNote: (note?: string) => void
    setDestination: (address?: string) => void
}

export const SendFundsContext = createContext<SendFundsState>({
    canSelectAsset: true,
    setCanSelectAsset: (_: boolean) => {},
    setSelectedAsset: (_?: AssetWithAccountBalance) => {},
    setAmount: (_?: Decimal) => {},
    setNote: (_?: string) => {},
    setDestination: (_?: string) => {},
})

export const SendFundsProvider = ({ children }: PropsWithChildren) => {
    const [canSelectAsset, setCanSelectAsset] = useState(false)
    const [selectedAsset, setSelectedAsset] =
        useState<AssetWithAccountBalance>()
    const [amount, setAmount] = useState<Decimal>()
    const [note, setNote] = useState<string>()
    const [destination, setDestination] = useState<string>()

    return (
        <SendFundsContext.Provider
            value={{
                canSelectAsset,
                selectedAsset,
                amount,
                note,
                destination,
                setCanSelectAsset,
                setSelectedAsset,
                setAmount,
                setNote,
                setDestination,
            }}
        >
            {children}
        </SendFundsContext.Provider>
    )
}
