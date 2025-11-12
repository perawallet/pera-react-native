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

import { useStyles } from './styles';
import PWView from '../../common/view/PWView';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RoundButton from '../../common/round-button/RoundButton';

import SwapIcon from '../../../../assets/icons/swap.svg';
import MoreIcon from '../../../../assets/icons/ellipsis.svg';
import StakeIcon from '../../../../assets/icons/dot-stack.svg';
import SendIcon from '../../../../assets/icons/outflow.svg';
import { Alert } from 'react-native';
import { useTheme } from '@rneui/themed';
import { useState } from 'react';
import SendFundsBottomSheet from '../../send-funds/bottom-sheet/SendFundsBottomSheet';

const ButtonPanel = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const themeStyle = useStyles();
  const [sendFundsOpen, setSendFundsOpen] = useState<boolean>(false);

  const goToRootPage = (name: string) => {
    navigation.replace('TabBar', { screen: name });
  };

  const notImplemented = () => {
    Alert.alert('Not Implemented');
  };
  
  const closeSendFunds = () => {
    setSendFundsOpen(false);
  };

  const openSendFunds = () => {
    setSendFundsOpen(true);
  };

  return (
    <PWView style={themeStyle.container}>
      <RoundButton
        buttonStyle={themeStyle.blackButton}
        title="Swap"
        icon={<SwapIcon color={theme.colors.buttonHelperText} />}
        onPress={() => goToRootPage('Swap')}
      />
      <RoundButton
        title="Stake"
        icon={<StakeIcon color={theme.colors.textMain} />}
        onPress={() => goToRootPage('Staking')}
      />
      <RoundButton
        title="Send"
        icon={<SendIcon color={theme.colors.textMain} />}
        onPress={openSendFunds}
      />
      <RoundButton
        title="More"
        icon={<MoreIcon color={theme.colors.textMain} />}
        onPress={notImplemented}
      />
      <SendFundsBottomSheet onClose={closeSendFunds} isVisible={sendFundsOpen} />
    </PWView>
  );
};

export default ButtonPanel;
