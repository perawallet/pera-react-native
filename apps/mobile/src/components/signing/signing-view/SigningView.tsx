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

import PWView from '../../common/view/PWView'
import {
    SignRequest,
    truncateAlgorandAddress,
    useSigningRequest,
} from '@perawallet/core'
import { useStyles } from './styles'
import { Text } from '@rneui/themed'
import PWButton from '../../common/button/PWButton'
import CurrencyDisplay from '../../currency/currency-display/CurrencyDisplay'
import Decimal from 'decimal.js'
import { ScrollView } from 'react-native'

import TransactionIcon from '../../common/transaction-icon/TransactionIcon'
import BalanceImpactView from '../balance-impact/BalanceImpactView'
import useToast from '../../../hooks/toast'
import PWTouchableOpacity from '../../common/touchable-opacity/PWTouchableOpacity'
import PWIcon from '../../common/icons/PWIcon'

type SigningViewProps = {
    request: SignRequest
}

//TODO: we need to support all tx types here
//TODO: use real data from the TXs
//TODO: convert usd amounts to preferred currency
const SingleTransactionView = ({ request }: SigningViewProps) => {
    const styles = useStyles()
    const tx = request.txs?.at(0)?.at(0)!

    return (
        <PWView style={styles.body}>
            <TransactionIcon
                type='pay'
                size='large'
            />
            <Text h4>Transfer to {truncateAlgorandAddress(tx.receiver)}</Text>
            <CurrencyDisplay
                currency='ALGO'
                precision={3}
                value={Decimal(-5059.44)}
                showSymbol
                h1
                h1Style={styles.mainAmount}
            />
            <CurrencyDisplay
                currency='USD'
                precision={3}
                value={Decimal(-5059.44 * 0.17)}
                showSymbol
                h3
                h3Style={styles.secondaryAmount}
            />
        </PWView>
    )
}

const GroupTransactionView = ({ request }: SigningViewProps) => {
    const styles = useStyles()
    const isMultipleGroups = request.txs?.length > 1
    return (
        <ScrollView contentContainerStyle={styles.body}>
            <TransactionIcon
                type='group'
                size='large'
            />
            <Text h4>
                {isMultipleGroups
                    ? 'Transaction Groups'
                    : `Group ID: ${truncateAlgorandAddress('SomeIDForAGroup')}`}
            </Text>
            {isMultipleGroups ? (
                <PWView>
                    <Text>This is where we'll show the groups</Text>
                </PWView>
            ) : (
                <BalanceImpactView />
            )}
        </ScrollView>
    )
}

const SigningView = ({ request }: SigningViewProps) => {
    const styles = useStyles()
    const { removeSignRequest } = useSigningRequest()
    //const { signTransactionForAddress } = useTransactionSigner()
    const { showToast } = useToast()

    const isMultipleTransactions =
        request.txs?.length > 1 || (request.txs?.at(0)?.length ?? 0) > 1
    const txFees = Decimal(0.001)

    const signAndSend = async () => {
        try {
            // TODO when we have valid TXs we'll need to sign them and then send them to the server
            // We might do this using algokit-utils or we can do it ourselves
            // Same with the signing - maybe we can hook up our infra to algokit-util's Signer
            //
            // let allSigs = []
            // for(let group of request.txs) {
            //     let sigs = []

            //     for(let tx of group) {
            //         //TODO maybe we should turn the binary tx into a Transaction using decodeTransaction from algokit
            //         const sig = await signTransactionForAddress(tx.sender, tx)
            //         sigs.push(sig)
            //     }

            //     allSigs.push(sigs)
            // }

            showToast({
                type: 'info',
                title: 'Signing Not Fully Implemented',
                body: `The transaction signing has not been fully implemented, no TXs were sent yet.`,
            })

            removeSignRequest(request)
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Signing Failed',
                body: `${error}`,
            })
        }
    }

    const rejectRequest = () => {
        removeSignRequest(request)
    }

    return (
        <PWView style={styles.container}>
            <Text
                h4
                h4Style={styles.title}
            >
                {isMultipleTransactions
                    ? 'Review Transactions'
                    : 'Review Transaction'}
            </Text>
            {!isMultipleTransactions ? (
                <GroupTransactionView request={request} />
            ) : (
                <SingleTransactionView request={request} />
            )}
            <PWView style={styles.footer}>
                <PWView style={styles.feeContainer}>
                    <Text
                        h4
                        h4Style={styles.feeLabel}
                    >
                        Transaction Fee
                    </Text>
                    <CurrencyDisplay
                        currency='ALGO'
                        precision={3}
                        value={txFees}
                        showSymbol
                        h4
                        h4Style={styles.feeAmount}
                    />
                </PWView>
                <PWTouchableOpacity style={styles.detailsContainer}>
                    <Text
                        h4
                        h4Style={styles.detailsLabel}
                    >
                        Show Transaction Details
                    </Text>
                    <PWIcon
                        variant='link'
                        name='chevron-right'
                    />
                </PWTouchableOpacity>
                <PWView style={styles.buttonContainer}>
                    <PWButton
                        title='Cancel'
                        variant='secondary'
                        onPress={rejectRequest}
                        style={styles.button}
                    />
                    <PWButton
                        title={
                            isMultipleTransactions ? 'Confirm All' : 'Confirm'
                        }
                        variant='primary'
                        onPress={signAndSend}
                        style={styles.button}
                    />
                </PWView>
            </PWView>
        </PWView>
    )
}

export default SigningView
