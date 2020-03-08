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
    private allowedSongs: string[];
    private deleteTask: NodeJS.Timeout;

    constructor() {
        this.songCache = [];
        this.allowedSongs = [];

        // The function is performed every 10 minutes to delete old song files.
        // YouTube audio links expire in 6 hours but we do this to save disk space.
        this.deleteTask = setInterval(this.deleteSongs, 1000 * 60 * 10);
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
        result = result.map((item: string) => {
            return basename(item, '.mp3');
        });

        // Remove deleted song files from cache
        for (const hash of result) {
            for (const videoId in this.songCache) {
                if (this.songCache[videoId].getHash() === hash) {
                    delete this.songCache[videoId];
                }
            }
        }
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
            return res.json({ success: result });
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    /** Returns song information */
    public async getSongInfo(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;
            const result = await YoutubeService.getVideoInfo(videoId);
            return API.response(res, 'Retrieved song data', result);
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    /** Returns playlist data */
    public async getPlaylistInfo(req: Request, res: Response, next: NextFunction) {
        try {
            const playlistId = req.params.playlistId;
            const result = await YoutubeService.getPlaylistData(playlistId);
            return API.response(res, 'Retrieved playlist data', result);
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    public async streamClient(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;
            const hash = md5(videoId);
            const filePath = resolve(env.__basedir, `./${YoutubeController.SONG_PATH}/${hash}.mp3`);

            // Video is in cache
            if (this.songCache[videoId]) {
                res.writeHead(200, {
                    'Content-Type': 'audio/mpeg',
                    'Content-Disposition': `inline; filename="${hash}.mp3"`,
                    'Connection': 'Keep-Alive',
                });
                const file = GrowingFile.open(filePath, YoutubeController.FILE_OPTIONS);
                file.on('error', (err) => { console.log(err); });
                file.pipe(res);
            } else {
                const videoStream = ytdl(videoId, { quality: 'highestaudio', filter: 'audioonly' });
                videoStream.on('error', (err) => { console.log(err); });

                const writeStream = fs.createWriteStream(filePath);
                writeStream.on('error', (err) => { console.log(err); });

                // Create a new cache entry
                this.songCache[videoId] = new CacheItem(hash);

                setFfmpegPath(env.FFMPEG_PATH);

                // Send compressed audio mp3 data
                const audioStream = ffmpeg()
                    .input(videoStream)
                    .toFormat('mp3')
                    .on('error', (err) => {
                        console.log(err);
                    })
                    .on('end', () => {
                        if (this.songCache[videoId]) {
                            this.songCache[videoId].setDownloaded();
                        } else {
                            this.songCache[videoId] = new CacheItem(hash, true);
                        }
                    })
                    .pipe(writeStream, { end: true });

                res.writeHead(200, {
                    'Content-Type': 'audio/mpeg',
                    'Content-Disposition': `inline; filename="${hash}.mp3"`,
                    'Connection': 'Keep-Alive',
                });

                const file = GrowingFile.open(filePath, YoutubeController.FILE_OPTIONS);
                file.on('error', (err) => { console.log(err); });
                file.pipe(res);
            }
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    public async streamChunked(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;
            const hash = md5(videoId);
            const filePath = resolve(env.__basedir, `./${YoutubeController.SONG_PATH}/${hash}.mp3`);

            // Video is in cache
            if (this.songCache[videoId]) {
                res.writeHead(200, {
                    'Content-Type': 'audio/mpeg',
                    'Content-Disposition': `inline; filename="${hash}.mp3"`,
                    'Connection': 'Keep-Alive',
                });

                const file = GrowingFile.open(filePath, YoutubeController.FILE_OPTIONS);
                file.on('error', (err) => next(new Error('Could not read the file: ' + err.message)));
                file.pipe(res);
            } else {
                return API.error(res, 'Video is not in cache');
            }
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    public async predownload(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;

            // Song is already in cache
            if (this.songCache[videoId]) {
                return API.response(res, 'The requested song is already in cache');
            }

            const hash = md5(videoId);
            const filePath = resolve(env.__basedir, `./${YoutubeController.SONG_PATH}/${hash}.mp3`);
            const audio = ytdl(videoId, { quality: 'highestaudio' });
            setFfmpegPath(env.FFMPEG_PATH);

            audio.on('error', (err) => next(new Error('Could not play the song: ' + err.message)));

            // We have to work with this event since 'response' is not always called
            let isResolved = false;
            audio.on('progress', () => {
                if (!isResolved) {
                    const writeStream = fs.createWriteStream(filePath);
                    writeStream.on('error', (err) => next(new Error('Could not write to file: ' + err.message)));

                    // Create a new cache entry
                    this.songCache[videoId] = new CacheItem(hash);

                    setFfmpegPath(env.FFMPEG_PATH);

                    // Convert to compressed mp3 audio
                    ffmpeg(audio)
                        .audioBitrate(128)
                        .format('mp3')
                        .on('error', (err) => { console.log(err); })
                        .on('end', () => {
                            if (this.songCache[videoId]) {
                                this.songCache[videoId].setDownloaded();
                            } else {
                                this.songCache[videoId] = new CacheItem(hash, true);
                            }
                        })
                        .pipe(writeStream, { end: true });

                    isResolved = true;
                    return API.response(res, 'The requested song is now being downloaded');
                }
            });
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }
}
