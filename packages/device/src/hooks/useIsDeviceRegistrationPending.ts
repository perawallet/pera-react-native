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

import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { useDeviceStore } from '../store'
import { useDeviceID } from './useDeviceID'

/**
 * True while the current network has no usable backend device registration:
 * either no device id exists yet or the last registration attempt failed and
 * awaits the reconnect/foreground retry. Consumers should render a loading
 * state instead of an empty state for device-keyed data (inbox, badge).
 */
export const useIsDeviceRegistrationPending = (): boolean => {
    const { network } = useNetwork()
    const deviceID = useDeviceID(network)
    const isRetryPending = useDeviceStore(state =>
        state.pendingRegistrationNetworks.includes(network),
    )
    return !deviceID || isRetryPending
}
