import React from 'react';
import PeraView from '../components/common/view/PeraView';

export type MainScreenLayoutProps = {
  fullScreen?: boolean;
  showBack?: boolean;
  title?: string;
  header?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

const MainScreenLayout = (props: MainScreenLayoutProps) => {
  const { fullScreen, showBack, title, header, className, children, ...rest } = props;

  return (
    <PeraView className={`flex flex-col h-full ${className || ''}`} {...rest}>
      {header && (
        <div className="flex items-center p-6 border-b bg-white">
          {showBack && (
            <button
              className="mr-4 text-gray-500 hover:text-gray-700"
              onClick={() => window.history.back()}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
          )}
          {title && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </PeraView>
  );
};

export default MainScreenLayout;
