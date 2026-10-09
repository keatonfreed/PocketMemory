import test from 'node:test'
import assert from 'node:assert/strict'
import { advanceReviewProgress, shouldRequestReview } from '../shared/review.js'

test('review becomes eligible on the third sent message and stays requested after restart', () => {
  let progress = {}
  for (let count = 1; count <= 3; count++) {
    progress = advanceReviewProgress(JSON.parse(JSON.stringify(progress)))
    assert.equal(progress.count, count)
    assert.equal(shouldRequestReview(progress), count === 3)
  }
  progress = { ...progress, requested: true }
  for (let count = 0; count < 5; count++) progress = advanceReviewProgress(JSON.parse(JSON.stringify(progress)))
  assert.equal(shouldRequestReview(progress), false)
})
