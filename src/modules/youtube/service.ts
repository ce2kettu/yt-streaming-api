import moment from 'moment';
import fetch from 'node-fetch';
import env from '../../util/environment';

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
    /* Number of results to display */
    private static readonly MAX_RESULTS: number = 21;
    private static readonly API_URL = 'https://www.googleapis.com/youtube/v3';

    /**
     * Fetches video duration
     *
     * @param {string} videoId YouTube video identifier
     * @return {Promise<number>} duration
     */
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

    /**
     * Fetches video information
     *
     * @param {string} videoId YouTube video identifier
     * @return {Promise<Video>} Result
     */
    public static async getVideoInfo(videoId: string): Promise<Video> {
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

    /**
     * Searches for a video with the specified query
     *
     * @param {string} searchVal video name
     * @param {number} maxResults Maximum amount of results to return
     * @return {Promise<Video[]>} List of videos that match the query
     */
    public static async searchVideos(searchVal: string, maxResults?: number): Promise<Video[]> {
        try {
            const params = {
                part: 'snippet',
                key: env.YT_API_KEY,
                q: searchVal,
                maxResults: maxResults || this.MAX_RESULTS,
            };
            const searchRes = await http(`${this.API_URL}/search?${this.buildQuery(params)}`);
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

    /**
     * Returns YouTube playlist video identifiers
     *
     * @param {string} videoId YouTube playlist identifier
     * @return {Promise<any[]>} Result
     */
    public static async getPlaylistData(playlistId: string): Promise<any[]> {
        try {
            const params = {
                part: 'snippet',
                key: env.YT_API_KEY,
                maxResults: 50,
                playlistId,
            };
            const queryRes = await http(`${this.API_URL}/playlistItems?${this.buildQuery(params)}`);

            const videoIds: string[] = queryRes.body?.items.map((obj: any) => {
                return obj.snippet.resourceId.videoId;
            });

            // There's a next page
            // TODO: make it more universal, do requests till pageInfo.totalResults,
            // 50 results is the maximum per page
            if (queryRes.body.nextPageToken) {
                const nextPage = await http(`${this.API_URL}/playlistItems?${this.buildQuery({
                    pageToken: queryRes.body.nextPageToken,
                    ...params,
                })}`);
                const ids: string[] = nextPage.body?.items.map((obj: any) => {
                    return obj.snippet.resourceId.videoId;
                });

                videoIds.concat(ids);
            }

            return videoIds;
        } catch (err) {
            throw new Error(`Error checking whether video exists: ${err.message}`);
        }
    }

    /**
     * Checks whether a YouTube exists
     *
     * @param {string} videoId YouTube video identifier
     * @return {Promise<boolean>} Result
     */
    public static async checkVideoExists(videoId: string): Promise<boolean> {
        try {
            const params = {
                format: 'json',
                url: `http://www.youtube.com/watch?v=${videoId}`,
            };
            const queryRes = await http(`https://www.youtube.com/oembed?${this.buildQuery(params)}`);
            return (queryRes.status === 200);
        } catch (err) {
            throw new Error(`Error checking whether video exists: ${err.message}`);
        }
    }

    /**
     * Parses a video from HTTP response and turns it into a Video object
     *
     * @param {any} videoObj The video in question
     * @return {Promise<Video>} A video object
     */
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

    /**
     * Builds a query with the specified params for a HTTP request
     *
     * @param {object} params An object containing all the parameters with their corresponding values
     * @return {string} Encoded query
     */
    private static buildQuery(params: object): string {
        return Object.keys(params)
            .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
            .join('&');
    }

    /**
     * Converts duration in ISO 8601 format to milliseconds
     *
     * @param {string} duration The duration of the video
     * @return {number} The duration in milliseconds
     */
    private static parseVideoDuration(duration: string): number {
        return moment.duration(duration).asMilliseconds();
    }
}
