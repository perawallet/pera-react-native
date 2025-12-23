import EmptyView from "@components/empty-view/EmptyView"
import { ArbitraryDataSignRequest } from "@perawallet/wallet-core-blockchain"

type ArbitraryDataSigningViewProps = {
    request: ArbitraryDataSignRequest
}

//TODO implement me
const ArbitraryDataSigningView = (_: ArbitraryDataSigningViewProps) => {
    return <EmptyView
        title='Arbitrary Data Not Implemented'
        body='Arbitrary data signing has not been implemented yet.'
    />
}

export default ArbitraryDataSigningView
