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
    <section className={`flex min-h-0 flex-col overflow-hidden bg-[rgba(250,253,254,.98)] border border-[#c5d5dc] shadow-[0_3px_12px_rgba(31,70,84,.06),inset_0_1px_white] ${className}`}>
      <header className="flex-[0_0_35px] max-h-[720px]:flex-basis-[31px] flex items-center justify-between px-[11px] border-b border-[#c5d5dc] bg-[#eff6f8]">
        <div className="flex items-center gap-2">
          {icon && <Icon name={icon} className="h-3.5 w-3.5 text-[#587783]" />}
          <h2 className="m-0 font-mono font-[800] text-[9px] leading-[1] tracking-[.13em] text-[#102b35]">{title}</h2>
        </div>
        {meta && <div className="font-mono font-[700] text-[7px] leading-[1] tracking-[.1em] text-[#69828c]">{meta}</div>}
      </header>
      {children}
    </section>
  );
}
