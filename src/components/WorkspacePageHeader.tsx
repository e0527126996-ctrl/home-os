import React from 'react';

type WorkspacePageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
};

export function WorkspacePageHeader({ eyebrow, title, description, actions, meta }: WorkspacePageHeaderProps) {
  return (
    <header className="homeos-page-heading homeos-atlas-page-heading" dir="rtl">
      <div className="homeos-page-heading-copy">
        <div className="homeos-page-eyebrow"><span className="homeos-page-eyebrow-mark" />{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
        {meta && <div className="homeos-page-meta">{meta}</div>}
      </div>
      {actions && <div className="homeos-page-actions">{actions}</div>}
    </header>
  );
}
