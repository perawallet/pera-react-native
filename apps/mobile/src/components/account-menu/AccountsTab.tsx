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

import PWView from '../common/view/PWView';
import {
  getAccountDisplayName,
  useAllAccounts,
  useSelectedAccountAddress,
  WalletAccount,
} from '@perawallet/core';
import { TouchableOpacity } from 'react-native';
import { useStyles } from './styles';
import { Text, useTheme } from '@rneui/themed';

import WalletIcon from '../../../assets/icons/wallet.svg';
import SortIcon from '../../../assets/icons/list-arrow-down.svg';
import PlusIcon from '../../../assets/icons/plus-with-border.svg';

type AccountsTabProps = {
  onSelected: (account: WalletAccount) => void;
};
const AccountsTab = (props: AccountsTabProps) => {
  const styles = useStyles();
  const { theme } = useTheme();
  const accounts = useAllAccounts();
  const { selectedAccountAddress, setSelectedAccountAddress } = useSelectedAccountAddress();

  const getRouteName = (account?: WalletAccount): string => {
    return account ? getAccountDisplayName(account) : 'Account';
  };

  const getWalletIcon = (acct: WalletAccount) => {
    return (
      <WalletIcon
        color={
          acct.address === selectedAccountAddress
            ? theme.colors.secondary
            : theme.colors.textMain
        }
      />
    );
  };

  const handleTap = (acct: WalletAccount) => {
    setSelectedAccountAddress(acct.address);
    props?.onSelected?.(acct);
  };
  return (
    <>
      <PWView style={styles.titleBar}>
        <PWView style={styles.titleBarButtonContainer}>
          <TouchableOpacity style={styles.addButtonContainer}>
            <PlusIcon style={styles.addButton} />
            <Text style={styles.addButtonTitle}>Add Account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sortButton}>
            <SortIcon />
            <Text style={styles.sortButtonTitle}>Sort</Text>
          </TouchableOpacity>
        </PWView>
      </PWView>
      <PWView style={styles.accountContainer}>
        {accounts.map(acct => (
          <TouchableOpacity
            key={acct.address}
            style={
              acct.address === selectedAccountAddress
                ? styles.activeItem
                : styles.passiveItem
            }
            onPress={() => handleTap(acct)}
          >
            {getWalletIcon(acct)}
            <Text
              style={
                acct.address === selectedAccountAddress
                  ? styles.activeLabel
                  : styles.passiveLabel
              }
            >
              {getRouteName(acct)}
            </Text>
          </TouchableOpacity>
        ))}
      </PWView>
    </>
  );
};
export default AccountsTab;
