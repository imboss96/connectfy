export interface RankingSubmission {
  status?: string | null;
  client_rating?: number | string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
}

export interface TesterRanking {
  tier: 'Unrated' | 'Bronze' | 'Silver' | 'Gold' | 'Top Rated';
  rankingScore: number;
  rankingQualityScore: number;
  rankingReliabilityScore: number;
  rankingVolumeScore: number;
  rankingApprovedCount: number;
  rankingReviewedCount: number;
  rating: number;
  totalReviews: number;
  acceptanceRate: number;
}

const RANKING_WINDOW_MONTHS = 6;
const MINIMUM_APPROVED_SUBMISSIONS = 5;
const APPROVED_SUBMISSIONS_FOR_FULL_VOLUME_SCORE = 20;
const PRIOR_RATING = 4.2;
const PRIOR_REVIEW_COUNT = 5;

const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;
const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

export const calculateTesterRanking = (
  submissions: RankingSubmission[],
  now = new Date()
): TesterRanking => {
  const cutoff = new Date(now);
  const cutoffDay = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RANKING_WINDOW_MONTHS);
  const lastDayOfCutoffMonth = new Date(Date.UTC(
    cutoff.getUTCFullYear(),
    cutoff.getUTCMonth() + 1,
    0
  )).getUTCDate();
  cutoff.setUTCDate(Math.min(cutoffDay, lastDayOfCutoffMonth));

  const reviewedSubmissions = submissions.filter((submission) => {
    const status = submission.status?.toLowerCase();
    if (status !== 'approved' && status !== 'rejected') return false;

    const reviewDate = new Date(submission.reviewed_at || submission.submitted_at || '');
    return Number.isFinite(reviewDate.getTime()) && reviewDate >= cutoff && reviewDate <= now;
  });
  const approvedSubmissions = reviewedSubmissions.filter((submission) => submission.status?.toLowerCase() === 'approved');
  const ratings = reviewedSubmissions
    .filter((submission) => submission.status?.toLowerCase() === 'approved')
    .map((submission) => Number(submission.client_rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  const ratingTotal = ratings.reduce((total, rating) => total + rating, 0);
  const rating = ratings.length > 0 ? ratingTotal / ratings.length : 0;
  const adjustedRating = (ratingTotal + PRIOR_RATING * PRIOR_REVIEW_COUNT) / (ratings.length + PRIOR_REVIEW_COUNT);
  const qualityScore = roundToOneDecimal((adjustedRating / 5) * 100);
  const reliabilityScore = reviewedSubmissions.length > 0
    ? roundToOneDecimal((approvedSubmissions.length / reviewedSubmissions.length) * 100)
    : 0;
  const volumeScore = roundToOneDecimal(Math.min(
    approvedSubmissions.length / APPROVED_SUBMISSIONS_FOR_FULL_VOLUME_SCORE,
    1
  ) * 100);
  const score = roundToOneDecimal(qualityScore * 0.4 + reliabilityScore * 0.35 + volumeScore * 0.25);

  let tier: TesterRanking['tier'] = 'Unrated';
  if (approvedSubmissions.length >= MINIMUM_APPROVED_SUBMISSIONS) {
    if (score >= 92) tier = 'Top Rated';
    else if (score >= 82) tier = 'Gold';
    else if (score >= 70) tier = 'Silver';
    else tier = 'Bronze';
  }

  return {
    tier,
    rankingScore: score,
    rankingQualityScore: qualityScore,
    rankingReliabilityScore: reliabilityScore,
    rankingVolumeScore: volumeScore,
    rankingApprovedCount: approvedSubmissions.length,
    rankingReviewedCount: reviewedSubmissions.length,
    rating: roundToTwoDecimals(rating),
    totalReviews: ratings.length,
    acceptanceRate: reliabilityScore
  };
};
