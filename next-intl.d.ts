import type common from './messages/en/common.json';
import type nav from './messages/en/nav.json';
import type dashboard from './messages/en/dashboard.json';
import type expenses from './messages/en/expenses.json';
import type contributions from './messages/en/contributions.json';
import type members from './messages/en/members.json';
import type auth from './messages/en/auth.json';

type AppMessages = {
  common: typeof common;
  nav: typeof nav;
  dashboard: typeof dashboard;
  expenses: typeof expenses;
  contributions: typeof contributions;
  members: typeof members;
  auth: typeof auth;
};

declare module 'use-intl' {
  interface AppConfig {
    Locale: 'en' | 'th';
    Messages: AppMessages;
  }
}

declare module 'next-intl' {
  interface AppConfig {
    Locale: 'en' | 'th';
    Messages: AppMessages;
  }
}
