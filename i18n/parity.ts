import type enCommon from '../messages/en/common.json';
import type enNav from '../messages/en/nav.json';
import type enDashboard from '../messages/en/dashboard.json';
import type enExpenses from '../messages/en/expenses.json';
import type enContributions from '../messages/en/contributions.json';
import type enMembers from '../messages/en/members.json';
import type enAuth from '../messages/en/auth.json';

import type thCommon from '../messages/th/common.json';
import type thNav from '../messages/th/nav.json';
import type thDashboard from '../messages/th/dashboard.json';
import type thExpenses from '../messages/th/expenses.json';
import type thContributions from '../messages/th/contributions.json';
import type thMembers from '../messages/th/members.json';
import type thAuth from '../messages/th/auth.json';

type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type AssertEqual<A, B> = IsEqual<A, B> extends true ? true : never;

const _thParity: {
  common: AssertEqual<typeof thCommon, typeof enCommon>;
  nav: AssertEqual<typeof thNav, typeof enNav>;
  dashboard: AssertEqual<typeof thDashboard, typeof enDashboard>;
  expenses: AssertEqual<typeof thExpenses, typeof enExpenses>;
  contributions: AssertEqual<typeof thContributions, typeof enContributions>;
  members: AssertEqual<typeof thMembers, typeof enMembers>;
  auth: AssertEqual<typeof thAuth, typeof enAuth>;
} = {
  common: true,
  nav: true,
  dashboard: true,
  expenses: true,
  contributions: true,
  members: true,
  auth: true,
};

void _thParity;
