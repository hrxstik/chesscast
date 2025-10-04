import React from 'react';

interface Props {
  className?: string;
}

export const HomeLayout: React.FC<Props> = ({ className }) => {
  return <div className={className}></div>;
};
