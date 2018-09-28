const crypto = require('crypto');

const ZERO_HASH = "0000000000000000000000000000000000000000000000000000000000000000";
let memo = {};

const getTimestamp = () => { return parseInt(Date.now()/1000, 10) };
const getZeroStr = (count = 1) => {
    if(memo[count] != undefined) return memo[count];
    let str = ""
    for(let i = 0; i < count ; i++){
        str+=0;
    }
    memo[count] = str;
    return str;
}
const getRandomData = () => {
    return [parseInt(Math.random()* 1000)];
}

const getHashBuffer = (data) => {
    return crypto.createHash("sha256").update(data).digest();
}
const getHashHex = (data) => {
    return crypto.createHash("sha256").update(data).digest('hex');
}
const isValidHash = (hash, difficulty) => {
    return hash.slice(0, difficulty) === getZeroStr(difficulty);
}
const isValidChain = (prevBlock, currentBlock) => {
    return isValidHash(getHashFromBlock(prevBlock), prevBlock.header.difficulty) && 
           isValidHash(getHashFromBlock(currentBlock), currentBlock.header.difficulty) && 
           getHashFromBlock(prevBlock) == currentBlock.header.prevHash;
}

const getNextNonce = function(miningStrategy, nonce, timestamp){
    switch(miningStrategy){
        case 1 : //desence 
            nonce--;
            if(nonce < 0) {
                nonce = 10000;
                timestamp = parseInt(Date.now()/1000);
            }
            break;
            //random
        case 2 : 
            nonce = parseInt(Math.random() * 10000);
            if(timestamp + 3 < parseInt(Date.now()/1000) )
                timestamp = parseInt(Date.now()/1000);
            break;
            //asence
        case 0 : 
        default :
            nonce++;
            if(nonce > 10000) {
                nonce = 0;
                timestamp = parseInt(Date.now()/1000);
            }
            break;
    }
    return {nonce, timestamp};
}
const getHashFromBlock = (block) => {
    if(block.header.blockNumber === 0){
        return ZERO_HASH;
    } 
    let hash = getHashHex(block.header.prevHash + 
        JSON.stringify(block.body.data) + 
        block.header.timestamp + 
        block.header.nonce);
    if(isValidHash(hash, block.header.difficulty)){
        return hash;
    }else{
        return null;
    }
}

const writeOnSocket = (socket, data)=>{
    socket.write(JSON.stringify(data)+" ");
}

module.exports = {
    ZERO_HASH : ZERO_HASH,
    getTimestamp : getTimestamp,
    getZeroStr : getZeroStr,
    getRandomData : getRandomData,
    getHashBuffer : getHashBuffer,
    getHashHex : getHashHex,
    getNextNonce : getNextNonce,
    isValidHash : isValidHash,
    isValidChain : isValidChain,
    getHashFromBlock : getHashFromBlock,
    writeOnSocket : writeOnSocket
}