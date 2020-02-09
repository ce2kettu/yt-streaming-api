import { Request, Response, NextFunction } from 'express';
import { API } from '../../util/api';
import { YoutubeService } from './service';
import { BadRequestException, InternalServerException } from '../../util/exception';
import findRemoveSync from 'find-remove';
import ffmpeg, { setFfmpegPath } from 'fluent-ffmpeg';
import ytdl from 'ytdl-core';
import { resolve } from 'path';
import fs from 'fs';
import env from '../../util/environment';
import md5 from 'md5';

// tslint:disable: max-classes-per-file
class CacheItem {
    private downloaded: boolean;

    constructor(downloaded: boolean = false) {
        this.downloaded = downloaded;
    }

    public isDownloaded(): boolean {
        return this.downloaded;
    }

    public setDownloaded() {
        this.downloaded = true;
    }
}

export class YoutubeController {
    private static readonly SONG_PATH: string = '/cache/mp3';
    public songCache: CacheItem[];
    private allowedSongs: string[];

    constructor() {
        this.songCache = [];
        this.allowedSongs = [];
        // The function is performed every 10 minutes to delete old song files.
        // YouTube audio links expire in 6 hours but we do this to save disk space.
        const deleteTask = setInterval(this.deleteSongs, 600000);
    }

    // Removes mp3 files older than an hour.
    private deleteSongs() {
        findRemoveSync(env.__basedir + YoutubeController.SONG_PATH, {
            files: '*.mp3',
            age: {
                seconds: 3600,
            },
        });

        // Reset cache
        this.songCache = [];
    }

    public async search(req: Request, res: Response, next: NextFunction) {
        try {
            const query = req.query.q;
            const maxResults = req.params.maxResults ? parseInt(req.params.maxResults, 10) : null;

            if (!query) {
                return next(new BadRequestException('Required parameter \'q\' missing'));
            }

            const data = await YoutubeService.searchVideos(query, maxResults);
            return API.response(res, 'Retrived search result', data);
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    public async stream(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;
            console.log(req.headers);

            if (!videoId) {
                return next(new BadRequestException('Required parameter \'v\' is missing'));
            }

            if (this.allowedSongs.indexOf(videoId) === -1) {
                return next(new BadRequestException('Invalid request'));
            }

            const hash = md5(videoId);

            const videoStream = ytdl(videoId, { quality: 'highestaudio', filter: 'audioonly' });
            videoStream.on('error', (err) => { throw err; });

            // Write response header
            res.writeHead(200, {
                'Content-Type': 'audio/mpeg',
                'Content-Disposition': `inline; filename="${hash}.mp3"`,
                'Connection': 'Keep-Alive',
                'Accept-Ranges': 'none',
            });

            // Send compressed audio mp3 data
            const audioStream = ffmpeg()
                .input(videoStream)
                .toFormat('mp3')
                .on('error', (err) => {
                    console.log(err);
                })
                .pipe(res, { end: true });

        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    public async streamCached(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;

            if (!videoId) {
                return next(new BadRequestException('Required parameter \'v\' is missing'));
            }

            const hash = md5(videoId);
            const filePath = resolve(env.__basedir, `./${YoutubeController.SONG_PATH}/${hash}.mp3`);

            // Video is in cache
            if (this.songCache[videoId]) {
                await this.checkIsDownloaded(videoId);
                this.streamSong(res, next, videoId);
            } else {
                const videoStream = ytdl(videoId, { quality: 'highestaudio', filter: 'audioonly' });
                videoStream.on('error', (err) => { throw err; });

                const writeStream = fs.createWriteStream(filePath);
                writeStream.on('error', (err) => { throw err; });

                // Create a new cache entry
                this.songCache[videoId] = new CacheItem();

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
                            this.songCache[videoId] = new CacheItem(true);
                        }

                        this.streamSong(res, next, videoId);
                    })
                    .pipe(writeStream, { end: true });
            }

        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    public streamSong(res: Response, next: NextFunction, videoId: string) {
        try {
            const hash = md5(videoId);
            const filePath = resolve(env.__basedir, `./${YoutubeController.SONG_PATH}/${hash}.mp3`);

            // Write response header
            res.writeHead(200, {
                'Content-Type': 'audio/mpeg',
                'Content-Disposition': `inline; filename="${hash}.mp3"`,
                'Connection': 'Keep-Alive',
                'Content-Length': fs.statSync(filePath).size,
            });

            const readStream = fs.createReadStream(filePath)
            readStream.on('error', (err) => { throw err; });
            readStream.pipe(res);
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    public async predownload(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;

            if (!videoId) {
                return next(new BadRequestException('Required parameter \'v\' missing'));
            }

            // Song is already in cache
            if (this.songCache[videoId]) {
                return API.response(res, 'The requested song is already in cache');
            }

            const hash = md5(videoId);
            const filePath = resolve(env.__basedir, `./${YoutubeController.SONG_PATH}/${hash}.mp3`);

            const videoStream = ytdl(videoId, { quality: 'highestaudio', filter: 'audioonly' });
            videoStream.on('error', (err) => { throw err; });

            const writeStream = fs.createWriteStream(filePath);
            writeStream.on('error', (err) => { throw err; });

            // Create a new cache entry
            this.songCache[videoId] = new CacheItem();

            setFfmpegPath(env.FFMPEG_PATH);

            // Send compressed audio mp3 data
            const audioStream = ffmpeg()
                .input(videoStream)
                .toFormat('mp3')
                .on('error', (err) => { throw err; })
                .on('end', () => {
                    if (this.songCache[videoId]) {
                        this.songCache[videoId].setDownloaded();
                    } else {
                        this.songCache[videoId] = new CacheItem(true);
                    }
                })
                .pipe(writeStream, { end: true });

            return API.response(res, 'The requested song is now being downloaded');
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    public async whitelist(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.params.videoId;

            if (!videoId) {
                return next(new BadRequestException('Required parameter \'v\' missing'));
            }

            this.allowedSongs.push(videoId);
            return API.response(res, 'Video whitelisted');
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    private async checkIsDownloaded(videoId: string): Promise<any> {
        // tslint:disable-next-line: no-shadowed-variable
        return new Promise((resolve) => {
            function checkFlag() {
                if (this.songCache[videoId] && this.songCache[videoId].isDownloaded()) {
                    resolve();
                } else {
                    setTimeout(checkFlag.bind(this), 1000);
                }
            }
            checkFlag.bind(this)();
        });
    }
}
