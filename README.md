
[![TypeScript](https://camo.githubusercontent.com/09b3f1112f2778ba9f739339a7037886f232508f/68747470733a2f2f62616467656e2e6e65742f62616467652f547970655363726970742f6c6f6f73652532302546302539462539382541352f6f72616e6765)](https://www.typescriptlang.org)

YouTube streaming API
==================================

This is an open source backend that can be deployed to any infrastructure that can run *Node.js*. It's intended to provide a seamless MP3 audio streaming experience with few other functionalities such as search.

This API works on top of the *Express* web application framework. It's used as a standalone application and is easily expandable due to it's modular structure.

## Requirements
Install Node.js
- [Node.js](https://nodejs.org/en/download/) v12.16.1 or newer

Install yarn
- [Yarn](https://yarnpkg.com/) package manager

Install FFmpeg
- [FFmpeg](https://www.ffmpeg.org/) a complete, cross-platform solution to record, convert and stream audio and video

## Getting Started

##### Clone the repository
```shell
git clone https://github.com/ce2kettu/yt-streaming-api.git
```

##### Install the dependencies
```shell
yarn install
```

##### Make cache and its subdirectories readable and writable
```shell
chmod -R 777 cache
```

##### Modify environt variables
Open `.env.development` or `.env.production` depending on your mode and modify the contents to fit your configuration.
Example:
```env
YT_API_KEY=AIzaSy...
API_KEY=not_so_secure
APP_PORT=3000
APP_HOST=localhost
APP_PROTOCOL=http
FFMPEG_PATH=ffmpeg
```

##### Run in production mode
```shell
yarn run start:prod
```
##### Run in development mode
```shell
yarn start
```

## Docker

##### Build Docker image
```shell
docker build -t <your-image-name> .
```

#### Run image in detached mode

```shell
docker run -d -p <port-on-host>:<port-inside-docker-container> <your-image-name>
```

#### Run image in foreground mode

```shell
docker run -i -t -p <port-on-host>:<port-inside-docker-container> <your-image-name>
```

### Stop Docker container

#### Detached mode

```shell
docker stop <container-id>
```

You can get a list of all running Docker container and its ids by following command

```shell
docker images
```

#### Foreground mode

Go to console and press <CTRL> + C at any time.


## List of API Routes

```sh
+--------+-------------------------+
  Method | URI
+--------+-------------------------+
  GET    | /api/status
  GET    | /api/music/search
  GET    | /api/music/stream
  GET    | /api/music/stream/chunked
  GET    | /api/music/predownload
  GET    | /api/music/verify
  GET    | /api/music/song
  GET    | /api/music/playlist
+--------+-------------------------+
```

### Endpoints and interaction

##### Status
Example: `GET /api/status` returns server status:

```json
{
  "success": true,
  "message": "",
  "data": null
}
```

##### Search
Server can perform a search for songs at `/api/music/search` endpoint. You can remove the apiKey middleware to make this available for clients as well.
Example: `GET /api/music/search?q=Lady Gaga&maxResults=10&key=not_so_secure`:

```json
{
  "success": true,
  "message": "Retrived search result",
  "data": [
    {
      "id": "5L6xyaeiV58",
      "duration": 218000,
      "title": "Lady Gaga - Stupid Love (Official Music Video)",
      "artist": "LadyGagaVEVO"
    }
    ...
  ]
}
```

##### Stream
Clients can stream any song they want using `/api/music/stream` endpoint. You should remove this endpoint if you do not wish for this kind of behavior, but instead want the server to "whitelist" songs that can be played. The audio is cached by default for future requests.
Example: `GET /api/music/stream/5L6xyaeiV58` returns a playable mp3 audio stream.

##### Predownload
Server can predownload a song to make it available for clients to play. The audio is cached by default for future requests.
Example: `GET /api/music/predownload/5L6xyaeiV58&key=not_so_secure`:

```json
{
  "success": true,
  "message": "The requested song is now being downloaded",
  "data": null
}
```
##### Stream with server validation
Example: `GET /api/music/stream/chunked/5L6xyaeiV58` returns a playable mp3 audio stream only if the server has predownloaded it. This way the server can ensure that clients cannot flood the server with requests that are not allowed.

##### Verify that a song exists
Returns whether a song is a valid.
Example: `GET /api/music/verify/5L6xyaeiV58&key=not_so_secure`:

```json
{
  "success": true | false,
  ...
}
```

##### Get song data
Example: `GET /api/music/song/5L6xyaeiV58&key=not_so_secure`:

```json
{
  "success": true,
  "message": "Retrieved song data",
  "data": {
    "id": "5L6xyaeiV58",
    "duration": 218000,
    "title": "Lady Gaga - Stupid Love (Official Music Video)",
    "artist": "LadyGagaVEVO"
  }
}
```

##### Playlist data
Example: `GET /api/music/playlist/PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&key=not_so_secure`:

```json
{
  "success": true,
  "message": "Retrieved playlist data",
  "data": [
    "8EJ3zbKTWQ8",
    "9HDEHj2yzew",
    "2n9gE20hqU4",
    "kayI9QB1-IA",
    "EgBJmlPo8Xw",
    "T_OYT396cYw",
    "NKzd_YiW9AQ",
    ...
  ]
}
```