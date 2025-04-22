import BpmCounter from '@/components/bpm-counter';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <BpmCounter />
    </main>
  );
}