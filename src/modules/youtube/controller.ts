import { Request, Response, NextFunction } from 'express';
import { resolve, basename } from 'path';
import fs from 'fs';
import md5 from 'md5';
import findRemoveSync from 'find-remove';
import ffmpeg, { setFfmpegPath } from 'fluent-ffmpeg';
import ytdl from 'ytdl-core';
import GrowingFile from 'growing-file';
import { YoutubeService } from './service';
import { env, API, BadRequestException, InternalServerException } from '../../util';

class CacheItem {
    private downloaded: boolean;
    private hash: string;

    constructor(hash: string, downloaded: boolean = false) {
        this.hash = hash;
        this.downloaded = downloaded;
    }

    public isDownloaded(): boolean {
        return this.downloaded;
    }

    public setDownloaded() {
        this.downloaded = true;
    }

    public getHash(): string {
        return this.hash;
    }
}

export class YoutubeController {
    private static readonly SONG_PATH: string = '/cache/mp3';
    private static readonly FILE_OPTIONS: object = {
        timeout: 10000,
        interval: 100,
        startFromEnd: false,
    };
    public songCache: CacheItem[];
    private deleteTask: NodeJS.Timeout;

    constructor() {
        this.songCache = [];

        // The function is performed every 10 minutes to delete old song files.
        // YouTube audio links expire in 6 hours but we do this to save disk space.
        this.deleteTask = setInterval(this.deleteSongs.bind(this), 1000 * 60 * 10);

        // Set correct path for ffmpeg binary
        setFfmpegPath(env.FFMPEG_PATH);
    }

    /** Removes mp3 files older than an hour from cache folder and song cache. */
    private deleteSongs() {
        console.log('Deleting songs from cache');

        // Returns an object containing all of the deleted files
        let result = findRemoveSync(resolve(env.__basedir, `./${YoutubeController.SONG_PATH}`), {
            extensions: '.mp3',
            age: { seconds: 3600 },
        });

        // Convert the object to an array
        result = Object.keys(result);

        // Map results to only contain the filename without an extension
        result = result.map((item: string) => basename(item, '.mp3'));

        // Remove deleted song files from cache
        for (const hash of result) {
            for (const videoId in this.songCache) {
                if (this.songCache[videoId].getHash() === hash) {
                    delete this.songCache[videoId];
                }
            }
        }
    }

    /** Sets the correct headers for the response to serve audio */
    private setSongHeaders(videoId: string, res: Response) {
        if (!res.headersSent) {
            res.writeHead(200, {
                'Content-Type': 'audio/mpeg',
                'Content-Disposition': `inline; filename="${md5(videoId)}.mp3"`,
                'Connection': 'Keep-Alive',
            });
        }
    }

    /** Opens a file and streams it to the client */
    private streamSong(videoId: string, res: Response, next: NextFunction) {
        this.setSongHeaders(videoId, res);
        const file = GrowingFile.open(this.getSongPath(videoId), YoutubeController.FILE_OPTIONS);
        file.on('error', (err) => {
            res.end();
            file.destroy();
            next(new InternalServerException('Could not read the file: ' + err));
        });
        file.pipe(res);
    }

    /** Deletes a song from the cache */
    private deleteSongFromCache(videoId: string) {
        if (this.songCache[videoId]) 
            delete this.songCache[videoId];
    }

    /** Returns absolute song path */
    private getSongPath(videoId: string) {
        return resolve(env.__basedir, `./${YoutubeController.SONG_PATH}/${md5(videoId)}.mp3`);
    }

