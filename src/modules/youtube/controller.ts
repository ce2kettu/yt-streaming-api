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
    private hash: string;
    private downloaded: boolean;

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
}

export class YoutubeController {
    public videoCache: CacheItem[];
    private static readonly SONG_PATH: string = '/mp3';

    constructor() {
        this.videoCache = [];
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
        this.videoCache = [];
    }

    public async search(req: Request, res: Response, next: NextFunction) {
        try {
            const query = req.query.q;
            const maxResults = req.query.maxResults;

            if (!query) {
                return next(new BadRequestException('Required parameter \'q\' missing'));
            }

            const data = await YoutubeService.searchVideos(query, maxResults);
            return API.response(res, data, 'Retrived search result');
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    public async stream(req: Request, res: Response, next: NextFunction) {
        try {
            const videoId = req.query.v;

            if (!videoId) {
                return next(new BadRequestException('Required parameter \'v\' missing'));
            }

            // TODO: remove?
            //setFfmpegPath(env.FFMPEG_PATH);

            const hash = md5(videoId);
            const output = resolve(env.__basedir, `./${YoutubeController.SONG_PATH}/${hash}.mp3`);

            let range = '0-';

            if (req.headers.range) {
                range = req.headers.range.replace(/bytes=/, '');
            }

            const video = ytdl(videoId, { filter: 'audioonly' });

            //video.pipe(fs.createWriteStream(output));
            video.once('response', (data) => {
                console.log('starting download');
                const totalSize: number = data.headers['content-length'];
                const parts = range.split('-');
                const partialstart = parts[0];
                const partialend = parts[1];

                const start = parseInt(partialstart, 10);
                const end = partialend ? parseInt(partialend, 10) : totalSize - 1;
                const chunkSize = (end - start) + 1;

                res.writeHead(200, {
                    'Content-Type': data.headers['content-type'],
                    'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                    'Content-Length': chunkSize,
                    'Content-Disposition': `inline; filename="${hash}.mp3"`,
                    'Accept-Ranges': 'bytes',
                    'Connection': 'Keep-Alive',
                });
            });
            video.on('end', () => {
                console.log('finished download');
            });

            //console.log('here');
            return video.pipe(res);
        } catch (err) {
            return next(new InternalServerException(err));
        }
    }

    public async download(req: Request, res: Response, next: NextFunction) {
        setFfmpegPath(env.FFMPEG_PATH);
        const url = 'https://www.youtube.com/watch?v=GgcHlZsOgQo';

        // Audio format header (OPTIONAL)
        //res.set({ 'Content-Type': 'audio/mpeg' });
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `inline; filename="${md5('4Q46xYqUwZQ')}.mp3"`,
            'Connection': 'Keep-Alive',
            'Accept-Ranges': 'bytes',
        });

        // Send compressed audio mp3 data
        const command = ffmpeg()
            .input(ytdl('4Q46xYqUwZQ'))
            .toFormat('mp3')
            .on('error', (err) => {
                console.log(err);
            });

        return command.pipe(res);
    }

    private async checkIsDownloaded(videoId: string): Promise<any> {
        // tslint:disable-next-line: no-shadowed-variable
        return new Promise((resolve) => {
            function checkFlag() {
                console.log('checking');
                if (this.videoCache[videoId] && this.videoCache[videoId].isDownloaded()) {
                    resolve();
                } else {
                    setTimeout(checkFlag.bind(this), 1000);
                }
            }
            checkFlag.bind(this)();
        });
    }
}
