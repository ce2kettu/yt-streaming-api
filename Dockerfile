FROM node:alpine

# Create work directory
WORKDIR /usr/src/app

# Copy app source to work directory
COPY . /usr/src/app

# Make cache read-writable
RUN chmod -R 777 /usr/src/app/cache

# Install app dependencies
RUN yarn install

# Install FFmpeg
RUN apk update
RUN apk upgrade
RUN apk add ffmpeg

# Build and run the app
CMD yarn run start:prod