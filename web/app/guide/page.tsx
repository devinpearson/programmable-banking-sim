import Image from 'next/image';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Quick start | Programmable Banking Sandbox' };

const STEPS = [
  {
    title: 'Open the Postman collection',
    text: 'Use the Postman link in the menu to open the collection made for this sandbox.',
    image: '/1_postman_link.png',
  },
  {
    title: 'Pick the environment',
    text: 'With the collection open, choose its environment. It sets up the variables the requests use.',
    image: '/2_postman_env.png',
  },
  { title: 'Select "Sim"', text: 'Select the environment named Sim.', image: '/3_postman_env_select.png' },
  {
    title: 'Open the environment',
    text: 'In the left-hand menu, select Environments, then the Sim environment.',
    image: '/4_postman_env_update.png',
  },
  {
    title: 'Check the variables',
    text: 'The variables now point at this sandbox.',
    image: '/5_postman_sim_update.png',
  },
  {
    title: 'Get accounts',
    text: 'In Collections, open the Accounts folder, select Get Accounts and click Send.',
    image: '/6_postman_accounts.png',
  },
  {
    title: 'See the data',
    text: 'The response lists the sandbox accounts. Change them from the dashboard and send the request again.',
    image: '/7_postman_account_data.png',
  },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Quick start</h1>
      <p className="mt-2 text-gray-600 dark:text-gray-300">
        Get going with the sandbox in Postman. The API runs at <code>http://localhost:3000</code>.
      </p>
      <ol className="mt-10 space-y-12">
        {STEPS.map((step, i) => (
          <li key={step.image} className="grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Step {i + 1}</p>
              <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{step.title}</h2>
              <p className="mt-2 text-gray-600 dark:text-gray-300">{step.text}</p>
            </div>
            <Image
              src={step.image}
              alt={step.title}
              width={1200}
              height={800}
              className="h-auto w-full rounded-lg border border-gray-200 shadow-md dark:border-gray-700"
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
