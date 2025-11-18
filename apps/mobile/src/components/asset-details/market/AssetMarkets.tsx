import EmptyView from "../../common/empty-view/EmptyView"
import { PeraAsset, WalletAccount } from "@perawallet/core"

type AssetMarketsProps = {
    account: WalletAccount
    asset: PeraAsset
}

const AssetMarkets = ({ account, asset }: AssetMarketsProps) => {
    return <EmptyView icon="dollar" title="Not Implemented" body="This page hasn't been implemented yet" />
}

export default AssetMarkets