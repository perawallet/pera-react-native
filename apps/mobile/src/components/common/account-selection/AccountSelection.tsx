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
import { getAccountDisplayName, useSelectedAccount } from '@perawallet/core';
import PWView from '../view/PWView';
import { useStyles } from './styles';

import ChevronDown from '../../../../assets/icons/chevron-down.svg';
import WalletIcon from '../../../../assets/icons/wallet-in-circle.svg';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';

type AccountSelectionProps = {} & TouchableOpacityProps;

const AccountSelection = (props: AccountSelectionProps) => {
  const { theme } = useTheme();
  const styles = useStyles();
  const account = useSelectedAccount();
  const displayName = getAccountDisplayName(account);

  //TODO we may want to add support for pending inbox items here too
  //(like the current inbox since we're using the same screen real estate)
  return (
    <TouchableOpacity {...props} activeOpacity={0.8}>
      <PWView style={styles.container}>
        <WalletIcon />
        <Text h4Style={styles.text} h4>
          {displayName}
        </Text>
        <ChevronDown color={theme.colors.textGray} />
      </PWView>
    </TouchableOpacity>
  );
};

export default AccountSelection;
