FROM node:14-buster

RUN apt-get update && \
  apt-get -y install rsync && \
  rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/rclone.deb https://downloads.rclone.org/v1.54.1/rclone-v1.54.1-linux-amd64.deb && \
  dpkg -i /tmp/rclone.deb && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock /app/
ARG YARN_INSTALL_ARGS="--frozen-lockfile --production"
RUN set -x && yarn install $YARN_INSTALL_ARGS

COPY . /app

ENV NODE_OPTIONS="--unhandled-rejections=strict --trace-warnings"
ENV NODE_ENV=production
