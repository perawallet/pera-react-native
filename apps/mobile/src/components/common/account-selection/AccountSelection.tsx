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

import { Text, useTheme } from '@rneui/themed';
import { getAccountDisplayName, useAppStore } from '@perawallet/core';
import PeraView from '../view/PeraView';
import { useStyles } from './styles';

import ChevronDown from '../../../../assets/icons/chevron-down.svg';
import WalletIcon from '../../../../assets/icons/wallet-in-circle.svg';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';

type AccountSelectionProps = {} & TouchableOpacityProps;

const AccountSelection = (props: AccountSelectionProps) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const getSelectedAccount = useAppStore(state => state.getSelectedAccount);
  const account = getSelectedAccount();
  const displayName = getAccountDisplayName(account);

  return (
    <TouchableOpacity {...props} activeOpacity={0.8}>
      <PeraView style={styles.container}>
        <WalletIcon />
        <Text h4Style={styles.text} h4>
          {displayName}
        </Text>
        <ChevronDown color={theme.colors.textGray} />
      </PeraView>
    </TouchableOpacity>
  );
};

export default AccountSelection;
