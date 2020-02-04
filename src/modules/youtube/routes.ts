import { Router } from 'express';
import { YoutubeController } from './controller';

export class YoutubeRoutes {
    public router: Router;
    private controller: YoutubeController;

    constructor() {
        this.router = Router();
        this.controller = new YoutubeController();
        this.routes();
    }

    public routes() {
        this.router.get('/search', this.controller.search.bind(this.controller));
        this.router.get('/stream', this.controller.stream.bind(this.controller));
        this.router.get('/download', this.controller.download.bind(this.controller));
    }
}
