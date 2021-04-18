FROM node:14-buster

RUN apt-get update && \
  apt-get -y install lsb-release rsync && \
  rm -rf /var/lib/apt/lists/*

RUN echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - && \
  apt-get update && \
  apt-get -y install postgresql-client-13 && \
  rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/rclone.deb https://downloads.rclone.org/v1.54.1/rclone-v1.54.1-linux-amd64.deb && \
  dpkg -i /tmp/rclone.deb && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock /app/
ARG YARN_INSTALL_ARGS="--frozen-lockfile --production"
RUN set -x && yarn install $YARN_INSTALL_ARGS

RUN curl -fsSL -o /usr/local/share/ca-certificates/gdig2.crt https://certs.godaddy.com/repository/gdig2.crt.pem && \
  update-ca-certificates

COPY . /app

ENV NODE_OPTIONS="--unhandled-rejections=strict --trace-warnings"
ENV NODE_ENV=production
