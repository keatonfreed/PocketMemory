export function advanceReviewProgress(progress = {}) {
  const count = Number.isSafeInteger(progress.count) && progress.count >= 0 ? progress.count : 0
  return { count: Math.min(count + 1, 3), requested: progress.requested === true }
}
export function shouldRequestReview(progress) { return progress.count >= 3 && !progress.requested }
