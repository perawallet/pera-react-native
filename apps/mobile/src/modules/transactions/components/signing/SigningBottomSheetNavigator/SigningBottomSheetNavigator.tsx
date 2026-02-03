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

import {
    NavigationContainer,
    NavigationIndependentTree,
} from '@react-navigation/native'
import { PWView } from '@components/core'
import type { TransactionSignRequest } from '@perawallet/wallet-core-signing'
import { SigningActionButtons } from '../SigningActionButtons'
import { SigningRoutes } from '@modules/transactions/routes/signing'
import { useStyles } from './styles'

export type SigningBottomSheetNavigatorProps = {
    request: TransactionSignRequest
}

export const SigningBottomSheetNavigator = ({
    request,
}: SigningBottomSheetNavigatorProps) => {
    const styles = useStyles()

    return (
        <PWView style={styles.container}>
            <NavigationIndependentTree>
                <NavigationContainer>
                    <SigningRoutes request={request} />
                </NavigationContainer>
            </NavigationIndependentTree>
            <SigningActionButtons />
        </PWView>
    )
}
