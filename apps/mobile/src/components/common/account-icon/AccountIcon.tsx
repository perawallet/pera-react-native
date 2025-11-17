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

import PWIcon from '../icons/PWIcon';

import { useMemo } from 'react';
import { SvgProps } from 'react-native-svg';
import { WalletAccount } from '@perawallet/core';

//TODO support all account types
export type AccountIconProps = {
  account?: WalletAccount;
} & SvgProps;

const AccountIcon = (props: AccountIconProps) => {
  const { account, ...rest } = props;

  const icon = useMemo(() => {
    if (!account) return <></>;
    const name = account.hdWalletDetails ? 'wallet-in-circle' : 'wallet';
    return <PWIcon {...rest} name={name} />;
  }, [account, rest]);

  return icon;
};

export default AccountIcon;
