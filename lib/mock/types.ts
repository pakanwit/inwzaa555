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
