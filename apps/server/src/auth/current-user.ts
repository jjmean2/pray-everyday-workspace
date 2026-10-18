import type { CurrentUser } from '@pray/api-contract';
import type { UserRecord } from './session.service.js';

export function toCurrentUser(user: UserRecord): CurrentUser {
  return {
    id: user.id,
    displayName: user.displayName,
    profileImageUrl: user.profileImageUrl,
  };
}
