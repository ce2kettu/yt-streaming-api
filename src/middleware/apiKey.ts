import { NextFunction, Request, Response } from 'express';
import { env, UnauthorizedException } from '../util';

// API key middleware
export function apiKey(req: Request, res: Response, next: NextFunction) {
    if (req.query.key !== env.API_KEY) {
        return next(new UnauthorizedException('Invalid api key'));
    } else {
        delete req.query.key;
        return next();
    }
}
