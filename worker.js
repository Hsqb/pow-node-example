const PoWUtil = require('./powUtil');
module.exports = function(input, done){
        let hash, newNonceObj;
        while(true){
            hash = PoWUtil.getHashHex(input.prevHashVal +
                JSON.stringify(input.data) +
                input.timestamp +
                input.nonce);
            if(PoWUtil.isValidHash(hash, input.difficulty)){
                break;
            }else{
                newNonceObj = PoWUtil.getNextNonce(input.miningStrategy,
                                input.nonce, 
                                input.timestamp);
                input.nonce = newNonceObj.nonce; 
                input.timestamp = newNonceObj.timestamp;
            }
        }
        done(input);
    }