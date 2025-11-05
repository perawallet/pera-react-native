import PaymentIcon from '../../../../assets/icons/transactions/payment.svg';
import GroupIcon from '../../../../assets/icons/transactions/group.svg';

import { useMemo } from 'react';
import { SvgProps } from 'react-native-svg';
import { useIsDarkMode } from '../../../hooks/theme';
import PeraView from '../view/PeraView';
import { useStyles } from './styles';
import { useTheme } from '@rneui/themed';

//TODO support all tx types
export type TransactionIconProps = {
  type: "pay" | "group"
  size?: "small" | "large";
} & SvgProps;

const TransactionIcon = (props: TransactionIconProps) => {
  const { type, style, size = "small", ...rest } = props;
  const { theme } = useTheme()
  const styles = useStyles(props);
  const isDarkMode = useIsDarkMode();
  const iconSize = size === 'small' ? theme.spacing.xl : theme.spacing.xl * 2

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
    return <GroupIcon {...rest} 
          width={iconSize}
          height={iconSize} />; 
  }, [type, rest, isDarkMode, styles.icon]);

  return <PeraView style={[styles.container, style]}>{icon}</PeraView>;
};

export default TransactionIcon;
