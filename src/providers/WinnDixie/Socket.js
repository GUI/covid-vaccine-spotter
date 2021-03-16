const io = require("socket.io-client");
const { v4: uuidv4 } = require("uuid");
const sleep = require("sleep-promise");
const _ = require("lodash");
const pTimeout = require("p-timeout");

const UrlToken =
  "df425c2e5d5e1084510b834c2fddcda8a459d7239c01d1766380e3d49fa7f936";

const stateUrlIds = {
  FL: "c20605cb988e4a18a3eab5f7fd466cf6",
  MS: "04ec5ed02145433ea25759a38403253d",
};

const stateSockets = {};

class Socket {
  static getSocketForState(state, index) {
    const key = `${state}-${index}`;
    console.info("key: ", key);
    if (!stateSockets[key]) {
      stateSockets[key] = new Socket(state);
    }

    return stateSockets[key];
  }

  constructor(state) {
    this.socket = io("wss://endpoint-chat.ateb.com", {
      upgrade: false,
      transports: ["websocket"],
    });

    this.socket.on("disconnect", () => {
      console.info("disconnect!");
    });

    this.state = state;
    this.stateUrlId = stateUrlIds[this.state];
    if (!this.stateUrlId) {
      throw new Error(`Unknown URL ID for state: ${this.state}`);
    }

    this.userId = uuidv4();
    this.sessionId = `session-${uuidv4()}`;

    this.baseMessage = {
      URLToken: UrlToken,
      userId: this.userId,
      sessionId: this.sessionId,
      channel: "webchat-client",
      source: "device",
      passthroughIP: null,
      reloadFlow: false,
      resetFlow: false,
      resetState: false,
      resetContext: false,
      text: "",
      data: {},
    };
  }

  async init() {
    if (!this.initComplete) {
      await this.sendMessage({
        data: {},
        text: this.stateUrlId,
      });
      await this.sendMessage({
        data: {
          adaptivecards: {
            card: "CARD_SELECT_ACTION",
            actionType: "ACTION_NEW",
          },
        },
      });
      this.initComplete = true;
    }
  }

  async checkPostalCode(postalCode, startDate) {
    await this.init();
    try {
      return await this.sendMessage({
        data: {
          adaptivecards: {
            offerings: "covid",
            start: startDate,
            zipCode: postalCode,
          },
        },
      });
    } finally {
      /*
      await this.sendMessage({
        data: {
          adaptivecards: {
            id: 'locationName',
            postBack: 'ZIP_SEARCH',
            scheduleLocation: "",
          },
        },
      });
      */
      /*
      await this.sendMessage({
        data: null,
        text: 'SEARCH_CLINIC',
      });
      */
    }
  }

  async sendMessage(message) {
    const outputMessages = [];

    await sleep(_.random(250, 750));

    return pTimeout(
      new Promise(
        (resolve) => {
          this.socket.on("output", (outputMessage) => {
            outputMessages.push(outputMessage);

            if (outputMessage.type === "finalPing") {
              this.socket.removeAllListeners("output");
              resolve(outputMessages);
            }
          });

          this.socket.emit("processInput", { ...this.baseMessage, ...message });
        },
        () => {
          this.socket.removeAllListeners("output");
          throw new Error(
            `Timed out waiting for finalPing: ${JSON.stringify(outputMessages)}`
          );
        }
      ),
      15000
    );
  }
}

module.exports = Socket;
