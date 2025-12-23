import PWView from "@components/view/PWView"
import { WalletConnectSessionRequest } from "@perawallet/wallet-core-walletconnect"
import { Text } from "@rneui/themed"

const ConnectionView = ({ request }: { request: WalletConnectSessionRequest }) => {
    return <PWView>
        <Text>Hello</Text>
    </PWView>
}

export default ConnectionView
