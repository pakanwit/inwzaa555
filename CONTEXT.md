# Trip Expense Tracker

A private web app for a fixed friend group on a single trip. Tracks a shared cash kitty, expenses paid from it or fronted by individuals, and shows who is owed what at trip end.

## Language

### Money & The Pot

**Pot**:
The central cash pool funded by member contributions. Expenses are drawn from the pot by default.
_Avoid_: Kitty, fund, pool, shared wallet

**Contribution**:
A transfer into the Pot, evidenced by a Slip image. Only Admins record Contributions. Multiple Contributions per member are allowed.
_Avoid_: Payment, deposit, top-up

**Slip**:
The bank transfer evidence attached to a Contribution. Required (a Contribution cannot exist without one). Viewable by all Members. Stored as an Attachment in the `receipts` bucket.
_Avoid_: Receipt, proof, transfer screenshot

**Expense**:
A spend charged against the group, either drawn from the Pot or fronted out-of-pocket by a member.
_Avoid_: Transaction, cost, purchase

**Fronted Expense**:
An Expense paid out-of-pocket by a member because the Pot didn't have cash on hand. The member is owed reimbursement from the Pot.
_Avoid_: Out-of-pocket expense, personal expense, advance

**Reimbursed**:
The boolean state set on a Fronted Expense when the Pot has paid the fronting member back. Stored as `reimbursed_at` timestamp; `NULL` = not yet reimbursed.
_Avoid_: Settled, paid back, cleared

**Fair Share**:
Each member's equal share of total expenses (`total_expenses ÷ member_count`, integer division). Used to compute net positions at trip end — not per-expense.
_Avoid_: Split, individual share, proportional share

**Net Position**:
`contributions + owed_unsettled − fair_share` for a given member. Positive = money owed to them; negative = they owe the Pot.
_Avoid_: Balance, net balance, amount owed

### People & Access

**Member**:
A person in the friend group who has signed in at least once. Has a row in the `users` table. All members can view everything and create their own expenses/contributions.
_Avoid_: User, participant, friend

**Admin**:
A Member with `role='admin'`. The first Admin is bootstrapped by editing `role` directly in the Supabase Table Editor; subsequent Admins are promoted via the Members page. Can mutate any record and manage the roster.
_Avoid_: Owner, super-user, organiser

**Removed Member**:
A Member with `removed_at` set (soft-delete). Cannot sign in. Their Expense and Contribution history remains in the ledger so balances stay correct.
_Avoid_: Deleted user, banned user, deactivated user

**Attachment**:
A receipt or evidence photo linked to an Expense or Contribution, stored in the private `receipts` Supabase Storage bucket.
_Avoid_: Receipt, photo, image, file

### Domain Types

**Canonical Types**:
The TypeScript interfaces in `lib/types.ts` that define the shape of domain entities throughout the app. Both the mock Zustand store and the Drizzle DB query layer must produce values assignable to these types. Timestamps are ISO strings (`string`), nullable fields are `T | undefined`.
_Avoid_: Domain model, app types, shared types

## Example dialogue

> **Dev:** "If Alice puts in 2000 baht and Bob puts in 1000, but Bob paid 500 for dinner out of his wallet because the pot was empty, what's Bob's net position?"
>
> **Domain expert:** "The Pot has 3000 total. Bob fronted 500, which is still unsettled. Total expenses so far are 500, fair share is 250 each. Bob's net position is `1000 + 500 − 250 = +1250` — he's owed 1250 baht overall."
>
> **Dev:** "And after we mark that Fronted Expense as Reimbursed?"
>
> **Domain expert:** "Bob's owed_unsettled drops to 0. Net position becomes `1000 + 0 − 250 = +750`. The Pot also shrinks by 500 because it just paid him back."
