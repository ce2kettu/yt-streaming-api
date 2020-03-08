FROM node:alpine

# Create work directory
WORKDIR /usr/src/app

# Copy app source to work directory
COPY . /usr/src/app

# Make cache read-writable
RUN chmod -R 777 /usr/src/app/cache

# Install app dependencies
RUN yarn install

# Build and run the app
CMD npm run start:prod