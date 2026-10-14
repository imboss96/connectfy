import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Briefcase, CalendarDays, ExternalLink, LoaderCircle, MapPin, Search } from 'lucide-react';

type Market = 'germany' | 'uk';
type JobSource = 'arbeitnow' | 'jobicy' | 'remoteok';
type FeedKey = 'arbeitnow-germany' | 'arbeitnow-uk' | 'jobicy' | 'remoteok';

interface ArbeitnowJob {
  slug: string;
  title: string;
  companyName: string;
  description: string;
  location: string;
  remote: boolean;
  url: string;
  createdAt: number | null;
  jobTypes: string[];
  tags: string[];
  source: JobSource;
}

interface JobPage {
  jobs: ArbeitnowJob[];
  hasMore: boolean;
  nextCursor: string | null;
}

const ARBEITNOW_ORIGINS: Record<Market, string> = {
  germany: 'https://www.arbeitnow.com',
  uk: 'https://www.arbeitnow.co.uk'
};
const FEEDS: FeedKey[] = ['arbeitnow-germany', 'arbeitnow-uk', 'jobicy', 'remoteok'];
const JOB_TYPE_PATTERN = /\bfreelanc\w*|\bfreiberufler\b|\bselbstständig\b|\bselbstandig\b|\bself[- ]employed\b|\bcontract(?:or)?\b/i;
const DATA_TASK_TITLE_PATTERN = /\b(data annotat\w*|data collect\w*|transcrib\w*|transcription|survey participant|voice recording|audio recording|image collection|video collection|ai training|ai trainer|data labeling|data labelling|crowd work)\b/i;

