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

import { isAddress, zeroAddress } from 'viem'
import {
    assetIdsIn,
    hiddenAssetIdsOf,
    useHeldListedTokensStore,
    useHiddenTokensStore,
    useKeptTokensStore,
    type HeldListedTokens,
    type HiddenTokens,
    type KeptTokens,
} from '@perawallet/wallet-core-accounts'
import {
    defaultNetworkForTier,
    networkTierForMode,
    type ChainScope,
    type NetworkTier,
    type WalletMode,
} from '@perawallet/wallet-core-chain-contract'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import {
    deviceIdForDeployment,
    useDeviceStore,
    type DeviceAccountRegistration,
} from '@perawallet/wallet-core-device'
import { logger, type Optional } from '@perawallet/wallet-core-shared'
import { toCaip19 } from '../blockchain/utils/caip19'
import { EVM_CHAINS } from '../chains/table'
import { putFollowedTokens, type FollowedTokenAccount } from './api/endpoints'

export type { FollowedTokenAccount } from './api/endpoints'

// The backend's limits; a request over any of them is a 422.
const MAX_ADDRESSES_PER_CHAIN = 500
const MAX_TOKENS_PER_ADDRESS = 1000
const MAX_TOKENS_PER_REQUEST = 5000

/** Lets a burst of changes (a swap adds, unhides and keeps one token) go out as one request. */
export const FOLLOWED_TOKENS_SEND_DELAY_MS = 1000

const evmNetworkOf = (
    chainId: DeviceAccountRegistration['chainId'],
    tier: NetworkTier,
) => {
    const chain = EVM_CHAINS.find(each => each.row.id === chainId)
    const network = chain && defaultNetworkForTier(chain.descriptor, tier)
    return chain && network?.caip2 !== undefined
        ? { chain, network, caip2: network.caip2 }
        : null
}

// The route is a full replace, so a set that has emptied must still go out for
// a device that registered an EVM address; a wallet with none has nothing to clear.
const hasRegisteredEvmAddress = (
    registeredAccounts: readonly DeviceAccountRegistration[],
    deployment: WalletMode,
): boolean => {
    const tier = networkTierForMode(deployment)
    return registeredAccounts.some(
        account => evmNetworkOf(account.chainId, tier) !== null,
    )
}

/**
 * The tokens each registered EVM address follows: the ones the user kept plus
 * the listed ones it has held, less any the user hid, since a hidden token
 * shouldn't push. Never reads the token list, so a token Pera has since
 * delisted stays followed; an unregistered address is left out because the
 * backend skips it anyway.
 */
