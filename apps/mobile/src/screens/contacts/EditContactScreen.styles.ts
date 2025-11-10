import { makeStyles } from '@rneui/themed';

export const useStyles = makeStyles(theme => {
  return {
    container: {
      padding: theme.spacing.xl,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: theme.spacing.xl,
      marginTop: theme.spacing.xl,
      justifyContent: 'space-between',
    },
    button: {
      paddingHorizontal: theme.spacing.xl,
    },
    avatar: {
      alignItems: 'center',
      marginVertical: theme.spacing.xl,
    },
    formContainer: {
      gap: theme.spacing.md,
    },
    label: {
      fontSize: 13,
      color:
        theme.mode === 'dark'
          ? theme.colors.textGrayLighter
          : theme.colors.textGray,
      marginBottom: theme.spacing.xs,
    },
    value: {},
    addressValueContainer: {
      flexDirection: 'row',
      gap: theme.spacing.xl,
    },
  };
});
