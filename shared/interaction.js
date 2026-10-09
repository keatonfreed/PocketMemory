// Capgo maps ASAuthorizationError.canceled to this explicit bridge code.
export const isUserCancellation = error => error?.code === 'USER_CANCELLED'
export function notificationState(permission) {
  return permission === 'granted' ? 'enabled' : permission === 'denied' ? 'settings' : 'request'
}
