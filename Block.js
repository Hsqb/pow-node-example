function Block(_blockNumber=0, _prevHash=0, _nonce=0, _timestamp=parseInt(Date.now()/1000), _difficulty=1,_data=[]){
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

module.exports = Block;