    /** Converts the audio stream to mp3 and adds the song to cache  */
    private async addSongToCache(videoId: string): Promise<boolean> {
        if (this.songCache[videoId]) {
            return true;
        }

        return new Promise<boolean>((songResolve, songReject) => {
            let earlyExit = false;

            // Get the actual audio
            const audio = ytdl(videoId, { quality: 'highestaudio' });

            audio.on('error', (err) => {
                this.deleteSongFromCache(videoId);
                songReject(new Error('Could not play the song: ' + err));
                audio.destroy();
                earlyExit = true;
            });

            if (earlyExit) { return; }

            // We have to work with this event since 'response' is not always called
            audio.once('progress', () => {
                // Create a new cache entry
                this.songCache[videoId] = new CacheItem(md5(videoId));

                const filePath = this.getSongPath(videoId);
                const writeStream = fs.createWriteStream(filePath);
                writeStream.on('error', (err) => {
                    songReject(new Error('Could not write to file: ' + err));
                    audio.destroy();
                    earlyExit = true;
                });

                if (earlyExit) { return; }

                // Convert stream to compressed mp3 audio
                ffmpeg(audio)
                    .audioBitrate(128)
                    .format('mp3')
                    .once('start', () => songResolve(true))
                    .on('error', (err) => {
                        this.deleteSongFromCache(videoId);
                        songReject(new Error('FFmpeg error:' + err));
                        audio.destroy();
                        writeStream.destroy();
                    })
                    .once('end', () => this.songCache[videoId].setDownloaded())
                    .pipe(writeStream);
            });
        });
    }

    /** Returns search result */
    public async search(req: Request, res: Response, next: NextFunction) {
        try {
            const searchQuery = req.query.q;
            const maxResults = req.query.maxResults ? parseInt(req.params.maxResults, 10) : null;

            if (!searchQuery) {
                return next(new BadRequestException('Required parameter \'q\' missing'));
            }

            const data = await YoutubeService.searchVideos(searchQuery, maxResults);
            return API.response(res, 'Retrived search result', data);
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    /** Returns whether a video exists with the provided id */
    public async checkVideoExists(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;
            const result = await YoutubeService.isVideoValid(videoId);

            if (result) {
                return API.response(res, 'Video is valid');
            }

            return API.error(res, 'Invalid video');
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    /** Returns song information */
    public async getSongInfo(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;
            const result = await YoutubeService.getVideoInfo(videoId);

            if (result) {
                return API.response(res, 'Retrieved song data', result);
            }

            return API.error(res, 'Could not get song data');
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    /** Returns playlist data */
    public async getPlaylistInfo(req: Request, res: Response, next: NextFunction) {
        try {
            const playlistId = req.params.playlistId;
            const result = await YoutubeService.getPlaylistData(playlistId);

            if (result) {
                return API.response(res, 'Retrieved playlist data', result);
            }

            return API.error(res, 'Could not get playlist data');
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    /** Returns playlist data as m3u */
    public async playListToM3U(req: Request, res: Response, next: NextFunction) {
        try {
            const playlistId = req.params.playlistId;
            const result = await YoutubeService.getPlaylistData(playlistId);

            if (result) {
                let m3uResult = `#EXTM3U\n`;
                result.forEach(videoId => m3uResult += `${env.APP_PROTOCOL}://${env.APP_HOST}:${env.APP_PORT}/api/music/stream/${videoId}\n`);

                return API.plain(res, 200, {
                    'Content-Type': 'audio/x-mpegurl',
                    'Content-Disposition': `inline; filename="${md5(playlistId)}.m3u"`,
                    'Connection': 'Keep-Alive',
                }, m3uResult);
            }

            return API.error(res, 'Could not get playlist data');
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    /** Streams a song to the client without validation */
    public async streamClient(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;

            // Video is in cache
            if (this.songCache[videoId]) {
                this.streamSong(videoId, res, next);
            } else {
                const result = await this.addSongToCache(videoId);

                if (result === true) {
                    return this.streamSong(videoId, res, next);
                }

                return API.error(res, 'Could not play the song');
            }
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    /** Streams a song to the client if it's pre-approved */
    public async streamChunked(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;

            // Video is in cache
            if (this.songCache[videoId]) {
                this.streamSong(videoId, res, next);
            } else {
                return API.error(res, 'Video is not in cache');
            }
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    /** Predownloads a song so it's available for clients */
    public async predownload(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;

            // Song is already in cache
            if (this.songCache[videoId]) {
                return API.response(res, 'The requested song is already in cache');
            }

            const result = await this.addSongToCache(videoId);

            if (result === true) {
                return API.response(res, 'The requested song is now being downloaded');
            }

            return API.error(res, 'Could not download the song');
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }
}
