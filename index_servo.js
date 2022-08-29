const hive = require("@hiveio/hive-js")
const _ = require("lodash")

const MILLI_SECONDS_TO_COMPLETE = 3000
const MILLI_SECONDS_TO_COMPLETE_WITH_BUFFER = MILLI_SECONDS_TO_COMPLETE + 500
const HOME_DEGREES = 0
const TO_DEGREES = 180
const ACCOUNT_NAME = 'east.autovote'
const BLOCK_GET_INTERVAL = 2500;
const GLOBAL_GET_INTERVAL = 3000;
const RPC_URL = 'https://anyx.io';

var five = require("johnny-five");
var board = new five.Board({ port: "COM3" });

hive.api.setOptions({ url: RPC_URL });

function handler() {
  console.log('move complete')
}

function returnToHome(servo){
  if(servo.value === TO_DEGREES) {
    servo.to(HOME_DEGREES, MILLI_SECONDS_TO_COMPLETE);
  }
}

let end_block = 0;
let current_block = 0;

board.on("ready", function() {
  var servo = new five.Servo({
    pin: 9,
    startAt: 0
  });
  servo.on('move:complete', handler)

  board.repl.inject({
    servo: servo
  });

  setInterval(function () {
    hive.api.getDynamicGlobalProperties(function (err, result) {
      if (!_.isEmpty(result)) {
        if (current_block === 0) {
          current_block = result.head_block_number;
        }
        end_block = result.head_block_number;
      }
    });
  }, GLOBAL_GET_INTERVAL);

  setInterval(function () {
    if (current_block < end_block) {
      hive.api.getOpsInBlock(current_block, false, async function (err, result) {
        if (err) {
          console.log('get block error', err);
          return;
        }

        // process un-empty blocks only
        if (result && result.length > 0) {
          result.forEach(tx => {
            let tx_type = tx.op[0];
            let tx_data = tx.op[1];

            const isTransferTx = (tx_type === 'transfer')
            const isTransferToAccount = (tx_data.to === ACCOUNT_NAME)

            // Look for transfer transaction and is transfer to target account
            if (isTransferTx && isTransferToAccount) {
              console.log("received transfer from: ", tx_data.from)
              console.log('is transfer transaction to target account...')

              const isOneHive = (tx_data.amount === '1.000 HIVE')
              const isOneHbd = (tx_data.amount === '1.000 HBD')
              const containsMemo = (tx_data.memo && tx_data.memo.toLowerCase().indexOf('feed cat') >= 0)

              const amtNum = parseFloat(tx_data.amount.split(' ')[0]);

              if (amtNum >= 0.1 && amtNum < 0.2) {
                servo.to(60, MILLI_SECONDS_TO_COMPLETE);
              } else if (amtNum >= 0.2 && amtNum < 0.3) {
                servo.to(80, MILLI_SECONDS_TO_COMPLETE);
              } else if (amtNum >= 0.3) {
                servo.to(90, MILLI_SECONDS_TO_COMPLETE);
              }

              setTimeout(returnToHome.bind(null, servo), MILLI_SECONDS_TO_COMPLETE_WITH_BUFFER);

            }

          });
        }
      });
      current_block = current_block + 1;
    }
  }, BLOCK_GET_INTERVAL);

  /* Old codes
  // Stream Blockchain
  stream.on('data', async operation => {
    // Look for comment type of transaction
    if (operation.op[0] == 'transfer') {
      if (operation.op[1].to == ACCOUNT_NAME) {
        console.log("received transfer from: ", operation.op[1].from)
        servo.to(TO_DEGREES, MILLI_SECONDS_TO_COMPLETE);
        setTimeout(returnToHome.bind(null, servo), MILLI_SECONDS_TO_COMPLETE_WITH_BUFFER);
      }
    }
  })  // end: stream.on()
  */

});