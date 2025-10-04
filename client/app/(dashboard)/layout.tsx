import React from 'react';

interface Props {
  className?: string;
}

export const DashboardLayout: React.FC<Props> = ({ className }) => {
  return <div className={className}></div>;
};
