export type UserId = string;
export type Role = 'admin' | 'member';

export type User = {
  id: UserId;
  email?: string;            // absent for admin-created Members who haven't signed in
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
  storagePath: string;
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
  /** undefined = paid from the Pot directly */
  frontedByUserId?: UserId;
  /** ISO timestamp when fronter was paid back; undefined = unsettled */
  reimbursedAt?: string;
  createdBy: UserId;
  createdAt: string;
  attachments: Attachment[];
};
