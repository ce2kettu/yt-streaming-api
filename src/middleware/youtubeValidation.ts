import { NextFunction, Request, Response } from 'express';
import { BadRequestException } from '../util/exception';
import { YoutubeService } from '../modules/youtube';

// Validate videoId in request params
export function validateVideoId(req: Request, res: Response, next: NextFunction) {
    const videoId = req.params.videoId;

    if (!videoId) {
        return next(new BadRequestException('Required parameter \'videoId\' is missing'));
    }

    if (!YoutubeService.validateVideoId(videoId)) {
        return next(new BadRequestException('Invalid parameter \'videoId\' provided'));
    }

    return next();
}

// Validate playlistId in request params
export function validatePlaylistId(req: Request, res: Response, next: NextFunction) {
    const playlistId = req.params.playlistId;

    if (!playlistId) {
        return next(new BadRequestException('Required parameter \'playlistId\' is missing'));
    }

    if (!YoutubeService.validateVideoId(playlistId)) {
        return next(new BadRequestException('Invalid parameter \'playlistId\' provided'));
    }

    return next();
}
