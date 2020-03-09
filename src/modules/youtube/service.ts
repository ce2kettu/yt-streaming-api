import moment from 'moment';
import fetch from 'node-fetch';
import { env } from '../../util';

export class Video {
    public id: string;
    public duration: number;
    public title: string;
    public artist: string;

    constructor(id: string, duration: number, title: string, artist: string) {
        this.id = id;
        this.duration = duration;
        this.title = title;
        this.artist = artist;
    }
}

interface IReqResponse {
    status: number;
    body: any;
}

async function http(request: string): Promise<IReqResponse> {
    const response = await fetch(request);
    const body = await response.json();
    return { status: response.status, body };
}

export class YoutubeService {
    private static readonly MAX_RESULTS: number = 21;
    private static readonly API_URL = 'https://www.googleapis.com/youtube/v3';
    private static readonly VIDEO_URL = 'http://www.youtube.com/watch?v=';
    private static readonly OEMBED_URL = 'https://www.youtube.com/oembed';
    private static readonly VIDEO_ID_REGEX = /^[a-zA-Z0-9-_]{11}$/;
    private static readonly PLAYLIST_ID_REGEX = /^[a-zA-Z0-9-_]{34}$/;

    /** Fetches video duration */
    public static async getVideoDuration(videoId: string): Promise<number> {
        try {
            const params = {
                part: 'contentDetails',
                id: videoId,
                key: env.YT_API_KEY,
            };
            const videoInfo = await http(`${this.API_URL}/videos?${this.buildQuery(params)}`);
            return this.parseVideoDuration(videoInfo.body?.items?.[0]?.contentDetails?.duration);
        } catch (err) {
            throw new Error('Error fetching video info: ' + err.message);
        }
    }

    /** Fetches video information */
    public static async getVideoInfoOembed(videoId: string): Promise<Video> {
        try {
            // We don't use YouTube API v3 here to save quota requests
            const params = {
                format: 'json',
                url: `http://www.youtube.com/watch?v=${videoId}`,
            };
            const queryRes = await http(`https://www.youtube.com/oembed?${this.buildQuery(params)}`);

            // Video not found
            if (queryRes.status !== 200) { return null; }

            const duration = await this.getVideoDuration(videoId);
            const video = new Video(videoId, duration, queryRes.body?.title, queryRes.body?.author_name);
            return video;
        } catch (err) {
            throw new Error('Error fetching video info: ' + err.message);
        }
    }

    /** Fetches video information */
    public static async getVideoInfo(videoId: string): Promise<Video> {
        try {
            const params = {
                part: 'snippet,contentDetails',
                id: videoId,
                key: env.YT_API_KEY,
            };
            const videoInfo = await http(`${this.API_URL}/videos?${this.buildQuery(params)}`);

            if (!videoInfo.body.items) { return null; }

            const info = videoInfo.body.items[0];
            const duration = this.parseVideoDuration(info?.contentDetails?.duration);
            const video = new Video(videoId, duration, info.snippet.title, info.snippet.channelTitle);
            return video;
        } catch (err) {
            throw new Error('Error fetching video info: ' + err.message);
        }
    }

    /** Searches for a video with the specified query */
    public static async searchVideos(searchVal: string, maxResults?: number): Promise<Video[]> {
        try {
            const params = {
                part: 'snippet',
                key: env.YT_API_KEY,
                q: searchVal,
                maxResults: maxResults || this.MAX_RESULTS,
            };
            const searchRes = await http(`${this.API_URL}/search?${this.buildQuery(params)}`);

            // Format response
            const videos: Video[] = await Promise.all(
                searchRes.body?.items.map(async (obj: any) => {
                    return await this.formatVideo(obj);
                }),
            );

            return videos;
        } catch (err) {
            throw new Error(`Error searching videos (this is probably due to
                 exceeded quota on YouTube API): ${err.message}`);
        }
    }

    /** Returns YouTube playlist video identifiers */
    public static async getPlaylistData(playlistId: string): Promise<any[]> {
        try {
            const params = {
                part: 'snippet',
                key: env.YT_API_KEY,
                maxResults: 50,
                playlistId,
            };
            const queryRes = await http(`${this.API_URL}/playlistItems?${this.buildQuery(params)}`);

            if (!queryRes.body.items) { return null; }

            let videoIds: string[] = queryRes.body?.items.map((obj: any) => {
                return obj.snippet.resourceId.videoId;
            });

            let nextPageToken = queryRes.body.nextPageToken;

            // Fetch all songs until no next page is available
            while (nextPageToken) {
                const nextPage = await http(`${this.API_URL}/playlistItems?${this.buildQuery({
                    pageToken: nextPageToken,
                    ...params,
                })}`);
                const ids: string[] = nextPage.body?.items.map((obj: any) => {
                    return obj.snippet.resourceId.videoId;
                });

                videoIds = [].concat(videoIds, ids);
                nextPageToken = nextPage.body.nextPageToken;
            }

            return videoIds;
        } catch (err) {
            throw new Error(`Error checking whether video exists: ${err.message}`);
        }
    }

    /** Checks whether a YouTube exists */
    public static async isVideoValid(videoId: string): Promise<boolean> {
        try {
            const params = {
                format: 'json',
                url: this.VIDEO_URL + videoId,
            };
            const queryRes = await fetch(`${this.OEMBED_URL}?${this.buildQuery(params)}`);
            return (queryRes.status === 200);
        } catch (err) {
            throw new Error(`Error checking whether video exists: ${err.message}`);
        }
    }

    /** Parses a video from HTTP response and turns it into a Video object */
    private static async formatVideo(videoObj: any): Promise<Video> {
        try {
            const videoId = videoObj.id.videoId;
            const duration = await this.getVideoDuration(videoId);
            const video = new Video(videoId, duration, videoObj.snippet.title, videoObj.snippet.channelTitle);
            return video;
        } catch (err) {
            throw new Error('Error formatting video: ' + err.message);
        }
    }

    /** Builds a query with the specified params for a HTTP request */
    private static buildQuery(params: object): string {
        return Object.keys(params)
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
            .join('&');
    }

    /** Converts duration in ISO 8601 format to milliseconds */
    private static parseVideoDuration(duration: string): number {
        return moment.duration(duration).asMilliseconds();
    }

    /** Returns true if given id satifies YouTube's video id format. */
    public static validateVideoId(videoId: string) {
        return this.VIDEO_ID_REGEX.test(videoId);
    }

    /** Returns true if given id satifies YouTube's playlist id format. */
    public static validatePlaylistId(videoId: string) {
        return this.PLAYLIST_ID_REGEX.test(videoId);
    }
}
