import EmptyView from "@components/empty-view/EmptyView"
import { Arc60SignRequest } from "@perawallet/wallet-core-blockchain"

type Arc60SigningViewProps = {
    request: Arc60SignRequest
}

//TODO implement me
const Arc60SigningView = (_: Arc60SigningViewProps) => {
    return <EmptyView
        title='Arc60 Not Implemented'
        body='Arc60 signing has not been implemented yet.'
    />
}

export default Arc60SigningView
