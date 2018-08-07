const nconf = require("nconf");
const config = nconf.file({"file": `${__dirname}/config.json`});
const WebSocket = require("ws");
const channels = ["master", "red", "green", "blue", "white"];
const spots = ["spot-1", "spot-2" , "spot-3", "spot-4"];
const webSockets = [];

const SerialPort = require('serialport');
const port = new SerialPort('/dev/ttyUSB0', {
  baudRate: 9600
}, function (err) {
  if (err) {
    return console.log('Error: ', err.message);
  }
});

class AbstractSpotConnection {
  constructor(device, channel) {
    this.socket =  new WebSocket(`ws://${config.get("server:host")}:${config.get("server:port")}/output/${device}/${channel}`, 'echo-protocol');
    this.socket.on('message', this.onMessage.bind(this));
  }

  async onMessage(message) {
    //Implement on message
  }
}

class SpotConnection extends AbstractSpotConnection {
  constructor(device, channel, deviceIndex) {
    super(device, channel);
    this.deviceIndex = deviceIndex;
    this.channelValue = 0;
  }

  async onMessage(message) {
    const data = message;
    const array = new Uint8Array(data);
    const value = array[0];
    if (value != this.channelValue) {
      this.channelValue = value;
      const command = `${this.deviceIndex},${value};`;
      port.write(command, (err) => {
        if (err) {
          return console.log('Error on write: ', err.message);
        }
        console.log(`sent ${value} message to channel ${this.deviceIndex}`);
      });
    }
  }
}

class MasterWaveConnection extends AbstractSpotConnection {
  constructor() {
    super("spot-all", "master-wave");
    this.enabled = false;
    this.masterChannels = [1, 11, 21, 31];
    this.currentValue = 0;
    this.currentIndex = 0;
    this.iterator = 0;
    this.deviceMultiplier = 1.2;
    this.iteratorAddition = 0.2;
    this.channelValueMap = [];
    setInterval(this.onProgress.bind(this), 50);
  }

  async onMessage(message) {
    const data = message;
    const array = new Uint8Array(data);
    const value = array[0];
    this.enabled = value > 50;
    this.iteratorAddition = (value - 50) / 500;
  }

  onProgress() {
    if (!this.enabled) {
      return;
    }

    for(let i = 0; i < this.masterChannels.length; i++) {
      const value = Math.min(Math.floor((Math.sin(i * this.deviceMultiplier + this.iterator) * 128 + 128)), 250);
      const channel = this.masterChannels[i];
      const command = `${channel},${value};`;
      if(this.channelValueMap[i] != value) {
        port.write(command, (err) => {
          if (err) {
            return console.log('Error on write: ', err.message);
          }
        });
      } 
      this.channelValueMap[i] = value;
    }

    this.iterator = this.iterator + this.iteratorAddition;
  }

}

new MasterWaveConnection();

channels.forEach((channel, channelIndex) => {
  spots.forEach((spot, spotIndex) => {
    const index = ((spotIndex * 10) + channelIndex) + 1;
    console.log(`Connected to spot ${spot} and channel ${channel} with index ${index}`);
    webSockets.push(new SpotConnection(spot, channel, index));
  });
});
