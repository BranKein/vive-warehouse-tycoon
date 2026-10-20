/** The sign-in ran out or was withdrawn; the player has to connect again. */
export class CloudAuthError extends Error {
  constructor(message = 'Cloud sign-in expired') {
    super(message);
    this.name = 'CloudAuthError';
  }
}

/** The player closed the sign-in window or declined the permission. Not worth an error message. */
export class CloudCancelledError extends Error {
  constructor(message = 'Cloud sign-in cancelled') {
    super(message);
    this.name = 'CloudCancelledError';
  }
}
