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

import type { AccountParticipation } from './AccountParticipation'
import type { Application } from './Application'
import type { ApplicationLocalState } from './ApplicationLocalState'
import type { ApplicationStateSchema } from './ApplicationStateSchema'
import type { Asset } from './Asset'
import type { AssetHolding } from './AssetHolding'

export type AccountSigTypeEnum = 'sig' | 'msig' | 'lsig'

/**
 * @description Account information at a given round.\n\nDefinition:\ndata/basics/userBalance.go : AccountData\n
 */
export type Account = {
    /**
     * @description the account public key
     * @type string
     */
    address: string
    /**
     * @description \\[algo\\] total number of MicroAlgos in the account
     * @type integer, uint64
     */
    amount: number
    /**
     * @description specifies the amount of MicroAlgos in the account, without the pending rewards.
     * @type integer, uint64
     */
    'amount-without-pending-rewards': number
    /**
     * @description \\[appl\\] applications local data stored in this account.\n\nNote the raw object uses `map[int] -> AppLocalState` for this type.
     * @type array | undefined
     */
    'apps-local-state'?: ApplicationLocalState[]
    /**
     * @description \\[teap\\] the sum of all extra application program pages for this account.
     * @type integer | undefined, uint64
     */
    'apps-total-extra-pages'?: number
    /**
     * @description Specifies maximums on the number of each type that may be stored.
     * @type object | undefined
     */
    'apps-total-schema'?: ApplicationStateSchema
    /**
     * @description \\[asset\\] assets held by this account.\n\nNote the raw object uses `map[int] -> AssetHolding` for this type.
     * @type array | undefined
     */
    assets?: AssetHolding[]
    /**
     * @description \\[spend\\] the address against which signing should be checked. If empty, the address of the current account is used. This field can be updated in any transaction by setting the RekeyTo field.
     * @type string | undefined
     */
    'auth-addr'?: string
    /**
     * @description \\[appp\\] parameters of applications created by this account including app global data.\n\nNote: the raw account uses `map[int] -> AppParams` for this type.
     * @type array | undefined
     */
    'created-apps'?: Application[]
    /**
     * @description \\[apar\\] parameters of assets created by this account.\n\nNote: the raw account uses `map[int] -> Asset` for this type.
     * @type array | undefined
     */
    'created-assets'?: Asset[]
    /**
     * @description Whether or not the account can receive block incentives if its balance is in range at proposal time.
     * @type boolean | undefined
     */
    'incentive-eligible'?: boolean
    /**
     * @description The round in which this account last went online, or explicitly renewed their online status.
     * @type integer | undefined
     */
    'last-heartbeat'?: number
    /**
     * @description The round in which this account last proposed the block.
     * @type integer | undefined
     */
    'last-proposed'?: number
    /**
     * @description MicroAlgo balance required by the account.\n\nThe requirement grows based on asset and application usage.
     * @type integer, uint64
     */
    'min-balance': number
    /**
     * @description AccountParticipation describes the parameters used by this account in consensus protocol.
     * @type object | undefined
     */
    participation?: AccountParticipation
    /**
     * @description amount of MicroAlgos of pending rewards in this account.
     * @type integer, uint64
     */
    'pending-rewards': number
    /**
     * @description \\[ebase\\] used as part of the rewards computation. Only applicable to accounts which are participating.
     * @type integer | undefined, uint64
     */
    'reward-base'?: number
    /**
     * @description \\[ern\\] total rewards of MicroAlgos the account has received, including pending rewards.
     * @type integer, uint64
     */
    rewards: number
    /**
     * @description The round for which this information is relevant.
     * @type integer
     */
    round: number
    /**
     * @description Indicates what type of signature is used by this account, must be one of:\n* sig\n* msig\n* lsig
     * @type string | undefined
     */
    'sig-type'?: AccountSigTypeEnum
    /**
     * @description \\[onl\\] delegation status of the account\'s MicroAlgos\n* Offline - indicates that the associated account is delegated.\n*  Online  - indicates that the associated account used as part of the delegation pool.\n*   NotParticipating - indicates that the associated account is neither a delegator nor a delegate.
     * @type string
     */
    status: string
    /**
     * @description The count of all applications that have been opted in, equivalent to the count of application local data (AppLocalState objects) stored in this account.
     * @type integer, uint64
     */
    'total-apps-opted-in': number
    /**
     * @description The count of all assets that have been opted in, equivalent to the count of AssetHolding objects held by this account.
     * @type integer, uint64
     */
    'total-assets-opted-in': number
    /**
     * @description \\[tbxb\\] The total number of bytes used by this account\'s app\'s box keys and values.
     * @type integer | undefined, uint64
     */
    'total-box-bytes'?: number
    /**
     * @description \\[tbx\\] The number of existing boxes created by this account\'s app.
     * @type integer | undefined, uint64
     */
    'total-boxes'?: number
    /**
     * @description The count of all apps (AppParams objects) created by this account.
     * @type integer, uint64
     */
    'total-created-apps': number
    /**
     * @description The count of all assets (AssetParams objects) created by this account.
     * @type integer, uint64
     */
    'total-created-assets': number
}
