import moment from 'moment';
import fetch from 'node-fetch';
import env from '../../util/environment';

// tslint:disable: max-classes-per-file
export class Thumbnail {
    public type: string;
    public url: string;
    public width: number;
    public height: number;
}

export class Video {
    public id: string;
    public duration: number;
    public title: string;
    public artist: string;
    public thumbnails: Thumbnail[];
    public streamUrl: string;

    public static fromResponseObject(obj: any): Video {
        const video = new Video();
        video.id = obj.id.videoId;
        video.title = obj.snippet.title;
        video.artist = obj.snippet.channelTitle;
        video.streamUrl = `${env.APP_PROTOCOL}://${env.APP_HOST}:${env.APP_PORT}/api/v1/music/streamChunk?v=${video.id}`;
        // thumbnails

        return video;
    }

    // get streamUrl() {
    //     return `${env.APP_PROTOCOL}://${env.APP_HOST}:${env.APP_PORT}/stream?v=${this.id}`;
    // }

    // get downloadUrl() {
    //     return `${env.APP_PROTOCOL}://${env.APP_HOST}:${env.APP_PORT}/download?v=${this.id}`;
    // }

    // get youtubeUrl() {
    //     return `https://www.youtube.com/watch?v=${this.id}`;
    // }
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
            const videoInfo = await http(`https://www.googleapis.com/youtube/v3/videos?${this.buildQuery(params)}`);

            return this.parseVideoDuration(videoInfo.body?.items?.[0]?.contentDetails?.duration);
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
            const searchRes = await http(`https://www.googleapis.com/youtube/v3/search?${this.buildQuery(params)}`);
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
     * @param {object} video The video in question
     * @return {Promise<Video>} A video object
     */
    private static async formatVideo(obj: object): Promise<Video> {
        try {
            const video: Video = Video.fromResponseObject(obj);
            const duration = await this.getVideoDuration(video.id);
            video.duration = duration;
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
        return moment.duration(duration).asSeconds();
        //return moment.duration(duration).asMilliseconds();
    }
}
