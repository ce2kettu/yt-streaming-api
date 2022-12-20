import { Response } from 'express';
import HttpStatus from 'http-status-codes';

export class API {
    public static response(res: Response, message?: string, data?: object, status?: number) {
        message = message || '';
        data = data || null;
        status = status || HttpStatus.OK;

        res.status(status).json({ success: true, message, data });
    }

    public static error(res: Response, message?: string, status?: number) {
        message = message || 'An error occurred.';
        status = status || HttpStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({ success: false, message });
    }

    public static plain(res: Response, status?: number, headers?: Record<string, any>, data?: any) {
        status = status || HttpStatus.OK;
        res.writeHead(status, headers);
        res.write(data);
        res.end();
    }
}
