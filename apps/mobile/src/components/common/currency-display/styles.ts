import { makeStyles } from '@rneui/themed';
import { CurrencyDisplayProps } from './CurrencyDisplay';

export const useStyles = makeStyles((theme, props: CurrencyDisplayProps) => {
  let size = 16;

  if (props.h1) {
    size = 40;
  } else if (props.h2) {
    size = 36;
  } else if (props.h3) {
    size = 24;
  }

  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    skeleton: {
      maxWidth: 150,
      height: size,
    },
    textContainer: {
      flexGrow: 1,
      alignItems: props.alignRight ? 'flex-end' : 'flex-start',
    },
    algoIcon: {
      width: size,
      height: size,
      flexShrink: 1,
    },
  };
});
