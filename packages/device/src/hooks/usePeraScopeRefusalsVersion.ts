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

import { useSyncExternalStore } from 'react'
import {
    getPeraScopeRefusalsVersion,
    subscribePeraScopeRefusals,
} from '@perawallet/wallet-core-config'

/**
 * A number that changes, re-rendering the caller, whenever
 * `isPeraScopeRefused` may answer differently: the chain list loading after
 * attestation, or a new refusal. Pass it as a memo dependency wherever a
 * value reads that answer.
 */
export const usePeraScopeRefusalsVersion = (): number =>
    useSyncExternalStore(
        subscribePeraScopeRefusals,
        getPeraScopeRefusalsVersion,
    )
