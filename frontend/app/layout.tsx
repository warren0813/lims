import './globals.css';
import type { ReactNode } from 'react';

export const metadata={title:'LIMS',description:'Laboratory Information Management System'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="en" suppressHydrationWarning><body suppressHydrationWarning>{children}</body></html>;}
