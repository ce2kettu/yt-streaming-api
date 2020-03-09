import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import routes from './routes';
import { env } from './util';
import { errorMiddleware, routeNotFound } from './middleware';

export class Server {
    private app: express.Application;

    constructor() {
        this.app = express();
        this.config();
        this.initMiddlewares();
        this.initRoutes();
        this.routeNotFound();
        this.errorHandler();
    }

    public start() {
        const server = this.app.listen(env.APP_PORT, () => {
            console.log(`Youtube streaming API running on ${env.APP_PROTOCOL}://${env.APP_HOST}:${env.APP_PORT}`);
        }).on('error', (err) => {
            console.log(err);
        });
    }

    private config() {
        // pretty print json
        this.app.set('json spaces', 2);
    }

    private initRoutes() {
        this.app.use('/api', routes);
    }

    private routeNotFound() {
        this.app.use(routeNotFound);
    }

    private initMiddlewares() {
        // Cross-origin support
        this.app.use(cors());

        // Secure against common attacks
        this.app.use(helmet());

        // Compress response body
        this.app.use(compression());

        // HTTP requests logging
        this.app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
    }

    private errorHandler() {
        this.app.use(errorMiddleware);
    }
}
