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

import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStyles } from './styles';
import { Text, useTheme } from '@rneui/themed';
import PWView from '../../components/common/view/PWView';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import PanelButton from '../../components/common/panel-button/PanelButton';

import WelcomeImage from '../../../assets/images/welcome-background.svg';
import WalletIcon from '../../../assets/icons/wallet-with-algo.svg';
import KeyIcon from '../../../assets/icons/key.svg';
import ChevronNext from '../../../assets/icons/chevron-right.svg';
import { ActivityIndicator } from 'react-native';
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
    navigation.push('ImportAccount');
  };

  return (
    <MainScreenLayout style={styles.layout} fullScreen>
      <PWView>
        <PWView style={styles.headerContainer}>
          <Text style={styles.headerTitle} h1>
            Welcome to {'\n'} Pera Wallet
          </Text>
          <WelcomeImage style={styles.headerImage} />
        </PWView>
        <PWView style={styles.mainContainer}>
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
        </PWView>
      </PWView>
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
