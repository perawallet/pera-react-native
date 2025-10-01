import { Button, ButtonProps } from '@rneui/themed';
import { useStyles } from './styles';

export type PeraButtonProps = {
  variant: 'primary' | 'secondary' | 'tertiary';
} & ButtonProps;

const PeraButton = (props: PeraButtonProps) => {
  const style = useStyles(props);

  return (
    <Button
      buttonStyle={style.buttonStyle}
      titleStyle={style.titleStyle}
      {...props}
    />
  );
};

export default PeraButton;