interface FeedProgress {
  page: number;
  nextCursor: string | null;
  hasMore: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const parseArbeitnowJob = (value: unknown): ArbeitnowJob | null => {
  if (!isRecord(value)) return null;

  const { slug, title, company_name: companyName, url } = value;
  if (typeof slug !== 'string' || typeof title !== 'string' || typeof companyName !== 'string' || typeof url !== 'string') {
    return null;
  }

  let listingUrl: URL;
  try {
    listingUrl = new URL(url);
  } catch {
    return null;
  }
  if (listingUrl.protocol !== 'https:' || !['arbeitnow.com', 'arbeitnow.co.uk'].includes(listingUrl.hostname)) return null;

  return {
    slug,
    title,
    companyName,
    url: listingUrl.toString(),
    description: typeof value.description === 'string' ? value.description : '',
    location: typeof value.location === 'string' ? value.location : '',
    remote: value.remote === true,
    createdAt: typeof value.created_at === 'number' && Number.isFinite(value.created_at) ? value.created_at : null,
    jobTypes: readStringArray(value.job_types),
    tags: readStringArray(value.tags),
    source: 'arbeitnow'
  };
};

const parseJobicyJob = (value: unknown): ArbeitnowJob | null => {
  if (!isRecord(value)) return null;
  const { jobTitle, companyName, url } = value;
  if (typeof jobTitle !== 'string' || typeof companyName !== 'string' || typeof url !== 'string') return null;

  let listingUrl: URL;
  try {
    listingUrl = new URL(url);
  } catch {
    return null;
  }
  if (listingUrl.protocol !== 'https:' || !['jobicy.com', 'www.jobicy.com'].includes(listingUrl.hostname)) return null;

  const postedAt = typeof value.pubDate === 'string' ? Date.parse(value.pubDate) : Number.NaN;
  return {
    slug: typeof value.jobSlug === 'string' ? value.jobSlug : listingUrl.pathname,
    title: jobTitle,
    companyName,
    description: typeof value.jobDescription === 'string'
      ? value.jobDescription
      : typeof value.jobExcerpt === 'string' ? value.jobExcerpt : '',
    location: typeof value.jobGeo === 'string' ? value.jobGeo : '',
    remote: true,
    url: listingUrl.toString(),
    createdAt: Number.isFinite(postedAt) ? Math.floor(postedAt / 1000) : null,
    jobTypes: readStringArray(value.jobType),
    tags: readStringArray(value.jobIndustry),
    source: 'jobicy'
  };
};

const parseRemoteOkJob = (value: unknown): ArbeitnowJob | null => {
  if (!isRecord(value) || (typeof value.id !== 'string' && typeof value.id !== 'number')) return null;
  const { position, company, url } = value;
  if (typeof position !== 'string' || typeof company !== 'string' || typeof url !== 'string') return null;

  let listingUrl: URL;
  try {
    listingUrl = new URL(url);
  } catch {
    return null;
  }
  if (listingUrl.protocol !== 'https:' || !['remoteok.com', 'www.remoteok.com'].includes(listingUrl.hostname.toLowerCase())) return null;

  const postedAt = typeof value.date === 'string' ? Date.parse(value.date) : Number.NaN;
  return {
    slug: String(value.id),
    title: position,
    companyName: company,
    description: typeof value.description === 'string' ? value.description : '',
    location: typeof value.location === 'string' ? value.location : 'Remote',
    remote: true,
    url: listingUrl.toString(),
    createdAt: Number.isFinite(postedAt) ? Math.floor(postedAt / 1000) : null,
    jobTypes: [],
    tags: readStringArray(value.tags),
    source: 'remoteok'
  };
};

const isFreelanceJob = (job: ArbeitnowJob) =>
  JOB_TYPE_PATTERN.test([job.title, ...job.jobTypes, ...job.tags].join(' '))
  || DATA_TASK_TITLE_PATTERN.test(job.title);

const fetchJobsPage = async (
  feed: FeedKey,
  page: number,
  cursor: string | null,
  signal: AbortSignal
): Promise<JobPage> => {
  const source: JobSource = feed.startsWith('arbeitnow-')
    ? 'arbeitnow'
    : feed === 'jobicy' ? 'jobicy' : 'remoteok';

  if (source === 'remoteok') {
    const response = await fetch('https://remoteok.com/api', { signal });
    if (!response.ok) throw new Error(`Remote OK could not load jobs (HTTP ${response.status}). Please try again.`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('Remote OK returned an unexpected jobs response. Please try again later.');
    const jobs = payload
      .map(parseRemoteOkJob)
      .filter((job): job is ArbeitnowJob => job !== null && isFreelanceJob(job));
    return { jobs, hasMore: false, nextCursor: null };
  }

  if (source === 'jobicy') {
    const url = new URL('/api/v2/remote-jobs', 'https://jobicy.com');
    url.searchParams.set('count', '50');
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error(`Jobicy could not load jobs (HTTP ${response.status}). Please try again.`);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.jobs)) {
      throw new Error('Jobicy returned an unexpected jobs response. Please try again later.');
    }
    const jobs = payload.jobs
      .map(parseJobicyJob)
      .filter((job): job is ArbeitnowJob => job !== null && isFreelanceJob(job));
    const nextCursor = typeof payload.nextCursor === 'string' ? payload.nextCursor : null;
    return { jobs, hasMore: payload.hasMore === true && nextCursor !== null, nextCursor };
  }

