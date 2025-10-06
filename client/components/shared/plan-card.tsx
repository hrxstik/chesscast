import Link from 'next/link';
import React from 'react';

interface Props {
  className?: string;
  title: string;
  price: string;
  description: string;
  features: string[];
}

export const PlanCard: React.FC<Props> = ({ title, price, description, features, className }) => {
  return (
    <div key={title} className={className}>
      <h2 className="text-2xl font-bold mb-2 dark:text-primary text-primary ">{title}</h2>
      <p className="text-xl font-semibold mb-4 dark:text-primary text-primary ">{price}</p>
      <p className="mb-6 dark:text-primary text-primary">{description}</p>
      <ul className="mb-8 space-y-2 flex-grow dark:text-primary text-primary ">
        {features.map((feature) => (
          <li key={feature} className="flex items-center dark:text-primary text-primary ">
            <svg
              className="h-6 w-6 text-green-500 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href="/login"
        className="mt-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
        aria-label={`Купить подписку ${title}`}>
        Купить
      </Link>
    </div>
  );
};