export const followedTokenAccountsOf = ({
    registeredAccounts,
    deployment,
    keptTokens,
    heldListedTokens,
    hiddenTokens,
}: {
    registeredAccounts: readonly DeviceAccountRegistration[]
    deployment: WalletMode
    keptTokens: KeptTokens
    heldListedTokens: HeldListedTokens
    hiddenTokens: HiddenTokens
}): FollowedTokenAccount[] => {
    const tier = networkTierForMode(deployment)
    const seen = new Set<string>()
    const addressesPerChain = new Map<string, number>()
    const accounts: FollowedTokenAccount[] = []
    let requestTokens = 0
    let droppedAddresses = 0
    let droppedTokens = 0
    for (const account of registeredAccounts) {
        const found = evmNetworkOf(account.chainId, tier)
        if (!found) continue
        const { chain, network, caip2 } = found
        const key = `${chain.row.id}|${account.address.toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        const scope: ChainScope = {
            chainId: chain.row.id,
            networkId: network.id,
        }
        const mirror = chain.row.nativeTokenContract?.toLowerCase()
        const hidden = new Set(
            hiddenAssetIdsOf(hiddenTokens, account.address, scope),
        )
        const allTokens = [
            ...new Set(
                [
                    ...assetIdsIn(keptTokens, account.address, scope),
                    ...assetIdsIn(heldListedTokens, account.address, scope),
                ]
                    // Drops NFT ids and the native id; the native coin's mirror
                    // contract is the native balance, never a token.
                    .filter(
                        id =>
                            isAddress(id) &&
                            !hidden.has(id) &&
                            id.toLowerCase() !== zeroAddress &&
                            id.toLowerCase() !== mirror,
                    )
                    .map(id => toCaip19(id, scope, chain)),
            ),
        ]
        // ponytail: a full replace can't be split across requests, so what
        // exceeds a cap is dropped; the cap is far above a real wallet.
        const tokens = allTokens.slice(0, MAX_TOKENS_PER_ADDRESS)
        droppedTokens += allTokens.length - tokens.length
        if (tokens.length === 0) continue
        const onChain = addressesPerChain.get(chain.row.id) ?? 0
        const room = MAX_TOKENS_PER_REQUEST - requestTokens
        if (onChain >= MAX_ADDRESSES_PER_CHAIN || room <= 0) {
            droppedAddresses += 1
            droppedTokens += tokens.length
            continue
        }
        const sent = tokens.slice(0, room)
        droppedTokens += tokens.length - sent.length
        addressesPerChain.set(chain.row.id, onChain + 1)
        requestTokens += sent.length
        accounts.push({ address: account.address, chain: caip2, tokens: sent })
    }
    // Counts only: an address in a log would tie a wallet to a report.
    if (droppedAddresses > 0 || droppedTokens > 0) {
        logger.warn('Followed tokens over the backend caps were left out', {
            droppedAddresses,
            droppedTokens,
        })
    }
    return accounts
}

// Never throws: a failed or unbuildable send is retried by the next change or
// registration, which rebuilds the payload from whatever the stores hold then.
const sendFollowedTokens = async (): Promise<void> => {
    try {
        const deployment = useNetworkStore.getState().mode
        const device = useDeviceStore.getState()
        const deviceId = deviceIdForDeployment(device, deployment)
        const registeredAccounts = device.registeredAccounts[deployment]
        if (!deviceId || !registeredAccounts) return
        const accounts = followedTokenAccountsOf({
            registeredAccounts,
            deployment,
            keptTokens: useKeptTokensStore.getState().keptTokens,
            heldListedTokens:
                useHeldListedTokensStore.getState().heldListedTokens,
            hiddenTokens: useHiddenTokensStore.getState().hiddenTokens,
        })
        if (
            accounts.length === 0 &&
            !hasRegisteredEvmAddress(registeredAccounts, deployment)
        ) {
            return
        }
        await putFollowedTokens(deployment, deviceId, accounts)
    } catch (error) {
        logger.warn('Followed tokens not sent; the next change retries', {
            error,
        })
    }
}

const onChange = <State>(
    store: {
        getState: () => State
        subscribe: (listener: (state: State) => void) => () => void
    },
    select: (state: State) => unknown,
    listener: () => void,
): (() => void) => {
    let previous = select(store.getState())
    return store.subscribe(state => {
        const next = select(state)
        if (next === previous) return
        previous = next
        listener()
    })
}

let stopSync: Optional<() => void>

/**
 * Sends the device's followed tokens after a registration lands and after each
 * change to what it follows. Sends never overlap, so a slow request can't land
 * after a newer one and put an older set back. Safe to call more than once.
 */
export const startFollowedTokensSync = (): (() => void) => {
    if (stopSync) return stopSync
    let timer: Optional<ReturnType<typeof setTimeout>>
    let tail: Promise<void> = Promise.resolve()
    const schedule = (): void => {
        clearTimeout(timer)
        timer = setTimeout(() => {
            tail = tail.then(sendFollowedTokens)
        }, FOLLOWED_TOKENS_SEND_DELAY_MS)
    }
    const unsubscribes = [
        onChange(useKeptTokensStore, state => state.keptTokens, schedule),
        onChange(
            useHeldListedTokensStore,
            state => state.heldListedTokens,
            schedule,
        ),
        onChange(useHiddenTokensStore, state => state.hiddenTokens, schedule),
        onChange(useDeviceStore, state => state.registeredAccounts, schedule),
    ]
    stopSync = () => {
        clearTimeout(timer)
        unsubscribes.forEach(unsubscribe => unsubscribe())
        stopSync = undefined
    }
    return stopSync
}
