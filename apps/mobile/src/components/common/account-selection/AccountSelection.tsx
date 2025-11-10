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
