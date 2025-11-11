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

import PaymentIcon from '../../../../assets/icons/transactions/payment.svg';
import GroupIcon from '../../../../assets/icons/transactions/group.svg';

import { useMemo } from 'react';
import { SvgProps } from 'react-native-svg';
import PeraView from '../view/PeraView';
import { useStyles } from './styles';
import { useTheme } from '@rneui/themed';

//TODO support all tx types
export type TransactionIconProps = {
  type: 'pay' | 'group';
  size?: 'small' | 'large';
} & SvgProps;

const TransactionIcon = (props: TransactionIconProps) => {
  const { type, style, size = 'small', ...rest } = props;
  const { theme } = useTheme();
  const styles = useStyles(props);
  const iconSize = size === 'small' ? theme.spacing.xl : theme.spacing.xl * 2;

  const icon = useMemo(() => {
    if (!type) return <></>;
    if (type === 'pay')
      return (
        <PaymentIcon
          {...rest}
          style={styles.icon}
          width={iconSize}
          height={iconSize}
        />
      );
    return <GroupIcon {...rest} width={iconSize} height={iconSize} />;
  }, [type, rest, styles.icon, iconSize]);

  return <PeraView style={[styles.container, style]}>{icon}</PeraView>;
};

export default TransactionIcon;
