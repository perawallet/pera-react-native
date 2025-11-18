import EmptyView from "../../common/empty-view/EmptyView"
import { PeraAsset, WalletAccount } from "@perawallet/core"

type AssetHoldingsProps = {
    account: WalletAccount
    asset: PeraAsset
}

const AssetHoldings = ({ account, asset }: AssetHoldingsProps) => {
    return <EmptyView icon="dollar" title="Not Implemented" body="This page hasn't been implemented yet" />
}

export default AssetHoldings