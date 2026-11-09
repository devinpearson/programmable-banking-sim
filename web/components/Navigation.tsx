import Image from 'next/image';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

const EXTERNAL_LINKS = [
  { href: 'https://developer.investec.com/za/api-products', label: 'Documentation' },
  { href: 'https://investec.gitbook.io/programmable-banking-community-wiki', label: 'Wiki' },
  { href: 'https://github.com/devinpearson/programmable-banking-sim', label: 'GitHub' },
  {
    href: 'https://www.postman.com/investec-open-api/workspace/hack-days/collection/26868804-62ce3cf6-3d98-4f62-ad82-b912b9826d51',
    label: 'Postman',
  },
];

export default function Navigation() {
  return (
    <header className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <nav
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"
        aria-label="Global"
      >
        <Link href="/" className="flex items-center gap-3">
          <Image src="/zeb.png" alt="" width={32} height={32} className="h-8 w-auto" />
          <span className="font-semibold text-gray-900 dark:text-white">Programmable Banking Sandbox</span>
        </Link>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          <Link href="/" className="hover:text-blue-600">
            Dashboard
          </Link>
          <Link href="/oauth" className="hover:text-blue-600">
            OAuth tester
          </Link>
          <Link href="/guide" className="hover:text-blue-600">
            Quick start
          </Link>
          {EXTERNAL_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-blue-600"
            >
              {link.label}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
