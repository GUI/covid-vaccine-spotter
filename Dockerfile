FROM node:14-buster

RUN apt-get update && \
  apt-get -y install awscli && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock /app/
ARG YARN_INSTALL_ARGS="--frozen-lockfile --production"
RUN set -x && yarn install $YARN_INSTALL_ARGS

COPY . /app

ENV NODE_OPTIONS="--unhandled-rejections=strict --trace-warnings"

ARG task_bin
ENV task_bin ${task_bin}
CMD /app/bin/${task_bin}
