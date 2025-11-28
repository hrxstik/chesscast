import React from 'react';

type Props = {
  children: React.ReactNode;
};

export default function CreateOrganizationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      CreateOrganizationLayout
      {children}
    </div>
  );
}
