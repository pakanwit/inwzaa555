/**
 * Pure helper to validate that a Storage path belongs to a given Expense.
 *
 * Lives outside `expenses.ts` because that file is `'use server'`, which only
 * allows async exports. Imported by `expenses.ts` and the unit tests.
 */
export function isReceiptPathForExpense(
  storagePath: string,
  expenseId: string,
): boolean {
  return storagePath.startsWith(`expense/${expenseId}/`)
}
