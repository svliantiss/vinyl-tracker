import './globals.css';
import type { Metadata } from 'next';
import { Inter, Space_Mono } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceMono = Space_Mono({ 
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono'
});

export const metadata: Metadata = {
  title: 'BPM Counter',
  description: 'A minimal BPM and key detection app',
  manifest: '/manifest.json',
  themeColor: '#000000',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceMono.variable} font-sans antialiased bg-black`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <footer className="fixed bottom-0 w-full py-2 text-center text-sm">
            Made with ❤️ by Wesly Nouse - <a href="https://buymeacoffee.com/n0use" target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-gray-300">Buy me a coffee</a>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}