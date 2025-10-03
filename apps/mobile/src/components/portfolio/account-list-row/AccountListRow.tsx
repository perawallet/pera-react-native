import { useStyles } from './styles';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Text } from '@rneui/themed';
import {
  getAccountDisplayName,
  truncateAlgorandAddress,
  useAccountBalances,
  WalletAccount,
} from '@perawallet/core';

import WalletIcon from '../../../../assets/icons/wallet-in-circle.svg';
import LedgerIcon from '../../../../assets/icons/ledger-in-circle.svg';
import WatchIcon from '../../../../assets/icons/eye-in-circle.svg';

import { TouchableOpacity } from 'react-native';
import PeraView from '../../common/view/PeraView';
import { useMemo } from 'react';
import CurrencyDisplay from '../../common/currency-display/CurrencyDisplay';
import Decimal from 'decimal.js';

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
  const icon = useMemo(() => {
    if (account.type === 'ledger') return <LedgerIcon />;
    if (account.type === 'standard') return <WalletIcon />;
    if (account.type === 'watch') return <WatchIcon />;
  }, [account]);

  const data = useAccountBalances([account]);
  const showAltAddress = account.rekeyAddress || account.name?.length;

  const goToAccount = () => {
    navigation.push('Account', { account });
  };

  return (
    <TouchableOpacity style={themeStyle.container} onPress={goToAccount}>
      {icon}
      <PeraView style={themeStyle.textContainer}>
        <PeraView style={themeStyle.nameContainer}>
          <Text h4>{displayName}</Text>
          {showAltAddress && (
            <Text style={themeStyle.secondaryText}>{displayAddress}</Text>
          )}
        </PeraView>
        <PeraView style={themeStyle.balanceContainer}>
          <CurrencyDisplay
            h4
            value={data.length ? data[0].algoAmount : Decimal(0)}
            precision={2}
            currency="ALGO"
            alignRight
            skeleton={data.length ? !data[0].isFetched : false}
          />
          <CurrencyDisplay
            style={themeStyle.secondaryText}
            value={data.length ? data[0].usdAmount : Decimal(0)}
            precision={2}
            currency="USD"
            alignRight
            skeleton={data.length ? !data[0].isFetched : false}
          />
        </PeraView>
      </PeraView>
    </TouchableOpacity>
  );
};

export default AccountListRow;
