# Trip Expense Tracker — UI-with-Mock-Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full UI for the trip expense tracker — every page, every interaction — driven entirely by an in-memory mock store with seed data. No Supabase, no real auth, no storage uploads. The mock layer is structured so the future backend swap is a localized change.

**Architecture:** Next.js 16 App Router + Tailwind v4 + a hand-rolled Y2K component library in `components/y2k/`. A Zustand store (persisted to `localStorage`) is the single source of truth for mock data. A fake auth context + dev-only "switch user" widget lets us preview every role. Pure-logic modules (`balance`, `permissions`, `money`) are TDD'd; visual components get smoke tests; pages are validated by manual click-through.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind CSS v4, Zustand (with persist), React Hook Form, Zod, date-fns, Vitest, @testing-library/react, jsdom.

**Reference spec:** `docs/superpowers/specs/2026-05-19-trip-expense-tracker-design.md`

---

## File Structure (target after this plan completes)

```
the-rich-boys/
├── app/
│   ├── globals.css                    # Y2K tokens + Tailwind v4 @theme
│   ├── layout.tsx                     # Root: html/body, font stack, wallpaper
│   ├── not-found.tsx                  # BSOD-styled 404
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── invite/[token]/page.tsx
│   └── (app)/
│       ├── layout.tsx                 # Auth guard + AppShell
│       ├── page.tsx                   # Dashboard
│       ├── expenses/
│       │   ├── page.tsx               # List
│       │   ├── new/page.tsx           # Create
│       │   └── [id]/page.tsx          # Detail / edit / delete / reimburse
│       ├── contributions/
│       │   ├── page.tsx               # List
│       │   └── new/page.tsx           # Create
│       └── members/page.tsx           # Roster + admin controls
├── components/
│   ├── y2k/
│   │   ├── window.tsx
│   │   ├── button.tsx
│   │   ├── text-input.tsx
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   ├── fieldset.tsx
│   │   ├── badge.tsx
│   │   ├── status-bar.tsx
│   │   ├── spinner.tsx
│   │   ├── marquee.tsx
│   │   ├── image-thumb.tsx
│   │   ├── dialog.tsx
│   │   └── tabs.tsx
│   ├── features/
│   │   ├── balance-summary.tsx
│   │   ├── owed-list.tsx
│   │   ├── expense-row.tsx
│   │   ├── contribution-row.tsx
│   │   └── role-switcher.tsx          # Dev-only floating widget
│   └── app-shell.tsx
├── lib/
│   ├── money.ts                       # Cents <-> baht formatting
│   ├── money.test.ts
│   ├── balance.ts                     # Pure balance math
│   ├── balance.test.ts
│   ├── permissions.ts                 # Permission matrix
│   ├── permissions.test.ts
│   └── mock/
│       ├── types.ts                   # Domain types (User, Expense, …)
│       ├── seed.ts                    # Initial mock data
│       ├── store.ts                   # Zustand store + actions
│       └── auth-context.tsx           # Current-user provider
├── public/
│   └── y2k/                           # Placeholder assets (wallpaper, gifs)
├── vitest.config.ts
├── tsconfig.json
├── tailwind.config.ts                 # Not used in v4, kept empty stub if needed
├── package.json
└── docs/superpowers/
    ├── specs/2026-05-19-trip-expense-tracker-design.md
    └── plans/2026-05-19-trip-expense-tracker-ui-mock.md   # this file
```

Boundaries:
- `lib/` is pure logic + mock state. Pages and components never import each other's internals — they import from `lib/`.
- `components/y2k/` is presentation-only and dependency-free (no `lib/` imports).
- `components/features/` composes `y2k/` primitives with `lib/` data.
- Pages compose `components/features/` + `components/y2k/` + read/write through the mock store.

---

## Task 1: Project scaffold + dependencies + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Touch: existing `docs/` and `.git/` stay in place

- [ ] **Step 1: Scaffold Next.js 16 into the current directory**

The project root already contains `docs/` and `.git/`. `create-next-app` refuses to scaffold into a non-empty dir, so scaffold into a temp folder and merge.

```bash
cd /Users/appleclub/Documents/personal/the-rich-boys
npx --yes create-next-app@latest .scaffold \
  --typescript --tailwind --app --no-src-dir \
  --import-alias "@/*" --no-eslint --use-npm --turbopack --yes
# Move scaffold contents into project root, ignoring the scaffold's empty .git
rsync -a --exclude='.git' .scaffold/ ./
rm -rf .scaffold
```

Expected: `package.json`, `tsconfig.json`, `app/`, `next.config.mjs`, `postcss.config.mjs`, `app/globals.css` now exist at project root. The pre-existing `docs/` directory is untouched.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install zustand react-hook-form @hookform/resolvers zod date-fns clsx
```

- [ ] **Step 3: Install dev/test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node
```

- [ ] **Step 4: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Add test script to package.json**

Edit `package.json` `"scripts"` to include:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Tighten tsconfig**

Edit `tsconfig.json` `compilerOptions` to ensure `"strict": true` and add `"noUncheckedIndexedAccess": true`.

- [ ] **Step 7: Verify build + tests run**

```bash
npm run build
npm test
```

Expected: build succeeds (or fails only on the default starter page, which we'll replace). `npm test` reports "No test files found" — acceptable.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "scaffold: next.js 16 + tailwind v4 + vitest setup"
```

---

## Task 2: Y2K theme tokens & global styles

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Create: `public/y2k/.gitkeep`

- [ ] **Step 1: Replace `app/globals.css` with Y2K tokens**

```css
@import "tailwindcss";

@theme {
  /* Y2K palette */
  --color-y2k-chrome-50: #f7f7f7;
  --color-y2k-chrome-100: #dfdfdf;
  --color-y2k-chrome-200: #c0c0c0;   /* classic Win95 surface */
  --color-y2k-chrome-300: #a8a8a8;
  --color-y2k-chrome-400: #808080;
  --color-y2k-chrome-700: #404040;
  --color-y2k-chrome-900: #1a1a1a;
  --color-y2k-blue: #0048d6;          /* link / title bar */
  --color-y2k-blue-dark: #002a82;
  --color-y2k-lime: #9fff00;
  --color-y2k-magenta: #ff00c8;
  --color-y2k-highlighter: #fffa3d;
  --color-y2k-bsod: #0000aa;
  --color-y2k-bsod-text: #ffffff;
  --color-y2k-paper: #ffffff;

  --font-sans: Tahoma, "MS Sans Serif", Verdana, Geneva, Arial, sans-serif;
  --font-mono: "Courier New", Courier, monospace;
}

html, body {
  background: var(--color-y2k-chrome-200);
  background-image:
    linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(0,0,0,0.04) 25%, transparent 25%);
  background-size: 8px 8px;
  color: var(--color-y2k-chrome-900);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.35;
  -webkit-font-smoothing: none;
  font-smooth: never;
  min-height: 100vh;
}

a { color: var(--color-y2k-blue); text-decoration: underline; }
a:visited { color: var(--color-y2k-blue-dark); }

/* Beveled border utility used across components */
@utility bevel-out {
  border-top: 1px solid #ffffff;
  border-left: 1px solid #ffffff;
  border-right: 1px solid var(--color-y2k-chrome-700);
  border-bottom: 1px solid var(--color-y2k-chrome-700);
  box-shadow: inset -1px -1px 0 0 var(--color-y2k-chrome-400),
              inset  1px  1px 0 0 var(--color-y2k-chrome-100);
}
@utility bevel-in {
  border-top: 1px solid var(--color-y2k-chrome-700);
  border-left: 1px solid var(--color-y2k-chrome-700);
  border-right: 1px solid #ffffff;
  border-bottom: 1px solid #ffffff;
  box-shadow: inset  1px  1px 0 0 var(--color-y2k-chrome-400),
              inset -1px -1px 0 0 var(--color-y2k-chrome-100);
}

