import { Button, ButtonProps, useTheme } from '@rneui/themed';
import { useStyles } from './styles';
import { useMemo } from 'react';

export type PeraButtonProps = {
  variant: 'primary' | 'secondary';
} & ButtonProps;

const PeraButton = (props: PeraButtonProps) => {
  const style = useStyles(props);
  const { theme } = useTheme();

  return <Button buttonStyle={style.buttonStyle} titleStyle={style.titleStyle} {...props} />;
};

export default PeraButton;
