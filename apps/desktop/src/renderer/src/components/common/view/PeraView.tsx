import React from 'react';

export type PeraViewProps = React.HTMLAttributes<HTMLDivElement>;

const PeraView = (props: PeraViewProps) => {
  const { className, ...rest } = props;
  return (
    <div className={`bg-white dark:bg-gray-900 ${className || ''}`} {...rest}>
      {props.children}
    </div>
  );
};

export default PeraView;
