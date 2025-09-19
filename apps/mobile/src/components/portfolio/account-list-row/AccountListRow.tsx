import { useStyles } from './styles';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ListItem, Text } from '@rneui/themed';
import {
  getAccountDisplayName,
  truncateAlgorandAddress,
  WalletAccount,
} from '@perawallet/core';

import WalletIcon from '../../../../assets/icons/wallet-in-circle.svg';
import LedgerIcon from '../../../../assets/icons/ledger-in-circle.svg';
import WatchIcon from '../../../../assets/icons/eye-in-circle.svg';

import { TouchableOpacity } from 'react-native';
import PeraView from '../../../components/view/PeraView';
import { useMemo } from 'react';
import CurrencyDisplay from '../../../components/currency-display/CurrencyDisplay';

type AccountListRowProps = {
  account: WalletAccount;
};

const AccountListRow = ({ account }: AccountListRowProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const themeStyle = useStyles();
  const displayName = useMemo(() => getAccountDisplayName(account), [account]);
  const displayAddress = useMemo(
    () => truncateAlgorandAddress(account.address),
    [account],
  );
  const icon = useMemo(
    () => {
      if (account.type === 'ledger') return <LedgerIcon />
      if (account.type === 'standard') return <WalletIcon />
      if (account.type === 'watch') return <WatchIcon />
    },
    [account],
  );

  const showAltAddress = account.rekeyAddress || account.name?.length

  //TODO pull from server/node/somewhere
  const algoAmount = '0';
  const usdAmount = '0';

  const goToAccount = () => {
    navigation.push('AccountDetails', { account });
  };

  return (
    <TouchableOpacity style={themeStyle.container} onPress={goToAccount}>
      <WalletIcon />
      <PeraView style={themeStyle.textContainer}>
        <PeraView style={themeStyle.nameContainer}>
          <Text h4>{displayName}</Text>
          {showAltAddress && <Text style={themeStyle.secondaryText}>{displayAddress}</Text>}
        </PeraView>
        <PeraView style={themeStyle.balanceContainer}>
          <CurrencyDisplay
            h4
            value={algoAmount}
            precision={2}
            currencySymbol="A"
          />
          <CurrencyDisplay style={themeStyle.secondaryText} value={usdAmount} precision={2} currencySymbol="$" />
        </PeraView>
      </PeraView>
    </TouchableOpacity>
  );
};

export default AccountListRow;
