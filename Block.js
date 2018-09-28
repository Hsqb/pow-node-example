const PoWUtil = require('./powUtil');

class Block{
    constructor(_blockNumber=0, _prevHash=PoWUtil.ZERO_HASH, _nonce=0, _timestamp=PoWUtil.getTimestamp(), _difficulty=1,_data=[]){
        this.header = {
            blockNumber : _blockNumber,
            prevHash    : _prevHash,
            nonce       : _nonce,
            timestamp   : _timestamp,
            difficulty  : _difficulty
        }
        this.body = {
            data : _data
        }
    };
}

module.exports = Block;