import { useStyles } from './styles';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ListItem, Text } from '@rneui/themed';
import {
  getAccountDisplayName,
  truncateAlgorandAddress,
  WalletAccount,
} from '@perawallet/core';

import WalletIcon from '../../../../assets/icons/wallet-with-algo.svg';
import { TouchableOpacity } from 'react-native';
import PeraView from '@components/view/PeraView';
import { useMemo } from 'react';
import CurrencyDisplay from '@components/currency-display/CurrencyDisplay';

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

  //TODO pull from server/node/somewhere
  const algoAmount = '0';
  const usdAmount = '0';

  const goToAccount = () => {
    navigation.push('AccountDetails', { account });
  };

  return (
    <TouchableOpacity style={themeStyle.container} onPress={goToAccount}>
      <WalletIcon />
      <PeraView style={themeStyle.nameContainer}>
        <PeraView>
          <Text>{displayName}</Text>
          <Text>{displayAddress}</Text>
        </PeraView>
        <PeraView style={themeStyle.balanceContainer}>
          <CurrencyDisplay
            value={algoAmount}
            precision={2}
            currencySymbol="A"
          />
          <CurrencyDisplay value={usdAmount} precision={2} currencySymbol="$" />
        </PeraView>
      </PeraView>
      <ListItem.Chevron />
    </TouchableOpacity>
  );
};

export default AccountListRow;
