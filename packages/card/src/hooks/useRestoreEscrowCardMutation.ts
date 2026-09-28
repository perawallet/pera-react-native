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

import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    CardUserUnavailableError,
    fetchFundingAddressLink,
} from '../api/card-creation'
import { fetchUser } from '../api/user'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

/** Resolves to the restored card address, or null when none was found. */
export type UseRestoreEscrowCardMutationResult = CardMutationResult<
    string[],
    Nullable<string>
>

/**
 * Recovers an escrow card created on another device or install.
 *
 * The card address lives only in the per-device store, so a sign-in on a
 * fresh install would otherwise send a finished user back through card
 * creation. The backend has no by-user lookup, only a per-address one, so
 * every candidate address is asked.
 */
export const useRestoreEscrowCardMutation =
    (): UseRestoreEscrowCardMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<Nullable<string>, Error, string[]>({
            mutationFn: async addresses => {
                if (addresses.length === 0) return null
                const user = await fetchUser({ network })
                if (!user) {
                    throw new CardUserUnavailableError()
                }
                // One failed lookup must not hide a card linked to another
                // address, so each is settled on its own.
                const links = await Promise.all(
                    addresses.map(address =>
                        fetchFundingAddressLink({
                            network,
                            address,
                            baanxUserId: user.id,
                        }).catch(() => null),
                    ),
                )
                const index = links.findIndex(
                    link =>
                        link?.state === 'linked_to_caller' &&
                        link.cardAddress !== null,
                )
                const cardAddress = links[index]?.cardAddress ?? null
                if (cardAddress === null) return null

                useCardStore.getState().restoreEscrowCard({
                    cardAddress,
                    ownerAddress: addresses[index],
                    network,
                })
                return cardAddress
            },
            // The caller falls back to the setup checklist on failure.
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
