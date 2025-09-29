import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStyles } from './styles';
import { Text, useTheme } from '@rneui/themed';
import PeraView from '../../components/view/PeraView';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import PanelButton from '../../components/panel-button/PanelButton';

import WelcomeImage from '../../../assets/images/welcome-background.svg';
import WalletIcon from '../../../assets/icons/wallet-with-algo.svg';
import KeyIcon from '../../../assets/icons/key.svg';
import ChevronNext from '../../../assets/icons/chevron-right.svg';
import { ActivityIndicator, Alert } from 'react-native';
import { useCreateAccount } from '@perawallet/core';
import { Overlay } from '@rneui/themed';
import { useState } from 'react';

const OnboardingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const styles = useStyles();
  const createAccount = useCreateAccount();
  const { theme } = useTheme();
  const [processing, setProcessing] = useState(false);

  const doCreate = async () => {
    try {
      const account = await createAccount({ account: 0, keyIndex: 0 });
      navigation.push('NameAccount', { account: account });
    } finally {
      setProcessing(false);
    }
  };

  const createAccountHandler = async () => {
    setProcessing(true);
    doCreate();
  };

  const importAccount = () => {
    Alert.alert('Not yet implemented');
  };

  return (
    <MainScreenLayout style={styles.layout} fullScreen>
      <PeraView>
        <PeraView style={styles.headerContainer}>
          <Text style={styles.headerTitle} h1>
            Welcome to {'\n'} Pera Wallet
          </Text>
          <WelcomeImage style={styles.headerImage} />
        </PeraView>
        <PeraView style={styles.mainContainer}>
          <Text style={styles.buttonTitle} h4>
            New to Algorand?
          </Text>
          <PanelButton
            title="Create a new wallet"
            titleWeight="h4" 
            onPress={createAccountHandler}
            leftIcon={<WalletIcon />}
            rightIcon={<ChevronNext />}
          />

          <Text style={styles.buttonTitle} h4>
            Already have an account?
          </Text>
          <PanelButton
            title="Import an account"
            titleWeight="h4" 
            onPress={importAccount}
            leftIcon={<KeyIcon />}
            rightIcon={<ChevronNext />}
          />
        </PeraView>
      </PeraView>
      <Overlay
        isVisible={processing}
        overlayStyle={styles.overlay}
        backdropStyle={styles.overlayBackdrop}
      >
        <Text>Setting up your wallet...</Text>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </Overlay>
    </MainScreenLayout>
  );
};

export default OnboardingScreen;
