import type { UserStatus } from '@inventory-ms/contracts';

/**
 * Explicit user status state machine. Status changes only ever happen
 * through dedicated, permission-checked application services (activate,
 * deactivate, archive, lock/unlock) -- never through a generic PATCH body.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<UserStatus, readonly UserStatus[]>> = {
  invited: ['active', 'archived'],
  active: ['locked', 'inactive', 'archived'],
  locked: ['active', 'archived'],
  inactive: ['active', 'archived'],
  archived: [],
};

export function canTransitionUserStatus(from: UserStatus, to: UserStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertUserStatusTransition(from: UserStatus, to: UserStatus): void {
  if (!canTransitionUserStatus(from, to)) {
    throw new Error(`Invalid user status transition: ${from} -> ${to}`);
  }
}