/* Focus rings: dotted, classic */
*:focus-visible {
  outline: 1px dotted var(--color-y2k-chrome-900);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Rich Boys — Trip Kitty',
  description: 'A very serious financial system for a 2D1N trip.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Placeholder default page that proves theme works**

Replace `app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="p-4">
      <div className="bevel-out bg-y2k-chrome-200 p-4 max-w-md mx-auto mt-12">
        <h1 className="text-y2k-blue text-lg font-bold mb-2">It works.</h1>
        <p>Y2K theme tokens loaded.</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Verify visually**

```bash
npm run dev
```

Open `http://localhost:3000`. Expected: gray bevelled box with blue heading, Tahoma-style font, dithered background. Stop the dev server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx app/page.tsx public/y2k/.gitkeep
git commit -m "feat(theme): y2k tokens, bevel utilities, base font stack"
```

---

## Task 3: Money formatting (TDD)

**Files:**
- Create: `lib/money.ts`, `lib/money.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { centsToBaht, formatBaht, parseBahtInput } from './money';

describe('centsToBaht', () => {
  it('converts integer cents to baht', () => {
    expect(centsToBaht(123400)).toBe(1234);
  });
  it('handles zero', () => {
    expect(centsToBaht(0)).toBe(0);
  });
});

describe('formatBaht', () => {
  it('formats whole baht with thousands separators and the ฿ symbol', () => {
    expect(formatBaht(150000)).toBe('฿1,500');
  });
  it('formats negative values with a leading minus inside the symbol', () => {
    expect(formatBaht(-200000)).toBe('-฿2,000');
  });
  it('formats zero as ฿0', () => {
    expect(formatBaht(0)).toBe('฿0');
  });
});

describe('parseBahtInput', () => {
  it('parses a whole baht string into cents', () => {
    expect(parseBahtInput('1234')).toBe(123400);
  });
  it('strips commas and spaces', () => {
    expect(parseBahtInput('  1,234 ')).toBe(123400);
  });
  it('returns null for non-numeric input', () => {
    expect(parseBahtInput('abc')).toBeNull();
  });
  it('returns null for empty input', () => {
    expect(parseBahtInput('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run lib/money.test.ts
```

Expected: FAIL (module not found / exports undefined).

- [ ] **Step 3: Implement `lib/money.ts`**

```ts
export function centsToBaht(cents: number): number {
  return Math.trunc(cents / 100);
}

export function formatBaht(cents: number): string {
  const whole = centsToBaht(Math.abs(cents));
  const formatted = whole.toLocaleString('en-US');
  return `${cents < 0 ? '-' : ''}฿${formatted}`;
}

export function parseBahtInput(input: string): number | null {
  const cleaned = input.replace(/[, ]/g, '').trim();
  if (cleaned === '') return null;
  if (!/^-?\d+$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 10) * 100;
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run lib/money.test.ts
```

Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/money.ts lib/money.test.ts
git commit -m "feat(money): cents/baht conversion and formatting helpers"
```

---

## Task 4: Mock domain types

**Files:**
- Create: `lib/mock/types.ts`

(This task has no runtime tests — it's pure type definitions consumed by later tasks. Skipping TDD is appropriate.)

- [ ] **Step 1: Create types file**

```ts
// lib/mock/types.ts
export type UserId = string;
export type Role = 'admin' | 'member';

export type User = {
  id: UserId;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: Role;
  removedAt?: string;        // ISO timestamp; absent = active
  createdAt: string;
};

export type Attachment = {
  id: string;
  parentType: 'expense' | 'contribution';
  parentId: string;
  storagePath: string;       // for the mock layer, a data URL or /placeholder.png
  mimeType: string;
  uploadedBy: UserId;
  uploadedAt: string;
};

export type Contribution = {
  id: string;
  userId: UserId;
  amountCents: number;
  contributedAt: string;
  note?: string;
  createdBy: UserId;
  createdAt: string;
  attachments: Attachment[];
};

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'lodging'
  | 'activity'
  | 'other';

export type Expense = {
  id: string;
  amountCents: number;
  description: string;
  category: ExpenseCategory;
  occurredAt: string;
  /** undefined = paid from the pot cash directly */
  frontedByUserId?: UserId;
  /** ISO timestamp when fronter was paid back; undefined = unsettled */
  reimbursedAt?: string;
  createdBy: UserId;
  createdAt: string;
  attachments: Attachment[];
};

export type InviteToken = {
  id: string;
  token: string;
  createdBy: UserId;
  createdAt: string;
  expiresAt: string;
  usedBy?: UserId;
  usedAt?: string;
  revokedAt?: string;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/mock/types.ts
git commit -m "feat(mock): domain types matching spec data model"
```

---

## Task 5: Balance math (TDD)

**Files:**
- Create: `lib/balance.ts`, `lib/balance.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/balance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeBalances } from './balance';
import type { Contribution, Expense, User } from './mock/types';

const u = (id: string, role: 'admin' | 'member' = 'member'): User => ({
  id,
  email: `${id}@example.com`,
  displayName: id,
  role,
  createdAt: '2026-05-19T00:00:00Z',
});

const c = (userId: string, amountCents: number): Contribution => ({
  id: `c-${userId}-${amountCents}`,
  userId,
  amountCents,
  contributedAt: '2026-05-19T00:00:00Z',
  createdBy: userId,
  createdAt: '2026-05-19T00:00:00Z',
  attachments: [],
});

const e = (
  amountCents: number,
  opts: { frontedBy?: string; reimbursed?: boolean } = {},
): Expense => ({
  id: `e-${Math.random()}`,
  amountCents,
  description: 'x',
  category: 'food',
  occurredAt: '2026-05-19T00:00:00Z',
  frontedByUserId: opts.frontedBy,
  reimbursedAt: opts.reimbursed ? '2026-05-19T00:00:00Z' : undefined,
  createdBy: opts.frontedBy ?? 'a',
  createdAt: '2026-05-19T00:00:00Z',
  attachments: [],
});

describe('computeBalances', () => {
  it('returns zeros for an empty trip', () => {
    const r = computeBalances({ users: [u('a')], contributions: [], expenses: [] });
    expect(r.potTotal).toBe(0);
    expect(r.potSpent).toBe(0);
    expect(r.potRemaining).toBe(0);
    expect(r.totalExpenses).toBe(0);
    expect(r.fairShare).toBe(0);
    expect(r.perUser['a']).toEqual({
      contributed: 0,
      owedUnsettled: 0,
      fairShare: 0,
      net: 0,
    });
  });

  it('counts contributions toward the pot', () => {
    const r = computeBalances({
      users: [u('a'), u('b')],
      contributions: [c('a', 200000), c('b', 200000)],
      expenses: [],
    });
    expect(r.potTotal).toBe(400000);
    expect(r.potRemaining).toBe(400000);
    expect(r.perUser['a'].contributed).toBe(200000);
  });

  it('pot-paid expenses drain the pot', () => {
    const r = computeBalances({
      users: [u('a'), u('b')],
      contributions: [c('a', 200000), c('b', 200000)],
      expenses: [e(300000)], // paid from pot
    });
    expect(r.potSpent).toBe(300000);
    expect(r.potRemaining).toBe(100000);
    expect(r.totalExpenses).toBe(300000);
    expect(r.fairShare).toBe(150000); // 300000 / 2
  });

  it('fronted-and-unreimbursed expenses do NOT drain the pot but DO create an obligation', () => {
    const r = computeBalances({
      users: [u('a'), u('b')],
      contributions: [c('a', 200000), c('b', 200000)],
      expenses: [e(300000, { frontedBy: 'a' })],
    });
    expect(r.potSpent).toBe(0);
    expect(r.potRemaining).toBe(400000);
    expect(r.totalExpenses).toBe(300000); // still counts toward fair share
    expect(r.perUser['a'].owedUnsettled).toBe(300000);
    expect(r.perUser['a'].net).toBe(
      200000 /* contributed */ + 300000 /* owed back */ - 150000 /* fair share */,
    ); // = 350000
    expect(r.perUser['b'].net).toBe(200000 - 150000); // = 50000
  });

  it('fronted-and-reimbursed expenses behave like pot-paid', () => {
    const r = computeBalances({
      users: [u('a'), u('b')],
      contributions: [c('a', 200000), c('b', 200000)],
      expenses: [e(300000, { frontedBy: 'a', reimbursed: true })],
    });
    expect(r.potSpent).toBe(300000);
    expect(r.potRemaining).toBe(100000);
    expect(r.perUser['a'].owedUnsettled).toBe(0);
  });

  it('excludes removed users from member_count for fair share', () => {
    const removed = { ...u('c'), removedAt: '2026-05-19T01:00:00Z' };
    const r = computeBalances({
      users: [u('a'), u('b'), removed],
      contributions: [c('a', 200000), c('b', 200000)],
      expenses: [e(400000)],
    });
    expect(r.fairShare).toBe(200000); // 400000 / 2 active members
  });

  it('integer-division remainder is absorbed by the pot (not double-counted)', () => {
    const r = computeBalances({
      users: [u('a'), u('b'), u('c')],
      contributions: [],
      expenses: [e(100000)], // 100000 / 3 = 33333 r1
    });
    expect(r.fairShare).toBe(33333);
    // Sum of fair shares < total — remainder of 1 cent stays in the pot bookkeeping
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run lib/balance.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `lib/balance.ts`**

```ts
import type { Contribution, Expense, User, UserId } from './mock/types';

export type PerUserBalance = {
  contributed: number;
  owedUnsettled: number;
  fairShare: number;
  net: number;
};

export type BalanceSnapshot = {
  potTotal: number;
  potSpent: number;
  potRemaining: number;
  totalExpenses: number;
  fairShare: number;
  perUser: Record<UserId, PerUserBalance>;
};

export function computeBalances(input: {
  users: User[];
  contributions: Contribution[];
  expenses: Expense[];
}): BalanceSnapshot {
  const { users, contributions, expenses } = input;
  const activeUsers = users.filter((u) => !u.removedAt);

  const potTotal = contributions.reduce((s, c) => s + c.amountCents, 0);

  const potSpent = expenses
    .filter((e) => e.frontedByUserId === undefined || e.reimbursedAt !== undefined)
    .reduce((s, e) => s + e.amountCents, 0);

  const totalExpenses = expenses.reduce((s, e) => s + e.amountCents, 0);
  const memberCount = activeUsers.length || 1;
  const fairShare = Math.trunc(totalExpenses / memberCount);

  const perUser: Record<UserId, PerUserBalance> = {};
  for (const u of users) {
    const contributed = contributions
      .filter((c) => c.userId === u.id)
      .reduce((s, c) => s + c.amountCents, 0);
    const owedUnsettled = expenses
      .filter(
        (e) => e.frontedByUserId === u.id && e.reimbursedAt === undefined,
      )
      .reduce((s, e) => s + e.amountCents, 0);
    const share = u.removedAt ? 0 : fairShare;
    perUser[u.id] = {
      contributed,
      owedUnsettled,
      fairShare: share,
      net: contributed + owedUnsettled - share,
    };
  }

  return {
    potTotal,
    potSpent,
    potRemaining: potTotal - potSpent,
    totalExpenses,
    fairShare,
    perUser,
  };
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run lib/balance.test.ts
```

Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/balance.ts lib/balance.test.ts
git commit -m "feat(balance): kitty/pot math with fair-share computation"
```

---

## Task 6: Permission matrix (TDD)

**Files:**
- Create: `lib/permissions.ts`, `lib/permissions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/permissions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { can } from './permissions';
import type { User, Expense, Contribution } from './mock/types';

const admin: User = {
  id: 'A', email: 'a@x', displayName: 'A', role: 'admin',
  createdAt: '2026-05-19T00:00:00Z',
};
const member: User = {
  id: 'M', email: 'm@x', displayName: 'M', role: 'member',
  createdAt: '2026-05-19T00:00:00Z',
};
const otherMember: User = {
  id: 'O', email: 'o@x', displayName: 'O', role: 'member',
  createdAt: '2026-05-19T00:00:00Z',
};

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  amountCents: 10000,
  description: 'x',
  category: 'food',
  occurredAt: '2026-05-19T00:00:00Z',
  frontedByUserId: 'M',
  reimbursedAt: undefined,
  createdBy: 'M',
  createdAt: '2026-05-19T00:00:00Z',
  attachments: [],
  ...overrides,
});

const contribution = (overrides: Partial<Contribution> = {}): Contribution => ({
  id: 'c1', userId: 'M', amountCents: 200000,
  contributedAt: '2026-05-19T00:00:00Z',
  createdBy: 'M', createdAt: '2026-05-19T00:00:00Z',
  attachments: [], ...overrides,
});

describe('permissions: expense actions', () => {
  it('admin can create any expense', () => {
    expect(can(admin, 'expense.create.fromPot')).toBe(true);
    expect(can(admin, 'expense.create.frontedBySelf')).toBe(true);
    expect(can(admin, 'expense.create.frontedByOther')).toBe(true);
  });
  it('member can create only self-fronted expenses', () => {
    expect(can(member, 'expense.create.frontedBySelf')).toBe(true);
    expect(can(member, 'expense.create.fromPot')).toBe(false);
    expect(can(member, 'expense.create.frontedByOther')).toBe(false);
  });
  it('admin can update or delete any expense', () => {
    expect(can(admin, 'expense.update', { resource: expense() })).toBe(true);
    expect(can(admin, 'expense.delete', { resource: expense() })).toBe(true);
  });
  it('member can update/delete only their own unreimbursed expense', () => {
    expect(can(member, 'expense.update', { resource: expense() })).toBe(true);
    expect(can(member, 'expense.delete', { resource: expense() })).toBe(true);
    expect(
      can(member, 'expense.update', {
        resource: expense({ reimbursedAt: '2026-05-19T01:00:00Z' }),
      }),
    ).toBe(false);
    expect(
      can(member, 'expense.update', { resource: expense({ frontedByUserId: 'O', createdBy: 'O' }) }),
    ).toBe(false);
  });
  it('only admin can mark reimbursed', () => {
    expect(can(admin, 'expense.markReimbursed', { resource: expense() })).toBe(true);
    expect(can(member, 'expense.markReimbursed', { resource: expense() })).toBe(false);
  });
});

describe('permissions: contribution actions', () => {
  it('member can manage own contribution', () => {
    expect(can(member, 'contribution.update', { resource: contribution() })).toBe(true);
    expect(can(member, 'contribution.delete', { resource: contribution() })).toBe(true);
  });
  it('member cannot manage another member\'s contribution', () => {
    expect(
      can(member, 'contribution.update', { resource: contribution({ userId: 'O', createdBy: 'O' }) }),
    ).toBe(false);
  });
  it('admin can manage any contribution', () => {
    expect(
      can(admin, 'contribution.update', { resource: contribution({ userId: 'O', createdBy: 'O' }) }),
    ).toBe(true);
  });
});

describe('permissions: member admin actions', () => {
  it('only admin can invite/remove/promote', () => {
    for (const action of ['invite.create', 'invite.revoke', 'member.remove', 'member.promote', 'member.demote'] as const) {
      expect(can(admin, action)).toBe(true);
      expect(can(member, action)).toBe(false);
    }
  });
});

describe('permissions: removed users have no write access', () => {
  it('removed admin loses powers', () => {
    const removed = { ...admin, removedAt: '2026-05-19T00:00:00Z' };
    expect(can(removed, 'invite.create')).toBe(false);
    expect(can(removed, 'expense.create.fromPot')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run lib/permissions.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `lib/permissions.ts`**

```ts
import type { User, Expense, Contribution } from './mock/types';

export type Action =
  | 'expense.create.fromPot'
  | 'expense.create.frontedBySelf'
  | 'expense.create.frontedByOther'
  | 'expense.update'
  | 'expense.delete'
  | 'expense.markReimbursed'
  | 'contribution.create.self'
  | 'contribution.create.other'
  | 'contribution.update'
  | 'contribution.delete'
  | 'invite.create'
  | 'invite.revoke'
  | 'member.remove'
  | 'member.promote'
  | 'member.demote';

type ResourceMap = {
  'expense.update': { resource: Expense };
  'expense.delete': { resource: Expense };
  'expense.markReimbursed': { resource: Expense };
  'contribution.update': { resource: Contribution };
  'contribution.delete': { resource: Contribution };
};
type Ctx<A extends Action> = A extends keyof ResourceMap ? ResourceMap[A] : undefined;

export function can<A extends Action>(actor: User, action: A, ctx?: Ctx<A>): boolean {
  if (actor.removedAt) return false;
  const isAdmin = actor.role === 'admin';

  switch (action) {
    case 'expense.create.fromPot':
    case 'expense.create.frontedByOther':
    case 'expense.markReimbursed':
    case 'contribution.create.other':
    case 'invite.create':
    case 'invite.revoke':
    case 'member.remove':
    case 'member.promote':
    case 'member.demote':
      return isAdmin;

    case 'expense.create.frontedBySelf':
    case 'contribution.create.self':
      return true;

    case 'expense.update':
    case 'expense.delete': {
      const e = (ctx as { resource: Expense }).resource;
      if (isAdmin) return true;
      const isOwner = e.frontedByUserId === actor.id || e.createdBy === actor.id;
      return isOwner && !e.reimbursedAt;
    }

    case 'contribution.update':
    case 'contribution.delete': {
      const c = (ctx as { resource: Contribution }).resource;
      if (isAdmin) return true;
      return c.userId === actor.id || c.createdBy === actor.id;
    }
  }
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npx vitest run lib/permissions.test.ts
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add lib/permissions.ts lib/permissions.test.ts
git commit -m "feat(permissions): role-based action gate with ownership rules"
```

---

## Task 7: Seed data

**Files:**
- Create: `lib/mock/seed.ts`

- [ ] **Step 1: Create seed**

```ts
// lib/mock/seed.ts
import type {
  Contribution,
  Expense,
  InviteToken,
  User,
} from './types';

const now = '2026-05-19T10:00:00Z';

export const seedUsers: User[] = [
  { id: 'u-pak',  email: 'pak@example.com',  displayName: 'Pak',
    role: 'admin',  createdAt: '2026-05-18T08:00:00Z' },
  { id: 'u-ploy', email: 'ploy@example.com', displayName: 'Ploy',
    role: 'member', createdAt: '2026-05-18T08:30:00Z' },
  { id: 'u-tee',  email: 'tee@example.com',  displayName: 'Tee',
    role: 'member', createdAt: '2026-05-18T09:00:00Z' },
  { id: 'u-nan',  email: 'nan@example.com',  displayName: 'Nan',
    role: 'member', createdAt: '2026-05-18T09:30:00Z' },
];

export const seedContributions: Contribution[] = seedUsers.map((u, i) => ({
  id: `c-${u.id}`,
  userId: u.id,
  amountCents: 200_000, // ฿2,000
  contributedAt: `2026-05-19T0${8 + i}:00:00Z`,
  note: 'Trip kitty deposit',
  createdBy: u.id,
  createdAt: now,
  attachments: [],
}));

export const seedExpenses: Expense[] = [
  {
    id: 'e-breakfast',
    amountCents: 60_000, // ฿600
    description: 'Breakfast at the resort',
    category: 'food',
    occurredAt: '2026-05-19T09:30:00Z',
    frontedByUserId: undefined, // paid from pot
    createdBy: 'u-pak',
    createdAt: now,
    attachments: [],
  },
  {
    id: 'e-gas',
    amountCents: 80_000, // ฿800
    description: 'Gas — drive up',
    category: 'transport',
    occurredAt: '2026-05-19T07:00:00Z',
    frontedByUserId: 'u-tee', // tee paid out of pocket
    createdBy: 'u-tee',
    createdAt: now,
    attachments: [],
  },
  {
    id: 'e-dinner',
    amountCents: 300_000, // ฿3,000
    description: 'Dinner & drinks',
    category: 'food',
    occurredAt: '2026-05-19T19:00:00Z',
    frontedByUserId: 'u-ploy',
    reimbursedAt: undefined, // unsettled — sample for "Owed" UI
    createdBy: 'u-ploy',
    createdAt: now,
    attachments: [],
  },
];

export const seedInvites: InviteToken[] = [];
```

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/mock/seed.ts
git commit -m "feat(mock): seed data for four-friend trip"
```

---

## Task 8: Zustand store with mutations

**Files:**
- Create: `lib/mock/store.ts`

- [ ] **Step 1: Create the store**

```ts
// lib/mock/store.ts
'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  seedContributions,
  seedExpenses,
  seedInvites,
  seedUsers,
} from './seed';
import type {
  Contribution,
  Expense,
  InviteToken,
  User,
  UserId,
} from './types';

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

type State = {
  users: User[];
  contributions: Contribution[];
  expenses: Expense[];
  invites: InviteToken[];
  resetToSeed: () => void;

  // expense actions
  addExpense: (input: Omit<Expense, 'id' | 'createdAt' | 'attachments'> & {
    attachments?: Expense['attachments'];
  }) => string;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  markExpenseReimbursed: (id: string, at?: string) => void;

  // contribution actions
  addContribution: (
    input: Omit<Contribution, 'id' | 'createdAt' | 'attachments'> & {
      attachments?: Contribution['attachments'];
    },
  ) => string;
  updateContribution: (id: string, patch: Partial<Contribution>) => void;
  deleteContribution: (id: string) => void;

  // member actions
  promoteToAdmin: (userId: UserId) => void;
  demoteToMember: (userId: UserId) => void;
  removeMember: (userId: UserId) => void;
  restoreMember: (userId: UserId) => void;

  // invite actions
  createInvite: (createdBy: UserId) => InviteToken;
  revokeInvite: (id: string) => void;
  consumeInvite: (
    token: string,
    user: { email: string; displayName: string },
  ) => User | null;
};

export const useMockStore = create<State>()(
  persist(
    (set, get) => ({
      users: seedUsers,
      contributions: seedContributions,
      expenses: seedExpenses,
      invites: seedInvites,

      resetToSeed: () =>
        set({
          users: seedUsers,
          contributions: seedContributions,
          expenses: seedExpenses,
          invites: seedInvites,
        }),

      addExpense: (input) => {
        const id = uid('e');
        const now = new Date().toISOString();
        const newExpense: Expense = {
          ...input,
          id,
          createdAt: now,
          attachments: input.attachments ?? [],
        };
        set({ expenses: [...get().expenses, newExpense] });
        return id;
      },
      updateExpense: (id, patch) =>
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, ...patch } : e,
          ),
        }),
      deleteExpense: (id) =>
        set({ expenses: get().expenses.filter((e) => e.id !== id) }),
      markExpenseReimbursed: (id, at = new Date().toISOString()) =>
        set({
          expenses: get().expenses.map((e) =>
            e.id === id ? { ...e, reimbursedAt: at } : e,
          ),
        }),

      addContribution: (input) => {
        const id = uid('c');
        const now = new Date().toISOString();
        const newContribution: Contribution = {
          ...input,
          id,
          createdAt: now,
          attachments: input.attachments ?? [],
        };
        set({ contributions: [...get().contributions, newContribution] });
        return id;
      },
      updateContribution: (id, patch) =>
        set({
          contributions: get().contributions.map((c) =>
            c.id === id ? { ...c, ...patch } : c,
          ),
        }),
      deleteContribution: (id) =>
        set({
          contributions: get().contributions.filter((c) => c.id !== id),
        }),

      promoteToAdmin: (userId) =>
        set({
          users: get().users.map((u) =>
            u.id === userId ? { ...u, role: 'admin' } : u,
          ),
        }),
      demoteToMember: (userId) => {
        const admins = get().users.filter(
          (u) => u.role === 'admin' && !u.removedAt,
        );
        if (admins.length <= 1 && admins[0]?.id === userId) return; // last admin guard
        set({
          users: get().users.map((u) =>
            u.id === userId ? { ...u, role: 'member' } : u,
          ),
        });
      },
      removeMember: (userId) =>
        set({
          users: get().users.map((u) =>
            u.id === userId
              ? { ...u, removedAt: new Date().toISOString() }
              : u,
          ),
        }),
      restoreMember: (userId) =>
        set({
          users: get().users.map((u) =>
            u.id === userId ? { ...u, removedAt: undefined } : u,
          ),
        }),

      createInvite: (createdBy) => {
        const token = Array.from(
          crypto.getRandomValues(new Uint8Array(24)),
          (b) => b.toString(16).padStart(2, '0'),
        ).join('').slice(0, 32);
        const now = new Date();
        const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const invite: InviteToken = {
          id: uid('i'),
          token,
          createdBy,
          createdAt: now.toISOString(),
          expiresAt: expires.toISOString(),
        };
        set({ invites: [...get().invites, invite] });
        return invite;
      },
      revokeInvite: (id) =>
        set({
          invites: get().invites.map((i) =>
            i.id === id ? { ...i, revokedAt: new Date().toISOString() } : i,
          ),
        }),
      consumeInvite: (token, user) => {
        const invite = get().invites.find((i) => i.token === token);
        if (!invite) return null;
        if (invite.usedAt || invite.revokedAt) return null;
        if (new Date(invite.expiresAt).getTime() < Date.now()) return null;
        const now = new Date().toISOString();
        const newUser: User = {
          id: uid('u'),
          email: user.email,
          displayName: user.displayName,
          role: 'member',
          createdAt: now,
        };
        set({
          users: [...get().users, newUser],
          invites: get().invites.map((i) =>
            i.id === invite.id ? { ...i, usedBy: newUser.id, usedAt: now } : i,
          ),
        });
        return newUser;
      },
    }),
    {
      name: 'trip-kitty-mock',
      // SSR safety
      skipHydration: false,
    },
  ),
);
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/mock/store.ts
git commit -m "feat(mock): zustand store with persisted mutations"
```

---

## Task 9: Fake auth context + role switcher

**Files:**
- Create: `lib/mock/auth-context.tsx`
- Create: `components/features/role-switcher.tsx`

- [ ] **Step 1: Create the auth context**

```tsx
// lib/mock/auth-context.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useMockStore } from './store';
import type { User } from './types';

const ACTIVE_USER_KEY = 'trip-kitty-active-user';

type Ctx = {
  currentUser: User | null;
  signInAs: (userId: string) => void;
  signOut: () => void;
};

const AuthCtx = createContext<Ctx | null>(null);

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const users = useMockStore((s) => s.users);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCurrentUserId(localStorage.getItem(ACTIVE_USER_KEY));
    setHydrated(true);
  }, []);

  const signInAs = (id: string) => {
    localStorage.setItem(ACTIVE_USER_KEY, id);
    setCurrentUserId(id);
  };
  const signOut = () => {
    localStorage.removeItem(ACTIVE_USER_KEY);
    setCurrentUserId(null);
  };

  const currentUser =
    hydrated && currentUserId
      ? users.find((u) => u.id === currentUserId && !u.removedAt) ?? null
      : null;

  return (
    <AuthCtx.Provider value={{ currentUser, signInAs, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside MockAuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Create the dev role switcher**

```tsx
// components/features/role-switcher.tsx
'use client';

import { useAuth } from '@/lib/mock/auth-context';
import { useMockStore } from '@/lib/mock/store';

export function RoleSwitcher() {
  const users = useMockStore((s) => s.users);
  const reset = useMockStore((s) => s.resetToSeed);
  const { currentUser, signInAs, signOut } = useAuth();

  return (
    <div className="fixed bottom-2 right-2 z-50 bevel-out bg-y2k-chrome-200 p-2 text-xs">
      <div className="font-bold mb-1">[dev] view as</div>
      <div className="flex flex-wrap gap-1 mb-1">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => signInAs(u.id)}
            className={`bevel-out px-2 py-0.5 bg-y2k-chrome-100 ${
              currentUser?.id === u.id ? 'font-bold underline' : ''
            }`}
          >
            {u.displayName}
            {u.role === 'admin' ? ' ★' : ''}
            {u.removedAt ? ' ✗' : ''}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={signOut}
          className="bevel-out px-2 py-0.5 bg-y2k-chrome-100"
        >
          sign out
        </button>
        <button
          type="button"
          onClick={reset}
          className="bevel-out px-2 py-0.5 bg-y2k-chrome-100"
        >
          reset seed
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/mock/auth-context.tsx components/features/role-switcher.tsx
git commit -m "feat(mock): fake auth provider and dev role switcher"
```

---

## Task 10: Y2K `Window` component

**Files:**
- Create: `components/y2k/window.tsx`, `components/y2k/window.test.tsx`

- [ ] **Step 1: Write smoke test**

```tsx
// components/y2k/window.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Window } from './window';

describe('Window', () => {
  it('renders title and children', () => {
    render(
      <Window title="Test Window">
        <p>hello</p>
      </Window>,
    );
    expect(screen.getByText('Test Window')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('exposes close button when onClose provided', () => {
    render(<Window title="X" onClose={() => {}}>x</Window>);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run components/y2k/window.test.tsx
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `Window`**

```tsx
// components/y2k/window.tsx
import clsx from 'clsx';

type Props = {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
};

export function Window({ title, children, onClose, className }: Props) {
  return (
    <section
      className={clsx(
        'bevel-out bg-y2k-chrome-200 shadow-[2px_2px_0_rgba(0,0,0,0.4)]',
        'max-w-full',
        className,
      )}
    >
      <header
        className="flex items-center justify-between px-1 py-0.5 text-white font-bold"
        style={{
          background:
            'linear-gradient(90deg, var(--color-y2k-blue) 0%, var(--color-y2k-blue-dark) 100%)',
        }}
      >
        <span className="truncate">{title}</span>
        <div className="flex gap-0.5">
          <FakeButton label="_" />
          <FakeButton label="□" />
          {onClose ? (
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="bevel-out bg-y2k-chrome-200 text-black w-5 h-4 text-[10px] leading-none"
            >
              ×
            </button>
          ) : (
            <FakeButton label="×" />
          )}
        </div>
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function FakeButton({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="bevel-out bg-y2k-chrome-200 text-black w-5 h-4 text-[10px] leading-none inline-flex items-center justify-center select-none"
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 4: Run test, verify pass**

```bash
npx vitest run components/y2k/window.test.tsx
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add components/y2k/window.tsx components/y2k/window.test.tsx
git commit -m "feat(y2k): Window component with title bar and fake controls"
```

---

## Task 11: Y2K `Button` component

**Files:**
- Create: `components/y2k/button.tsx`, `components/y2k/button.test.tsx`

- [ ] **Step 1: Smoke test**

```tsx
// components/y2k/button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders children and fires onClick', async () => {
    const user = userEvent.setup();
    const handle = vi.fn();
    render(<Button onClick={handle}>Click me</Button>);
    await user.click(screen.getByRole('button', { name: /click me/i }));
    expect(handle).toHaveBeenCalledOnce();
  });

  it('respects disabled', async () => {
    const user = userEvent.setup();
    const handle = vi.fn();
    render(<Button onClick={handle} disabled>Nope</Button>);
    await user.click(screen.getByRole('button', { name: /nope/i }));
    expect(handle).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run components/y2k/button.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
// components/y2k/button.tsx
import clsx from 'clsx';

type Variant = 'default' | 'primary' | 'danger';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  className,
  variant = 'default',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={clsx(
        'bevel-out px-3 py-1 min-h-[28px] min-w-[64px] text-[13px] font-sans',
        'active:bevel-in',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'default' && 'bg-y2k-chrome-200 text-black',
        variant === 'primary' &&
          'bg-y2k-blue text-white font-bold',
        variant === 'danger' &&
          'bg-y2k-magenta text-white font-bold',
        className,
      )}
      {...rest}
    />
  );
}
```

- [ ] **Step 4: Verify pass**

```bash
npx vitest run components/y2k/button.test.tsx
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add components/y2k/button.tsx components/y2k/button.test.tsx
git commit -m "feat(y2k): Button with default/primary/danger variants"
```

---

## Task 12: Y2K form inputs

**Files:**
- Create: `components/y2k/text-input.tsx`, `components/y2k/select.tsx`, `components/y2k/textarea.tsx`, `components/y2k/fieldset.tsx`
- Create: `components/y2k/form-inputs.test.tsx`

- [ ] **Step 1: Smoke test all four**

```tsx
// components/y2k/form-inputs.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextInput } from './text-input';
import { Select } from './select';
import { Textarea } from './textarea';
import { Fieldset } from './fieldset';

describe('form inputs', () => {
  it('TextInput exposes label and value', () => {
    render(<TextInput label="Name" defaultValue="Pak" />);
    expect(screen.getByLabelText('Name')).toHaveValue('Pak');
  });
  it('Select renders options', () => {
    render(
      <Select label="Pick" options={[{ value: 'a', label: 'A' }]} />,
    );
    expect(screen.getByRole('combobox', { name: 'Pick' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
  });
  it('Textarea works', () => {
    render(<Textarea label="Note" defaultValue="hi" />);
    expect(screen.getByLabelText('Note')).toHaveValue('hi');
  });
  it('Fieldset renders legend and children', () => {
    render(<Fieldset legend="Group"><p>x</p></Fieldset>);
    expect(screen.getByText('Group')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test, verify failure**

```bash
npx vitest run components/y2k/form-inputs.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement `TextInput`**

```tsx
// components/y2k/text-input.tsx
import { forwardRef, useId } from 'react';
import clsx from 'clsx';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput(
  { label, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="font-bold">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          'bevel-in bg-white px-2 py-1 font-sans text-[13px]',
          className,
        )}
        {...rest}
      />
      {error ? <span className="text-y2k-magenta">{error}</span> : null}
    </div>
  );
});
```

- [ ] **Step 4: Implement `Select`**

```tsx
// components/y2k/select.tsx
import { forwardRef, useId } from 'react';
import clsx from 'clsx';

type Option = { value: string; label: string };
type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string;
  options: Option[];
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, options, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="font-bold">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        className={clsx(
          'bevel-in bg-white px-2 py-1 font-sans text-[13px]',
          className,
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-y2k-magenta">{error}</span> : null}
    </div>
  );
});
```

- [ ] **Step 5: Implement `Textarea`**

```tsx
// components/y2k/textarea.tsx
import { forwardRef, useId } from 'react';
import clsx from 'clsx';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const taId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={taId} className="font-bold">{label}</label>
      <textarea
        ref={ref}
        id={taId}
        className={clsx(
          'bevel-in bg-white px-2 py-1 font-sans text-[13px] min-h-[72px]',
          className,
        )}
        {...rest}
      />
      {error ? <span className="text-y2k-magenta">{error}</span> : null}
    </div>
  );
});
```

- [ ] **Step 6: Implement `Fieldset`**

```tsx
// components/y2k/fieldset.tsx
import clsx from 'clsx';

type Props = {
  legend: string;
  children: React.ReactNode;
  className?: string;
};

export function Fieldset({ legend, children, className }: Props) {
  return (
    <fieldset className={clsx('border border-y2k-chrome-700 p-3', className)}>
      <legend className="px-1 font-bold">{legend}</legend>
      <div className="flex flex-col gap-3">{children}</div>
    </fieldset>
  );
}
```

- [ ] **Step 7: Verify all tests pass**

```bash
npx vitest run components/y2k/form-inputs.test.tsx
```

Expected: 4 passing.

- [ ] **Step 8: Commit**

```bash
git add components/y2k/text-input.tsx components/y2k/select.tsx components/y2k/textarea.tsx components/y2k/fieldset.tsx components/y2k/form-inputs.test.tsx
git commit -m "feat(y2k): form inputs (TextInput, Select, Textarea, Fieldset)"
```

---

## Task 13: Y2K display primitives (Badge, StatusBar, Spinner, Marquee, ImageThumb)

**Files:**
- Create: `components/y2k/badge.tsx`, `components/y2k/status-bar.tsx`, `components/y2k/spinner.tsx`, `components/y2k/marquee.tsx`, `components/y2k/image-thumb.tsx`
- Create: `components/y2k/display.test.tsx`

- [ ] **Step 1: Smoke test**

```tsx
// components/y2k/display.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';
import { StatusBar } from './status-bar';
import { Spinner } from './spinner';
import { Marquee } from './marquee';
import { ImageThumb } from './image-thumb';

describe('display primitives', () => {
  it('Badge renders text', () => {
    render(<Badge>admin</Badge>);
    expect(screen.getByText('admin')).toBeInTheDocument();
  });
  it('StatusBar renders children', () => {
    render(<StatusBar><span>hi</span></StatusBar>);
    expect(screen.getByText('hi')).toBeInTheDocument();
  });
  it('Spinner has role=status', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
  it('Marquee renders content', () => {
    render(<Marquee>scrolling</Marquee>);
    expect(screen.getByText('scrolling')).toBeInTheDocument();
  });
  it('ImageThumb renders an img', () => {
    render(<ImageThumb src="/x.png" alt="x" />);
    expect(screen.getByAltText('x')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run components/y2k/display.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement Badge**

```tsx
// components/y2k/badge.tsx
import clsx from 'clsx';

type Tone = 'neutral' | 'admin' | 'warning' | 'good';

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide bevel-out',
        tone === 'neutral' && 'bg-y2k-chrome-200 text-black',
        tone === 'admin' && 'bg-y2k-highlighter text-black',
        tone === 'warning' && 'bg-y2k-magenta text-white',
        tone === 'good' && 'bg-y2k-lime text-black',
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Implement StatusBar**

```tsx
// components/y2k/status-bar.tsx
'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

export function StatusBar({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <footer
      className={clsx(
        'bevel-out bg-y2k-chrome-200 flex items-center justify-between gap-2 px-2 py-1 text-xs',
        className,
      )}
    >
      <div className="bevel-in bg-y2k-chrome-100 px-2 py-0.5 flex-1 truncate">
        {children ?? 'Ready'}
      </div>
      <div className="bevel-in bg-y2k-chrome-100 px-2 py-0.5">{time}</div>
    </footer>
  );
}
```

- [ ] **Step 5: Implement Spinner**

```tsx
// components/y2k/spinner.tsx
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1 text-xs"
      aria-live="polite"
    >
      <span className="inline-block w-3 h-3 border-2 border-y2k-chrome-700 border-t-y2k-blue animate-spin" />
      {label}
    </span>
  );
}
```

- [ ] **Step 6: Implement Marquee**

```tsx
// components/y2k/marquee.tsx
export function Marquee({
  children,
  speed = 40,
}: {
  children: React.ReactNode;
  speed?: number;
}) {
  return (
    <div className="overflow-hidden whitespace-nowrap bevel-in bg-y2k-chrome-100 py-1">
      <span
        className="inline-block pl-full animate-[marquee_linear_infinite]"
        style={{ animationDuration: `${speed}s` }}
      >
        {children}
      </span>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0%); }
          to   { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 7: Implement ImageThumb**

```tsx
// components/y2k/image-thumb.tsx
import clsx from 'clsx';

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  alt: string;
};

export function ImageThumb({ className, alt, ...rest }: Props) {
  return (
    <span className={clsx('bevel-in bg-white p-1 inline-block', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={alt} className="block max-w-full h-auto" {...rest} />
    </span>
  );
}
```

- [ ] **Step 8: Verify tests pass**

```bash
npx vitest run components/y2k/display.test.tsx
```

Expected: 5 passing.

- [ ] **Step 9: Commit**

```bash
git add components/y2k/badge.tsx components/y2k/status-bar.tsx components/y2k/spinner.tsx components/y2k/marquee.tsx components/y2k/image-thumb.tsx components/y2k/display.test.tsx
git commit -m "feat(y2k): badge, status bar, spinner, marquee, image thumb"
```

---

## Task 14: Y2K Dialog and Tabs

**Files:**
- Create: `components/y2k/dialog.tsx`, `components/y2k/tabs.tsx`
- Create: `components/y2k/overlay.test.tsx`

- [ ] **Step 1: Smoke test**

```tsx
// components/y2k/overlay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './dialog';
import { Tabs } from './tabs';

describe('Dialog', () => {
  it('renders when open and exposes close', async () => {
    const user = userEvent.setup();
    let closed = false;
    render(
      <Dialog open title="t" onClose={() => { closed = true; }}>
        body
      </Dialog>,
    );
    expect(screen.getByText('body')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(closed).toBe(true);
  });
});

describe('Tabs', () => {
  it('shows the active panel and switches', async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        tabs={[
          { id: 'a', label: 'A', content: <div>panel A</div> },
          { id: 'b', label: 'B', content: <div>panel B</div> },
        ]}
        defaultId="a"
      />,
    );
    expect(screen.getByText('panel A')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByText('panel B')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run components/y2k/overlay.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement Dialog**

```tsx
// components/y2k/dialog.tsx
'use client';
import { useEffect } from 'react';
import { Window } from './window';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function Dialog({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center p-2"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Window title={title} onClose={onClose} className="w-full max-w-md">
        {children}
      </Window>
    </div>
  );
}
```

- [ ] **Step 4: Implement Tabs**

```tsx
// components/y2k/tabs.tsx
'use client';
import { useState } from 'react';
import clsx from 'clsx';

type Tab = { id: string; label: string; content: React.ReactNode };

export function Tabs({
  tabs,
  defaultId,
}: {
  tabs: Tab[];
  defaultId?: string;
}) {
  const [active, setActive] = useState(defaultId ?? tabs[0]?.id);
  return (
    <div>
      <div role="tablist" className="flex gap-0.5 -mb-px">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.id)}
              className={clsx(
                'px-3 py-1 bevel-out bg-y2k-chrome-200',
                'rounded-t-sm border-b-0',
                isActive
                  ? 'font-bold relative z-10'
                  : 'opacity-80',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="bevel-out bg-y2k-chrome-200 p-3">
        {tabs.find((t) => t.id === active)?.content}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify tests pass**

```bash
npx vitest run components/y2k/overlay.test.tsx
```

Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add components/y2k/dialog.tsx components/y2k/tabs.tsx components/y2k/overlay.test.tsx
git commit -m "feat(y2k): dialog and tabs overlay components"
```

---

## Task 15: App shell + providers

**Files:**
- Create: `components/app-shell.tsx`
- Create: `app/providers.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Providers**

```tsx
// app/providers.tsx
'use client';
import { MockAuthProvider } from '@/lib/mock/auth-context';

export function Providers({ children }: { children: React.ReactNode }) {
  return <MockAuthProvider>{children}</MockAuthProvider>;
}
```

- [ ] **Step 2: App shell**

```tsx
// components/app-shell.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import { StatusBar } from '@/components/y2k/status-bar';
import { RoleSwitcher } from '@/components/features/role-switcher';
import { useAuth } from '@/lib/mock/auth-context';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/contributions', label: 'Pot' },
  { href: '/members', label: 'Members' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <nav
        className="bevel-out bg-y2k-chrome-200 px-2 py-1 flex flex-wrap gap-1 items-center"
        aria-label="Primary"
      >
        <strong className="mr-2">Trip Kitty</strong>
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                'bevel-out bg-y2k-chrome-100 px-2 py-0.5 no-underline text-black',
                active && 'font-bold bevel-in',
              )}
            >
              {n.label}
            </Link>
          );
        })}
        <span className="ml-auto text-xs">
          {currentUser ? `Signed in: ${currentUser.displayName}` : 'Not signed in'}
        </span>
      </nav>
      <main className="flex-1 p-3 md:p-6 max-w-3xl w-full mx-auto">{children}</main>
      <StatusBar className="m-2">
        {currentUser
          ? `Hello ${currentUser.displayName} (${currentUser.role})`
          : 'Use the dev switcher to view as a user'}
      </StatusBar>
      <RoleSwitcher />
    </div>
  );
}
```

- [ ] **Step 3: Wire providers into root layout**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'The Rich Boys — Trip Kitty',
  description: 'A very serious financial system for a 2D1N trip.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/providers.tsx app/layout.tsx components/app-shell.tsx
git commit -m "feat(shell): providers wrapper and AppShell with nav + status bar"
```

---

## Task 16: 404 (BSOD)

**Files:**
- Create: `app/not-found.tsx`

- [ ] **Step 1: Implement BSOD 404**

```tsx
// app/not-found.tsx
export default function NotFound() {
  return (
    <main
      className="min-h-screen p-6 font-mono text-y2k-bsod-text"
      style={{ background: 'var(--color-y2k-bsod)' }}
    >
      <div className="max-w-2xl mx-auto space-y-4 mt-12">
        <p className="text-center text-y2k-bsod inline-block px-2 bg-y2k-bsod-text">
          Windows
        </p>
        <p>
          A fatal exception <strong>0E</strong> has occurred at{' '}
          <strong>0028:C0011E36</strong> in the route handler. The current
          application will be terminated.
        </p>
        <ul className="list-disc pl-6">
          <li>Press any key to terminate the current application.</li>
          <li>
            Press CTRL+ALT+DEL again to restart your computer. You will lose any
            unsaved information in all applications.
          </li>
        </ul>
        <p className="text-center mt-12">
          Press any key to continue <span className="animate-pulse">_</span>
        </p>
        <p className="text-center mt-8 text-xs">
          <a className="underline text-y2k-bsod-text" href="/">
            Return to the desktop
          </a>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

Visit `http://localhost:3000/this-page-does-not-exist`. Expected: blue screen.

- [ ] **Step 3: Commit**

```bash
git add app/not-found.tsx
git commit -m "feat(404): BSOD-styled not-found page"
```

---

## Task 17: Login page (mocked)

**Files:**
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(auth)/login/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { TextInput } from '@/components/y2k/text-input';
import { Marquee } from '@/components/y2k/marquee';
import { useMockStore } from '@/lib/mock/store';
import { useAuth } from '@/lib/mock/auth-context';

export default function LoginPage() {
  const users = useMockStore((s) => s.users);
  const { signInAs } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const match = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && !u.removedAt,
    );
    if (!match) {
      setError('No invite found for this email. Ask an admin for a link.');
      return;
    }
    setSent(true);
    setTimeout(() => {
      signInAs(match.id);
      router.push('/');
    }, 600);
  }

  return (
    <main className="p-6 max-w-md mx-auto mt-8">
      <Marquee>
        Welcome to TripKitty 2003!!! Best viewed in Internet Explorer 6.
      </Marquee>
      <div className="h-3" />
      <Window title="Sign in to TripKitty">
        <form onSubmit={send} className="flex flex-col gap-3">
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={sent}
          />
          {error ? <p className="text-y2k-magenta">{error}</p> : null}
          {sent ? (
            <p>
              Magic link sent (mock). Signing you in…
            </p>
          ) : (
            <Button variant="primary" type="submit">
              Send magic link
            </Button>
          )}
        </form>
        <p className="mt-4 text-xs">
          Mock mode: any seed user email works (e.g. <code>pak@example.com</code>).
        </p>
      </Window>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/login/page.tsx
git commit -m "feat(login): mocked magic-link sign-in form"
```

---

## Task 18: Invite acceptance page (mocked)

**Files:**
- Create: `app/(auth)/invite/[token]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(auth)/invite/[token]/page.tsx
'use client';

import { useRouter, useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { TextInput } from '@/components/y2k/text-input';
import { useMockStore } from '@/lib/mock/store';
import { useAuth } from '@/lib/mock/auth-context';

export default function InvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';
  const invites = useMockStore((s) => s.invites);
  const consume = useMockStore((s) => s.consumeInvite);
  const { signInAs } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const status = useMemo(() => {
    const invite = invites.find((i) => i.token === token);
    if (!invite) return 'not-found' as const;
    if (invite.revokedAt) return 'revoked' as const;
    if (invite.usedAt) return 'used' as const;
    if (new Date(invite.expiresAt).getTime() < Date.now())
      return 'expired' as const;
    return 'valid' as const;
  }, [invites, token]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const created = consume(token, {
      email: email.trim(),
      displayName: displayName.trim(),
    });
    if (!created) {
      setError('Invite is no longer valid.');
      return;
    }
    signInAs(created.id);
    router.push('/');
  }

  if (status !== 'valid') {
    return (
      <main className="p-6 max-w-md mx-auto mt-8">
        <Window title="Invite">
          <p>
            This invite is <strong>{status}</strong>. Ask an admin for a new
            link.
          </p>
        </Window>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-md mx-auto mt-8">
      <Window title="Join the trip">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <TextInput
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextInput
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
          {error ? <p className="text-y2k-magenta">{error}</p> : null}
          <Button variant="primary" type="submit">Accept invite</Button>
        </form>
      </Window>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/invite/\[token\]/page.tsx
git commit -m "feat(invite): mocked invite-acceptance flow"
```

---

## Task 19: App layout with auth guard

**Files:**
- Create: `app/(app)/layout.tsx`
- Modify: `app/page.tsx` (remove temp placeholder; we'll put the real dashboard in the (app) group)

- [ ] **Step 1: Delete the placeholder root page**

```bash
rm app/page.tsx
```

- [ ] **Step 2: Create grouped layout**

```tsx
// app/(app)/layout.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/lib/mock/auth-context';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (currentUser === null) {
      // give the auth context a tick to hydrate before redirecting
      const t = setTimeout(() => {
        if (!currentUser) router.replace('/login');
      }, 50);
      return () => clearTimeout(t);
    }
  }, [currentUser, router]);
  if (!currentUser) return null;
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx app/\(app\)/layout.tsx
git commit -m "feat(app): grouped layout with mock auth guard"
```

---

## Task 20: Dashboard page

**Files:**
- Create: `app/(app)/page.tsx`
- Create: `components/features/balance-summary.tsx`
- Create: `components/features/owed-list.tsx`
- Create: `components/features/expense-row.tsx`

- [ ] **Step 1: Balance summary widget**

```tsx
// components/features/balance-summary.tsx
'use client';
import { Window } from '@/components/y2k/window';
import { useMockStore } from '@/lib/mock/store';
import { computeBalances } from '@/lib/balance';
import { formatBaht } from '@/lib/money';

export function BalanceSummary() {
  const users = useMockStore((s) => s.users);
  const contributions = useMockStore((s) => s.contributions);
  const expenses = useMockStore((s) => s.expenses);
  const b = computeBalances({ users, contributions, expenses });

  return (
    <Window title="The Kitty">
      <div className="grid grid-cols-2 gap-3 text-center">
        <Stat label="Pot total" value={formatBaht(b.potTotal)} />
        <Stat
          label="Remaining cash"
          value={formatBaht(b.potRemaining)}
          accent
        />
        <Stat label="Spent so far" value={formatBaht(b.potSpent)} />
        <Stat label="Fair share / person" value={formatBaht(b.fairShare)} />
      </div>
    </Window>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bevel-in bg-white p-3">
      <div className="text-xs uppercase tracking-wide">{label}</div>
      <div
        className={`text-2xl font-bold ${accent ? 'text-y2k-blue' : 'text-black'}`}
      >
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Owed list**

```tsx
// components/features/owed-list.tsx
'use client';
import Link from 'next/link';
import { Window } from '@/components/y2k/window';
import { useMockStore } from '@/lib/mock/store';
import { formatBaht } from '@/lib/money';

export function OwedList() {
  const users = useMockStore((s) => s.users);
  const expenses = useMockStore((s) => s.expenses);
  const unsettled = expenses.filter(
    (e) => e.frontedByUserId && !e.reimbursedAt,
  );
  const byUser = new Map<string, number>();
  for (const e of unsettled) {
    byUser.set(
      e.frontedByUserId!,
      (byUser.get(e.frontedByUserId!) ?? 0) + e.amountCents,
    );
  }

  return (
    <Window title="Pot owes…">
      {byUser.size === 0 ? (
        <p>No outstanding reimbursements. ✔</p>
      ) : (
        <ul className="space-y-1">
          {[...byUser.entries()].map(([uid, cents]) => {
            const u = users.find((x) => x.id === uid);
            return (
              <li key={uid} className="flex justify-between">
                <span>{u?.displayName ?? uid}</span>
                <strong>{formatBaht(cents)}</strong>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 text-xs">
        <Link href="/expenses">View all expenses →</Link>
      </div>
    </Window>
  );
}
```

- [ ] **Step 3: Expense row**

```tsx
// components/features/expense-row.tsx
import Link from 'next/link';
import { formatBaht } from '@/lib/money';
import type { Expense, User } from '@/lib/mock/types';
import { Badge } from '@/components/y2k/badge';

export function ExpenseRow({
  expense,
  fronterName,
}: {
  expense: Expense;
  fronterName?: string;
}) {
  return (
    <li className="bevel-in bg-white p-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <Link
          href={`/expenses/${expense.id}`}
          className="font-bold no-underline text-black hover:underline"
        >
          {expense.description}
        </Link>
        <div className="text-xs flex flex-wrap gap-1 items-center">
          <span>{new Date(expense.occurredAt).toLocaleDateString()}</span>
          <span>·</span>
          <span>{expense.category}</span>
          {expense.frontedByUserId ? (
            <Badge tone={expense.reimbursedAt ? 'good' : 'warning'}>
              {expense.reimbursedAt
                ? `Reimbursed (${fronterName ?? 'paid'})`
                : `Fronted by ${fronterName ?? 'member'}`}
            </Badge>
          ) : (
            <Badge>From pot</Badge>
          )}
        </div>
      </div>
      <strong>{formatBaht(expense.amountCents)}</strong>
    </li>
  );
}

export function findFronter(users: User[], expense: Expense): string | undefined {
  if (!expense.frontedByUserId) return undefined;
  return users.find((u) => u.id === expense.frontedByUserId)?.displayName;
}
```

- [ ] **Step 4: Dashboard page**

```tsx
// app/(app)/page.tsx
'use client';
import Link from 'next/link';
import { BalanceSummary } from '@/components/features/balance-summary';
import { OwedList } from '@/components/features/owed-list';
import { ExpenseRow, findFronter } from '@/components/features/expense-row';
import { Button } from '@/components/y2k/button';
import { useMockStore } from '@/lib/mock/store';

export default function DashboardPage() {
  const users = useMockStore((s) => s.users);
  const expenses = useMockStore((s) => s.expenses);
  const recent = [...expenses]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 5);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <BalanceSummary />
      <OwedList />
      <div className="md:col-span-2 bevel-out bg-y2k-chrome-200 p-3">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold">Recent expenses</h2>
          <div className="flex gap-2">
            <Link href="/expenses/new"><Button variant="primary">Add expense</Button></Link>
            <Link href="/contributions/new"><Button>Add contribution</Button></Link>
          </div>
        </div>
        <ul className="space-y-1">
          {recent.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              fronterName={findFronter(users, e)}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Manual verification**

```bash
npm run dev
```

Click "Pak" in the role switcher → land on dashboard. Expected: pot ฿8,000 total, ฿7,400 remaining (since two pot-paid expenses sum to ฿600… wait, recompute: seed has one pot-paid expense ฿600 + one fronted unreimbursed ฿800 + one fronted unreimbursed ฿3000. Pot spent = ฿600. Pot remaining = ฿7,400. "Pot owes…" shows Tee ฿800, Ploy ฿3,000.). Stop dev server.

- [ ] **Step 6: Commit**

```bash
git add components/features/balance-summary.tsx components/features/owed-list.tsx components/features/expense-row.tsx app/\(app\)/page.tsx
git commit -m "feat(dashboard): balance summary, owed list, recent expenses"
```

---

## Task 21: Expense list page with filters

**Files:**
- Create: `app/(app)/expenses/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(app)/expenses/page.tsx
'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { Select } from '@/components/y2k/select';
import { ExpenseRow, findFronter } from '@/components/features/expense-row';
import { useMockStore } from '@/lib/mock/store';
import type { ExpenseCategory } from '@/lib/mock/types';

const CATEGORIES: { value: ExpenseCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All categories' },
  { value: 'food', label: 'Food & drink' },
  { value: 'transport', label: 'Transport' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
];

export default function ExpensesPage() {
  const users = useMockStore((s) => s.users);
  const expenses = useMockStore((s) => s.expenses);
  const [cat, setCat] = useState<string>('all');
  const [payer, setPayer] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');

  const filtered = expenses
    .filter((e) => (cat === 'all' ? true : e.category === cat))
    .filter((e) => {
      if (payer === 'all') return true;
      if (payer === 'pot') return !e.frontedByUserId;
      return e.frontedByUserId === payer;
    })
    .filter((e) => {
      if (status === 'all') return true;
      if (status === 'unsettled')
        return !!e.frontedByUserId && !e.reimbursedAt;
      if (status === 'reimbursed') return !!e.reimbursedAt;
      if (status === 'pot') return !e.frontedByUserId;
      return true;
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold">Expenses</h1>
        <Link href="/expenses/new"><Button variant="primary">Add expense</Button></Link>
      </div>
      <Window title="Filters">
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label="Category"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          />
          <Select
            label="Paid by"
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
            options={[
              { value: 'all', label: 'Anyone' },
              { value: 'pot', label: 'Pot' },
              ...users.map((u) => ({ value: u.id, label: u.displayName })),
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pot', label: 'From pot' },
              { value: 'unsettled', label: 'Unsettled fronts' },
              { value: 'reimbursed', label: 'Reimbursed' },
            ]}
          />
        </div>
      </Window>
      <ul className="space-y-1">
        {filtered.length === 0 ? (
          <li className="text-xs">No expenses match these filters.</li>
        ) : (
          filtered.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              fronterName={findFronter(users, e)}
            />
          ))
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/expenses/page.tsx
git commit -m "feat(expenses): list page with category/payer/status filters"
```

---

## Task 22: New / edit expense form

**Files:**
- Create: `app/(app)/expenses/new/page.tsx`
- Create: `lib/expense-form.ts`

- [ ] **Step 1: Shared form helper (Zod schema, default values, role-aware payer options)**

```ts
// lib/expense-form.ts
import { z } from 'zod';
import type { ExpenseCategory, User } from './mock/types';
import { parseBahtInput } from './money';

export const expenseFormSchema = z.object({
  description: z.string().min(1, 'Required'),
  amountBaht: z
    .string()
    .min(1, 'Required')
    .refine((v) => parseBahtInput(v) !== null && parseBahtInput(v)! > 0, {
      message: 'Enter a positive whole baht amount',
    }),
  category: z.enum(['food', 'transport', 'lodging', 'activity', 'other']),
  occurredAt: z.string().min(1, 'Required'),
  paidBy: z.string().min(1, 'Required'), // 'pot' or user id
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export function payerOptions(currentUser: User, members: User[]) {
  const isAdmin = currentUser.role === 'admin';
  const active = members.filter((m) => !m.removedAt);
  if (isAdmin) {
    return [
      { value: 'pot', label: 'From the pot' },
      ...active.map((m) => ({
        value: m.id,
        label: `${m.displayName}${m.id === currentUser.id ? ' (me)' : ''} fronted`,
      })),
    ];
  }
  // Members can only record self-fronted expenses
  return [
    { value: currentUser.id, label: `${currentUser.displayName} (me) fronted` },
  ];
}

export const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'food', label: 'Food & drink' },
  { value: 'transport', label: 'Transport' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
];
```

- [ ] **Step 2: Page**

```tsx
// app/(app)/expenses/new/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { TextInput } from '@/components/y2k/text-input';
import { Select } from '@/components/y2k/select';
import { useAuth } from '@/lib/mock/auth-context';
import { useMockStore } from '@/lib/mock/store';
import { parseBahtInput } from '@/lib/money';
import {
  expenseFormSchema,
  type ExpenseFormValues,
  payerOptions,
  CATEGORY_OPTIONS,
} from '@/lib/expense-form';

export default function NewExpensePage() {
  const { currentUser } = useAuth();
  const users = useMockStore((s) => s.users);
  const addExpense = useMockStore((s) => s.addExpense);
  const router = useRouter();

  if (!currentUser) return null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      description: '',
      amountBaht: '',
      category: 'food',
      occurredAt: new Date().toISOString().slice(0, 10),
      paidBy: currentUser.role === 'admin' ? 'pot' : currentUser.id,
    },
  });

  const options = payerOptions(currentUser, users);

  function onSubmit(values: ExpenseFormValues) {
    const cents = parseBahtInput(values.amountBaht)!;
    const frontedBy = values.paidBy === 'pot' ? undefined : values.paidBy;
    addExpense({
      amountCents: cents,
      description: values.description,
      category: values.category,
      occurredAt: new Date(values.occurredAt).toISOString(),
      frontedByUserId: frontedBy,
      createdBy: currentUser.id,
    });
    router.push('/expenses');
  }

  return (
    <Window title="New expense">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <TextInput
          label="Description"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput
            label="Amount (THB)"
            inputMode="numeric"
            error={errors.amountBaht?.message}
            {...register('amountBaht')}
          />
          <TextInput
            label="Date"
            type="date"
            error={errors.occurredAt?.message}
            {...register('occurredAt')}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="Category"
            error={errors.category?.message}
            options={CATEGORY_OPTIONS}
            {...register('category')}
          />
          <Select
            label="Paid by"
            error={errors.paidBy?.message}
            options={options}
            {...register('paidBy')}
          />
        </div>
        <p className="text-xs">
          (Receipt upload comes online when backend is wired up.)
        </p>
        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            Save expense
          </Button>
          <Button type="button" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Window>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/expense-form.ts app/\(app\)/expenses/new/page.tsx
git commit -m "feat(expenses): role-aware new-expense form with validation"
```

---

## Task 23: Expense detail page (view / edit / delete / reimburse)

**Files:**
- Create: `app/(app)/expenses/[id]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(app)/expenses/[id]/page.tsx
'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { Badge } from '@/components/y2k/badge';
import { Dialog } from '@/components/y2k/dialog';
import { useAuth } from '@/lib/mock/auth-context';
import { useMockStore } from '@/lib/mock/store';
import { formatBaht } from '@/lib/money';
import { can } from '@/lib/permissions';

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();
  const users = useMockStore((s) => s.users);
  const expense = useMockStore((s) =>
    s.expenses.find((e) => e.id === params?.id),
  );
  const markReimbursed = useMockStore((s) => s.markExpenseReimbursed);
  const deleteExpense = useMockStore((s) => s.deleteExpense);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!currentUser) return null;
  if (!expense)
    return (
      <Window title="Not found">
        <p>That expense no longer exists.</p>
      </Window>
    );

  const fronter = expense.frontedByUserId
    ? users.find((u) => u.id === expense.frontedByUserId)
    : null;
  const canEdit = can(currentUser, 'expense.update', { resource: expense });
  const canDelete = can(currentUser, 'expense.delete', { resource: expense });
  const canReimburse = can(currentUser, 'expense.markReimbursed', {
    resource: expense,
  });

  return (
    <Window title={expense.description}>
      <div className="flex flex-col gap-3">
        <div className="text-3xl font-bold text-y2k-blue">
          {formatBaht(expense.amountCents)}
        </div>
        <div className="text-xs flex flex-wrap gap-1 items-center">
          <Badge>{expense.category}</Badge>
          {fronter ? (
            <Badge tone={expense.reimbursedAt ? 'good' : 'warning'}>
              {expense.reimbursedAt
                ? `Reimbursed to ${fronter.displayName}`
                : `Fronted by ${fronter.displayName}`}
            </Badge>
          ) : (
            <Badge>Paid from pot</Badge>
          )}
          <span>·</span>
          <span>{new Date(expense.occurredAt).toLocaleDateString()}</span>
        </div>
        <p className="text-xs">
          (Receipt image preview appears here once storage is wired up.)
        </p>

        <div className="flex flex-wrap gap-2 mt-2">
          {fronter && !expense.reimbursedAt && canReimburse ? (
            <Button
              variant="primary"
              onClick={() => markReimbursed(expense.id)}
            >
              Mark reimbursed
            </Button>
          ) : null}
          {canEdit ? <Button disabled>Edit (TODO)</Button> : null}
          {canDelete ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ) : null}
          <Button onClick={() => router.push('/expenses')}>Back</Button>
        </div>
      </div>
      <Dialog
        open={confirmDelete}
        title="Delete expense?"
        onClose={() => setConfirmDelete(false)}
      >
        <p className="mb-3">
          This will remove "<strong>{expense.description}</strong>" from the
          ledger.
        </p>
        <div className="flex gap-2 justify-end">
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              deleteExpense(expense.id);
              router.push('/expenses');
            }}
          >
            Yes, delete
          </Button>
        </div>
      </Dialog>
    </Window>
  );
}
```

(The "Edit (TODO)" button is intentionally a stub — full edit form is identical to "new expense" and can be wired up in a follow-up.)

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/expenses/\[id\]/page.tsx
git commit -m "feat(expenses): detail page with reimburse/delete + permission gating"
```

---

## Task 24: Contributions list + new contribution

**Files:**
- Create: `app/(app)/contributions/page.tsx`
- Create: `app/(app)/contributions/new/page.tsx`
- Create: `components/features/contribution-row.tsx`

- [ ] **Step 1: Row component**

```tsx
// components/features/contribution-row.tsx
import { formatBaht } from '@/lib/money';
import type { Contribution, User } from '@/lib/mock/types';

export function ContributionRow({
  contribution,
  user,
}: {
  contribution: Contribution;
  user?: User;
}) {
  return (
    <li className="bevel-in bg-white p-2 flex items-center justify-between gap-2">
      <div>
        <strong>{user?.displayName ?? contribution.userId}</strong>
        <div className="text-xs">
          {new Date(contribution.contributedAt).toLocaleDateString()}
          {contribution.note ? ` · ${contribution.note}` : ''}
        </div>
      </div>
      <strong>{formatBaht(contribution.amountCents)}</strong>
    </li>
  );
}
```

- [ ] **Step 2: List page**

```tsx
// app/(app)/contributions/page.tsx
'use client';
import Link from 'next/link';
import { Button } from '@/components/y2k/button';
import { ContributionRow } from '@/components/features/contribution-row';
import { useMockStore } from '@/lib/mock/store';

export default function ContributionsPage() {
  const users = useMockStore((s) => s.users);
  const contributions = useMockStore((s) => s.contributions);
  const sorted = [...contributions].sort((a, b) =>
    b.contributedAt.localeCompare(a.contributedAt),
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h1 className="text-lg font-bold">Contributions</h1>
        <Link href="/contributions/new">
          <Button variant="primary">Add contribution</Button>
        </Link>
      </div>
      <ul className="space-y-1">
        {sorted.map((c) => (
          <ContributionRow
            key={c.id}
            contribution={c}
            user={users.find((u) => u.id === c.userId)}
          />
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: New contribution page**

```tsx
// app/(app)/contributions/new/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { TextInput } from '@/components/y2k/text-input';
import { Select } from '@/components/y2k/select';
import { useAuth } from '@/lib/mock/auth-context';
import { useMockStore } from '@/lib/mock/store';
import { parseBahtInput } from '@/lib/money';

const schema = z.object({
  userId: z.string().min(1),
  amountBaht: z
    .string()
    .min(1)
    .refine((v) => parseBahtInput(v) !== null && parseBahtInput(v)! > 0, {
      message: 'Enter a positive whole baht amount',
    }),
  contributedAt: z.string().min(1),
  note: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export default function NewContributionPage() {
  const { currentUser } = useAuth();
  const users = useMockStore((s) => s.users);
  const addContribution = useMockStore((s) => s.addContribution);
  const router = useRouter();
  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';
  const memberOptions = users
    .filter((u) => !u.removedAt)
    .map((u) => ({
      value: u.id,
      label: u.id === currentUser.id ? `${u.displayName} (me)` : u.displayName,
    }));

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: currentUser.id,
      amountBaht: '',
      contributedAt: new Date().toISOString().slice(0, 10),
      note: '',
    },
  });

  function onSubmit(v: Values) {
    addContribution({
      userId: isAdmin ? v.userId : currentUser!.id,
      amountCents: parseBahtInput(v.amountBaht)!,
      contributedAt: new Date(v.contributedAt).toISOString(),
      note: v.note || undefined,
      createdBy: currentUser!.id,
    });
    router.push('/contributions');
  }

  return (
    <Window title="New contribution">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {isAdmin ? (
          <Select
            label="Contributor"
            options={memberOptions}
            error={errors.userId?.message}
            {...register('userId')}
          />
        ) : (
          <p className="text-xs">
            Adding on behalf of yourself ({currentUser.displayName}).
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput
            label="Amount (THB)"
            inputMode="numeric"
            error={errors.amountBaht?.message}
            {...register('amountBaht')}
          />
          <TextInput
            label="Date"
            type="date"
            error={errors.contributedAt?.message}
            {...register('contributedAt')}
          />
        </div>
        <TextInput label="Note (optional)" {...register('note')} />
        <div className="flex gap-2">
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            Save
          </Button>
          <Button type="button" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </Window>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/features/contribution-row.tsx app/\(app\)/contributions/page.tsx app/\(app\)/contributions/new/page.tsx
git commit -m "feat(contributions): list and create pages"
```

---

## Task 25: Members page (admin + member views)

**Files:**
- Create: `app/(app)/members/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// app/(app)/members/page.tsx
'use client';
import { useState } from 'react';
import { Window } from '@/components/y2k/window';
import { Button } from '@/components/y2k/button';
import { Badge } from '@/components/y2k/badge';
import { Dialog } from '@/components/y2k/dialog';
import { useAuth } from '@/lib/mock/auth-context';
import { useMockStore } from '@/lib/mock/store';
import { can } from '@/lib/permissions';

export default function MembersPage() {
  const { currentUser } = useAuth();
  const users = useMockStore((s) => s.users);
  const invites = useMockStore((s) => s.invites);
  const createInvite = useMockStore((s) => s.createInvite);
  const revokeInvite = useMockStore((s) => s.revokeInvite);
  const promote = useMockStore((s) => s.promoteToAdmin);
  const demote = useMockStore((s) => s.demoteToMember);
  const remove = useMockStore((s) => s.removeMember);
  const restore = useMockStore((s) => s.restoreMember);
  const [newLink, setNewLink] = useState<string | null>(null);

  if (!currentUser) return null;
  const isAdmin = can(currentUser, 'invite.create');

  function generate() {
    const invite = createInvite(currentUser!.id);
    setNewLink(`${window.location.origin}/invite/${invite.token}`);
  }

  const liveInvites = invites.filter(
    (i) => !i.usedAt && !i.revokedAt && new Date(i.expiresAt).getTime() > Date.now(),
  );

  return (
    <div className="space-y-3">
      <Window title="Members">
        <ul className="space-y-1">
          {users.map((u) => (
            <li
              key={u.id}
              className="bevel-in bg-white p-2 flex items-center gap-2 flex-wrap"
            >
              <strong className={u.removedAt ? 'line-through' : ''}>
                {u.displayName}
              </strong>
              <span className="text-xs text-y2k-chrome-700">{u.email}</span>
              {u.role === 'admin' ? <Badge tone="admin">admin</Badge> : <Badge>member</Badge>}
              {u.removedAt ? <Badge tone="warning">removed</Badge> : null}
              {isAdmin ? (
                <div className="ml-auto flex gap-1">
                  {u.role === 'member' ? (
                    <Button onClick={() => promote(u.id)}>Make admin</Button>
                  ) : (
                    <Button
                      onClick={() => demote(u.id)}
                      disabled={u.id === currentUser!.id}
                    >
                      Demote
                    </Button>
                  )}
                  {u.removedAt ? (
                    <Button onClick={() => restore(u.id)}>Restore</Button>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => remove(u.id)}
                      disabled={u.id === currentUser!.id}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Window>

      {isAdmin ? (
        <Window title="Invite links">
          <div className="flex gap-2 mb-3">
            <Button variant="primary" onClick={generate}>
              Generate invite link
            </Button>
          </div>
          {liveInvites.length === 0 ? (
            <p className="text-xs">No live invite links.</p>
          ) : (
            <ul className="space-y-1">
              {liveInvites.map((i) => {
                const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${i.token}`;
                return (
                  <li
                    key={i.id}
                    className="bevel-in bg-white p-2 flex items-center gap-2 flex-wrap"
                  >
                    <code className="break-all text-xs flex-1">{url}</code>
                    <Button
                      onClick={() => navigator.clipboard?.writeText(url)}
                    >
                      Copy
                    </Button>
                    <Button variant="danger" onClick={() => revokeInvite(i.id)}>
                      Revoke
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Window>
      ) : null}

      <Dialog
        open={!!newLink}
        title="Invite link ready"
        onClose={() => setNewLink(null)}
      >
        <p className="mb-2">Send this link to your friend:</p>
        <code className="block bevel-in bg-white p-2 break-all text-xs mb-3">
          {newLink}
        </code>
        <div className="flex justify-end gap-2">
          <Button
            onClick={() => {
              if (newLink) navigator.clipboard?.writeText(newLink);
            }}
          >
            Copy
          </Button>
          <Button onClick={() => setNewLink(null)}>Done</Button>
        </div>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/members/page.tsx
git commit -m "feat(members): roster, role controls, invite link management"
```

---

## Task 26: Responsive audit + final polish

- [ ] **Step 1: Start dev server and walk through every page on both viewport sizes**

```bash
npm run dev
```

Open Chrome devtools, toggle device toolbar. Verify on **iPhone 12 Pro (390×844)** AND **desktop (≥1024px wide)**:

1. `/login` — form readable, button reachable
2. `/invite/anything-token` — shows "not-found" state cleanly
3. `/` (dashboard) — windows stack on mobile, side-by-side on desktop; numbers readable; "Add expense" button reachable
4. `/expenses` — filter row stacks on mobile; expense rows scroll
5. `/expenses/new` — fields stack; tap targets ≥ 44px; date picker works
6. `/expenses/<id>` — buttons wrap; delete dialog fills viewport on mobile
7. `/contributions` — list scrolls
8. `/contributions/new` — same as expense form
9. `/members` — role chips wrap; admin controls wrap onto a second row on mobile; invite-link `<code>` wraps via `break-all`
10. `/not-found-page` — BSOD renders

For any layout that breaks (text overflow, button cut off, tap target < 40px), fix with Tailwind responsive classes (`flex-wrap`, `md:grid-cols-2`, `min-h-[44px]`) right then.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all green.

- [ ] **Step 3: Run a production build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit any layout fixes**

```bash
git add -A
git commit -m "polish: responsive layout fixes from manual audit"
```

- [ ] **Step 5: Final smoke checklist (manual)**

Run through one complete demo flow as Pak (admin):
- See dashboard with seed data → ฿7,400 remaining, two owed entries
- Add an expense ฿500 fronted by self → appears in list
- Mark Ploy's ฿3,000 dinner reimbursed → "Pot owes" updates, pot remaining drops to ฿4,400
- Switch to Ploy (member) via dev switcher → "Add expense" form shows only "Ploy (me) fronted"
- Try the URL `/expenses/e-breakfast` as Ploy → no Edit/Delete/Reimburse buttons visible
- Generate an invite link → copy → open in incognito → fill form → land on dashboard as a new member

If anything's off, fix and commit. Otherwise you're done with the UI phase.

---

## What's intentionally NOT in this plan (deferred to backend phase)

- Real Supabase auth (magic link); `magic link` button currently just signs in as the matched seed user
- Server actions and RLS policies
- Drizzle migrations
- File uploads to Supabase Storage; receipt previews on detail pages
- Edit-expense form (stub button left in the detail page so the slot is visible)
- Playwright E2E (low value without real backend state)
- Multi-currency, multi-trip, custom splits, dark mode (spec §13)

When you give the go-ahead, the next plan will:
1. Provision Supabase + run migrations
2. Replace `lib/mock/store.ts` callers with server actions hitting Drizzle
3. Replace `MockAuthProvider` with Supabase session
4. Wire signed-URL upload + receipt display
5. Add the permission-matrix integration tests against the real DB
6. Add Playwright smoke flows
