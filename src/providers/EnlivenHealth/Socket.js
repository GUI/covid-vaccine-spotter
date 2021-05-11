const io = require("socket.io-client");
const { v4: uuidv4 } = require("uuid");
const sleep = require("sleep-promise");
const _ = require("lodash");
const pTimeout = require("p-timeout");

class Socket {
  constructor(urlId) {
    this.socket = io("wss://endpoint-chat.ateb.com", {
      upgrade: false,
      transports: ["websocket"],
    });

    this.urlId = urlId;
    this.userId = uuidv4();
    this.sessionId = `session-${uuidv4()}`;

    this.baseMessage = {
      URLToken:
        "df425c2e5d5e1084510b834c2fddcda8a459d7239c01d1766380e3d49fa7f936",
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
        text: this.urlId,
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
    return this.sendMessage({
      data: {
        adaptivecards: {
          offerings: "covid",
          start: startDate,
          zipCode: postalCode,
          radius: "100",
        },
      },
    });
  }

  async checkState(state, startDate) {
    await this.init();
    return this.sendMessage({
      data: {
        adaptivecards: {
          offerings: "covid",
          start: startDate,
          state,
          zipCode: "",
        },
      },
    });
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
