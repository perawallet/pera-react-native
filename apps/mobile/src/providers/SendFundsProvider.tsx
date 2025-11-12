import { PeraAsset, useSelectedAccount, WalletAccount } from "@perawallet/core"
import Decimal from "decimal.js"
import { createContext, PropsWithChildren, useState } from "react"


type SendFundsState = {
    selectedAsset?: PeraAsset
    canSelectAsset?: boolean
    amount?: Decimal
    note?: string
    destination?: string
    setCanSelectAsset: (canSelect: boolean) => void
    setSelectedAsset: (asset?: PeraAsset) => void
    setAmount: (amount?: Decimal) => void
    setNote: (note?: string) => void
    setDestination: (address?: string) => void
}

export const SendFundsContext = createContext<SendFundsState>({
    canSelectAsset: true,
    setCanSelectAsset: (canSelect: boolean) => {},
    setSelectedAsset: (asset?: PeraAsset) => {},
    setAmount: (amount?: Decimal) =>  {},
    setNote: (note?: string) =>  {},
    setDestination: (address?: string) =>  {}
});

const SendFundsProvider = ({ children }: PropsWithChildren) => {
    const [canSelectAsset, setCanSelectAsset] = useState(false)
    const [selectedAsset, setSelectedAsset] = useState<PeraAsset>()
    const [amount, setAmount] = useState<Decimal>()
    const [note, setNote] = useState<string>()
    const [destination, setDestination] = useState<string>()

  return (
    <SendFundsContext.Provider value={{ 
        canSelectAsset, selectedAsset, amount, note, destination, 
        setCanSelectAsset, setSelectedAsset, setAmount, setNote, setDestination }}>
        {children}
    </SendFundsContext.Provider>
  );
};

export default SendFundsProvider
