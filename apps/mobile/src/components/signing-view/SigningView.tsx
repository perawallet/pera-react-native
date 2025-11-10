import PeraView from '../common/view/PeraView';
import {
  SignRequest,
  truncateAlgorandAddress,
  useAppStore,
} from '@perawallet/core';
import { useStyles } from './styles';
import { Text, useTheme } from '@rneui/themed';
import PeraButton from '../common/button/PeraButton';
import CurrencyDisplay from '../common/currency-display/CurrencyDisplay';
import Decimal from 'decimal.js';
import { ScrollView, TouchableOpacity } from 'react-native';

import ChevronRight from '../../../assets/icons/chevron-right.svg';
import TransactionIcon from '../common/transaction-icon/TransactionIcon';
import BalanceImpactView from './balance-impact/BalanceImpactView';
import useToast from '../../hooks/toast';

type SigningViewProps = {
  request: SignRequest;
};

//TODO: we need to support all tx types here
//TODO: use real data from the TXs
const SingleTransactionView = ({ request }: SigningViewProps) => {
  const styles = useStyles();
  const tx = request.txs?.at(0)?.at(0)!;

  return (
    <PeraView style={styles.body}>
      <TransactionIcon type="pay" size="large" />
      <Text h4>Transfer to {truncateAlgorandAddress(tx.receiver)}</Text>
      <CurrencyDisplay
        currency="ALGO"
        precision={3}
        value={Decimal(-5059.44)}
        showSymbol
        h1
        h1Style={styles.mainAmount}
      />
      <CurrencyDisplay
        currency="USD"
        precision={3}
        value={Decimal(-5059.44 * 0.17)}
        showSymbol
        h3
        h3Style={styles.secondaryAmount}
      />
    </PeraView>
  );
};

const GroupTransactionView = ({ request }: SigningViewProps) => {
  const styles = useStyles();
  const isMultipleGroups = request.txs?.length > 1;
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <TransactionIcon type="group" size="large" />
      <Text h4>
        {isMultipleGroups
          ? 'Transaction Groups'
          : `Group ID: ${truncateAlgorandAddress('SomeIDForAGroup')}`}
      </Text>
      {isMultipleGroups ? (
        <PeraView>
          <Text>This is where we'll show the groups</Text>
        </PeraView>
      ) : (
        <BalanceImpactView />
      )}
    </ScrollView>
  );
};

const SigningView = ({ request }: SigningViewProps) => {
  const styles = useStyles();
  const { theme } = useTheme();
  const { removeSignRequest } = useAppStore();
  //const { signTransactionForAddress } = useTransactionSigner()
  const { showToast } = useToast();

  const isMultipleTransactions =
    request.txs?.length > 1 || (request.txs?.at(0)?.length ?? 0) > 1;
  const txFees = Decimal(0.001);

  const signAndSend = async () => {
    try {
      // TODO when we have valid TXs we'll need to sign them and then send them to the server
      // We might do this using algokit-utils or we can do it ourselves
      //
      // let allSigs = []
      // for(let group of request.txs) {
      //     let sigs = []

      //     for(let tx of group) {
      //         const sig = await signTransactionForAddress(tx.sender, tx)
      //         sigs.push(sig)
      //     }

      //     allSigs.push(sigs)
      // }

      showToast({
        type: 'info',
        title: 'Signing Not Fully Implemented',
        body: `The transaction signing has not been fully implemented, no TXs were sent yet.`,
      });

      removeSignRequest(request);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Signing Failed',
        body: `${error}`,
      });
    }
  };

  const rejectRequest = () => {
    removeSignRequest(request);
  };

  return (
    <PeraView style={styles.container}>
      <Text h4 h4Style={styles.title}>
        {isMultipleTransactions ? 'Review Transactions' : 'Review Transaction'}
      </Text>
      {!isMultipleTransactions ? (
        <GroupTransactionView request={request} />
      ) : (
        <SingleTransactionView request={request} />
      )}
      <PeraView style={styles.footer}>
        <PeraView style={styles.feeContainer}>
          <Text h4 h4Style={styles.feeLabel}>
            Transaction Fee
          </Text>
          <CurrencyDisplay
            currency="ALGO"
            precision={3}
            value={txFees}
            showSymbol
            h4
            h4Style={styles.feeAmount}
          />
        </PeraView>
        <TouchableOpacity style={styles.detailsContainer}>
          <Text h4 h4Style={styles.detailsLabel}>
            Show Transaction Details
          </Text>
          <ChevronRight color={theme.colors.linkPrimary} />
        </TouchableOpacity>
        <PeraView style={styles.buttonContainer}>
          <PeraButton
            title="Cancel"
            variant="tertiary"
            onPress={rejectRequest}
            containerStyle={styles.button}
          />
          <PeraButton
            title={isMultipleTransactions ? 'Confirm All' : 'Confirm'}
            variant="primary"
            onPress={signAndSend}
            containerStyle={styles.button}
          />
        </PeraView>
      </PeraView>
    </PeraView>
  );
};

export default SigningView;
