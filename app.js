const WebSocket = require('ws');
const channels = ["master", "red", "green", "blue", "white"];
const spots = ["spot-1", "spot-2", "spot-3", "spot-4"];
const webSockets = [];

const SerialPort = require('serialport');
const port = new SerialPort('/dev/ttyUSB0', {
  baudRate: 9600
}, function (err) {
  if (err) {
    return console.log('Error: ', err.message);
  }
});

class SpotConnection {
  constructor(device, channel, deviceIndex) {
    this.socket =  new WebSocket(`ws://192.168.8.106:3000/output/${device}/${channel}`, 'echo-protocol');
    this.socket.on('message', this.onMessage.bind(this));
    this.deviceIndex = deviceIndex;
    this.channelValue = 0;
  }

  blobToArrayBuffer(blob) {
    return new Promise((resolve) => {
      const fileReader = new FileReader();

      fileReader.onload = (event) => {
        resolve(event.target.result);
      };

      fileReader.readAsArrayBuffer(blob);
    });
  }

  async onMessage(message) {
    const data = message;
    const array = new Uint8Array(data);
    const value = array[0];
    if (value != this.channelValue) {
      this.channelValue = value;
      const command = `${this.deviceIndex},${value};`;
      port.write(command, function(err) {
        if (err) {
          return console.log('Error on write: ', err.message);
        }
        console.log(command);
      });
    } else {
      console.log("Value already set");
    }
  }
}

channels.forEach((channel, channelIndex) => {
  spots.forEach((spot, spotIndex) => {
    webSockets.push(new SpotConnection(spot, channel, ((spotIndex * 10) + channelIndex) + 1));
  });
})
