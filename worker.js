const PoWUtil = require('./powUtil');
module.exports = function(input, done){
        let hash, newNonceObj;
        while(true){
            hash = PoWUtil.getHashHex(input.prevHashVal +
                JSON.stringify(input.newBlockSources.data) +
                input.newBlockSources.timestamp +
                input.newBlockSources.nonce);
            if(PoWUtil.isValidHash(hash, input.newBlockSources.difficulty)){
                break;
            }else{
                newNonceObj = PoWUtil.getNextNonce(input.miningStrategy,
                                input.newBlockSources.nonce, 
                                input.newBlockSources.timestamp);
                input.newBlockSources.nonce = newNonceObj.nonce; 
                input.newBlockSources.timestamp = newNonceObj.timestamp;
            }       
            
        }
        done({hash:hash, newBlockSources:input.newBlockSources});
    }