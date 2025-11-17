import { Text } from '@rneui/themed';
import PWIcon, { IconName } from '../icons/PWIcon';
import PWView from '../view/PWView';
import { useStyles } from './styles';
import { PropsWithChildren } from 'react';

type PWHeaderProps = {
  title?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onLeftPress?: () => void;
  onRightPress?: () => void;
} & PropsWithChildren;

const PWHeader = ({
  title,
  leftIcon,
  rightIcon,
  onLeftPress,
  onRightPress,
  children
}: PWHeaderProps) => {
  const styles = useStyles();

  return (
    <PWView style={styles.container}>
      <PWView style={styles.iconContainer}>
        {!!leftIcon && <PWIcon name={leftIcon} onPress={onLeftPress} />}
      </PWView>
      <PWView style={styles.childContainer}>
        {children}
        {!!title && (
          <Text h4 h4Style={styles.title}>
            {title}
          </Text>
        )}
      </PWView>
      <PWView style={styles.iconContainer}>
        {!!rightIcon && <PWIcon name={rightIcon} onPress={onRightPress} />}
      </PWView>
    </PWView>
  );
};

export default PWHeader;
