import { Button, ButtonProps } from '@rneui/themed';
import { useStyles } from './styles';

export type PeraButtonProps = {
  variant: 'primary' | 'secondary';
} & ButtonProps;

const PeraButton = (props: PeraButtonProps) => {
  const style = useStyles(props);

  return <Button style={style.buttonStyle} {...props} />;
};

export default PeraButton;