  const market: Market = feed === 'arbeitnow-uk' ? 'uk' : 'germany';
  const url = new URL('/api/job-board-api', ARBEITNOW_ORIGINS[market]);
  url.searchParams.set('page', String(page));
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Arbeitnow could not load jobs (HTTP ${response.status}). Please try again.`);

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error('Arbeitnow returned an unexpected jobs response. Please try again later.');
  }

  const jobs = payload.data
    .map(parseArbeitnowJob)
    .filter((job): job is ArbeitnowJob => job !== null && isFreelanceJob(job));
  const hasMore = isRecord(payload.links) && typeof payload.links.next === 'string';
  return { jobs, hasMore, nextCursor: null };
};

const getDescriptionText = (description: string) => {
  const parsed = new DOMParser().parseFromString(description, 'text/html');
  return (parsed.body.textContent || '').replace(/\s+/g, ' ').trim();
};

const formatPostedDate = (createdAt: number | null) => {
  if (createdAt === null) return null;
  const date = new Date(createdAt * 1000);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
};

export const ArbeitnowJobsBoard: React.FC = () => {
  const [jobs, setJobs] = useState<ArbeitnowJob[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedProgress, setFeedProgress] = useState<Partial<Record<FeedKey, FeedProgress>>>({});
  const [failedFeeds, setFailedFeeds] = useState<FeedKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const activeRequest = useRef<AbortController | null>(null);
  const feedProgressRef = useRef(feedProgress);

  const loadFeeds = useCallback(async (
    feeds: FeedKey[],
    append: boolean,
    signal: AbortSignal
  ) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    setError('');

    const results = await Promise.allSettled(feeds.map(feed => {
      const progress = feedProgressRef.current[feed];
      return fetchJobsPage(feed, (progress?.page || 0) + 1, progress?.nextCursor || null, signal)
        .then(result => ({ feed, result }));
    }));
    if (signal.aborted) return;

    const loadedJobs: ArbeitnowJob[] = [];
    const nextProgress: Partial<Record<FeedKey, FeedProgress>> = { ...feedProgressRef.current };
    const failures: FeedKey[] = [];
    results.forEach((result, index) => {
      const feed = feeds[index];
      if (result.status === 'fulfilled') {
        loadedJobs.push(...result.value.result.jobs);
        nextProgress[feed] = {
          page: (feedProgressRef.current[feed]?.page || 0) + 1,
          nextCursor: result.value.result.nextCursor,
          hasMore: result.value.result.hasMore
        };
      } else {
        failures.push(feed);
      }
    });

    if (loadedJobs.length > 0) {
      setJobs(currentJobs => {
        const seen = new Set(currentJobs.map(job => `${job.source}:${job.slug}`));
        return [
          ...(append ? currentJobs : []),
          ...loadedJobs.filter(job => !seen.has(`${job.source}:${job.slug}`))
        ];
      });
    } else if (!append && failures.length > 0) {
      setJobs([]);
    }
    feedProgressRef.current = nextProgress;
    setFeedProgress(nextProgress);
    setFailedFeeds(failures);
    const failedFeedNames = failures.map(feed =>
      feed === 'arbeitnow-germany' ? 'Arbeitnow Germany'
        : feed === 'arbeitnow-uk' ? 'Arbeitnow UK'
          : feed === 'jobicy' ? 'Jobicy'
            : 'Remote OK'
    );
    if (failures.length > 0) {
      setError(`Could not load listings from ${failedFeedNames.join(', ')}.`);
    }
    setIsLoading(false);
    setIsLoadingMore(false);
  }, []);

  useEffect(() => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setJobs([]);
    feedProgressRef.current = {};
    setFeedProgress({});
    setFailedFeeds([]);
    setError('');
    void loadFeeds(FEEDS, false, controller.signal);

    return () => {
      controller.abort();
      if (activeRequest.current === controller) activeRequest.current = null;
    };
  }, [loadFeeds]);

  const visibleJobs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return jobs;
    return jobs.filter(job =>
      [job.title, job.companyName, job.location, job.description, ...job.jobTypes, ...job.tags]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [jobs, searchTerm]);

  const handleLoadMore = () => {
    const feedsToLoad = FEEDS.filter(feed => feedProgress[feed]?.hasMore);
    if (isLoading || isLoadingMore || feedsToLoad.length === 0) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    void loadFeeds(feedsToLoad, true, controller.signal);
  };

  const hasMore = FEEDS.some(feed => feedProgress[feed]?.hasMore);
  const retryFailedFeeds = () => {
    if (failedFeeds.length === 0) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    void loadFeeds(failedFeeds, true, controller.signal);
  };
  const jobLabel = (job: ArbeitnowJob) =>
    job.jobTypes.find(type => JOB_TYPE_PATTERN.test(type))
    || (DATA_TASK_TITLE_PATTERN.test(job.title)
      ? 'Data task'
      : /\bfreelanc\w*|\bfreiberufler\b|\bselbstständig\b|\bselbstandig\b|\bself[- ]employed\b/i.test(job.title)
        ? 'Freelance' : 'Contract');

  const sourceName = (source: JobSource) =>
    source === 'arbeitnow' ? 'Arbeitnow'
      : source === 'jobicy' ? 'Jobicy'
        : 'Remote OK';

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-[#0B132B] via-[#102242] to-[#006987] p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-200">
              <Briefcase className="h-4 w-4" />
              External opportunities
            </div>
            <h1 className="text-2xl font-black sm:text-3xl">Freelance jobs</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Browse remote opportunities explicitly identified as freelance or contract. Applications and job details are handled by the original listing.
            </p>
          </div>
          <p className="text-xs font-semibold text-cyan-100">All sources · all available markets</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={event => setSearchTerm(event.target.value)}
            placeholder="Search title, company, location, or skill"
            aria-label="Search freelance jobs"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-[#00A3E0]"
          />
        </label>
        <p className="text-xs text-slate-500">
          {jobs.length} freelance and data-task {jobs.length === 1 ? 'listing' : 'listings'} loaded from all sources
        </p>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            onClick={retryFailedFeeds}
            disabled={failedFeeds.length === 0 || isLoading || isLoadingMore}
            className="shrink-0 rounded-lg border border-rose-300 px-3 py-2 font-semibold hover:bg-rose-100"
          >
            Retry failed sources
          </button>
        </div>
      )}

      {isLoading && jobs.length === 0 && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading freelance jobs...
        </div>
      )}

      {!isLoading && !error && visibleJobs.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="mt-3 font-bold text-slate-800">
            {jobs.length === 0 ? 'No explicitly tagged freelance or contract jobs found' : 'No matching jobs'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {jobs.length === 0
              ? 'Listings without a clear freelance or contract label are excluded. Load more to search older listings.'
              : 'Try another search term.'}
          </p>
        </div>
      )}

      {visibleJobs.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleJobs.map(job => {
            const description = getDescriptionText(job.description);
            const postedDate = formatPostedDate(job.createdAt);
            return (
              <article key={`${job.source}-${job.slug}`} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold capitalize text-emerald-700">{jobLabel(job)}</span>
                    {job.remote && <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">Remote</span>}
                  </div>
                  <h2 className="mt-3 text-lg font-bold leading-snug text-slate-900">{job.title}</h2>
                  <p className="mt-1 text-sm font-medium text-slate-600">{job.companyName}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                    {job.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {job.location}
                      </span>
                    )}
                    {postedDate && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Posted {postedDate}
                      </span>
                    )}
                  </div>
                  {description && <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{description}</p>}
                  {job.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {job.tags.slice(0, 5).map(tag => (
                        <span key={tag} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-500">Source: {sourceName(job.source)}</span>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#007AFF] px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700"
                  >
                    View & apply
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoading || isLoadingMore}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingMore && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {isLoadingMore ? 'Loading...' : 'Load more freelance jobs'}
          </button>
        </div>
      )}

      <p className="text-center text-xs text-slate-500">
        Job data provided by{' '}
        <a href="https://www.arbeitnow.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#007f95] underline">Arbeitnow</a>
        ,{' '}
        <a href="https://jobicy.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#007f95] underline">Jobicy</a>
        , and{' '}
        <a href="https://remoteok.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#007f95] underline">Remote OK</a>
        . Confirm details and eligibility on the original job listing before applying.
      </p>
    </section>
  );
};
