/* eslint-disable camelcase */

import Twitter from 'twitter-v2';
import { DateTime } from 'luxon';

interface TwitterRecentTweetsResponse {
  data: {
    id: number;
    text: string;
  }[];
  meta: {
    newest_id: number;
    oldest_id: number;
    result_count: number;
  }
}

const tweetDateTimeRegex = /(?<date>(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4})\D+(?<startTime>[\d:]+)\D+(?<endTime>[\d:]+) \(UTC(?<utcOffsetTimezone>[-\d]+)\)/;

const twitter = new Twitter({ bearer_token: process.env.TWITTER_API_BEARER_TOKEN! });

interface Maintenance {
  start: DateTime;
  end: DateTime;
}

// eslint-disable-next-line import/prefer-default-export
export const fetchLatestMaintenanceTweet = async (): Promise<Maintenance | null> => {
  const response = await twitter.get<TwitterRecentTweetsResponse>('tweets/search/recent', { query: 'perform maintenance from:ArknightsEN' });
  const mostRecentId = response.meta.newest_id;
  if (response?.data) {
    const mostRecentTweet = response.data.find((tweet) => tweet.id === mostRecentId);
    console.log('mostRecentTweet:', mostRecentTweet);
    const match = mostRecentTweet?.text.match(tweetDateTimeRegex);
    if (match?.groups) {
      const {
        date, startTime, endTime, utcOffsetTimezone,
      } = match.groups;
      const start = DateTime.fromFormat(`${date} ${startTime} ${utcOffsetTimezone}`, 'DDD T Z');
      const end = DateTime.fromFormat(`${date} ${endTime} ${utcOffsetTimezone}`, 'DDD T Z');
      return {
        start,
        end,
      };
    }
  }
  return null;
};

export const formatDateTime = (dt: DateTime, options?: { withDate?: boolean }): string => dt.setZone('UTC-7').toFormat(options?.withDate ? "DDD T 'UTC'Z" : "T 'UTC'Z");
