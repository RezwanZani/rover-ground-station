import React from 'react';
import Icon from './Icon';

export default function Panel({
  title,
  icon,
  meta,
  children,
  className = "",
}: {
  title: string;
  icon?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      <header className="panel-header">
        <div className="flex items-center gap-2">
          {icon && <Icon name={icon} className="h-3.5 w-3.5 text-[#99a2a7]" />}
          <h2>{title}</h2>
        </div>
        {meta && <div className="panel-meta">{meta}</div>}
      </header>
      {children}
    </section>
  );
}
