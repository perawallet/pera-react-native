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

import { TransactionSignRequest } from '../../../../../../../packages/signing/dist'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useMemo } from 'react'
import { SigningStackParamList } from './types'
import { SingleTransactionScreen } from '@modules/transactions/screens/signing/SingleTransactionScreen'
import { TransactionDetailsScreen } from '@modules/transactions/screens/signing/TransactionDetailsScreen'
import { GroupListScreen } from '@modules/transactions/screens/signing/GroupListScreen'
import { MultiGroupListScreen } from '@modules/transactions/screens/signing/MultiGroupListScreen'
import { useStyles } from './styles'

type SigningRoutesProps = {
    request: TransactionSignRequest
}

const Stack = createNativeStackNavigator<SigningStackParamList>()

type InitialRouteConfig = {
    name: keyof SigningStackParamList
    params?: SigningStackParamList[keyof SigningStackParamList]
}

const getInitialRouteConfig = (
    request: TransactionSignRequest,
): InitialRouteConfig => {
    const groupCount = request.txs.length
    const firstGroupLength = request.txs[0]?.length ?? 0
    const isSingleTransaction = groupCount === 1 && firstGroupLength === 1
    const isSingleGroup = groupCount === 1 && !isSingleTransaction

    if (isSingleTransaction) {
        return { name: 'SingleTransaction' }
    }
    if (isSingleGroup) {
        return { name: 'GroupList', params: { groupIndex: 0 } }
    }
    return { name: 'MultiGroupList' }
}

export const SigningRoutes = ({ request }: SigningRoutesProps) => {
    const initialRouteConfig = useMemo(
        () => getInitialRouteConfig(request),
        [request],
    )
    const styles = useStyles()
    return (
        <Stack.Navigator
            initialRouteName={initialRouteConfig.name}
            screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: styles.screenContent,
            }}
        >
            <Stack.Screen
                name='SingleTransaction'
                component={SingleTransactionScreen}
            />
            <Stack.Screen
                name='TransactionDetails'
                component={TransactionDetailsScreen}
            />
            <Stack.Screen
                name='GroupList'
                component={GroupListScreen}
                initialParams={
                    initialRouteConfig.name === 'GroupList'
                        ? (initialRouteConfig.params as { groupIndex: number })
                        : undefined
                }
            />
            <Stack.Screen
                name='MultiGroupList'
                component={MultiGroupListScreen}
            />
        </Stack.Navigator>
    )
}
