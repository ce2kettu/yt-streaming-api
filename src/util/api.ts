import { Response } from 'express';

export class API {
    public static response(res: Response, data?: object, message?: string) {
        data = data || {};
        message = message || '';

        res.json({ success: true, message, data });
    }

    public static error(res: Response, message?: string) {
        message = message || 'An error occurred.';

        res.json({ success: false, message });
    }
}
