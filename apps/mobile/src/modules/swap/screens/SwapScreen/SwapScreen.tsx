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

import { Text } from '@rneui/themed'
import {
    PWBottomSheet,
    PWIcon,
    PWText,
    PWToolbar,
    PWView,
} from '@components/core'
import { useStyles } from './styles'
import { PairSelectionPanel } from '@modules/swap/components/PairSelectionPanel/PairSelectionPanel'
import { SwapHistoryPanel } from '@modules/swap/components/SwapHistoryPanel/SwapHistoryPanel'
import { TopPairsPanel } from '@modules/swap/components/TopPairsPanel/TopPairsPanel'
import { AccountSelection } from '@modules/accounts/components/AccountSelection'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Drawer } from 'react-native-drawer-layout'
import { useEffect, useState } from 'react'
import { AccountMenu } from '@modules/accounts/components/AccountMenu'
import { useLanguage } from '@hooks/useLanguage'
import { useWebView } from '@hooks/usePeraWebviewInterface'
import { config } from '@perawallet/wallet-core-config'
import {
    PeraDisplayableTransaction,
    useAlgorandClient,
} from '@perawallet/wallet-core-blockchain'
import { Decimal } from 'decimal.js'
import { TransactionDisplay } from '@modules/transactions/components/TransactionDisplay'
import { ScrollView } from 'react-native-gesture-handler'

export const SwapScreen = () => {
    const insets = useSafeAreaInsets()
    const styles = useStyles(insets)
    const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
    const { t } = useLanguage()
    const { pushWebView } = useWebView()
    const algoClient = useAlgorandClient()

    const openSwapSupport = () => {
        pushWebView({
            url: config.swapSupportUrl,
            id: 'swap-support',
        })
    }

    const [tx, setTx] = useState<PeraDisplayableTransaction>()
    const [innerTx, setInnerTx] = useState<
        PeraDisplayableTransaction | undefined
    >(undefined)
    useEffect(() => {
        const fetchTx = async () => {
            const appcall =
                'IWDWCSAX52PHP7YTOBPTW4XCNTFTQGO7PNETPJ74RR467CVJOHLQ'
            const appCallWithInnerApp =
                '2H2UVTEZGELCWYJBNHI75XC4N7AUTYCRWFSUMJP26K6WGD5ARIJA'
            const axfer = '6YXXCHW5JNWA6MZ3ZQAELWIR46ENPXUPI64Z37GHHDDBIJOJENEQ'
            const payment =
                'NSYTJRR4FKQWR4NB6P56IO7EHHS755VU6DK7UT5IWFEFBPXX7QNA'
            const assetConfig =
                'SQWLJMLVPNUNMCMDDF3FS2E4PZL2DOQCSFVC4EZGSSPQDF3MRVYQ'
            const tx =
                await algoClient.client.indexer.lookupTransactionById(
                    appCallWithInnerApp,
                )

            setTx(tx.transaction)
        }
        fetchTx()
    }, [])

    const showTx = (tx: PeraDisplayableTransaction) => {
        setInnerTx(tx)
    }

    return (
        <Drawer
            open={drawerOpen}
            onOpen={() => setDrawerOpen(true)}
            onClose={() => setDrawerOpen(false)}
            drawerType='front'
            swipeEnabled
            drawerStyle={styles.drawer}
            renderDrawerContent={() => (
                <AccountMenu onSelected={() => setDrawerOpen(false)} />
            )}
        >
            <PWView style={{ flex: 1, padding: 16 }}>
                <ScrollView>
                    {!!tx && (
                        <TransactionDisplay
                            transaction={tx}
                            onInnerTransactionsPress={showTx}
                        />
                    )}
                </ScrollView>
                <PWBottomSheet
                    isVisible={!!innerTx}
                    containerStyle={{ height: '100%' }}
                >
                    <PWToolbar
                        left={
                            <PWIcon
                                name='cross'
                                onPress={() => setInnerTx(undefined)}
                            />
                        }
                        center={<PWText>Inner Transaction</PWText>}
                    />
                    {!!innerTx && (
                        <TransactionDisplay
                            transaction={innerTx}
                            isInnerTransaction
                            onInnerTransactionsPress={showTx}
                        />
                    )}
                </PWBottomSheet>
            </PWView>
        </Drawer>
    )
}
