import env from './environment';

// tslint:disable: max-classes-per-file
export class HttpException extends Error {
    public message: string;

    constructor(message: string) {
        super(message);
        this.message = message;
    }
}

export class InternalServerException extends HttpException {
    constructor(error?: string, pretty?: string) {
        error = env.NODE_ENV === 'development' ? error : 'Something went wrong';
        const message = error || pretty;
        super(message);
    }
}

export class UnauthorizedException extends HttpException {
    constructor(message: string) {
        super(message);
    }
}

export class BadRequestException extends HttpException {
    constructor(message?: string) {
        message = message || 'Bad Request';
        super(message);
    }
}
