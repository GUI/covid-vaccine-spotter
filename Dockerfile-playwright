FROM mcr.microsoft.com/playwright:v1.8.1-focal

WORKDIR /app

COPY package.json yarn.lock /app/
ARG YARN_INSTALL_ARGS="--frozen-lockfile --production"
RUN set -x && yarn install $YARN_INSTALL_ARGS

COPY . /app

ENV NODE_OPTIONS="--unhandled-rejections=strict --trace-warnings"
# ENV DEBUG=pw:api
ARG task_bin
ENV task_bin ${task_bin}
CMD /app/bin/${task_bin}
