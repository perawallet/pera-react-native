import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStyles } from './styles';
import { Input, Text, useTheme } from '@rneui/themed';
import PeraView from '../../components/common/view/PeraView';
import PeraButton from '../../components/common/button/PeraButton';
import MainScreenLayout from '../../layouts/MainScreenLayout';

import WalletIcon from '../../../assets/icons/wallet.svg';
import {
  useAllAccounts,
  getAccountDisplayName,
  WalletAccount,
  useUpdateAccount,
} from '@perawallet/core';
import { useState } from 'react';
import type { StaticScreenProps } from '@react-navigation/native';
import { KeyboardAvoidingView, Platform } from 'react-native';

type NameAccountScreenProps = StaticScreenProps<{
  account: WalletAccount;
}>;

const NameAccountScreen = ({ route }: NameAccountScreenProps) => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const styles = useStyles();
  const { theme } = useTheme();
  const accounts = useAllAccounts();
  const updateAccount = useUpdateAccount();

  const routeAccount = route.params?.account;

  const [account, setAccount] = useState<WalletAccount>(routeAccount);
  const numWallets = accounts.length;
  const initialWalletName = getAccountDisplayName(account);
  const [walletDisplay, setWalletDisplay] = useState<string>(initialWalletName);

  const saveName = (value: string) => {
    account.name = value;
    setAccount(account);
    setWalletDisplay(value);
    updateAccount(account);
  };

  const goToHome = () => {
    navigation.replace('TabBar', {
      screen: 'Home',
    });
  };

  return (
    <MainScreenLayout title="Name your account" showBack>
      <KeyboardAvoidingView
        style={styles.mainContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text h4 style={styles.helperText}>
          Name your account to easily identify it while using the Pera Wallet.
          These names are stored locally, and can only be seen by you.
        </Text>
        <PeraView style={styles.walletNameContainer}>
          <WalletIcon color={theme.colors.textGray} />
          <Text h4 style={styles.nameText}>{`Wallet #${numWallets + 1}`}</Text>
        </PeraView>
        <Input
          label="Account name"
          containerStyle={styles.input}
          value={walletDisplay}
          onChangeText={saveName}
          autoFocus
        />
        <PeraView style={styles.spacer} />
        <PeraButton
          style={styles.finishButton}
          variant="primary"
          title="Finish Account Creation"
          onPress={goToHome}
        />
      </KeyboardAvoidingView>
    </MainScreenLayout>
  );
};

export default NameAccountScreen;
