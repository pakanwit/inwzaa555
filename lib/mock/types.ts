// Re-export canonical domain types — mock layer conforms to these
import type { UserId } from '../types';
export type {
  UserId,
  Role,
  User,
  Attachment,
  Contribution,
  ExpenseCategory,
  Expense,
} from '../types';

// Mock-only: invite_tokens table was dropped from the real schema
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
