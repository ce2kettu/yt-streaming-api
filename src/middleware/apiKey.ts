import { NextFunction, Request, Response } from 'express';
import { API } from '../util/api';
import env from '../util/environment';
import { UnauthorizedException } from '../util/exception';

// API key middleware
export default function(req: Request, res: Response, next: NextFunction) {
    if (req.query.key !== env.API_KEY) {
        return next(new UnauthorizedException('Invalid api key'));
    } else {
        delete req.query.key;
        return next();
    }
}
