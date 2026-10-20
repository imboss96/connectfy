import assert from 'node:assert/strict';
import { calculateTesterRanking } from '../src/lib/testerRanking';

const now = new Date('2026-10-20T12:00:00.000Z');
const submission = (
  status: 'approved' | 'rejected' | 'under_review',
  rating?: number,
  reviewedAt = '2026-10-01T12:00:00.000Z'
) => ({
  status,
  client_rating: rating,
  submitted_at: reviewedAt,
  reviewed_at: reviewedAt
});

const developingTester = calculateTesterRanking(
  Array.from({ length: 4 }, () => submission('approved', 5)),
  now
);
assert.equal(developingTester.tier, 'Unrated');
assert.equal(developingTester.rankingApprovedCount, 4);

const experiencedTester = calculateTesterRanking(
  Array.from({ length: 20 }, () => submission('approved', 5)),
  now
);
assert.equal(experiencedTester.tier, 'Top Rated');
assert.equal(experiencedTester.rankingScore, 98.7);
assert.equal(experiencedTester.totalReviews, 20);

const unreliableTester = calculateTesterRanking(
  [
    ...Array.from({ length: 5 }, () => submission('approved', 1)),
    ...Array.from({ length: 5 }, () => submission('rejected'))
  ],
  now
);
assert.equal(unreliableTester.tier, 'Bronze');
assert.equal(unreliableTester.rankingReliabilityScore, 50);

const rollingWindowTester = calculateTesterRanking(
  [
    ...Array.from({ length: 5 }, () => submission('approved', 5, '2025-10-01T12:00:00.000Z')),
    ...Array.from({ length: 5 }, () => submission('approved', 5, '2026-10-01T12:00:00.000Z')),
    submission('under_review')
  ],
  now
);
assert.equal(rollingWindowTester.rankingApprovedCount, 5);
assert.equal(rollingWindowTester.rankingReviewedCount, 5);
assert.equal(rollingWindowTester.tier, 'Silver');

const monthEndTester = calculateTesterRanking(
  [
    ...Array.from({ length: 5 }, () => submission('approved', 5, '2026-04-29T23:59:59.000Z')),
    ...Array.from({ length: 5 }, () => submission('approved', 5, '2026-10-01T12:00:00.000Z'))
  ],
  new Date('2026-10-31T12:00:00.000Z')
);
assert.equal(monthEndTester.rankingApprovedCount, 5);

console.log('tester ranking regression checks passed');
