import { Router } from 'express';
import { YoutubeController } from './controller';
import apiKey from '../../middleware/apiKey';

export class YoutubeRoutes {
    public router: Router;
    private controller: YoutubeController;

    constructor() {
        this.router = Router();
        this.controller = new YoutubeController();
        this.routes();
    }

    public routes() {
        this.router.get('/search/:searchQuery/:maxResults', this.controller.search.bind(this.controller));
        // this.router.get('/stream/cache/:videoId', this.controller.streamCached.bind(this.controller));
        this.router.get('/stream/:videoId', this.controller.stream.bind(this.controller));
        // this.router.get('/predownload/:videoId', this.controller.predownload.bind(this.controller));
        this.router.get('/whitelist/:videoId', apiKey, this.controller.whitelist.bind(this.controller));
        this.router.get('/verify/:videoId', apiKey, this.controller.checkVideoExists.bind(this.controller));
    }
}
