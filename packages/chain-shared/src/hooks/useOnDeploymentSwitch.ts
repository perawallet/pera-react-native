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

import { useEffect, useRef } from 'react'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { useWalletDeployment } from './useSelectedScope'

export type DeploymentSwitchHandler = (from: WalletMode, to: WalletMode) => void

/**
 * Runs `handler(from, to)` once per real change of the Pera deployment, never
 * on initial mount. The single place that detects a switch, so modules with
 * deployment-switch side-effects (device re-registration, multisig sync, …)
 * don't each re-implement a previous-deployment gate. Always invokes the
 * latest handler.
 */
export const useOnDeploymentSwitch = (
    handler: DeploymentSwitchHandler,
): void => {
    const deployment = useWalletDeployment()
    const handlerRef = useRef(handler)
    handlerRef.current = handler
    const previousDeploymentRef = useRef(deployment)

    useEffect(() => {
        const previousDeployment = previousDeploymentRef.current
        if (previousDeployment === deployment) return
        previousDeploymentRef.current = deployment
        handlerRef.current(previousDeployment, deployment)
    }, [deployment])
}
