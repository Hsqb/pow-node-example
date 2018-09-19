const crypto = require('crypto');
const difficulty = process.argv[2] || 2;
const difficultyStr = getDifficultyStr();

let blockData = [];
var topology = require('fully-connected-topology');
/*
var t1 = topology('127.0.0.1:4001', ['127.0.0.1:4002', '127.0.0.1:4003']);
var t2 = topology('127.0.0.1:4002', ['127.0.0.1:4001', '127.0.0.1:4003']);
var t3 = topology('127.0.0.1:4003', ['127.0.0.1:4001', '127.0.0.1:4002']);

t1.on('connection', function(connection, peer) {
    console.log('t1 is connected to', peer);
  });
  
  t2.on('connection', function(connection, peer) {
    console.log('t2 is connected to', peer);
  });
  
  t3.on('connection', function(connection, peer) {
    console.log('t3 is connected to', peer);
  });*/
function Block(_blockNumber=0, _prevHash=0, _nonce=0, _data=[]){
    this.header = {
        blockNumber : _blockNumber,
        prevHash    : _prevHash,
        nonce       : _nonce,
        timestamp   : parseInt(Date.now()/1000)
    }
    this.body = {
        data : _data
    }
    this.toBinary = function(){
        return Buffer.concat([Buffer.from(new Uint32Array(Buffer.from([this.header.blockNumber,this.header.timestamp,this.header.nonce])).buffer), , Buffer.from[this.body.data]]);

        /*
            header
            blocknumber 4byte 
            timestamp   4byte
            nonce       4byte uint
            prevHash    32byte
            \n
            body
            data ~ 8byte
        */
        

    }
    function getInfo(){
        return "blockNumber : "+this.header.blockNumber +"\nprevHash : "+this.header.prevHash+"\nnonce : "+this.header.nonce+"\ntimestamp : "+this.header.timestamp+"\ndata : "+JSON.stringify(this.body.data);
    }
}


function getRandom(){
    return [parseInt(Math.random()* 1000)];
}

function miningBlock(){
    let lastBlock = blockData[blockData.length - 1];
    let hashed = "";
    let prevHashVal = lastBlock.prevHash;
    let data = getRandom();
    let timestamp = parseInt(Date.now()/1000);
    let nonce = 10000;
    while(true){
        
        hashed = getHashHex(prevHashVal+data+timestamp+nonce--);
        if(hashed.slice(0, difficulty) == difficultyStr)
            break;
        if(nonce < 0) {
            nonce = 10000;
            timestamp = parseInt(Date.now()/1000);
        }    
    }
    console.log("Get "+(blockData.length - 1)+" Block!");
    console.log(nonce);
    blockData.push(new Block(blockData.length, hashed, nonce, data));
    
}

for(let i = 0 ; i < 10 ; i++){
    if(blockData.length == 0){
        blockData.push(new Block(0, getHashHex("0"), 0));
        continue;
    }
    miningBlock();
}

console.log(JSON.stringify(blockData));
