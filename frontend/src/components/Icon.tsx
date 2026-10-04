import React from 'react';

export default function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    signal: <><path d="M4 18.5a2 2 0 1 0 0 .01" /><path d="M2.2 13.1a8 8 0 0 1 11.3 0M-1.3 9.6a13 13 0 0 1 18.4 0" /></>,
    battery: <><rect x="1.5" y="5" width="17" height="12" rx="2" /><path d="M21 9v4M5 9h7v4H5z" /></>,
    camera: <><rect x="2" y="5" width="16" height="13" rx="2" /><path d="m18 9 4-2v9l-4-2M7 5l1.3-2h3.4L13 5" /></>,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m15 8-2 5-5 2 2-5z" /></>,
    crosshair: <><circle cx="12" cy="12" r="8" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></>,
    swap: <><path d="M7 7h12l-3-3m3 3-3 3M17 17H5l3 3m-3-3 3-3" /></>,
    alert: <><path d="M12 3 2.5 20h19z" /><path d="M12 9v5m0 3v.1" /></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
