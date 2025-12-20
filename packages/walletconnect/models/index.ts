export type WalletConnectPeerMeta = {
    id: string
    name: string
    url: string
    icons: string[]
    description: string
}

export type WalletConnectWalletMeta = {
    addresses: string[]
    peerId: string
    chainId: number
    peerMeta: WalletConnectPeerMeta
}

export type WalletConnectSession = {
    id: string
    version: '1' | '2'
    bridgeUrl: string
    peerMeta: WalletConnectPeerMeta
    walletMeta: WalletConnectWalletMeta
    peerId: string
    createdAt: Date
    lastActiveAt: Date
    expiresAt?: Date
    connected: boolean
    subscribed: boolean
}

export type WalletConnectStore = {
    walletConnectSessions: WalletConnectSession[]
    setWalletConnectSessions: (
        walletConnectSessions: WalletConnectSession[],
    ) => void
}
